<?php

namespace App\Http\Controllers;

use App\Mail\InvoiceMail;
use App\Models\Firm;
use App\Models\Invoice;
use App\Models\InvoiceLineItem;
use App\Models\Matter;
use App\Models\Payment;
use App\Models\TimeEntry;
use App\Models\Expense;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

class InvoiceController extends Controller
{
    public function index(Request $request)
    {
        abort_unless($request->user()->hasPermissionTo('view_invoices'), 403);

        $user = auth()->user();
        $firmId = $user->firm_id;

        $request->validate([
            'timeframe'  => 'nullable|in:today,week,month,quarter,ytd,custom,all',
            'date_from'  => 'nullable|date',
            'date_to'    => 'nullable|date|after_or_equal:date_from',
            'date_field' => 'nullable|in:created_at,due_date,sent_at,paid_at',
            'matter_id'  => ['nullable', 'uuid', Rule::exists('matters', 'id')->where(fn ($q) => $q->where('firm_id', $firmId))],
            'user_id'    => ['nullable', 'uuid', Rule::exists('users', 'id')->where(fn ($q) => $q->where('firm_id', $firmId))],
            'status'     => 'nullable|in:draft,sent,partial,paid,written_off,cancelled',
            'search'     => 'nullable|string|max:255',
        ]);

        [$dateFrom, $dateTo] = \App\Support\Timeframe::resolve($request->input('timeframe'), $request->input('date_from'), $request->input('date_to'));
        $dateField = $request->input('date_field', 'created_at');

        $query = Invoice::with(['matter', 'matter.responsibleUser'])
            ->withSum('payments as amount_paid', 'amount')
            ->where('firm_id', $firmId)
            ->orderBy('created_at', 'desc');

        // Filters
        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('invoice_number', 'like', "%{$search}%")
                  ->orWhereHas('matter', fn($mq) => $mq->where('name', 'like', "%{$search}%"));
            });
        }

        if ($request->filled('matter_id')) {
            $query->where('matter_id', $request->matter_id);
        }

        if ($request->filled('user_id')) {
            $query->whereHas('matter', fn ($mq) => $mq->where('responsible_user_id', $request->user_id));
        }

        if ($dateFrom && $dateTo) {
            if ($dateField === 'paid_at') {
                $query->whereHas('payments', fn ($pq) => $pq->whereBetween('paid_at', [$dateFrom, $dateTo]));
            } else {
                $query->whereBetween($dateField, [$dateFrom, $dateTo]);
            }
        }

        $invoices = $query->paginate(15)->withQueryString();

        // Stats for dashboard - respect same filters except pagination, but not search for cleaner KPI
        $statsBase = Invoice::where('firm_id', $firmId)
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->status))
            ->when($request->filled('matter_id'), fn ($q) => $q->where('matter_id', $request->matter_id))
            ->when($request->filled('user_id'), fn ($q) => $q->whereHas('matter', fn ($mq) => $mq->where('responsible_user_id', $request->user_id)))
            ->when($dateFrom && $dateTo && $dateField !== 'paid_at', fn ($q) => $q->whereBetween($dateField, [$dateFrom, $dateTo]));

        $outstandingInvoices = (clone $statsBase)
            ->whereIn('status', ['draft', 'sent', 'partial'])
            ->get(['id', 'total']);
        $paidPerInvoice = Payment::where('firm_id', $firmId)
            ->whereIn('invoice_id', $outstandingInvoices->pluck('id'))
            ->when($dateField === 'paid_at' && $dateFrom && $dateTo, fn ($q) => $q->whereBetween('paid_at', [$dateFrom, $dateTo]))
            ->selectRaw('invoice_id, SUM(amount) as paid_total')
            ->groupBy('invoice_id')
            ->pluck('paid_total', 'invoice_id');

        $stats = [
            'total_outstanding' => round($outstandingInvoices->sum(
                fn ($inv) => max(0, (float) $inv->total - (float) ($paidPerInvoice[$inv->id] ?? 0))
            ), 2),
            'overdue_amount' => (clone $statsBase)
                ->whereIn('status', ['sent', 'partial'])
                ->whereNotNull('due_date')
                ->where('due_date', '<', now())
                ->get(['id', 'total'])
                ->sum(fn ($inv) => max(0, (float) $inv->total - (float) ($paidPerInvoice[$inv->id] ?? 0))),
            'paid_this_month' => Payment::where('firm_id', $firmId)
                ->when($dateFrom && $dateTo, fn ($q) => $q->whereBetween('paid_at', [$dateFrom, $dateTo]), fn ($q) => $q->whereMonth('paid_at', now()->month)->whereYear('paid_at', now()->year))
                ->when($request->filled('matter_id'), fn ($q) => $q->whereHas('invoice', fn ($iq) => $iq->where('matter_id', $request->matter_id)))
                ->sum('amount'),
            'draft_count' => (clone $statsBase)->where('status', 'draft')->count(),
        ];

        $filterOptions = [
            'matters' => \App\Models\Matter::where('firm_id', $firmId)->orderBy('name')->get(['id', 'name', 'matter_number']),
            'users' => \App\Models\User::where('firm_id', $firmId)->where('is_active', true)->get(['id', 'full_name']),
        ];

        return Inertia::render('Billing/Index', [
            'invoices' => $invoices,
            'stats' => $stats,
            'filters' => $request->only(['status', 'search', 'matter_id', 'user_id', 'timeframe', 'date_from', 'date_to', 'date_field']),
            'filterOptions' => $filterOptions,
        ]);
    }

    public function create(Request $request)
    {
        abort_unless($request->user()->hasPermissionTo('create_invoices'), 403);

        $user = auth()->user();
        $firmId = $user->firm_id;

        $matters = Matter::where('firm_id', $firmId)
            ->where('status', 'open')
            ->with(['responsibleUser', 'contacts'])
            ->orderBy('name')
            ->get()
            ->each(fn ($m) => $m->setAppends([]));

        $unbilledTime = TimeEntry::where('firm_id', $firmId)
            ->where('billed', false)
            ->where('billable', true)
            ->with(['matter', 'user'])
            ->orderBy('date', 'desc')
            ->get();

        $unbilledExpenses = Expense::where('firm_id', $firmId)
            ->where('billed', false)
            ->with('matter')
            ->orderBy('date', 'desc')
            ->get();

        $firmVatRate = (float) ($user->firm->vat_rate ?? 0);
        $paymentTermsDays = (int) ($user->firm->payment_terms_days ?? 30);

        return Inertia::render('Billing/Create', [
            'matters'           => $matters,
            'unbilledTime'      => $unbilledTime,
            'unbilledExpenses'  => $unbilledExpenses,
            'nextInvoiceNumber' => $this->getNextInvoiceNumber($firmId),
            'firmVatRate'       => $firmVatRate,
            'paymentTermsDays'  => $paymentTermsDays,
        ]);
    }

    public function store(Request $request)
    {
        abort_unless($request->user()->hasPermissionTo('create_invoices'), 403);

        $user = auth()->user();
        $firmId = $user->firm_id;

        $validated = $request->validate([
            'matter_id'               => [
                'required', 'uuid',
                Rule::exists('matters', 'id')->where(fn ($q) => $q->where('firm_id', $firmId)),
            ],
            'invoice_number'          => [
                'required', 'string', 'max:255',
                Rule::unique('invoices', 'invoice_number')->where(fn ($q) => $q->where('firm_id', $firmId)),
            ],
            'due_date'                => 'required|date',
            'issue_date'              => 'nullable|date',
            'line_items'              => 'required|array|min:1',
            'line_items.*.description'=> 'required|string|max:2000',
            'line_items.*.quantity'   => 'required|numeric|min:0|max:100000',
            'line_items.*.unit_rate'  => 'required|numeric|min:0|max:10000000',
            'line_items.*.type'       => 'nullable|in:time,expense,fixed,fixed_fee',
            'vat_rate'                => 'required|numeric|min:0|max:100',
            'discount_amount'         => 'nullable|numeric|min:0',
            'discount_reason'         => 'nullable|string|max:500',
            'notes'                   => 'nullable|string|max:5000',
            'action'                  => 'nullable|in:draft,send',
        ]);

        // Linked unbilled records must belong to this firm + matter and not already be billed.
        foreach (['bill_time_entry_ids' => [TimeEntry::class, 'time entries'], 'bill_expense_ids' => [Expense::class, 'expenses']] as $field => [$model, $label]) {
            $ids = array_values(array_filter((array) $request->input($field, [])));
            if (empty($ids)) continue;

            $validCount = $model::whereIn('id', $ids)
                ->where('firm_id', $firmId)
                ->where('matter_id', $validated['matter_id'])
                ->where('billed', false)
                ->count();

            abort_unless($validCount === count($ids), 422, "Some selected {$label} are invalid, already billed, or belong to another matter.");
        }

        $invoiceId = null;

        DB::transaction(function () use ($validated, $firmId, $request, &$invoiceId) {
            // Recalculate all money server-side; never trust client-computed amounts.
            $vatRate = (float) $validated['vat_rate'];
            $subtotal = 0;
            $vatAmount = 0;
            $lineItems = [];

            foreach ($validated['line_items'] as $item) {
                $qty    = round((float) $item['quantity'], 2);
                $rate   = round((float) $item['unit_rate'], 2);
                $amount = round($qty * $rate, 2);
                $vat    = round($amount * $vatRate / 100, 2);

                $subtotal += $amount;
                $vatAmount += $vat;

                $lineItems[] = [
                    'description' => $item['description'],
                    'quantity'    => $qty,
                    'unit_rate'   => $rate,
                    'amount'      => $amount,
                    'vat_amount'  => $vat,
                    'type'        => in_array($item['type'] ?? null, ['time', 'expense'], true) ? $item['type'] : 'fixed_fee',
                ];
            }

            $subtotal       = round($subtotal, 2);
            $vatAmount      = round($vatAmount, 2);
            $discountAmount = round(min((float) ($validated['discount_amount'] ?? 0), $subtotal + $vatAmount), 2);
            $total          = round($subtotal + $vatAmount - $discountAmount, 2);
            $action         = $validated['action'] ?? 'draft';

            $invoice = Invoice::create([
                'firm_id'         => $firmId,
                'matter_id'       => $validated['matter_id'],
                'invoice_number'  => $validated['invoice_number'],
                'status'          => $action === 'send' ? 'sent' : 'draft',
                'subtotal'        => $subtotal,
                'vat_amount'      => $vatAmount,
                'vat_rate'        => $vatRate,
                'total'           => max(0, $total),
                'discount_amount' => $discountAmount,
                'discount_reason' => $validated['discount_reason'] ?? null,
                'due_date'        => $validated['due_date'],
                'sent_at'         => $action === 'send' ? now() : null,
                'notes'           => $validated['notes'] ?? null,
            ]);

            foreach ($lineItems as $item) {
                $invoice->lineItems()->create($item);
            }

            // Mark validated time entries as billed if selected
            $timeEntryIds = array_values(array_filter((array) $request->input('bill_time_entry_ids', [])));
            if (!empty($timeEntryIds)) {
                TimeEntry::whereIn('id', $timeEntryIds)
                    ->update(['billed' => true, 'invoice_id' => $invoice->id]);
            }

            // Mark validated expenses as billed if selected
            $expenseIds = array_values(array_filter((array) $request->input('bill_expense_ids', [])));
            if (!empty($expenseIds)) {
                Expense::whereIn('id', $expenseIds)
                    ->update(['billed' => true, 'invoice_id' => $invoice->id]);
            }

            $invoiceId = $invoice->id;

            // Claim the firm sequence when the number follows the auto scheme,
            // so future auto-generated numbers can never collide with this one.
            $firm = Firm::lockForUpdate()->find($firmId);
            if ($firm) {
                $expected = str_pad((string) ($firm->invoice_sequence + 1), 4, '0', STR_PAD_LEFT);
                $prefix   = "{$firm->invoice_prefix}-" . date('Y') . '-';
                if ($validated['invoice_number'] === "{$prefix}{$expected}") {
                    $firm->increment('invoice_sequence');
                }
            }
        });

        // Auto-send invoice email to client contact if action is 'send'
        if (($validated['action'] ?? 'draft') === 'send' && $invoiceId) {
            $invoice = Invoice::with(['matter.contacts'])->find($invoiceId);
            $firm = $user->firm;

            $clientContact = $invoice->matter->contacts()
                ->wherePivotIn('role', ['client', 'claimant', 'applicant', 'petitioner'])
                ->first()
                ?? $invoice->matter->contacts()->first();

            if ($clientContact && $clientContact->email) {
                try {
                    Mail::to($clientContact->email)
                        ->send(new InvoiceMail($invoice, $firm, $clientContact->name, $clientContact->email));

                    activity()->causedBy($user)->performedOn($invoice)->withProperties([
                        'sent_to' => $clientContact->email,
                    ])->log('invoice_emailed');
                } catch (\Exception $e) {
                    // Invoice was created successfully, email failed - log but don't block
                    activity()->causedBy($user)->performedOn($invoice)->withProperties([
                        'error' => $e->getMessage(),
                    ])->log('invoice_email_failed');
                }
            }
        }

        return redirect()->route('billing.show', $invoiceId)
            ->with('success', 'Invoice created successfully.');
    }

    public function show(Invoice $invoice)
    {
        $this->authorize('view', $invoice);

        $invoice->load(['matter', 'matter.responsibleUser', 'matter.contacts', 'lineItems', 'payments']);

        $invoiceArray = $invoice->toArray();

        return Inertia::render('Billing/Show', [
            'invoice' => array_merge($invoiceArray, [
                'lineItems' => $invoice->lineItems->values()->toArray(),
                'payments'  => $invoice->payments->values()->toArray(),
            ]),
        ]);
    }

    public function update(Request $request, Invoice $invoice)
    {
        $this->authorize('update', $invoice);

        $validated = $request->validate([
            'status' => 'sometimes|in:draft,sent,partial,paid,written_off,cancelled',
            'notes'  => 'nullable|string|max:5000',
        ]);

        // Guard rails: cancelled invoices are terminal; paid invoices cannot be reopened.
        if ($invoice->status === 'cancelled' && ($validated['status'] ?? 'cancelled') !== 'cancelled') {
            return redirect()->back()->with('error', 'A cancelled invoice cannot be reopened. Duplicate it instead.');
        }

        if (in_array($invoice->status, ['paid'], true) && ($validated['status'] ?? '') !== 'paid') {
            return redirect()->back()->with('error', 'A fully paid invoice cannot change status. Record a refund or write it off via support.');
        }

        // Cancelling releases linked time entries and expenses back to the unbilled pool.
        if (($validated['status'] ?? null) === 'cancelled' && $invoice->status !== 'cancelled') {
            TimeEntry::where('invoice_id', $invoice->id)->update(['billed' => false, 'invoice_id' => null]);
            Expense::where('invoice_id', $invoice->id)->update(['billed' => false, 'invoice_id' => null]);
        }

        if ($request->input('status') === 'sent' && $invoice->status === 'draft') {
            $validated['sent_at'] = now();
        }

        if ($request->input('status') === 'paid') {
            $validated['paid_at'] = now();
        }

        $invoice->update($validated);

        return redirect()->back()->with('success', 'Invoice updated.');
    }

    public function recordPayment(Request $request, Invoice $invoice)
    {
        $this->authorize('update', $invoice);

        $maxAmount = $invoice->amount_outstanding;

        $validated = $request->validate([
            'amount'  => ['required', 'numeric', 'min:0.01', 'max:' . $maxAmount],
            'method'  => 'required|in:cash,cheque,bank_transfer,stripe_card,stripe_sepa',
            'paid_at' => 'required|date',
            'notes'   => 'nullable|string',
        ]);

        Payment::create([
            'firm_id' => $invoice->firm_id,
            'invoice_id' => $invoice->id,
            'amount' => $validated['amount'],
            'method' => $validated['method'],
            'paid_at' => $validated['paid_at'],
            'notes' => $validated['notes'] ?? null,
        ]);

        $invoice->refresh();
        if ($invoice->amount_outstanding <= 0.01) {
            $invoice->update(['status' => 'paid', 'paid_at' => $validated['paid_at']]);
        } elseif ($invoice->amount_paid > 0) {
            $invoice->update(['status' => 'partial']);
        }

        return redirect()->back()->with('success', 'Payment recorded successfully.');
    }

    public function destroy(Invoice $invoice)
    {
        $this->authorize('delete', $invoice);

        // Never delete invoices that carry money records or settled statuses.
        if ($invoice->payments()->exists() || in_array($invoice->status, ['paid', 'partial', 'written_off'], true)) {
            return redirect()->route('billing.index')
                ->with('error', 'Invoices with recorded payments or settled statuses cannot be deleted. Cancel the invoice instead.');
        }

        // Unlink time entries and expenses so they return to the unbilled pool
        TimeEntry::where('invoice_id', $invoice->id)->update(['billed' => false, 'invoice_id' => null]);
        Expense::where('invoice_id', $invoice->id)->update(['billed' => false, 'invoice_id' => null]);

        activity()->causedBy(auth()->user())->performedOn($invoice)->withProperties([
            'invoice_number' => $invoice->invoice_number,
            'total'          => $invoice->total,
        ])->log('invoice_deleted');

        $invoice->delete();

        return redirect()->route('billing.index')
            ->with('success', 'Invoice deleted.');
    }

    public function sendEmail(Request $request, Invoice $invoice)
    {
        $this->authorize('update', $invoice);

        $validated = $request->validate([
            'recipient_email' => 'required|email',
            'recipient_name'  => 'nullable|string|max:255',
            'message'         => 'nullable|string|max:2000',
        ]);

        $invoice->load(['matter', 'matter.contacts', 'lineItems']);

        // The invoice carries the firm's bank details, so it may only be sent
        // to an address already recorded against this matter -- otherwise the
        // endpoint is a self-service exfiltration channel.
        $permitted = $invoice->matter?->contacts
            ->flatMap(fn ($c) => [$c->email, $c->contact_person_email])
            ->filter()
            ->map(fn ($email) => strtolower(trim($email)))
            ->unique();

        if (! $permitted || ! $permitted->contains(strtolower(trim($validated['recipient_email'])))) {
            return back()->withErrors([
                'recipient_email' => 'Invoices can only be emailed to a contact on this matter. Add the recipient to the matter first.',
            ]);
        }

        $firm        = $request->user()->firm;
        $clientName  = $validated['recipient_name']
                    ?? $invoice->matter?->contacts?->first()?->full_name
                    ?? $invoice->matter?->contacts?->first()?->name
                    ?? 'Valued Client';
        $clientEmail = $validated['recipient_email'];

        try {
            Mail::to($clientEmail)
                ->send(new InvoiceMail($invoice, $firm, $clientName, $clientEmail));

            // Mark as sent if currently draft
            if ($invoice->status === 'draft') {
                $invoice->update(['status' => 'sent', 'sent_at' => now()]);
            }

            activity()->causedBy($request->user())->performedOn($invoice)->withProperties([
                'sent_to' => $clientEmail,
            ])->log('invoice_emailed');

            return back()->with('success', "Invoice emailed to {$clientEmail} successfully.");
        } catch (\Exception $e) {
            return back()->with('error', "Failed to send email: {$e->getMessage()}");
        }
    }

    public function downloadPdf(Invoice $invoice)
    {
        $this->authorize('view', $invoice);

        $invoice->load(['matter', 'matter.contacts', 'lineItems']);
        $firm = auth()->user()->firm;

        $clientContact = $invoice->matter->contacts()
            ->wherePivotIn('role', ['client', 'claimant', 'applicant', 'petitioner'])
            ->first()
            ?? $invoice->matter->contacts()->first();

        $clientName = $clientContact?->name ?? 'Valued Client';

        $lineItems = $invoice->lineItems;
        $bankDetails = [
            'bank_name'           => $firm->bank_name,
            'bank_account_name'   => $firm->bank_account_name,
            'bank_sort_code'      => $firm->bank_sort_code,
            'bank_account_number' => $firm->bank_account_number,
            'bank_iban'           => $firm->bank_iban,
            'bank_swift_code'     => $firm->bank_swift_code,
            'payment_instructions'=> $firm->payment_instructions,
        ];

        $pdf = Pdf::loadView('invoices.pdf', [
            'invoice'     => $invoice,
            'firm'        => $firm,
            'clientName'  => $clientName,
            'lineItems'   => $lineItems,
            'bankDetails' => $bankDetails,
        ]);

        return $pdf->download("invoice-{$invoice->invoice_number}.pdf");
    }

    private function getNextInvoiceNumber(string $firmId): string
    {
        $firm = Firm::find($firmId);

        if ($firm) {
            // Preview only: mirrors TimeController's sequence+increment scheme.
            $number = str_pad((string) ($firm->invoice_sequence + 1), 4, '0', STR_PAD_LEFT);
            return "{$firm->invoice_prefix}-" . date('Y') . "-{$number}";
        }

        $count = Invoice::where('firm_id', $firmId)->count() + 1;
        return 'INV-' . date('Y') . '-' . str_pad($count, 4, '0', STR_PAD_LEFT);
    }
}
