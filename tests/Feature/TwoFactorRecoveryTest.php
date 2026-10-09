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
            ->post('/two-factor/enable', [
                'password' => 'password',
                'code' => $this->otp('ABCDEFGHIJKLMNOP'),
            ]);

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

    public function test_enable_requires_the_password_not_just_a_code(): void
    {
        [$firm, $user] = $this->createFirmAndUser();
        $user->forceFill(['totp_secret' => 'ABCDEFGHIJKLMNOP'])->save();

        // No password at all.
        $this->actingAsUser($user)
            ->post('/two-factor/enable', ['code' => $this->otp('ABCDEFGHIJKLMNOP')])
            ->assertSessionHasErrors('password');
        $this->assertFalse((bool) $user->fresh()->totp_enabled);

        // Wrong password with a live code.
        $this->actingAsUser($user->fresh())
            ->post('/two-factor/enable', [
                'password' => 'not-the-password',
                'code' => $this->otp('ABCDEFGHIJKLMNOP'),
            ])
            ->assertSessionHasErrors('password');
        $this->assertFalse((bool) $user->fresh()->totp_enabled);
    }

    public function test_recovery_code_works_with_or_without_dashes(): void
    {
        [$firm, $user] = $this->enabledUser();

        // Dashes omitted and lowercase: still the same code.
        $this->actingAs($user)
            ->post('/two-factor', ['code' => 'aaaabbbbcccc'])
            ->assertRedirect(route('dashboard'));
        $this->assertCount(1, $user->fresh()->totp_recovery_codes);
    }

    public function test_firm_admin_can_reset_a_staff_members_2fa(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        [$f, $staff] = $this->createFirmAndUser();
        $staff->forceFill(['firm_id' => $firm->id])->save();
        $this->assignFirmRole($staff->fresh(), 'lawyer');
        $staff = $staff->fresh();
        $staff->forceFill([
            'totp_enabled' => true,
            'totp_secret' => 'ABCDEFGHIJKLMNOP',
            'totp_recovery_codes' => [Hash::make('AAAA-BBBB-CCCC')],
            'locked_until' => now()->addMinutes(15),
        ])->save();

        $this->actingAsUser($admin)
            ->post("/admin/users/{$staff->id}/reset-two-factor")
            ->assertRedirect();

        $fresh = $staff->fresh();
        $this->assertFalse((bool) $fresh->totp_enabled);
        $this->assertNull($fresh->totp_secret);
        $this->assertNull($fresh->totp_recovery_codes);
        $this->assertNull($fresh->locked_until);

        $this->assertDatabaseHas('activity_log', [
            'description' => 'totp_reset_by_admin',
            'subject_id' => $staff->id,
        ]);
    }

    public function test_2fa_reset_is_admin_only_and_never_self_or_admin_targets(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        [$f, $staff] = $this->createFirmAndUser();
        $staff->forceFill(['firm_id' => $firm->id])->save();
        $staff = $staff->fresh();
        $staff->forceFill(['totp_enabled' => true, 'totp_secret' => 'ABCDEFGHIJKLMNOP'])->save();

        // Delegated user-manager: every other user power, but not this one.
        $manager = \App\Models\User::factory()->forFirm($firm)->create(['role' => 'lawyer']);
        $this->assignFirmRole($manager, 'lawyer');
        $manager->givePermissionTo('manage_users');

        $this->actingAsUser($manager->fresh())
            ->post("/admin/users/{$staff->id}/reset-two-factor")
            ->assertForbidden();
        $this->assertTrue((bool) $staff->fresh()->totp_enabled);

        // Self-reset would bypass the disable guards (password + live code).
        $admin->forceFill(['totp_enabled' => true, 'totp_secret' => 'ABCDEFGHIJKLMNOP'])->save();
        $this->actingAsUser($admin)
            ->post("/admin/users/{$admin->id}/reset-two-factor")
            ->assertForbidden();
        $this->assertTrue((bool) $admin->fresh()->totp_enabled);

        // Another admin's second factor is untouchable.
        [$firm2, $admin2] = $this->createFirmAndAdmin();
        $this->actingAsUser($admin)
            ->post("/admin/users/{$admin2->id}/reset-two-factor")
            ->assertForbidden();
    }

    public function test_password_change_kills_other_sessions(): void
    {
        [$firm, $user] = $this->createFirmAndUser();

        // Establish a session (stores the current password hash in it).
        $this->actingAs($user)->get('/dashboard')->assertOk();

        // Password changes behind this session's back (admin reset, reset link).
        $user->forceFill(['password' => Hash::make('ChangedPassword123!')])->save();

        // The stale session no longer verifies: signed out on next request.
        $this->get('/dashboard')->assertRedirect(route('login'));
    }
}
