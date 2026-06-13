<?php

namespace App\Http\Controllers;

use App\Mail\InvoiceMail;
use App\Models\Invoice;
use App\Models\InvoiceLineItem;
use App\Models\Matter;
use App\Models\Payment;
use App\Models\TimeEntry;
use App\Models\Expense;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Inertia\Inertia;

class InvoiceController extends Controller
{
    public function index(Request $request)
    {
        $user = auth()->user();
        $firmId = $user->firm_id;

        $query = Invoice::with(['matter', 'matter.responsibleUser'])
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

        $invoices = $query->paginate(15)->withQueryString();

        // Stats for dashboard
        $stats = [
            'total_outstanding' => Invoice::where('firm_id', $firmId)
                ->whereIn('status', ['draft', 'sent'])
                ->sum('total'),
            'overdue_amount' => Invoice::where('firm_id', $firmId)
                ->whereIn('status', ['sent'])
                ->where('due_date', '<', now())
                ->sum('total'),
            'paid_this_month' => Payment::where('firm_id', $firmId)
                ->whereMonth('paid_at', now()->month)
                ->sum('amount'),
        ];

        return Inertia::render('Billing/Index', [
            'invoices' => $invoices,
            'stats' => $stats,
            'filters' => $request->only(['status', 'search']),
        ]);
    }

    public function create()
    {
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
        $user = auth()->user();
        $firmId = $user->firm_id;

        $validated = $request->validate([
            'matter_id'               => 'required|uuid|exists:matters,id',
            'invoice_number'          => 'required|string|unique:invoices',
            'due_date'                => 'required|date',
            'issue_date'              => 'nullable|date',
            'line_items'              => 'required|array|min:1',
            'line_items.*.description'=> 'required|string',
            'line_items.*.quantity'   => 'required|numeric|min:0',
            'line_items.*.unit_rate'  => 'required|numeric|min:0',
            'line_items.*.amount'     => 'required|numeric|min:0',
            'line_items.*.vat_amount' => 'required|numeric|min:0',
            'vat_rate'                => 'required|numeric|min:0',
            'discount_amount'         => 'nullable|numeric|min:0',
            'discount_reason'         => 'nullable|string|max:500',
            'notes'                   => 'nullable|string',
            'action'                  => 'nullable|in:draft,send',
        ]);

        $invoiceId = null;

        DB::transaction(function () use ($validated, $firmId, $request, &$invoiceId) {
            $subtotal       = collect($validated['line_items'])->sum('amount');
            $vatAmount      = collect($validated['line_items'])->sum('vat_amount');
            $discountAmount = (float) ($validated['discount_amount'] ?? 0);
            $total          = $subtotal + $vatAmount - $discountAmount;
            $action         = $validated['action'] ?? 'draft';

            $invoice = Invoice::create([
                'firm_id'         => $firmId,
                'matter_id'       => $validated['matter_id'],
                'invoice_number'  => $validated['invoice_number'],
                'status'          => $action === 'send' ? 'sent' : 'draft',
                'subtotal'        => $subtotal,
                'vat_amount'      => $vatAmount,
                'vat_rate'        => $validated['vat_rate'],
                'total'           => max(0, $total),
                'discount_amount' => $discountAmount,
                'discount_reason' => $validated['discount_reason'] ?? null,
                'due_date'        => $validated['due_date'],
                'sent_at'         => $action === 'send' ? now() : null,
                'notes'           => $validated['notes'] ?? null,
            ]);

            foreach ($validated['line_items'] as $item) {
                $invoice->lineItems()->create($item);
            }

            // Mark time entries as billed if selected
            if ($request->has('bill_time_entry_ids')) {
                TimeEntry::whereIn('id', $request->bill_time_entry_ids)
                    ->update(['billed' => true, 'invoice_id' => $invoice->id]);
            }

            // Mark expenses as billed if selected
            if ($request->has('bill_expense_ids')) {
                Expense::whereIn('id', $request->bill_expense_ids)
                    ->update(['billed' => true, 'invoice_id' => $invoice->id]);
            }

            $invoiceId = $invoice->id;
        });

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
            'notes'  => 'nullable|string',
        ]);

        if ($request->status === 'sent' && $invoice->status === 'draft') {
            $validated['sent_at'] = now();
        }

        if ($request->status === 'paid') {
            $validated['paid_at'] = now();
        }

        $invoice->update($validated);

        return redirect()->back()->with('success', 'Invoice updated.');
    }

    public function recordPayment(Request $request, Invoice $invoice)
    {
        $this->authorize('update', $invoice);

        $validated = $request->validate([
            'amount'  => 'required|numeric|min:0.01',
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

        // Unlink time entries and expenses
        TimeEntry::where('invoice_id', $invoice->id)->update(['billed' => false, 'invoice_id' => null]);
        Expense::where('invoice_id', $invoice->id)->update(['billed' => false, 'invoice_id' => null]);

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

        $firm        = $request->user()->firm;
        $clientName  = $validated['recipient_name']
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

    private function getNextInvoiceNumber(string $firmId): string
    {
        $count = Invoice::where('firm_id', $firmId)->count() + 1;
        return 'INV-' . date('Y') . '-' . str_pad($count, 4, '0', STR_PAD_LEFT);
    }
}
