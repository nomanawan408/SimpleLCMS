<?php

namespace App\Policies;

use App\Models\Firm;
use App\Models\User;

class FirmPolicy
{
    public function view(User $user, Firm $firm): bool
    {
        return $user->is_active && $user->firm_id === $firm->id;
    }

    public function update(User $user, Firm $firm): bool
    {
        return $user->is_active
            && $user->firm_id === $firm->id
            && $user->role === 'administrator';
    }
}
