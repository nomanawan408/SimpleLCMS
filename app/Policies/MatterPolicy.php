<?php

namespace App\Policies;

use App\Models\Matter;
use App\Models\User;

class MatterPolicy
{
    /**
     * Unified rule: permission (from the user's roles) unlocks the module,
     * assignment unlocks the record, open-state unlocks mutation.
     * firm_admin bypasses assignment scoping as the accountable owner;
     * super_admin bypasses everything via Gate::before.
     * Closed assigned files stay readable archive for lawyers.
     */
    public function viewAny(User $user): bool
    {
        return (bool) ($user->is_active && $user->hasPermissionTo('view_matters'));
    }

    public function view(User $user, Matter $matter): bool
    {
        if (! $user->is_active || $matter->firm_id !== $user->firm_id) {
            return false;
        }
        if ($user->hasRole('firm_admin')) {
            return true;
        }

        return $user->hasPermissionTo('view_matters') && $matter->isAssignedTo($user);
    }

    public function create(User $user): bool
    {
        return (bool) ($user->is_active && $user->hasPermissionTo('create_matters'));
    }

    public function update(User $user, Matter $matter): bool
    {
        if (! $user->is_active || $matter->firm_id !== $user->firm_id) {
            return false;
        }
        if ($user->hasRole('firm_admin')) {
            return true;
        }

        return ! $matter->isClosed()
            && $matter->isAssignedTo($user)
            && ($user->hasPermissionTo('edit_matters') || $user->hasPermissionTo('manage_matters'));
    }

    public function delete(User $user, Matter $matter): bool
    {
        if (! $user->is_active || $matter->firm_id !== $user->firm_id) {
            return false;
        }
        if ($user->hasRole('firm_admin')) {
            return true;
        }

        return ! $matter->isClosed()
            && $matter->isAssignedTo($user)
            && $user->hasPermissionTo('delete_matters');
    }
}
