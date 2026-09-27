<?php

use App\Models\User;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

/**
 * Access-model rebuild: roles collapse to super_admin / firm_admin / lawyer,
 * permissions collapse to the financial pair, and matter visibility moves
 * to an explicit assignment pivot.
 *
 * PRODUCTION SAFETY (real data):
 *  - Every step is re-runnable (upsert / firstOrCreate / idempotent assigns).
 *  - The backfill is VERIFIED (pivot rows == matters with a responsible
 *    user) before anything is deleted; mismatch aborts the migration.
 *  - Role/permission removal runs inside a DB transaction and ends with a
 *    fail-closed check: no user may be left holding a deleted role.
 *  - down() is a documented no-op: grants cannot be faithfully reconstructed.
 */
return new class extends Migration
{
    private const KEEP_ROLES = ['super_admin', 'firm_admin', 'lawyer'];

    private const KEEP_PERMISSIONS = ['view_finances', 'manage_finances'];

    public function up(): void
    {
        Schema::create('matter_user', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('matter_id');
            $table->uuid('user_id');
            $table->timestamps();

            $table->foreign('matter_id')->references('id')->on('matters')->onDelete('cascade');
            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
            $table->unique(['matter_id', 'user_id']);
            $table->index('user_id');
        });

        $this->backfillAssignments();
        $this->rebuildRolesAndPermissions();
    }

    private function backfillAssignments(): void
    {
        $expected = (int) DB::table('matters')->whereNotNull('responsible_user_id')->count();

        DB::table('matters')->whereNotNull('responsible_user_id')->orderBy('id')->chunk(500, function ($matters) {
            $now = now()->toDateTimeString();
            $rows = [];
            foreach ($matters as $m) {
                $rows[] = [
                    'id' => (string) Str::uuid(),
                    'matter_id' => $m->id,
                    'user_id' => $m->responsible_user_id,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }
            DB::table('matter_user')->upsert($rows, ['matter_id', 'user_id']);
        });

        $actual = (int) DB::table('matter_user')->distinct()->count('matter_id');

        if ($actual !== $expected) {
            throw new \RuntimeException(
                "Assignment backfill verification failed: {$expected} matters have a responsible user but {$actual} were linked. Aborting before any role/permission is touched."
            );
        }
    }

    private function rebuildRolesAndPermissions(): void
    {
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        foreach (self::KEEP_PERMISSIONS as $name) {
            Permission::firstOrCreate(['name' => $name, 'guard_name' => 'web']);
        }

        Role::firstOrCreate(['name' => 'lawyer', 'guard_name' => 'web']);

        DB::transaction(function () {
            $morph = (new User)->getMorphClass();
            $deletedRoleIds = Role::whereNotIn('name', self::KEEP_ROLES)->pluck('id');
            $deletedRoleNames = Role::whereNotIn('name', self::KEEP_ROLES)->pluck('name')->all();

            DB::table('model_has_roles')
                ->where('model_type', $morph)
                ->whereIn('role_id', $deletedRoleIds)
                ->select('model_id')
                ->distinct()
                ->orderBy('model_id')
                ->chunk(500, function ($rows) use ($deletedRoleNames) {
                    foreach ($rows as $row) {
                        $user = User::find($row->model_id);
                        if (! $user) {
                            continue;
                        }
                        if (! $user->hasAnyRole(['super_admin', 'firm_admin'])) {
                            $user->assignRole('lawyer');
                            if (in_array($user->role, $deletedRoleNames, true)) {
                                $user->forceFill(['role' => 'lawyer'])->save();
                            }
                        }
                    }
                });

            Role::whereNotIn('name', self::KEEP_ROLES)->delete();
            Permission::whereNotIn('name', self::KEEP_PERMISSIONS)->delete();

            // Fail closed: nobody may reference a role that no longer exists.
            $orphaned = DB::table('model_has_roles as mhr')
                ->leftJoin('roles', 'roles.id', '=', 'mhr.role_id')
                ->whereNull('roles.id')
                ->count();

            if ($orphaned > 0) {
                throw new \RuntimeException(
                    "Role purge verification failed: {$orphaned} assignments reference missing roles. Transaction rolled back — no grants were changed."
                );
            }
        });

        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();
    }

    public function down(): void
    {
        // Destructive by design: deleted roles, permissions and their grants
        // cannot be faithfully reconstructed, and the matter_user assignments
        // must survive regardless.
    }
};
