<?php

use App\Models\Firm;
use App\Models\User;
use App\Support\ProvisionsFirmRoles;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\Models\Role;

/**
 * Every firm owns an editable lawyer role (see ProvisionsFirmRoles).
 *
 * Firms created before that rule existed may still have users holding the
 * shared template row. This moves each of those grants onto the holder's
 * own firm row (provisioned here if missing) and then verifies:
 *
 *   1. every firm owns exactly one lawyer row,
 *   2. nobody still holds the shared template row,
 *   3. every moved user now holds their firm's row.
 *
 * Additive + remap only; custom roles and their grants are untouched.
 */
return new class extends Migration
{
    public function up(): void
    {
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        $shared = Role::where('name', 'lawyer')->where('guard_name', 'web')->whereNull('firm_id')->first();

        $movedUserIds = [];
        if ($shared) {
            $movedUserIds = DB::table('model_has_roles')
                ->where('role_id', $shared->id)
                ->where('model_type', (new User)->getMorphClass())
                ->pluck('model_id')
                ->map(fn ($id) => (string) $id)
                ->all();
        }

        Firm::query()->orderBy('id')->chunk(200, function ($firms) use ($shared) {
            foreach ($firms as $firm) {
                $row = ProvisionsFirmRoles::for($firm);

                if (! $shared) {
                    continue;
                }

                $holderIds = DB::table('model_has_roles')
                    ->where('role_id', $shared->id)
                    ->where('model_type', (new User)->getMorphClass())
                    ->whereIn('model_id', User::where('firm_id', $firm->id)->pluck('id')->all())
                    ->pluck('model_id')
                    ->map(fn ($id) => (string) $id)
                    ->all();

                foreach ($holderIds as $userId) {
                    $already = DB::table('model_has_roles')
                        ->where('role_id', $row->id)
                        ->where('model_type', (new User)->getMorphClass())
                        ->where('model_id', $userId)
                        ->exists();
                    if (! $already) {
                        DB::table('model_has_roles')->insert([
                            'role_id' => $row->id,
                            'model_type' => (new User)->getMorphClass(),
                            'model_id' => $userId,
                        ]);
                    }
                    DB::table('model_has_roles')
                        ->where('role_id', $shared->id)
                        ->where('model_type', (new User)->getMorphClass())
                        ->where('model_id', $userId)
                        ->delete();
                }
            }
        });

        $this->verify($shared, $movedUserIds);

        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();
    }

    private function verify(?Role $shared, array $movedUserIds): void
    {
        $morph = (new User)->getMorphClass();

        $firmsWithoutRow = Firm::query()
            ->whereNotExists(fn ($q) => $q->select(DB::raw(1))->from('roles')
                ->whereColumn('roles.firm_id', 'firms.id')
                ->where('roles.name', 'lawyer')
                ->where('roles.guard_name', 'web'))
            ->count();
        if ($firmsWithoutRow > 0) {
            throw new \RuntimeException("Firm lawyer backfill failed: {$firmsWithoutRow} firms still lack their own lawyer row.");
        }

        if ($shared) {
            // Firm-less holders (platform anomalies, if any) cannot move to
            // a firm row: report, don't fail the deploy over them.
            $orphaned = DB::table('model_has_roles as mhr')
                ->where('mhr.role_id', $shared->id)
                ->where('mhr.model_type', $morph)
                ->leftJoin('users', 'users.id', '=', 'mhr.model_id')
                ->whereNull('users.firm_id')
                ->count();
            if ($orphaned > 0) {
                \Illuminate\Support\Facades\Log::warning("Firm lawyer backfill: {$orphaned} firm-less grant(s) left on the shared lawyer row for manual review.");
            }
            $leftover = DB::table('model_has_roles as mhr')
                ->where('mhr.role_id', $shared->id)
                ->where('mhr.model_type', $morph)
                ->join('users', 'users.id', '=', 'mhr.model_id')
                ->whereNotNull('users.firm_id')
                ->count();
            if ($leftover > 0) {
                throw new \RuntimeException("Firm lawyer backfill failed: {$leftover} grants still reference the shared lawyer row.");
            }

            foreach (array_chunk($movedUserIds, 500) as $chunk) {
                $unmoved = DB::table('users')
                    ->whereIn('users.id', $chunk)
                    ->whereNotExists(fn ($q) => $q->select(DB::raw(1))->from('model_has_roles as mhr')
                        ->join('roles', 'roles.id', '=', 'mhr.role_id')
                        ->whereColumn('roles.firm_id', 'users.firm_id')
                        ->where('roles.name', 'lawyer')
                        ->where('mhr.model_type', $morph)
                        ->whereColumn('mhr.model_id', 'users.id'))
                    ->count();
                if ($unmoved > 0) {
                    throw new \RuntimeException('Firm lawyer backfill failed: moved users are missing their firm lawyer grant.');
                }
            }
        }
    }

    public function down(): void
    {
        // Grants are firm-owned data: a rollback must not strip them.
    }
};
