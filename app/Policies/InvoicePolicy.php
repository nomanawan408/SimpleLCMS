<?php

namespace App\Policies;

use App\Models\Invoice;
use App\Models\User;

class InvoicePolicy
{
    private const BILLING_ROLES = ['administrator', 'manager', 'accounts', 'solicitor', 'lawyer', 'barrister', 'consultant'];

    public function viewAny(User $user): bool
    {
        return $user->is_active && in_array($user->role, self::BILLING_ROLES);
    }

    public function view(User $user, Invoice $invoice): bool
    {
        return $user->is_active
            && $user->firm_id === $invoice->firm_id
            && in_array($user->role, self::BILLING_ROLES);
    }

    public function create(User $user): bool
    {
        return $user->is_active && in_array($user->role, self::BILLING_ROLES);
    }

    public function update(User $user, Invoice $invoice): bool
    {
        return $user->is_active
            && $user->firm_id === $invoice->firm_id
            && in_array($user->role, self::BILLING_ROLES);
    }

    public function delete(User $user, Invoice $invoice): bool
    {
        return $user->is_active
            && $user->firm_id === $invoice->firm_id
            && in_array($user->role, ['administrator', 'manager', 'accounts']);
    }
}
