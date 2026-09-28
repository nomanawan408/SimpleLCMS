<?php

namespace Tests;

use App\Models\Firm;
use App\Models\User;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;

abstract class TestCase extends BaseTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutMiddleware([
            \Illuminate\Foundation\Http\Middleware\PreventRequestForgery::class,
        ]);

        config(['inertia.testing.ensure_pages_exist' => false]);

        $this->seedRolesAndPermissions();
    }

    protected function seedRolesAndPermissions(): void
    {
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        // Mirrors production (RolePermissionSeeder): the lawyer working set.
        // Visibility still comes from matter assignment and money visibility
        // from the two grants below — permissions unlock modules, assignment
        // unlocks records. Tests needing other vocabulary rows create them
        // on demand via firstOrCreate.
        foreach (array_merge([
            'view_dashboard',
            'view_matters', 'create_matters', 'edit_matters',
            'view_contacts', 'create_contacts', 'edit_contacts',
            'view_time_entries', 'create_time_entries', 'edit_time_entries',
            'create_expenses', 'edit_expenses', 'delete_expenses',
            'view_documents', 'upload_documents',
            'view_calendar', 'create_events', 'edit_events',
            'view_tasks', 'create_tasks', 'edit_tasks',
            'view_ledger', 'post_ledger',
        ], ['view_finances', 'manage_finances']) as $permission) {
            Permission::firstOrCreate(['name' => $permission, 'guard_name' => 'web']);
        }

        $superAdmin = Role::firstOrCreate(['name' => 'super_admin', 'guard_name' => 'web']);
        $superAdmin->update(['is_system' => true]);
        $superAdmin->syncPermissions(Permission::all());

        $firmAdmin = Role::firstOrCreate(['name' => 'firm_admin', 'guard_name' => 'web']);
        $firmAdmin->update(['is_system' => true]);
        $firmAdmin->syncPermissions(Permission::all());

        $lawyer = Role::firstOrCreate(['name' => 'lawyer', 'guard_name' => 'web']);
        $lawyer->update(['is_system' => true]);
        $lawyer->syncPermissions([
            'view_dashboard',
            'view_matters', 'create_matters', 'edit_matters',
            'view_contacts', 'create_contacts', 'edit_contacts',
            'view_time_entries', 'create_time_entries', 'edit_time_entries',
            'create_expenses', 'edit_expenses', 'delete_expenses',
            'view_documents', 'upload_documents',
            'view_calendar', 'create_events', 'edit_events',
            'view_tasks', 'create_tasks', 'edit_tasks',
            'view_ledger', 'post_ledger',
        ]);
    }

    protected function createFirmAndAdmin(array $firmAttrs = [], array $userAttrs = []): array
    {
        $firm  = Firm::factory()->create($firmAttrs);
        $admin = User::factory()->firmAdmin()->forFirm($firm)->create($userAttrs);
        $admin->assignRole('firm_admin');
        return [$firm, $admin];
    }

    protected function createFirmAndUser(array $userAttrs = []): array
    {
        $firm = Firm::factory()->create();
        $user = User::factory()->forFirm($firm)->create($userAttrs);
        $role = $user->role;
        if (Role::where('name', $role)->exists()) {
            $user->assignRole($role);
        }
        return [$firm, $user];
    }

    /**
     * Assign a user to a matter (the visibility gate for non-admins).
     */
    protected function assignToMatter(User $user, \App\Models\Matter $matter): void
    {
        $matter->assignees()->syncWithoutDetaching([$user->id]);
    }

    /**
     * Grant financial access. $manage implies view (both flags are set).
     */
    protected function grantFinances(User $user, bool $manage = false): void
    {
        $user->givePermissionTo($manage ? ['view_finances', 'manage_finances'] : ['view_finances']);
    }

    protected function actingAsUser(User $user): static
    {
        $this->actingAs($user);
        session(['totp_verified' => true]);
        return $this;
    }
}
