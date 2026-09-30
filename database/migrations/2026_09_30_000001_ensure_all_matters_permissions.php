<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

/**
 * Ensures the all-matters override permissions (view/edit/delete) plus
 * platform-role coverage. Same additive shape as the vocabulary ensure:
 * existing rows, roles and custom grants are never touched.
 */
return new class extends Migration
{
    private const NAMES = ['view_all_matters', 'edit_all_matters', 'delete_all_matters'];

    public function up(): void
    {
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        foreach (self::NAMES as $name) {
            Permission::firstOrCreate(['name' => $name, 'guard_name' => 'web']);
        }

        foreach (['super_admin', 'firm_admin'] as $name) {
            $role = Role::where('name', $name)->where('guard_name', 'web')->whereNull('firm_id')->first();
            if ($role) {
                $existing = $role->permissions()->pluck('name')->all();
                $role->givePermissionTo(array_values(array_unique(array_merge($existing, self::NAMES))));
            }
        }

        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();
    }

    public function down(): void
    {
        // Vocabulary rows are shared reference data; rollback drops nothing.
    }
};
