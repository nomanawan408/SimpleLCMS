<?php

namespace App\Policies;

use App\Models\Matter;
use App\Models\User;

class MatterPolicy
{
    /**
     * Three tiers: super_admin (via Gate::before), firm_admin (whole firm),
     * lawyer (assigned matters, any status — closed files are readable
     * archive). Mutation (update/delete) stays open-only: the archive is
     * strictly read-only for lawyers.
     */
    public function viewAny(User $user): bool
    {
        return (bool) $user->is_active;
    }

    public function view(User $user, Matter $matter): bool
    {
        if (! $user->is_active || $matter->firm_id !== $user->firm_id) {
            return false;
        }
        if ($user->hasRole('super_admin') || $user->hasRole('firm_admin')) {
            return true;
        }

        return $matter->isAssignedTo($user);
    }

    public function create(User $user): bool
    {
        return (bool) ($user->is_active && $user->hasRole('firm_admin'));
    }

    public function update(User $user, Matter $matter): bool
    {
        if (! $user->is_active || $matter->firm_id !== $user->firm_id) {
            return false;
        }
        if ($user->hasRole('super_admin') || $user->hasRole('firm_admin')) {
            return true;
        }

        return ! $matter->isClosed() && $matter->isAssignedTo($user);
    }

    public function delete(User $user, Matter $matter): bool
    {
        return $this->update($user, $matter);
    }
}
