<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\Models\Role;

return new class extends Migration
{
    public function up(): void
    {
        $firmAdmin = Role::firstOrCreate(
            ['name' => 'firm_admin', 'guard_name' => 'web'],
            ['description' => 'Firm administrator with full operational, financial and administrative access', 'is_system' => true]
        );

        foreach (['admin', 'administrator'] as $legacyName) {
            Role::where('name', $legacyName)->where('guard_name', 'web')->get()
                ->each(function (Role $legacy) use ($firmAdmin): void {
                    $firmAdmin->givePermissionTo($legacy->permissions->pluck('name'));

                    DB::table('model_has_roles')
                        ->where('role_id', $legacy->getKey())
                        ->update(['role_id' => $firmAdmin->getKey()]);

                    $legacy->delete();
                });
        }

        DB::table('users')->whereIn('role', ['admin', 'administrator'])->update(['role' => 'firm_admin']);
    }

    public function down(): void
    {
        // Intentional no-op. Consolidation of legacy admin/administrator roles
        // is not reversible as separate roles were already being merged.
    }
};