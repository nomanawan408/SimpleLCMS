<?php

namespace App\Policies;

use App\Models\Contact;
use App\Models\User;

class ContactPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->is_active && $user->hasPermissionTo('view_contacts');
    }

    public function view(User $user, Contact $contact): bool
    {
        return $user->is_active && $contact->firm_id === $user->firm_id && $user->hasPermissionTo('view_contacts');
    }

    public function create(User $user): bool
    {
        return $user->is_active && $user->hasPermissionTo('create_contacts');
    }

    public function update(User $user, Contact $contact): bool
    {
        return $user->is_active
            && $contact->firm_id === $user->firm_id
            && ($user->hasPermissionTo('edit_contacts') || $user->hasPermissionTo('manage_contacts'));
    }

    public function delete(User $user, Contact $contact): bool
    {
        return $user->is_active
            && $contact->firm_id === $user->firm_id
            && $user->hasPermissionTo('delete_contacts');
    }
}
