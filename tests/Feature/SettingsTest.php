<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class SettingsTest extends TestCase
{
    use RefreshDatabase;

    public function test_settings_page_exposes_prefs_firm_and_team(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();

        $this->actingAsUser($admin)->get('/settings')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('preferences.theme', 'light')
                ->where('canEditFirm', true)
                ->where('canManageTeam', true)
                ->where('firm.id', $firm->id)
                ->has('users')
                ->has('availableRoles')
                ->has('roles')
                ->has('groupedPermissions'));
    }

    public function test_non_admin_gets_no_firm_or_team_payload(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $user = User::factory()->forFirm($firm)->create(['role' => 'solicitor']);
        $user->assignRole('solicitor');

        $this->actingAsUser($user)->get('/settings')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('canEditFirm', false)
                ->where('canManageTeam', false)
                ->where('firm', null)
                ->missing('users')
                ->missing('roles'));
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

    public function test_platform_roles_are_hidden_in_firm_context(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();

        $this->actingAsUser($admin)->get('/settings')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('roles', fn ($roles) => collect($roles)->pluck('name')->doesntContain('super_admin'))
                ->where('availableRoles', fn ($roles) => collect($roles)->pluck('name')->doesntContain('super_admin')));

        $this->actingAsUser($admin)->get('/admin/roles')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('roles', fn ($roles) => collect($roles)->pluck('name')->doesntContain('super_admin')));
    }

    public function test_removed_firm_endpoint_stays_gone(): void
    {
        // Firm edits live only in the embedded Company form (PUT /admin/firm);
        // a standalone settings mutation path must not exist.
        [$firm, $admin] = $this->createFirmAndAdmin();

        $this->actingAsUser($admin)->put('/settings/firm', ['vat_rate' => 5])
            ->assertNotFound();
    }
}
