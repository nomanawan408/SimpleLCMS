<?php

namespace App\Http\Controllers;

use App\Models\Expense;
use App\Models\Matter;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response as SymfonyResponse;

class MatterExpenseController extends Controller
{
    public function store(Matter $matter, Request $request): SymfonyResponse
    {
        $this->authorize('update', $matter);

        $validated = $request->validate([
            'date'        => ['required', 'date'],
            'amount'      => ['required', 'numeric', 'min:0'],
            'billable'    => ['required', 'boolean'],
            'vendor'      => ['nullable', 'string', 'max:255'],
            'category'    => ['nullable', 'string', 'max:255'],
            'description' => ['required', 'string', 'max:255'],
        ]);

        $expense = Expense::create([
            'firm_id'      => $request->user()->firm_id,
            'matter_id'    => $matter->id,
            'user_id'      => $request->user()->id,
            'invoice_id'   => null,
            'date'         => $validated['date'],
            'vendor'       => $validated['vendor'] ?? null,
            'amount'       => $validated['amount'],
            'vat_amount'   => 0,
            'category'     => $validated['category'] ?? null,
            'billable'     => (bool) $validated['billable'],
            'billed'       => false,
            'receipt_path' => null,
            'description'  => $validated['description'],
        ]);

        activity()->causedBy($request->user())->performedOn($matter)->log('expense_added');

        if ($request->expectsJson()) {
            return response()->json(['expense' => $expense->load('user')]);
        }

        return back()->with('success', 'Expense added.');
    }
}
