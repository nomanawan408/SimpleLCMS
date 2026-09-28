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
            'view_expenses',
            'create_expenses',
            'edit_expenses',
            'delete_expenses',
            'manage_expenses',
            'view_expenses',
            'create_expenses',
            'edit_expenses',
            'delete_expenses',
            'manage_invoices',
            'view_invoices',
            'create_invoices',
            'edit_invoices',
            'delete_invoices',
            'manage_trust',
            'view_trust',
            'create_trust_entries',
            'edit_trust_entries',
            'delete_trust_entries',
            'manage_documents',
            'view_documents',
            'upload_documents',
            'delete_documents',
            'manage_users',
            'view_users',
            'create_users',
            'edit_users',
            'delete_users',
            'manage_firm',
            'view_firm_settings',
            'edit_firm_settings',
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
            'view_reports',
            'export_data',
            'view_ledger',
            'post_ledger',
            'transfer_client_funds',
            'reverse_ledger_entries',
            'run_reconciliation',
            'view_finances',
            'manage_finances',
        ];

        foreach ($permissions as $permission) {
            Permission::firstOrCreate(['name' => $permission, 'guard_name' => 'web']);
        }

        $superAdmin = Role::firstOrCreate(['name' => 'super_admin', 'guard_name' => 'web']);
        $superAdmin->update(['is_system' => true, 'description' => 'SaaS platform owner with full platform access']);
        $superAdmin->syncPermissions(Permission::all());

        $firmAdmin = Role::firstOrCreate(['name' => 'firm_admin', 'guard_name' => 'web']);
        $firmAdmin->update(['is_system' => true, 'description' => 'Firm administrator with full operational, financial and administrative access']);
        $firmAdmin->syncPermissions(Permission::all());

        // Lawyer: the default firm role. Day-to-day case work on assigned
        // matters; money visibility comes from the financial grants instead.
        $lawyer = Role::firstOrCreate(['name' => 'lawyer', 'guard_name' => 'web']);
        $lawyer->update(['is_system' => true, 'description' => 'Lawyer. Sees only assigned matters; finances only with explicit grants.']);
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

        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        $this->command->info('Roles and permissions updated successfully.');
    }
}
