<?php

namespace App\Http\Controllers;

use App\Models\Invoice;
use App\Models\InvoiceLineItem;
use App\Models\Matter;
use App\Models\Payment;
use App\Models\TimeEntry;
use App\Models\Expense;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class InvoiceController extends Controller
{
    public function index(Request $request)
    {
        $user = auth()->user();
        $firmId = $user->firm_id;

        $query = Invoice::with(['matter', 'matter.responsible_user'])
            ->where('firm_id', $firmId)
            ->orderBy('created_at', 'desc');

        // Filters
        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('invoice_number', 'ilike', "%{$search}%")
                  ->orWhereHas('matter', fn($mq) => $mq->where('name', 'ilike', "%{$search}%"));
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
            ->with('responsibleUser')
            ->orderBy('name')
            ->get();

        // Get unbilled time and expenses
        $unbilledTime = TimeEntry::where('firm_id', $firmId)
            ->where('is_billed', false)
            ->with(['matter', 'user'])
            ->get();

        $unbilledExpenses = Expense::where('firm_id', $firmId)
            ->where('is_billed', false)
            ->with('matter')
            ->get();

        return Inertia::render('Billing/Create', [
            'matters' => $matters,
            'unbilledTime' => $unbilledTime,
            'unbilledExpenses' => $unbilledExpenses,
            'nextInvoiceNumber' => $this->getNextInvoiceNumber($firmId),
        ]);
    }

    public function store(Request $request)
    {
        $user = auth()->user();
        $firmId = $user->firm_id;

        $validated = $request->validate([
            'matter_id' => 'required|uuid|exists:matters,id',
            'invoice_number' => 'required|string|unique:invoices',
            'due_date' => 'required|date',
            'line_items' => 'required|array|min:1',
            'line_items.*.description' => 'required|string',
            'line_items.*.quantity' => 'required|numeric|min:0',
            'line_items.*.unit_rate' => 'required|numeric|min:0',
            'line_items.*.amount' => 'required|numeric|min:0',
            'line_items.*.vat_amount' => 'required|numeric|min:0',
            'vat_rate' => 'required|numeric|min:0',
            'notes' => 'nullable|string',
        ]);

        DB::transaction(function () use ($validated, $firmId, $request) {
            $subtotal = collect($validated['line_items'])->sum('amount');
            $vatAmount = collect($validated['line_items'])->sum('vat_amount');
            $total = $subtotal + $vatAmount;

            $invoice = Invoice::create([
                'firm_id' => $firmId,
                'matter_id' => $validated['matter_id'],
                'invoice_number' => $validated['invoice_number'],
                'status' => 'draft',
                'subtotal' => $subtotal,
                'vat_amount' => $vatAmount,
                'vat_rate' => $validated['vat_rate'],
                'total' => $total,
                'due_date' => $validated['due_date'],
                'notes' => $validated['notes'] ?? null,
            ]);

            foreach ($validated['line_items'] as $item) {
                $invoice->lineItems()->create($item);
            }

            // Mark time entries as billed if selected
            if ($request->has('bill_time_entry_ids')) {
                TimeEntry::whereIn('id', $request->bill_time_entry_ids)
                    ->update(['is_billed' => true, 'invoice_id' => $invoice->id]);
            }

            // Mark expenses as billed if selected
            if ($request->has('bill_expense_ids')) {
                Expense::whereIn('id', $request->bill_expense_ids)
                    ->update(['is_billed' => true, 'invoice_id' => $invoice->id]);
            }
        });

        return redirect()->route('billing.index')
            ->with('success', 'Invoice created successfully.');
    }

    public function show(Invoice $invoice)
    {
        $this->authorize('view', $invoice);

        $invoice->load(['matter', 'matter.responsible_user', 'lineItems', 'payments']);

        return Inertia::render('Billing/Show', [
            'invoice' => $invoice,
        ]);
    }

    public function update(Request $request, Invoice $invoice)
    {
        $this->authorize('update', $invoice);

        $validated = $request->validate([
            'status' => 'sometimes|in:draft,sent,paid,cancelled',
            'notes' => 'nullable|string',
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
            'amount' => 'required|numeric|min:0.01|max:' . $invoice->amount_outstanding,
            'method' => 'required|in:cash,cheque,bank_transfer,credit_card,stripe',
            'paid_at' => 'required|date',
            'notes' => 'nullable|string',
        ]);

        Payment::create([
            'firm_id' => $invoice->firm_id,
            'invoice_id' => $invoice->id,
            'amount' => $validated['amount'],
            'method' => $validated['method'],
            'paid_at' => $validated['paid_at'],
            'notes' => $validated['notes'] ?? null,
        ]);

        // Auto-mark as paid if fully paid
        if ($invoice->amount_outstanding <= $validated['amount']) {
            $invoice->update(['status' => 'paid', 'paid_at' => $validated['paid_at']]);
        }

        return redirect()->back()->with('success', 'Payment recorded successfully.');
    }

    public function destroy(Invoice $invoice)
    {
        $this->authorize('delete', $invoice);

        // Unlink time entries and expenses
        TimeEntry::where('invoice_id', $invoice->id)->update(['is_billed' => false, 'invoice_id' => null]);
        Expense::where('invoice_id', $invoice->id)->update(['is_billed' => false, 'invoice_id' => null]);

        $invoice->delete();

        return redirect()->route('billing.index')
            ->with('success', 'Invoice deleted.');
    }

    private function getNextInvoiceNumber(string $firmId): string
    {
        $count = Invoice::where('firm_id', $firmId)->count() + 1;
        return 'INV-' . date('Y') . '-' . str_pad($count, 4, '0', STR_PAD_LEFT);
    }
}
