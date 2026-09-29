<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\Models\Permission;

/**
 * Removes decorative permissions: vocabulary names no gate checks.
 *
 * These toggles were offered on the Roles screen but enforced nowhere, so
 * granting them implied control that did not exist. Money and admin access
 * are covered by the finance flags, the admin-panel gate and FirmPolicy;
 * ledger reads/writes ride the flags plus post_ledger / transfer_client_funds.
 *
 * Detaches grants first (role and direct), then deletes the rows, all in one
 * transaction. Fails closed if anything references an unexpected row.
 */
return new class extends Migration
{
    private const DECORATIVE = [
        'manage_firm', 'view_firm_settings', 'edit_firm_settings',
        'view_reports', 'export_data',
        'manage_users', 'view_users', 'create_users', 'edit_users', 'delete_users',
        'manage_invoices', 'view_invoices', 'create_invoices', 'edit_invoices', 'delete_invoices',
        'manage_trust', 'view_trust', 'create_trust_entries', 'edit_trust_entries', 'delete_trust_entries',
        'view_expenses',
        'reverse_ledger_entries', 'run_reconciliation', 'view_ledger',
    ];

    public function up(): void
    {
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        DB::transaction(function () {
            $ids = Permission::whereIn('name', self::DECORATIVE)->pluck('id');

            DB::table('role_has_permissions')->whereIn('permission_id', $ids)->delete();
            DB::table('model_has_permissions')->whereIn('permission_id', $ids)->delete();
            Permission::whereIn('name', self::DECORATIVE)->delete();
        });

        $leftover = Permission::whereIn('name', self::DECORATIVE)->count();
        if ($leftover > 0) {
            throw new \RuntimeException("Decorative permission cleanup failed: {$leftover} rows remain.");
        }

        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();
    }

    public function down(): void
    {
        // Re-created by the seeder if ever needed; grants are not restored.
    }
};
