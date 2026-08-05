<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;

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
        ];

        foreach ($permissions as $permission) {
            Permission::firstOrCreate(['name' => $permission, 'guard_name' => 'web']);
        }

        // ── Super Admin (SaaS platform owner — not scoped to a firm) ──
        $superAdmin = Role::firstOrCreate(['name' => 'super_admin', 'guard_name' => 'web']);
        $superAdmin->update(['is_system' => true, 'description' => 'SaaS platform owner with full platform access']);
        $superAdmin->syncPermissions(Permission::all());

        // ── Firm Admin (consolidated from legacy admin / administrator) ──
        $firmAdmin = Role::firstOrCreate(['name' => 'firm_admin', 'guard_name' => 'web']);
        $firmAdmin->update(['is_system' => true, 'description' => 'Firm administrator with full operational, financial and administrative access']);
        $firmAdmin->syncPermissions(Permission::all());

        // Merge any legacy admin / administrator roles into firm_admin (reassign
        // users, carry over permissions, then drop the legacy roles).
        foreach (['admin', 'administrator'] as $legacyName) {
            $legacy = Role::where('name', $legacyName)->where('guard_name', 'web')->first();
            if (! $legacy) {
                continue;
            }

            foreach (\App\Models\User::role($legacyName)->get() as $user) {
                $user->assignRole('firm_admin');
            }
            $firmAdmin->givePermissionTo($legacy->permissions->pluck('name'));
            $legacy->delete();
        }

        // ── Manager ──
        $manager = Role::firstOrCreate(['name' => 'manager', 'guard_name' => 'web']);
        $manager->update(['is_system' => true, 'description' => 'Manager with team oversight and reporting access']);
        $manager->syncPermissions([
            'view_dashboard',
            'manage_matters', 'view_matters', 'create_matters', 'edit_matters',
            'manage_contacts', 'view_contacts', 'create_contacts', 'edit_contacts',
            'manage_time_entries', 'view_time_entries', 'create_time_entries', 'edit_time_entries',
            'manage_documents', 'view_documents', 'upload_documents',
            'manage_calendar', 'view_calendar', 'create_events', 'edit_events', 'delete_events',
            'manage_tasks', 'view_tasks', 'create_tasks', 'edit_tasks', 'delete_tasks',
        ]);

        // ── Solicitor ──
        $solicitor = Role::firstOrCreate(['name' => 'solicitor', 'guard_name' => 'web']);
        $solicitor->update(['is_system' => true, 'description' => 'Qualified solicitor with case management access']);
        $solicitor->syncPermissions([
            'view_dashboard',
            'view_matters', 'create_matters', 'edit_matters',
            'view_contacts', 'create_contacts', 'edit_contacts',
            'view_time_entries', 'create_time_entries', 'edit_time_entries',
            'view_documents', 'upload_documents',
            'view_calendar', 'create_events', 'edit_events',
            'view_tasks', 'create_tasks', 'edit_tasks',
        ]);

        // ── Lawyer ──
        $lawyer = Role::firstOrCreate(['name' => 'lawyer', 'guard_name' => 'web']);
        $lawyer->update(['is_system' => true, 'description' => 'Lawyer with full case management access']);
        $lawyer->syncPermissions([
            'view_dashboard',
            'view_matters', 'create_matters', 'edit_matters',
            'view_contacts', 'create_contacts', 'edit_contacts',
            'view_time_entries', 'create_time_entries', 'edit_time_entries',
            'view_documents', 'upload_documents',
            'view_calendar', 'create_events', 'edit_events',
            'view_tasks', 'create_tasks', 'edit_tasks',
        ]);

        // ── Barrister ──
        $barrister = Role::firstOrCreate(['name' => 'barrister', 'guard_name' => 'web']);
        $barrister->update(['is_system' => true, 'description' => 'Barrister with court-focused access']);
        $barrister->syncPermissions([
            'view_dashboard',
            'view_matters', 'edit_matters',
            'view_contacts',
            'view_time_entries', 'create_time_entries',
            'view_documents', 'upload_documents',
            'view_calendar', 'create_events', 'edit_events',
            'view_tasks', 'create_tasks',
        ]);

        // ── Paralegal ──
        $paralegal = Role::firstOrCreate(['name' => 'paralegal', 'guard_name' => 'web']);
        $paralegal->update(['is_system' => true, 'description' => 'Paralegal with limited case support access']);
        $paralegal->syncPermissions([
            'view_dashboard',
            'view_matters',
            'view_contacts', 'create_contacts', 'edit_contacts',
            'view_time_entries', 'create_time_entries',
            'view_documents', 'upload_documents',
            'view_calendar', 'create_events',
            'view_tasks', 'create_tasks', 'edit_tasks',
        ]);

        // ── Secretary ──
        $secretary = Role::firstOrCreate(['name' => 'secretary', 'guard_name' => 'web']);
        $secretary->update(['is_system' => true, 'description' => 'Secretary with read-only case access and admin support']);
        $secretary->syncPermissions([
            'view_dashboard',
            'view_matters',
            'view_contacts',
            'view_time_entries',
            'view_documents', 'upload_documents',
            'view_calendar', 'create_events',
            'view_tasks',
        ]);

        // ── Clerk ──
        $clerk = Role::firstOrCreate(['name' => 'clerk', 'guard_name' => 'web']);
        $clerk->update(['is_system' => true, 'description' => 'Clerk with administrative support access']);
        $clerk->syncPermissions([
            'view_dashboard',
            'view_matters',
            'view_contacts', 'create_contacts', 'edit_contacts',
            'view_time_entries',
            'view_documents', 'upload_documents',
            'view_calendar', 'create_events',
            'view_tasks', 'create_tasks',
        ]);

        // ── Consultant ──
        $consultant = Role::firstOrCreate(['name' => 'consultant', 'guard_name' => 'web']);
        $consultant->update(['is_system' => true, 'description' => 'Consultant with advisory access']);
        $consultant->syncPermissions([
            'view_dashboard',
            'view_matters',
            'view_contacts',
            'view_time_entries', 'create_time_entries',
            'view_documents', 'upload_documents',
            'view_calendar', 'create_events',
            'view_tasks', 'create_tasks', 'edit_tasks',
        ]);

        // ── Accounts (financial role, retained as-is) ──
        $accounts = Role::firstOrCreate(['name' => 'accounts', 'guard_name' => 'web']);
        $accounts->update(['is_system' => true, 'description' => 'Accounts role with billing and financial access']);
        $accounts->syncPermissions([
            'view_dashboard',
            'view_matters',
            'view_contacts',
            'view_time_entries', 'create_time_entries',
            'view_expenses', 'create_expenses', 'edit_expenses',
            'manage_invoices', 'view_invoices', 'create_invoices', 'edit_invoices',
            'manage_trust', 'view_trust', 'create_trust_entries', 'edit_trust_entries',
            'view_documents',
            'view_calendar',
            'view_tasks',
            'view_reports', 'export_data',
        ]);

        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        $this->command->info('Roles and permissions updated successfully.');
    }
}
