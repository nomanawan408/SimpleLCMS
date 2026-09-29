<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Spatie\Permission\Models\Role;

#[Signature('app:sync-user-roles')]
#[Description('Sync legacy user role column values to Spatie roles')]
class SyncUserRoles extends Command
{
    private const ROLE_MAP = [
        'super_admin'   => 'super_admin',
        'admin'         => 'firm_admin',
        'administrator' => 'firm_admin',
        'firm_admin'    => 'firm_admin',
        // Every legacy staff role collapses to lawyer; visibility then comes
        // from matter assignment, not the role name.
        'staff'         => 'lawyer',
        'manager'       => 'lawyer',
        'solicitor'     => 'lawyer',
        'barrister'     => 'lawyer',
        'paralegal'     => 'lawyer',
        'secretary'     => 'lawyer',
        'clerk'         => 'lawyer',
        'consultant'    => 'lawyer',
        'accounts'      => 'lawyer',
        'lawyer'        => 'lawyer',
    ];

    public function handle(): int
    {
        $users = User::withTrashed()->get();
        $synced = 0;
        $skipped = 0;

        foreach ($users as $user) {
            $legacyRole = $user->role;
            $spatieRoleName = self::ROLE_MAP[$legacyRole] ?? null;

            if (!$spatieRoleName) {
                $this->warn("User {$user->email} has unknown role '{$legacyRole}', skipping.");
                $skipped++;
                continue;
            }

            // Firm-scoped first: with per-firm role rows in play, a bare
            // name lookup could attach another firm's row. Falls back to the
            // shared row for built-ins (and firm-less platform users).
            $role = Role::where('name', $spatieRoleName)
                ->where('guard_name', 'web')
                ->where(fn ($q) => $q
                    ->where('firm_id', $user->firm_id)
                    ->orWhereNull('firm_id'))
                ->orderByRaw('firm_id IS NULL')
                ->first();

            if (!$role) {
                $this->error("Spatie role '{$spatieRoleName}' not found. Run the seeder first.");
                return self::FAILURE;
            }

            $user->syncRoles([$role]);

            // Keep the display column truthful too: the firm UI, exports and
            // several tests read users.role directly, not the Spatie pivot.
            if ($user->role !== $spatieRoleName) {
                $user->forceFill(['role' => $spatieRoleName])->save();
            }

            $synced++;
            $this->info("{$user->email}: {$legacyRole} → {$spatieRoleName}");
        }

        $this->removeStaleRoles();

        $this->newLine();
        $this->info("Done. Synced: {$synced}, Skipped: {$skipped}");

        return self::SUCCESS;
    }

    /**
     * Remove legacy role rows (e.g. staff) so they can never resurface in
     * dropdowns or be re-granted. Fail-closed: a role with any remaining
     * user/permission assignment is reported and kept, never deleted.
     */
    private function removeStaleRoles(): void
    {
        $canonical = array_values(array_unique(array_values(self::ROLE_MAP)));
        $staleNames = array_diff(array_keys(self::ROLE_MAP), $canonical);

        foreach ($staleNames as $name) {
            $role = Role::where('name', $name)->where('guard_name', 'web')->first();
            if (! $role) {
                continue;
            }

            $userRefs = \DB::table('model_has_roles')->where('role_id', $role->id)->count();
            $permRefs = \DB::table('role_has_permissions')->where('role_id', $role->id)->count();

            if ($userRefs > 0 || $permRefs > 0) {
                $this->warn("Kept '{$name}': still referenced ({$userRefs} users, {$permRefs} permissions). Re-run after syncing users.");
                continue;
            }

            $role->delete();
            $this->info("Removed stale role '{$name}'.");
        }
    }
}
