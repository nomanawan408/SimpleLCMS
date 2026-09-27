<?php

namespace App\Policies;

use App\Models\Contact;
use App\Models\User;

class ContactPolicy
{
    public function viewAny(User $user): bool
    {
        return (bool) $user->is_active;
    }

    public function view(User $user, Contact $contact): bool
    {
        if (! $user->is_active || $contact->firm_id !== $user->firm_id) {
            return false;
        }
        if ($user->hasRole('super_admin') || $user->hasRole('firm_admin')) {
            return true;
        }

        return $contact->matters()->where(function ($q) use ($user) {
            $q->whereHas('assignees', fn ($qq) => $qq->where('users.id', $user->id))
                ->orWhere('responsible_user_id', $user->id);
        })->exists();
    }

    public function create(User $user): bool
    {
        return (bool) ($user->is_active && ($user->hasRole('firm_admin') || $user->hasRole('lawyer')));
    }

    public function update(User $user, Contact $contact): bool
    {
        return $this->view($user, $contact);
    }

    public function delete(User $user, Contact $contact): bool
    {
        return (bool) ($user->is_active
            && $contact->firm_id === $user->firm_id
            && ($user->hasRole('super_admin') || $user->hasRole('firm_admin')));
    }
}
