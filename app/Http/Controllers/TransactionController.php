<?php

namespace App\Http\Controllers;

use App\Models\Invoice;
use App\Models\Matter;
use App\Models\Payment;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class TransactionController extends Controller
{
    public function index(Request $request): Response
    {
        $user   = $request->user();
        $firmId = $user->firm_id;

        $query = Payment::with(['invoice', 'invoice.matter', 'invoice.matter.contacts'])
            ->where('firm_id', $firmId)
            ->orderBy('paid_at', 'desc');

        if ($request->filled('matter_id')) {
            $query->whereHas('invoice', fn ($q) => $q->where('matter_id', $request->matter_id));
        }

        if ($request->filled('method')) {
            $query->where('method', $request->method);
        }

        if ($request->filled('date_from')) {
            $query->whereDate('paid_at', '>=', $request->date_from);
        }

        if ($request->filled('date_to')) {
            $query->whereDate('paid_at', '<=', $request->date_to);
        }

        $transactions = $query->paginate(25)->withQueryString();

        $outstandingInvoices = Invoice::where('firm_id', $firmId)
            ->whereIn('status', ['draft', 'sent', 'partial'])
            ->get(['id', 'total']);
        $paidPerInvoice = Payment::where('firm_id', $firmId)
            ->whereIn('invoice_id', $outstandingInvoices->pluck('id'))
            ->selectRaw('invoice_id, SUM(amount) as paid_total')
            ->groupBy('invoice_id')
            ->pluck('paid_total', 'invoice_id');
        $outstanding = $outstandingInvoices->sum(fn ($inv) => max(0, (float) $inv->total - (float) ($paidPerInvoice[$inv->id] ?? 0)));

        $stats = [
            'total_received'      => (float) Payment::where('firm_id', $firmId)->sum('amount'),
            'received_this_month' => (float) Payment::where('firm_id', $firmId)
                                         ->whereMonth('paid_at', now()->month)
                                         ->whereYear('paid_at',  now()->year)
                                         ->sum('amount'),
            'received_this_week'  => (float) Payment::where('firm_id', $firmId)
                                         ->whereBetween('paid_at', [now()->startOfWeek(), now()->endOfWeek()])
                                         ->sum('amount'),
            'outstanding'         => (float) $outstanding,
        ];

        $matters = Matter::where('firm_id', $firmId)
            ->orderBy('name')
            ->get(['id', 'name', 'matter_number'])
            ->each(fn ($m) => $m->setAppends([]));

        $openInvoices = Invoice::with('matter')
            ->where('firm_id', $firmId)
            ->whereNotIn('status', ['paid', 'cancelled'])
            ->orderBy('created_at', 'desc')
            ->get(['id', 'invoice_number', 'total', 'status', 'matter_id'])
            ->map(fn ($inv) => [
                'id'             => $inv->id,
                'invoice_number' => $inv->invoice_number,
                'total'          => (float) $inv->total,
                'status'         => $inv->status,
                'matter_name'    => $inv->matter?->name ?? '—',
                'matter_number'  => $inv->matter?->matter_number ?? '—',
            ]);

        return Inertia::render('Transactions/Index', [
            'transactions' => $transactions,
            'stats'        => $stats,
            'matters'      => $matters,
            'openInvoices' => $openInvoices,
            'filters'      => $request->only('matter_id', 'method', 'date_from', 'date_to'),
        ]);
    }

    public function store(Request $request)
    {
        $user   = $request->user();
        $firmId = $user->firm_id;

        $validated = $request->validate([
            'invoice_id' => ['required', 'uuid', 'exists:invoices,id'],
            'amount'     => ['required', 'numeric', 'min:0.01'],
            'method'     => ['required', 'in:cash,cheque,bank_transfer,stripe_card,stripe_sepa'],
            'paid_at'    => ['required', 'date'],
            'notes'      => ['nullable', 'string', 'max:500'],
        ]);

        $invoice = Invoice::where('id', $validated['invoice_id'])
            ->where('firm_id', $firmId)
            ->firstOrFail();

        $payment = Payment::create([
            'firm_id'    => $firmId,
            'invoice_id' => $invoice->id,
            'amount'     => $validated['amount'],
            'method'     => $validated['method'],
            'paid_at'    => $validated['paid_at'],
            'notes'      => $validated['notes'] ?? null,
        ]);

        $totalPaid = Payment::where('invoice_id', $invoice->id)->sum('amount');
        if ($totalPaid >= $invoice->total) {
            $invoice->update(['status' => 'paid', 'paid_at' => $validated['paid_at']]);
        } elseif ($totalPaid > 0) {
            $invoice->update(['status' => 'partial']);
        }

        activity()->causedBy($user)->performedOn($payment)->log('payment_recorded');

        return back()->with('success', 'Payment recorded successfully.');
    }
}
