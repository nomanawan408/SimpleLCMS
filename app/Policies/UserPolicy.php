<?php

namespace App\Policies;

use App\Models\User;

class UserPolicy
{
    private function isFirmManager(User $user): bool
    {
        return $user->is_active && $user->hasRole('firm_admin');
    }

    public function viewAny(User $user): bool
    {
        return $this->isFirmManager($user);
    }

    public function create(User $user): bool
    {
        return $this->isFirmManager($user);
    }

    public function update(User $user, User $target): bool
    {
        if (! $this->isFirmManager($user)) {
            return false;
        }

        return $user->firm_id === $target->firm_id;
    }

    public function delete(User $user, User $target): bool
    {
        return $this->update($user, $target) && $user->id !== $target->id;
    }

    public function editAny(User $user): bool
    {
        return $this->isFirmManager($user);
    }
}
