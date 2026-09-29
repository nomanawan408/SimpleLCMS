<?php

namespace App\Support;

use App\Models\Firm;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

/**
 * Gives every firm its own editable lawyer role.
 *
 * The shared lawyer row (firm_id NULL) is an immutable template: a firm
 * admin must never edit it, because one shared row serves every firm.
 * Instead each firm owns a `lawyer` row carrying its own permission set,
 * which the firm admin adjusts freely from the Roles screen. Users always
 * hold their own firm's row (resolved by ID, never by bare name).
 *
 * Idempotent: safe to call on every firm creation (via the Firm model
 * hook) and from the backfill migration for pre-existing firms.
 */
class ProvisionsFirmRoles
{
    public static function for(Firm $firm): Role
    {
        foreach (DefaultRoles::LAWYER_PERMISSIONS as $name) {
            Permission::firstOrCreate(['name' => $name, 'guard_name' => 'web']);
        }

        $role = Role::firstOrNew(
            ['name' => 'lawyer', 'guard_name' => 'web', 'firm_id' => $firm->id]
        );

        if (! $role->exists) {
            $role->fill([
                'description' => 'Lawyer. Sees only assigned matters; finances only with explicit grants.',
                'is_system' => true,
            ]);
            $role->save();
        }

        // Fresh or empty rows get the defaults; a row holding any permission
        // is a firm's customization and is never overwritten on repeat calls.
        if ($role->permissions()->count() === 0) {
            $role->syncPermissions(DefaultRoles::LAWYER_PERMISSIONS);
            app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();
        }

        return $role->fresh();
    }
}
