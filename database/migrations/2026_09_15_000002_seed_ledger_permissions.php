<?php

use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

/**
 * Idempotent ledger permission grants. Unlike RolePermissionSeeder (fresh
 * installs), this never syncs whole roles: on existing firms it only ADDS
 * the new permissions, so firm-level customizations are preserved.
 */
return new class extends Migration
{
    private const GRANTS = [
        'super_admin' => ['view_ledger', 'post_ledger', 'transfer_client_funds', 'reverse_ledger_entries', 'run_reconciliation'],
        'firm_admin'  => ['view_ledger', 'post_ledger', 'transfer_client_funds', 'reverse_ledger_entries', 'run_reconciliation'],
        'manager'     => ['view_ledger', 'post_ledger', 'transfer_client_funds', 'run_reconciliation'],
        'accounts'    => ['view_ledger', 'post_ledger', 'transfer_client_funds', 'reverse_ledger_entries', 'run_reconciliation'],
        'solicitor'   => ['view_ledger', 'post_ledger'],
        'lawyer'      => ['view_ledger', 'post_ledger'],
        'barrister'   => ['view_ledger', 'post_ledger'],
        'paralegal'   => ['view_ledger'],
        'secretary'   => ['view_ledger'],
        'clerk'       => ['view_ledger'],
        'consultant'  => ['view_ledger'],
    ];

    public function up(): void
    {
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        foreach (array_unique(array_merge(...array_values(self::GRANTS))) as $name) {
            Permission::firstOrCreate(['name' => $name, 'guard_name' => 'web']);
        }

        foreach (self::GRANTS as $roleName => $permissions) {
            $role = Role::where('name', $roleName)->where('guard_name', 'web')->first();
            if ($role) {
                $role->givePermissionTo($permissions);
            }
        }

        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();
    }

    public function down(): void
    {
        // Permissions are left in place on rollback: stripping them could
        // lock firms out of posted ledgers. Remove manually if ever needed.
    }
};
