<?php

namespace App\Policies;

use App\Models\Matter;
use App\Models\User;

class MatterPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->is_active;
    }

    public function view(User $user, Matter $matter): bool
    {
        if ($matter->firm_id !== $user->firm_id) return false;
        if (in_array($user->role, ['firm_admin', 'senior_solicitor'])) return true;
        return $matter->responsible_user_id === $user->id;
    }

    public function create(User $user): bool
    {
        return $user->is_active && in_array($user->role, ['firm_admin', 'senior_solicitor', 'solicitor']);
    }

    public function update(User $user, Matter $matter): bool
    {
        if ($matter->firm_id !== $user->firm_id) return false;
        if (in_array($user->role, ['firm_admin', 'senior_solicitor'])) return true;
        return $matter->responsible_user_id === $user->id;
    }

    public function delete(User $user, Matter $matter): bool
    {
        return $matter->firm_id === $user->firm_id && $user->role === 'firm_admin';
    }
}
