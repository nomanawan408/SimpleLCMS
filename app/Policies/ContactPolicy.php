<?php

namespace App\Policies;

use App\Models\Contact;
use App\Models\User;

class ContactPolicy
{
    /**
     * Unified rule: permission unlocks the module, matter-linkage unlocks
     * the record (a contact is visible/editable when tied to a matter the
     * user can see). firm_admin bypasses linkage as the accountable owner.
     */
    public function viewAny(User $user): bool
    {
        return (bool) ($user->is_active && $user->hasPermissionTo('view_contacts'));
    }

    public function view(User $user, Contact $contact): bool
    {
        if (! $user->is_active || $contact->firm_id !== $user->firm_id) {
            return false;
        }
        if ($user->hasRole('firm_admin')) {
            return true;
        }

        return $user->hasPermissionTo('view_contacts') && $this->linkedToVisibleMatter($user, $contact);
    }

    public function create(User $user): bool
    {
        return (bool) ($user->is_active && $user->hasPermissionTo('create_contacts'));
    }

    public function update(User $user, Contact $contact): bool
    {
        if (! $user->is_active || $contact->firm_id !== $user->firm_id) {
            return false;
        }
        if ($user->hasRole('firm_admin')) {
            return true;
        }

        return ($user->hasPermissionTo('edit_contacts') || $user->hasPermissionTo('manage_contacts'))
            && $this->linkedToVisibleMatter($user, $contact);
    }

    public function delete(User $user, Contact $contact): bool
    {
        if (! $user->is_active || $contact->firm_id !== $user->firm_id) {
            return false;
        }
        if ($user->hasRole('firm_admin')) {
            return true;
        }

        return $user->hasPermissionTo('delete_contacts') || $user->hasPermissionTo('manage_contacts');
    }

    private function linkedToVisibleMatter(User $user, Contact $contact): bool
    {
        return $contact->matters()->where(function ($q) use ($user) {
            $q->whereHas('assignees', fn ($qq) => $qq->where('users.id', $user->id))
                ->orWhere('responsible_user_id', $user->id);
        })->exists();
    }
}
