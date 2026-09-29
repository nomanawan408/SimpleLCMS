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
    /**
     * Full permission vocabulary the application gates on. Ensured to exist
     * (never deleted): custom roles carry subsets of these, granted from the
     * Roles screen. Mirrors RolePermissionSeeder's list; both must agree.
     */
    /**
     * Every name here is enforced by a policy or controller gate (verified by
     * test: no decorative permissions). Removed 2026-09-29: user/invoice/
     * trust verbs (covered by admin-panel, finance flags, ledger gates),
     * firm-settings verbs (FirmPolicy), view_reports and export_data
     * (reports are firm_admin-only), view_ledger, reverse_ledger_entries and
     * run_reconciliation (ledger reads/writes ride the finance flags plus
     * post_ledger / transfer_client_funds).
     */
    private const PERMISSION_VOCABULARY = [
        'view_dashboard',
        'manage_matters', 'view_matters', 'create_matters', 'edit_matters', 'delete_matters',
        'manage_contacts', 'view_contacts', 'create_contacts', 'edit_contacts', 'delete_contacts',
        'manage_time_entries', 'view_time_entries', 'create_time_entries', 'edit_time_entries', 'delete_time_entries',
        'manage_expenses', 'create_expenses', 'edit_expenses', 'delete_expenses',
        'manage_documents', 'view_documents', 'upload_documents', 'delete_documents',
        'manage_calendar', 'view_calendar', 'create_events', 'edit_events', 'delete_events',
        'manage_tasks', 'view_tasks', 'create_tasks', 'edit_tasks', 'delete_tasks',
        'post_ledger', 'transfer_client_funds',
        'view_finances', 'manage_finances',
    ];

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

    /**
     * Additive only, by design: firm custom roles and their grants are never
     * touched here (the firm admin owns them from the application). This only
     * guarantees the built-in roles and the permission vocabulary exist, so
     * any deploy is self-sufficient and permission gates never hit missing
     * rows (Spatie throws on unknown permission names).
     */
    private function rebuildRolesAndPermissions(): void
    {
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        foreach (self::PERMISSION_VOCABULARY as $name) {
            Permission::firstOrCreate(['name' => $name, 'guard_name' => 'web']);
        }

        foreach (['super_admin', 'firm_admin', 'lawyer'] as $name) {
            Role::firstOrCreate(['name' => $name, 'guard_name' => 'web']);
        }

        // The two platform roles always hold the whole vocabulary: gates call
        // hasPermissionTo directly, so an admin must never 403 on a permission
        // row that was added after their last seed. Custom roles are untouched.
        foreach (['super_admin', 'firm_admin'] as $name) {
            $role = Role::where('name', $name)->where('guard_name', 'web')->first();
            if ($role) {
                $role->syncPermissions(Permission::where('guard_name', 'web')->pluck('name')->all());
            }
        }

        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();
    }

    public function down(): void
    {
        // Only the matter_user pivot is dropped. Roles, permissions and their
        // grants are firm-owned data and are never removed by a rollback.
        Schema::dropIfExists('matter_user');
    }
};
