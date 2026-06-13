<?php

namespace App\Policies;

use App\Models\Invoice;
use App\Models\User;

class InvoicePolicy
{
    public function viewAny(User $user): bool
    {
        return $user->is_active && $user->hasPermissionTo('view_invoices');
    }

    public function view(User $user, Invoice $invoice): bool
    {
        return $user->is_active
            && $user->firm_id === $invoice->firm_id
            && $user->hasPermissionTo('view_invoices');
    }

    public function create(User $user): bool
    {
        return $user->is_active && $user->hasPermissionTo('create_invoices');
    }

    public function update(User $user, Invoice $invoice): bool
    {
        return $user->is_active
            && $user->firm_id === $invoice->firm_id
            && ($user->hasPermissionTo('edit_invoices') || $user->hasPermissionTo('manage_invoices'));
    }

    public function delete(User $user, Invoice $invoice): bool
    {
        return $user->is_active
            && $user->firm_id === $invoice->firm_id
            && $user->hasPermissionTo('delete_invoices');
    }
}
