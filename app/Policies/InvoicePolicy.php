<?php

namespace App\Policies;

use App\Models\Invoice;
use App\Models\User;

class InvoicePolicy
{
    public function viewAny(User $user): bool
    {
        return (bool) ($user->is_active && $user->canViewFinances());
    }

    public function view(User $user, Invoice $invoice): bool
    {
        if (! $user->is_active || $user->firm_id !== $invoice->firm_id) {
            return false;
        }
        if ($user->hasRole('super_admin') || $user->hasRole('firm_admin')) {
            return true;
        }

        return $user->canViewFinances() && $invoice->matter && $invoice->matter->isAssignedTo($user);
    }

    public function create(User $user): bool
    {
        return (bool) ($user->is_active && $user->canManageFinances());
    }

    public function update(User $user, Invoice $invoice): bool
    {
        if (! $user->is_active || $user->firm_id !== $invoice->firm_id) {
            return false;
        }
        if ($user->hasRole('super_admin') || $user->hasRole('firm_admin')) {
            return true;
        }

        // Invoices on closed matters are frozen archive, like everything else.
        if (! $invoice->matter || $invoice->matter->isClosed()) {
            return false;
        }

        return $user->canManageFinances() && $invoice->matter->isAssignedTo($user);
    }

    public function delete(User $user, Invoice $invoice): bool
    {
        return $this->update($user, $invoice);
    }
}
