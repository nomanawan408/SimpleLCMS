<?php

namespace App\Policies;

use App\Models\Invoice;
use App\Models\User;

class InvoicePolicy
{
    public function view(User $user, Invoice $invoice): bool
    {
        return $user->firm_id === $invoice->firm_id;
    }

    public function update(User $user, Invoice $invoice): bool
    {
        return $user->firm_id === $invoice->firm_id;
    }

    public function delete(User $user, Invoice $invoice): bool
    {
        return $user->firm_id === $invoice->firm_id;
    }
}
