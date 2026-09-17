<?php

namespace App\Http\Controllers;

use App\Http\Requests\Ledger\ReverseLedgerEntryRequest;
use App\Http\Requests\Ledger\RunReconciliationRequest;
use App\Http\Requests\Ledger\StoreLedgerEntryRequest;
use App\Models\BankReconciliation;
use App\Models\FinancialTransaction;
use App\Models\LedgerPosting;
use App\Models\Matter;
use App\Services\Accounting\LedgerService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * SRA Accounts Rules 2019 ledger. Write paths go exclusively through
 * LedgerService (double entry, deficit lock, legacy trust sync). There are
 * intentionally no update/delete actions: corrections are reversals.
 */
class LedgerController extends Controller
{
    private function service(Request $request): LedgerService
    {
        return new LedgerService($request->user()->firm_id, $request->user()->id);
    }

    /** Combined matter ledger: client + business columns with running balances. */
    public function matterLedger(Request $request, string $matter): Response
    {
        abort_unless($request->user()->hasPermissionTo('view_ledger'), 403);

        $record = Matter::where('firm_id', $request->user()->firm_id)->findOrFail($matter);
        $svc = $this->service($request);

        $postings = LedgerPosting::where('firm_id', $request->user()->firm_id)
            ->where('matter_id', $record->id)
            ->whereIn('account_type', ['matter_client', 'matter_business'])
            ->with('transaction:id,transaction_date,reference,narrative,transaction_type')
            ->orderBy('value_date')
            ->orderBy('created_at')
            ->orderBy('id')
            ->get();

        return Inertia::render('Ledger/Matter', [
            'matter' => $record->only(['id', 'name', 'matter_number', 'status']),
            'postings' => $postings,
            'balances' => [
                'client' => $svc->clientBalance($record->id),
                'office' => $svc->officeBalance($record->id),
            ],
        ]);
    }

    /** System cash sheets (client + business), filterable by date range. */
    public function cashSheet(Request $request): Response
    {
        abort_unless($request->user()->hasPermissionTo('view_ledger'), 403);

        $validated = $request->validate([
            'account'   => ['nullable', 'in:client,business'],
            'date_from' => ['nullable', 'date'],
            'date_to'   => ['nullable', 'date', 'after_or_equal:date_from'],
            'matter_id' => ['nullable', 'uuid'],
        ]);

        $account = $validated['account'] ?? 'client';
        $query = LedgerPosting::where('firm_id', $request->user()->firm_id)
            ->where('account_type', $account === 'business' ? 'cash_sheet_business' : 'cash_sheet_client')
            ->with(['transaction:id,transaction_date,reference,narrative,transaction_type', 'matter:id,name,matter_number'])
            ->orderBy('value_date', 'desc')
            ->orderBy('created_at', 'desc');

        if (! empty($validated['date_from'])) {
            $query->where('value_date', '>=', $validated['date_from']);
        }
        if (! empty($validated['date_to'])) {
            $query->where('value_date', '<=', $validated['date_to']);
        }
        if (! empty($validated['matter_id'])) {
            $query->where('matter_id', $validated['matter_id']);
        }

        $postings = $query->paginate(30)->withQueryString();
        $svc = $this->service($request);

        return Inertia::render('Ledger/CashSheet', [
            'postings' => $postings,
            'balance'  => $svc->cashSheetBalance(),
            'matters'  => Matter::where('firm_id', $request->user()->firm_id)
                ->orderBy('name')
                ->get(['id', 'name', 'matter_number'])
                ->each(fn ($m) => $m->setAppends([])),
            'filters'  => $request->only('account', 'date_from', 'date_to', 'matter_id'),
        ]);
    }

    public function store(StoreLedgerEntryRequest $request): RedirectResponse
    {
        abort_unless($request->user()->hasPermissionTo($request->requiredPermission()), 403);

        $data = $request->validated();
        $svc = $this->service($request);

        $transaction = match ($data['transaction_type']) {
            'client_receipt' => $svc->recordClientReceipt($data),
            'client_payment' => $svc->recordClientPayment($data),
            'client_to_office_transfer' => $svc->recordTransfer($data),
        };

        activity()->causedBy($request->user())->performedOn($transaction)->log('ledger_entry_posted');

        return back()->with('success', 'Ledger entry posted.');
    }

    public function reverse(ReverseLedgerEntryRequest $request, string $transaction): RedirectResponse
    {
        abort_unless($request->user()->hasPermissionTo('reverse_ledger_entries'), 403);

        $reversal = $this->service($request)->recordReversal($transaction, $request->validated()['narrative']);

        activity()->causedBy($request->user())->performedOn($reversal)->log('ledger_entry_reversed');

        return back()->with('success', 'Reversal posted. The original entry is unchanged.');
    }

    public function reconciliations(Request $request): Response
    {
        abort_unless($request->user()->hasPermissionTo('view_ledger'), 403);

        $records = BankReconciliation::where('firm_id', $request->user()->firm_id)
            ->with('performer:id,full_name')
            ->orderBy('as_at_date', 'desc')
            ->paginate(15);

        return Inertia::render('Ledger/Reconciliations', ['reconciliations' => $records]);
    }

    public function reconcile(RunReconciliationRequest $request): RedirectResponse
    {
        abort_unless($request->user()->hasPermissionTo('run_reconciliation'), 403);

        $data = $request->validated();
        $record = $this->service($request)->runReconciliation(
            $data['as_at_date'],
            (string) $data['paper_statement_balance'],
            $data['notes'] ?? null,
        );

        activity()->causedBy($request->user())->performedOn($record)->log('reconciliation_run');

        return back()->with(
            'success',
            $record->status === 'balanced'
                ? 'Reconciliation balanced.'
                : "Discrepancy of £{$record->discrepancy} recorded — SRA reconciliation breach."
        );
    }
}
