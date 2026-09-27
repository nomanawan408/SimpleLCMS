<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

/**
 * Access model: three roles, two financial permissions.
 *
 *  - super_admin: platform owner, everything everywhere.
 *  - firm_admin: everything within their firm.
 *  - lawyer: nothing by default; visibility comes from matter assignment,
 *    money visibility from the two financial grants below.
 *
 * Lawyer financial access is granted per user (firm admin toggles it on the
 * user record), never by role: two solicitors can have different access.
 */
class RolePermissionSeeder extends Seeder
{
    public function run(): void
    {
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        foreach (['view_finances', 'manage_finances'] as $permission) {
            Permission::firstOrCreate(['name' => $permission, 'guard_name' => 'web']);
        }

        $superAdmin = Role::firstOrCreate(['name' => 'super_admin', 'guard_name' => 'web']);
        $superAdmin->update(['is_system' => true, 'description' => 'SaaS platform owner with full platform access']);
        $superAdmin->syncPermissions(Permission::all());

        $firmAdmin = Role::firstOrCreate(['name' => 'firm_admin', 'guard_name' => 'web']);
        $firmAdmin->update(['is_system' => true, 'description' => 'Firm administrator with full operational, financial and administrative access']);
        $firmAdmin->syncPermissions(Permission::all());

        $lawyer = Role::firstOrCreate(['name' => 'lawyer', 'guard_name' => 'web']);
        $lawyer->update(['is_system' => true, 'description' => 'Lawyer. Sees only assigned matters; finances only with explicit grants.']);
        $lawyer->syncPermissions([]);

        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        $this->command->info('Roles and permissions updated successfully.');
    }
}
