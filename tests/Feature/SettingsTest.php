<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class SettingsTest extends TestCase
{
    use RefreshDatabase;

    public function test_settings_page_exposes_prefs_and_firm_defaults(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();

        $this->actingAsUser($admin)->get('/settings')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('preferences.theme', 'light')
                ->where('canEditFirm', true)
                ->where('firmDefaults.vat_rate', fn ($v) => (float) $v === (float) $firm->vat_rate));
    }

    public function test_non_admin_cannot_edit_firm_but_sees_the_page(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $user = User::factory()->forFirm($firm)->create(['role' => 'solicitor']);
        $user->assignRole('solicitor');

        $this->actingAsUser($user)->get('/settings')
            ->assertOk()
            ->assertInertia(fn ($page) => $page->where('canEditFirm', false));

        $this->actingAsUser($user)->put('/settings/firm', ['vat_rate' => 5])
            ->assertForbidden();
        $this->assertNotEquals(5, (float) $firm->fresh()->vat_rate);
    }

    public function test_profile_update_changes_own_record_only(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $other = User::factory()->forFirm($firm)->create(['role' => 'solicitor']);

        $this->actingAsUser($admin)->put('/settings/profile', [
            'full_name' => 'New Name', 'phone' => '+44 7700 000099', 'email' => 'hacked@example.com',
        ])->assertRedirect()->assertSessionHasNoErrors();

        $admin->refresh();
        $this->assertSame('New Name', $admin->full_name);
        $this->assertSame('+44 7700 000099', $admin->phone);
        $this->assertNotEquals('hacked@example.com', $admin->email);
        $this->assertSame('New Name', $admin->full_name);
        $this->assertDatabaseMissing('users', ['email' => 'hacked@example.com']);
        $this->assertSame($other->full_name, $other->fresh()->full_name);
    }

    public function test_preferences_merge_and_validate_theme(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $admin->forceFill(['preferences' => ['theme' => 'light', 'other_key' => 'keep-me']])->save();

        $this->actingAsUser($admin)->put('/settings/preferences', ['theme' => 'dark'])
            ->assertRedirect()->assertSessionHasNoErrors();

        $prefs = $admin->fresh()->preferences;
        $this->assertSame('dark', $prefs['theme']);
        $this->assertSame('keep-me', $prefs['other_key']);

        $this->actingAsUser($admin)->put('/settings/preferences', ['theme' => 'neon'])
            ->assertSessionHasErrors('theme');
    }

    public function test_password_change_requires_current_and_strong_new(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();

        // Wrong current password.
        $this->actingAsUser($admin)->put('/settings/password', [
            'current_password' => 'wrong-password',
            'password' => 'NewStrongPassword123!',
            'password_confirmation' => 'NewStrongPassword123!',
        ])->assertSessionHasErrors('current_password');

        // Weak new password.
        $this->actingAsUser($admin)->put('/settings/password', [
            'current_password' => 'password',
            'password' => 'short',
            'password_confirmation' => 'short',
        ])->assertSessionHasErrors('password');

        // Success (factory password is 'password').
        $this->actingAsUser($admin)->put('/settings/password', [
            'current_password' => 'password',
            'password' => 'NewStrongPassword123!',
            'password_confirmation' => 'NewStrongPassword123!',
        ])->assertRedirect()->assertSessionHasNoErrors();

        $this->assertTrue(Hash::check('NewStrongPassword123!', $admin->fresh()->password));
    }

    public function test_firm_defaults_update_with_validation(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();

        $this->actingAsUser($admin)->put('/settings/firm', ['vat_rate' => 150])
            ->assertSessionHasErrors('vat_rate');

        $this->actingAsUser($admin)->put('/settings/firm', [
            'vat_rate' => 20, 'invoice_prefix' => 'SL', 'payment_terms_days' => 14, 'default_hourly_rate' => 300,
        ])->assertRedirect()->assertSessionHasNoErrors();

        $firm->refresh();
        $this->assertEquals(20, (float) $firm->vat_rate);
        $this->assertSame('SL', $firm->invoice_prefix);
        $this->assertSame(14, (int) $firm->payment_terms_days);
    }
}
