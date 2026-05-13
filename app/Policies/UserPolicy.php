<?php

namespace App\Policies;

use App\Models\User;

class UserPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->is_active && $user->role === 'firm_admin';
    }

    public function create(User $user): bool
    {
        return $user->is_active && $user->role === 'firm_admin';
    }

    public function update(User $user, User $target): bool
    {
        if (! $user->is_active || $user->role !== 'firm_admin') {
            return false;
        }

        if ($user->firm_id !== $target->firm_id) {
            return false;
        }

        return true;
    }

    public function delete(User $user, User $target): bool
    {
        return $this->update($user, $target) && $user->id !== $target->id;
    }
}
