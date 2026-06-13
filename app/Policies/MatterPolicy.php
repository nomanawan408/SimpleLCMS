<?php

namespace App\Policies;

use App\Models\Matter;
use App\Models\User;

class MatterPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->is_active && $user->hasPermissionTo('view_matters');
    }

    public function view(User $user, Matter $matter): bool
    {
        if (!$user->is_active || $matter->firm_id !== $user->firm_id) return false;
        return $user->hasPermissionTo('view_matters');
    }

    public function create(User $user): bool
    {
        return $user->is_active && $user->hasPermissionTo('create_matters');
    }

    public function update(User $user, Matter $matter): bool
    {
        if (!$user->is_active || $matter->firm_id !== $user->firm_id) return false;
        return $user->hasPermissionTo('edit_matters') || $user->hasPermissionTo('manage_matters');
    }

    public function delete(User $user, Matter $matter): bool
    {
        return $user->is_active
            && $matter->firm_id === $user->firm_id
            && $user->hasPermissionTo('delete_matters');
    }
}
