<?php

namespace App\Policies;

use App\Models\Contact;
use App\Models\User;

class ContactPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->is_active;
    }

    public function view(User $user, Contact $contact): bool
    {
        return $user->is_active && $contact->firm_id === $user->firm_id;
    }

    public function create(User $user): bool
    {
        return $user->is_active && !in_array($user->role, ['accounts', 'clerk']);
    }

    public function update(User $user, Contact $contact): bool
    {
        return $user->is_active
            && $contact->firm_id === $user->firm_id
            && !in_array($user->role, ['accounts', 'clerk']);
    }

    public function delete(User $user, Contact $contact): bool
    {
        return $user->is_active
            && $contact->firm_id === $user->firm_id
            && in_array($user->role, ['administrator', 'manager']);
    }
}
