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
        'administrator' => 'admin',
        'manager'       => 'admin',
        'solicitor'     => 'solicitor',
        'lawyer'        => 'solicitor',
        'barrister'     => 'solicitor',
        'clerk'         => 'paralegal',
        'consultant'    => 'paralegal',
        'accounts'      => 'secretary',
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

            $role = Role::where('name', $spatieRoleName)
                ->where('guard_name', 'web')
                ->first();

            if (!$role) {
                $this->error("Spatie role '{$spatieRoleName}' not found. Run the seeder first.");
                return self::FAILURE;
            }

            $user->syncRoles([$role]);
            $synced++;
            $this->info("{$user->email}: {$legacyRole} → {$spatieRoleName}");
        }

        $this->newLine();
        $this->info("Done. Synced: {$synced}, Skipped: {$skipped}");

        return self::SUCCESS;
    }
}
