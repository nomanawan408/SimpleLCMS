<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

/**
 * Access model: Spatie RBAC with three built-in roles plus firm custom roles.
 *
 *  - super_admin: platform owner, everything everywhere (platform console only).
 *  - firm_admin: everything within their firm, holds every permission so any
 *    permission can be granted onward to custom roles (assertGrantable).
 *  - lawyer: the default firm role. Working case-management permissions;
 *    visibility is further narrowed per record by matter assignment, money
 *    visibility by the two financial grants below.
 *  - custom roles: created per firm from the application (Roles screen),
 *    carrying any subset of the vocabulary below. Firm-scoped (firm_id).
 *
 * Lawyer financial access is additionally grantable per user (firm admin
 * toggles it on the user record): two lawyers can hold different access.
 */
class RolePermissionSeeder extends Seeder
{
    public function run(): void
    {
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        $permissions = [
            'view_dashboard',
            'manage_matters',
            'view_matters',
            'create_matters',
            'edit_matters',
            'delete_matters',
            'manage_contacts',
            'view_contacts',
            'create_contacts',
            'edit_contacts',
            'delete_contacts',
            'manage_time_entries',
            'view_time_entries',
            'create_time_entries',
            'edit_time_entries',
            'delete_time_entries',
            'manage_expenses',
            'create_expenses',
            'edit_expenses',
            'delete_expenses',
            'manage_documents',
            'view_documents',
            'upload_documents',
            'delete_documents',
            'manage_calendar',
            'view_calendar',
            'create_events',
            'edit_events',
            'delete_events',
            'manage_tasks',
            'view_tasks',
            'create_tasks',
            'edit_tasks',
            'delete_tasks',
            'post_ledger',
            'transfer_client_funds',
            'view_reports', 'export_data',
            'manage_assignments',
            'manage_users', 'view_users', 'create_users', 'edit_users', 'delete_users',
            'view_finances',
            'manage_finances',
        ];

        foreach ($permissions as $permission) {
            Permission::firstOrCreate(['name' => $permission, 'guard_name' => 'web']);
        }

        $superAdmin = Role::firstOrCreate(['name' => 'super_admin', 'guard_name' => 'web', 'firm_id' => null]);
        $superAdmin->update(['is_system' => true, 'description' => 'SaaS platform owner with full platform access']);
        $superAdmin->syncPermissions(Permission::all());

        $firmAdmin = Role::firstOrCreate(['name' => 'firm_admin', 'guard_name' => 'web', 'firm_id' => null]);
        $firmAdmin->update(['is_system' => true, 'description' => 'Firm administrator with full operational, financial and administrative access']);
        $firmAdmin->syncPermissions(Permission::all());

        // Lawyer template (shared row): the default firm role. Day-to-day
        // case work on assigned matters; money visibility comes from the
        // financial grants instead. Each firm gets its own editable copy on
        // creation (ProvisionsFirmRoles); this shared row is never assigned.
        // Single definition lives in DefaultRoles::LAWYER_PERMISSIONS.
        $lawyer = Role::firstOrCreate(['name' => 'lawyer', 'guard_name' => 'web', 'firm_id' => null]);
        $lawyer->update(['is_system' => true, 'description' => 'Lawyer. Sees only assigned matters; finances only with explicit grants.']);
        $lawyer->syncPermissions(\App\Support\DefaultRoles::LAWYER_PERMISSIONS);

        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        $this->command->info('Roles and permissions updated successfully.');
    }
}
