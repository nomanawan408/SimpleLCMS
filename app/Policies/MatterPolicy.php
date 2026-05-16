<?php

namespace App\Policies;

use App\Models\Matter;
use App\Models\User;

class MatterPolicy
{
    private const MATTER_ROLES  = ['administrator', 'manager', 'solicitor', 'lawyer', 'barrister', 'consultant', 'clerk', 'accounts'];
    private const WORK_ROLES    = ['administrator', 'manager', 'solicitor', 'lawyer', 'barrister', 'consultant', 'clerk'];

    public function viewAny(User $user): bool
    {
        return $user->is_active && in_array($user->role, self::MATTER_ROLES);
    }

    public function view(User $user, Matter $matter): bool
    {
        if (!$user->is_active || $matter->firm_id !== $user->firm_id) return false;
        if (in_array($user->role, self::MATTER_ROLES)) return true;
        return $matter->responsible_user_id === $user->id;
    }

    public function create(User $user): bool
    {
        return $user->is_active && in_array($user->role, self::WORK_ROLES);
    }

    public function update(User $user, Matter $matter): bool
    {
        if (!$user->is_active || $matter->firm_id !== $user->firm_id) return false;
        if (in_array($user->role, ['administrator', 'manager', 'solicitor', 'lawyer', 'barrister', 'consultant'])) return true;
        return $matter->responsible_user_id === $user->id;
    }

    public function delete(User $user, Matter $matter): bool
    {
        return $user->is_active
            && $matter->firm_id === $user->firm_id
            && in_array($user->role, ['administrator', 'manager']);
    }
}
