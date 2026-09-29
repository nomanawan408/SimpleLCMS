<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

/**
 * Ensures the permission vocabulary and platform-role grants.
 *
 * Vocabulary grows over time, but migrations run once: any database that
 * migrated before a permission existed would otherwise miss the row forever
 * (Spatie throws on unknown names, and the Roles screen lists only rows).
 * This is additive and idempotent -- safe to extend and re-run by adding a
 * new migration that calls the same shape, or simply by editing the list
 * below before it runs anywhere new. Custom roles and their grants are
 * never touched; only the two platform roles are synced to the full set.
 */
return new class extends Migration
{
    private const VOCABULARY = [
        'view_dashboard',
        'manage_matters', 'view_matters', 'create_matters', 'edit_matters', 'delete_matters',
        'manage_contacts', 'view_contacts', 'create_contacts', 'edit_contacts', 'delete_contacts',
        'manage_time_entries', 'view_time_entries', 'create_time_entries', 'edit_time_entries', 'delete_time_entries',
        'manage_expenses', 'create_expenses', 'edit_expenses', 'delete_expenses',
        'manage_documents', 'view_documents', 'upload_documents', 'delete_documents',
        'manage_calendar', 'view_calendar', 'create_events', 'edit_events', 'delete_events',
        'manage_tasks', 'view_tasks', 'create_tasks', 'edit_tasks', 'delete_tasks',
        'post_ledger', 'transfer_client_funds',
        'view_reports', 'export_data',
        'manage_assignments',
        'manage_users', 'view_users', 'create_users', 'edit_users', 'delete_users',
        'view_finances', 'manage_finances',
    ];

    public function up(): void
    {
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        foreach (self::VOCABULARY as $name) {
            Permission::firstOrCreate(['name' => $name, 'guard_name' => 'web']);
        }

        // Platform roles always hold the whole vocabulary: gates call
        // hasPermissionTo directly, so an admin must never 403 on a row
        // added after their last seed. Custom roles are untouched.
        foreach (['super_admin', 'firm_admin'] as $name) {
            $role = Role::where('name', $name)->where('guard_name', 'web')->whereNull('firm_id')->first();
            if ($role) {
                $role->syncPermissions(Permission::where('guard_name', 'web')->pluck('name')->all());
            }
        }

        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();
    }

    public function down(): void
    {
        // Vocabulary rows are shared reference data; rollback drops nothing.
    }
};
