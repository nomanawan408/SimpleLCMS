<?php

namespace Tests\Feature;

use App\Models\Matter;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

/**
 * Delegated administration: permissions that used to be firm_admin-only
 * now work through custom roles -- reports viewing/export, matter
 * assignment, and user management -- each with its own anti-escalation
 * rails (no touching admins, no self-promotion, no granting unheld power).
 */
class DelegatedAccessTest extends TestCase
{
    use RefreshDatabase;

    private function customRoleUser(string $firmId, array $permissions, string $roleName = 'Custom'): User
    {
        foreach ($permissions as $name) {
            Permission::firstOrCreate(['name' => $name, 'guard_name' => 'web']);
        }
        $role = Role::create(['name' => $roleName, 'guard_name' => 'web', 'firm_id' => $firmId]);
        $role->syncPermissions($permissions);
        $user = User::factory()->forFirm(\App\Models\Firm::find($firmId))->create(['role' => $roleName]);
        $user->assignRole($role);

        return $user->fresh();
    }

    // ── Reports ────────────────────────────────────────────────

    public function test_reports_need_view_reports_export_needs_export_data(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $auditor = $this->customRoleUser($firm->id, ['view_reports'], 'Auditor');

        $this->actingAsUser($auditor)->get('/reports')->assertOk();
        $this->actingAsUser($auditor)->get('/reports?export=csv&tab=financial')->assertForbidden();

        $exporter = $this->customRoleUser($firm->id, ['view_reports', 'export_data'], 'Exporter');
        $response = $this->actingAsUser($exporter)->get('/reports?export=csv&tab=financial');
        $response->assertOk();
        $this->assertStringContainsString('text/csv', $response->headers->get('Content-Type', ''));

        $plain = $this->customRoleUser($firm->id, ['view_contacts'], 'Clerk');
        $this->actingAsUser($plain)->get('/reports')->assertForbidden();
    }

    // ── Assignment delegation ──────────────────────────────────

    public function test_manage_assignments_delegates_team_changes(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $matter = Matter::factory()->forFirm($firm)->create(['status' => 'open']);
        $lead = $this->customRoleUser(
            $firm->id,
            ['view_matters', 'edit_matters', 'manage_assignments'],
            'TeamLead'
        );
        $this->assignToMatter($lead, $matter);
        $outsider = User::factory()->forFirm($firm)->create(['role' => 'lawyer']);
        $this->assignFirmRole($outsider, 'lawyer');

        $this->actingAsUser($lead)->put("/matters/{$matter->id}", [
            'name' => $matter->name,
            'assignee_ids' => [$lead->id, $outsider->id],
        ])->assertSessionHasNoErrors();

        $this->assertTrue($matter->fresh()->isAssignedTo($outsider));
    }

    // ── User management delegation ─────────────────────────────

    private function manager(string $firmId, array $permissions): User
    {
        return $this->customRoleUser($firmId, $permissions, 'Manager' . substr(md5(implode(',', $permissions)), 0, 6));
    }

    public function test_view_only_manager_reads_but_writes_nothing(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $viewer = $this->manager($firm->id, ['view_users']);

        $this->actingAsUser($viewer)->get('/admin/users')->assertOk();
        $this->actingAsUser($viewer)->post('/admin/users', [
            'full_name' => 'Nope', 'email' => 'nope@example.com',
            'password' => 'Password123!', 'password_confirmation' => 'Password123!',
            'role' => 'lawyer',
        ])->assertForbidden();
    }

    public function test_manager_runs_user_crud_but_cannot_touch_admins_or_escalate(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $manager = $this->manager($firm->id, ['manage_users']);

        // Ordinary CRUD works, including lawyer assignment.
        $this->actingAsUser($manager)->post('/admin/users', [
            'full_name' => 'New Hire', 'email' => 'hire@example.com',
            'password' => 'Password123!', 'password_confirmation' => 'Password123!',
            'role' => 'lawyer',
        ])->assertRedirect();
        $hire = User::where('email', 'hire@example.com')->firstOrFail();
        $this->assertTrue($hire->hasRole('lawyer'));

        // Promoting to firm_admin is refused (would hand over the firm).
        $this->actingAsUser($manager)->post('/admin/users', [
            'full_name' => 'Sneaky', 'email' => 'sneaky@example.com',
            'password' => 'Password123!', 'password_confirmation' => 'Password123!',
            'role' => 'firm_admin',
        ])->assertForbidden();
        $this->assertDatabaseMissing('users', ['email' => 'sneaky@example.com']);

        // Admin accounts are untouchable: update, delete, password reset.
        $this->actingAsUser($manager)->put("/admin/users/{$admin->id}", ['full_name' => 'Pwned'])
            ->assertForbidden();
        $this->actingAsUser($manager)->delete("/admin/users/{$admin->id}")->assertForbidden();
        $this->actingAsUser($manager)->put("/admin/users/{$admin->id}/reset-password", [
            'password' => 'Password123!', 'password_confirmation' => 'Password123!',
        ])->assertForbidden();

        // No self-promotion and no self-granted finance flags.
        $this->actingAsUser($manager)->put("/admin/users/{$manager->id}", ['role' => 'lawyer'])
            ->assertForbidden();
        $this->actingAsUser($manager)->put("/admin/users/{$manager->id}", ['can_manage_finances' => true])
            ->assertForbidden();

        // Ordinary edit of a peer works, deactivation works (manage verbs).
        $this->actingAsUser($manager)->put("/admin/users/{$hire->id}", ['full_name' => 'New Hire Esq'])
            ->assertSessionHasNoErrors();
        $this->actingAsUser($manager)->put("/admin/users/{$hire->id}", ['is_active' => false])
            ->assertSessionHasNoErrors();
        $this->assertFalse((bool) $hire->fresh()->is_active);
    }

    public function test_edit_only_manager_cannot_deactivate(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $editor = $this->manager($firm->id, ['edit_users']);
        $peer = User::factory()->forFirm($firm)->create(['role' => 'lawyer']);
        $this->assignFirmRole($peer, 'lawyer');

        $this->actingAsUser($editor)->put("/admin/users/{$peer->id}", ['full_name' => 'Renamed'])
            ->assertSessionHasNoErrors();
        $this->actingAsUser($editor)->put("/admin/users/{$peer->id}", ['is_active' => false])
            ->assertForbidden();
        $this->assertTrue((bool) $peer->fresh()->is_active);
    }

    public function test_settings_team_tab_opens_without_roles_tab(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $manager = $this->manager($firm->id, ['manage_users']);

        $this->actingAsUser($manager)->get('/settings')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('canManageTeam', true)
                ->where('canManageRoles', false)
                ->has('users')
                ->missing('roles'));

        [$firm2, $lawyer] = $this->createFirmAndUser(['role' => 'lawyer']);
        $this->actingAsUser($lawyer)->get('/settings')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('canManageTeam', false)
                ->missing('users'));
    }
}
