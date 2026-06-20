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

        $permissions = [
            'view_dashboard',
            'manage_matters', 'view_matters', 'create_matters', 'edit_matters', 'delete_matters',
            'manage_contacts', 'view_contacts', 'create_contacts', 'edit_contacts', 'delete_contacts',
            'manage_time_entries', 'view_time_entries', 'create_time_entries', 'edit_time_entries', 'delete_time_entries',
            'manage_expenses', 'view_expenses', 'create_expenses', 'edit_expenses', 'delete_expenses',
            'manage_invoices', 'view_invoices', 'create_invoices', 'edit_invoices', 'delete_invoices',
            'manage_trust', 'view_trust', 'create_trust_entries', 'edit_trust_entries', 'delete_trust_entries',
            'manage_documents', 'view_documents', 'upload_documents', 'delete_documents',
            'manage_users', 'view_users', 'create_users', 'edit_users', 'delete_users',
            'manage_firm', 'view_firm_settings', 'edit_firm_settings',
            'manage_calendar', 'view_calendar', 'create_events', 'edit_events', 'delete_events',
            'manage_tasks', 'view_tasks', 'create_tasks', 'edit_tasks', 'delete_tasks',
            'view_reports', 'export_data',
        ];

        foreach ($permissions as $permission) {
            Permission::firstOrCreate(['name' => $permission, 'guard_name' => 'web']);
        }

        $superAdmin = Role::firstOrCreate(['name' => 'super_admin', 'guard_name' => 'web']);
        $superAdmin->update(['is_system' => true]);
        $superAdmin->syncPermissions(Permission::all());

        $admin = Role::firstOrCreate(['name' => 'admin', 'guard_name' => 'web']);
        $admin->update(['is_system' => true]);
        $admin->syncPermissions([
            'view_dashboard',
            'manage_matters', 'view_matters', 'create_matters', 'edit_matters',
            'manage_contacts', 'view_contacts', 'create_contacts', 'edit_contacts',
            'manage_time_entries', 'view_time_entries', 'create_time_entries', 'edit_time_entries',
            'manage_expenses', 'view_expenses', 'create_expenses', 'edit_expenses',
            'manage_invoices', 'view_invoices', 'create_invoices', 'edit_invoices',
            'manage_trust', 'view_trust', 'create_trust_entries', 'edit_trust_entries',
            'manage_documents', 'view_documents', 'upload_documents',
            'manage_users', 'view_users', 'create_users', 'edit_users', 'delete_users',
            'view_firm_settings',
            'manage_calendar', 'view_calendar', 'create_events', 'edit_events',
            'manage_tasks', 'view_tasks', 'create_tasks', 'edit_tasks',
            'view_reports', 'export_data',
        ]);

        $solicitor = Role::firstOrCreate(['name' => 'solicitor', 'guard_name' => 'web']);
        $solicitor->update(['is_system' => true]);
        $solicitor->syncPermissions([
            'view_dashboard',
            'view_matters', 'create_matters', 'edit_matters',
            'view_contacts', 'create_contacts', 'edit_contacts',
            'view_time_entries', 'create_time_entries', 'edit_time_entries',
            'view_expenses', 'create_expenses',
            'view_documents', 'upload_documents',
            'view_calendar', 'create_events',
            'view_tasks', 'create_tasks', 'edit_tasks',
            'view_reports',
        ]);

        $paralegal = Role::firstOrCreate(['name' => 'paralegal', 'guard_name' => 'web']);
        $paralegal->update(['is_system' => true]);
        $paralegal->syncPermissions([
            'view_dashboard',
            'view_matters',
            'view_contacts', 'create_contacts', 'edit_contacts',
            'view_time_entries', 'create_time_entries',
            'view_documents', 'upload_documents',
            'view_calendar',
            'view_tasks', 'create_tasks',
        ]);

        $secretary = Role::firstOrCreate(['name' => 'secretary', 'guard_name' => 'web']);
        $secretary->update(['is_system' => true]);
        $secretary->syncPermissions([
            'view_dashboard',
            'view_matters',
            'view_contacts',
            'view_time_entries',
            'view_documents', 'upload_documents',
            'view_calendar',
            'view_tasks',
        ]);

        foreach (['clerk', 'lawyer', 'barrister', 'consultant', 'manager', 'accounts', 'administrator'] as $name) {
            Role::firstOrCreate(['name' => $name, 'guard_name' => 'web']);
        }
    }

    protected function createFirmAndAdmin(array $firmAttrs = [], array $userAttrs = []): array
    {
        $firm  = Firm::factory()->create($firmAttrs);
        $admin = User::factory()->firmAdmin()->forFirm($firm)->create($userAttrs);
        $admin->assignRole('admin');
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

    protected function actingAsUser(User $user): static
    {
        $this->actingAs($user);
        session(['totp_verified' => true]);
        return $this;
    }
}
