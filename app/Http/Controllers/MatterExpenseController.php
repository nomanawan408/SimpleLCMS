<?php

namespace App\Http\Controllers;

use App\Models\Expense;
use App\Models\Matter;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\Response as SymfonyResponse;

class MatterExpenseController extends Controller
{
    /**
     * The expenses.category column is an enum, so anything outside this list
     * is rejected by the database. Validating against the same list turns what
     * used to be a 500 into a normal field error.
     */
    public const CATEGORIES = [
        'court_fees',
        'counsel_fees',
        'travel',
        'disbursement',
        'stamp_duty',
        'search_fees',
        'translation',
        'other',
    ];

    public function store(Matter $matter, Request $request): SymfonyResponse
    {
        $this->authorize('update', $matter);
        abort_unless($this->canManageExpenses($request, 'create_expenses'), 403);

        $validated = $request->validate($this->rules());

        $expense = Expense::create([
            'firm_id' => $request->user()->firm_id,
            'matter_id' => $matter->id,
            'user_id' => $request->user()->id,
            'invoice_id' => null,
            'date' => $validated['date'],
            'vendor' => $validated['vendor'] ?? null,
            'amount' => $validated['amount'],
            'vat_amount' => $validated['vat_amount'] ?? 0,
            'category' => $validated['category'] ?? null,
            'billable' => (bool) $validated['billable'],
            'billed' => false,
            'receipt_path' => null,
            'description' => $validated['description'],
        ]);

        activity()->causedBy($request->user())->performedOn($matter)->log('expense_added');

        if ($request->expectsJson()) {
            return response()->json(['expense' => $expense->load('user')]);
        }

        return back()->with('success', 'Expense added.');
    }

    public function update(Matter $matter, Expense $expense, Request $request): SymfonyResponse
    {
        $this->authorize('update', $matter);
        abort_unless($this->canManageExpenses($request, 'edit_expenses'), 403);
        abort_unless($expense->matter_id === $matter->id, 404);

        if ($locked = $this->lockedResponse($expense, $request, 'edited')) {
            return $locked;
        }

        $validated = $request->validate($this->rules(partial: true));

        $expense->fill($validated);
        $expense->save();

        activity()->causedBy($request->user())->performedOn($matter)->log('expense_updated');

        if ($request->expectsJson()) {
            return response()->json(['expense' => $expense->fresh()->load('user')]);
        }

        return back()->with('success', 'Expense updated.');
    }

    public function destroy(Matter $matter, Expense $expense, Request $request): SymfonyResponse
    {
        $this->authorize('update', $matter);
        abort_unless($this->canManageExpenses($request, 'delete_expenses'), 403);
        abort_unless($expense->matter_id === $matter->id, 404);

        if ($locked = $this->lockedResponse($expense, $request, 'deleted')) {
            return $locked;
        }

        $expense->delete();

        activity()->causedBy($request->user())->performedOn($matter)->log('expense_deleted');

        if ($request->expectsJson()) {
            return response()->json(['message' => 'Expense deleted.']);
        }

        return back()->with('success', 'Expense deleted.');
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    private function rules(bool $partial = false): array
    {
        $required = $partial ? 'sometimes' : 'required';

        return [
            'date' => [$required, 'date'],
            'amount' => [$required, 'numeric', 'min:0', 'max:10000000'],
            'vat_amount' => ['nullable', 'numeric', 'min:0', 'max:10000000'],
            'billable' => [$required, 'boolean'],
            'vendor' => ['nullable', 'string', 'max:255'],
            'category' => ['nullable', Rule::in(self::CATEGORIES)],
            'description' => [$required, 'string', 'max:1000'],
        ];
    }

    /**
     * An expense already on an invoice is part of a billing record and must
     * not shift underneath it. Cancel or credit the invoice instead.
     */
    private function lockedResponse(Expense $expense, Request $request, string $verb): ?SymfonyResponse
    {
        if (! $expense->billed && $expense->invoice_id === null) {
            return null;
        }

        $message = "This expense has been billed and cannot be {$verb}. Cancel the invoice first.";

        if ($request->expectsJson()) {
            return response()->json(['message' => $message], 422);
        }

        return back()->with('error', $message);
    }

    /**
     * Expenses are financial records, so they use the dedicated expense
     * permissions rather than general matter-edit rights.
     */
    private function canManageExpenses(Request $request, string $permission): bool
    {
        $user = $request->user();

        return $user->hasPermissionTo($permission) || $user->hasPermissionTo('manage_expenses');
    }
}
