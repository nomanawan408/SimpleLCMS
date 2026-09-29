<?php

namespace App\Policies;

use App\Models\User;

class UserPolicy
{
    private function isFirmManager(User $user): bool
    {
        return $user->is_active && $user->hasRole('firm_admin');
    }

    /**
     * User administration is delegable: firm admins, plus holders of the
     * user-management verbs. Roles management (editAny/deleteAny) stays
     * firm_admin-only -- handing out permissions stays an admin act.
     */
    public function viewAny(User $user): bool
    {
        return (bool) ($user->is_active && ($user->hasRole('firm_admin')
            || $user->hasPermissionTo('view_users')
            || $user->hasPermissionTo('manage_users')));
    }

    public function create(User $user): bool
    {
        return (bool) ($user->is_active && ($user->hasRole('firm_admin')
            || $user->hasPermissionTo('create_users')
            || $user->hasPermissionTo('manage_users')));
    }

    public function update(User $user, User $target): bool
    {
        if (! $user->is_active || $user->firm_id !== $target->firm_id) {
            return false;
        }
        if ($user->hasRole('firm_admin')) {
            return true;
        }

        return (bool) ($user->hasPermissionTo('edit_users') || $user->hasPermissionTo('manage_users'));
    }

    public function delete(User $user, User $target): bool
    {
        if (! $user->is_active || $user->firm_id !== $target->firm_id || $user->id === $target->id) {
            return false;
        }
        if ($user->hasRole('firm_admin')) {
            return true;
        }

        return (bool) ($user->hasPermissionTo('delete_users') || $user->hasPermissionTo('manage_users'));
    }

    public function editAny(User $user): bool
    {
        return $this->isFirmManager($user);
    }

    public function deleteAny(User $user): bool
    {
        return $this->isFirmManager($user);
    }
}
