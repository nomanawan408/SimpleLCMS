<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use PragmaRX\Google2FA\Google2FA;
use Tests\TestCase;

class TwoFactorRecoveryTest extends TestCase
{
    use RefreshDatabase;

    private function otp(string $secret): string
    {
        return app(Google2FA::class)->getCurrentOtp($secret);
    }

    private function enabledUser(): array
    {
        [$firm, $user] = $this->createFirmAndUser();
        $user->forceFill([
            'totp_enabled' => true,
            'totp_secret' => 'ABCDEFGHIJKLMNOP',
            'totp_recovery_codes' => [Hash::make('AAAA-BBBB-CCCC'), Hash::make('DDDD-EEEE-FFFF')],
        ])->save();

        return [$firm, $user->fresh()];
    }

    public function test_enable_issues_recovery_codes_shown_once(): void
    {
        [$firm, $user] = $this->createFirmAndUser();
        $user->forceFill(['totp_secret' => 'ABCDEFGHIJKLMNOP'])->save();

        $response = $this->actingAsUser($user)
            ->post('/two-factor/enable', ['code' => $this->otp('ABCDEFGHIJKLMNOP')]);

        $response->assertRedirect(route('two-factor.recovery'));
        $codes = session('recovery_codes');
        $this->assertCount(8, $codes);
        $this->assertMatchesRegularExpression('/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/', $codes[0]);

        // Stored hashed, never plaintext.
        $stored = $user->fresh()->totp_recovery_codes;
        $this->assertCount(8, $stored);
        foreach ($codes as $i => $plain) {
            $this->assertTrue(Hash::check($plain, $stored[$i]));
            $this->assertNotContains($plain, $stored);
        }

        // First visit renders; revisit finds nothing (flash consumed).
        $this->actingAsUser($user->fresh())->get('/two-factor/recovery-codes')->assertOk();
        $this->actingAsUser($user->fresh())->get('/two-factor/recovery-codes')->assertRedirect('/dashboard');
    }

    public function test_recovery_code_signs_in_once_then_dies(): void
    {
        [$firm, $user] = $this->enabledUser();

        $this->actingAs($user)
            ->post('/two-factor', ['code' => 'AAAA-BBBB-CCCC'])
            ->assertRedirect(route('dashboard'));
        $this->assertCount(1, $user->fresh()->totp_recovery_codes);

        // Same code again: invalid (counts as a miss, audited).
        $this->actingAs($user)
            ->post('/two-factor', ['code' => 'AAAA-BBBB-CCCC'])
            ->assertSessionHasErrors('code');
        $this->assertSame(1, $user->fresh()->totp_failed_count);
    }

    public function test_recovery_misses_count_toward_lockout(): void
    {
        [$firm, $user] = $this->enabledUser();

        for ($i = 0; $i < 5; $i++) {
            $this->actingAs($user)->post('/two-factor', ['code' => 'WRONG-CODE-' . $i . 'X']);
        }

        $this->assertNotNull($user->fresh()->locked_until);
    }

    public function test_regenerate_rotates_codes_and_disable_clears_them(): void
    {
        [$firm, $user] = $this->enabledUser();

        $this->actingAsUser($user)->post('/two-factor/recovery-codes', [
            'password' => 'password',
            'code' => $this->otp('ABCDEFGHIJKLMNOP'),
        ])->assertRedirect(route('two-factor.recovery'));
        $this->assertCount(8, session('recovery_codes'));

        // Old codes are dead.
        $this->actingAs($user->fresh())
            ->post('/two-factor', ['code' => 'DDDD-EEEE-FFFF'])
            ->assertSessionHasErrors('code');

        // Disable wipes everything second-factor.
        $this->actingAsUser($user->fresh())->delete('/two-factor', [
            'password' => 'password',
            'code' => $this->otp('ABCDEFGHIJKLMNOP'),
        ])->assertRedirect();
        $fresh = $user->fresh();
        $this->assertFalse((bool) $fresh->totp_enabled);
        $this->assertNull($fresh->totp_secret);
        $this->assertNull($fresh->totp_recovery_codes);
    }
}
