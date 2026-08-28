<?php

namespace App\Http\Controllers;

use App\Models\Invoice;
use App\Models\Matter;
use App\Models\Payment;
use App\Models\TimeEntry;
use App\Models\User;
use App\Support\Timeframe;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

class ReportController extends Controller
{
    public function index(Request $request)
    {
        abort_unless($request->user()->hasPermissionTo('view_reports'), 403);

        $firmId = $request->user()->firm_id;

        $request->validate([
            'timeframe'     => 'nullable|in:today,week,month,quarter,ytd,custom,all',
            'date_from'     => 'nullable|date',
            'date_to'       => 'nullable|date|after_or_equal:date_from',
            'date_field'    => 'nullable|in:created_at,due_date,sent_at,paid_at',
            'matter_id'     => ['nullable', 'uuid', Rule::exists('matters', 'id')->where(fn ($q) => $q->where('firm_id', $firmId))],
            'user_id'       => ['nullable', 'uuid', Rule::exists('users', 'id')->where(fn ($q) => $q->where('firm_id', $firmId))],
            'practice_area' => 'nullable|string|max:50',
            'status'        => 'nullable|in:draft,sent,partial,paid,written_off,cancelled',
            'tab'           => 'nullable|in:financial,time,matters',
            'export'        => 'nullable|in:csv',
        ]);

        [$dateFrom, $dateTo] = Timeframe::resolve($request->input('timeframe'), $request->input('date_from'), $request->input('date_to'));
        $dateField = $request->input('date_field', 'created_at');
        $matterId = $request->input('matter_id');
        $userId = $request->input('user_id');
        $practiceArea = $request->input('practice_area');
        $status = $request->input('status');

        // Payments subquery for collection/outstanding
        $paidByInvoice = Payment::where('firm_id', $firmId)
            ->when($dateField === 'paid_at' && $dateFrom && $dateTo, fn ($q) => $q->whereBetween('paid_at', [$dateFrom, $dateTo]))
            ->selectRaw('invoice_id, SUM(amount) as paid_total')
            ->groupBy('invoice_id');

        // Base invoice query with common filters (for financial summary)
        $invoiceBase = fn () => Invoice::where('firm_id', $firmId)
            ->whereNotIn('status', ['cancelled'])
            ->when($matterId, fn ($q) => $q->where('matter_id', $matterId))
            ->when($status, fn ($q) => $q->where('status', $status))
            ->when($userId, fn ($q) => $q->whereHas('matter', fn ($mq) => $mq->where('responsible_user_id', $userId)))
            ->when($practiceArea, fn ($q) => $q->whereHas('matter', fn ($mq) => $mq->where('practice_area', $practiceArea)))
            ->when($dateFrom && $dateTo && $dateField !== 'paid_at', fn ($q) => $q->whereBetween($dateField, [$dateFrom, $dateTo]));

        $financialSummary = [
            'total_invoiced'   => (clone $invoiceBase())->sum('total'),
            'total_collected'  => (float) Payment::where('firm_id', $firmId)
                ->when($matterId, fn ($q) => $q->whereHas('invoice', fn ($iq) => $iq->where('matter_id', $matterId)))
                ->when($userId, fn ($q) => $q->whereHas('invoice.matter', fn ($mq) => $mq->where('responsible_user_id', $userId)))
                ->when($dateFrom && $dateTo, fn ($q) => $q->whereBetween('paid_at', [$dateFrom, $dateTo]))
                ->sum('amount'),
            'total_outstanding' => Invoice::where('firm_id', $firmId)
                ->whereIn('status', ['sent', 'partial'])
                ->when($matterId, fn ($q) => $q->where('matter_id', $matterId))
                ->when($status, fn ($q) => $q->where('status', $status))
                ->when($userId, fn ($q) => $q->whereHas('matter', fn ($mq) => $mq->where('responsible_user_id', $userId)))
                ->when($practiceArea, fn ($q) => $q->whereHas('matter', fn ($mq) => $mq->where('practice_area', $practiceArea)))
                ->when($dateFrom && $dateTo && $dateField !== 'paid_at', fn ($q) => $q->whereBetween($dateField, [$dateFrom, $dateTo]))
                ->leftJoinSub(clone $paidByInvoice, 'pp2', 'pp2.invoice_id', '=', 'invoices.id')
                ->sum(DB::raw('GREATEST(0, invoices.total - COALESCE(pp2.paid_total, 0))')),
            'invoices_by_matter' => (clone $invoiceBase())
                ->leftJoinSub(clone $paidByInvoice, 'pp', 'pp.invoice_id', '=', 'invoices.id')
                ->with('matter:id,name,matter_number')
                ->select(
                    'matter_id',
                    DB::raw('COUNT(*) as count'),
                    DB::raw('SUM(total) as total_amount'),
                    DB::raw('SUM(COALESCE(pp.paid_total, 0)) as collected_amount'),
                    DB::raw("SUM(CASE WHEN status IN ('sent','partial') THEN GREATEST(0, total - COALESCE(pp.paid_total, 0)) ELSE 0 END) as outstanding_amount")
                )
                ->groupBy('matter_id')
                ->orderBy('total_amount', 'desc')
                ->limit(20)
                ->get(),
        ];

        // Time by user - respects timeframe + matter + user filters
        $timeQueryFilters = function ($q) use ($firmId, $matterId, $userId, $dateFrom, $dateTo) {
            $q->where('firm_id', $firmId);
            if ($matterId) $q->where('matter_id', $matterId);
            if ($userId) $q->where('user_id', $userId);
            if ($dateFrom && $dateTo) $q->whereBetween('date', [$dateFrom->toDateString(), $dateTo->toDateString()]);
        };

        $timeByUserQuery = User::where('firm_id', $firmId)->where('is_active', true);
        if ($userId) $timeByUserQuery->where('id', $userId);

        $timeByUser = $timeByUserQuery->get(['id', 'full_name'])->map(function ($user) use ($timeQueryFilters) {
            $agg = TimeEntry::where(function ($q) use ($timeQueryFilters) { $timeQueryFilters($q); })
                ->where('user_id', $user->id)
                ->selectRaw('SUM(duration_minutes) as total_minutes, SUM(CASE WHEN billable = true THEN duration_minutes ELSE 0 END) as billable_minutes, SUM(COALESCE(amount, 0)) as total_value')
                ->first();
            // When using closure above, we need to re-apply - simpler: direct
            $entries = TimeEntry::where('firm_id', $user->firm_id ?? null)->where('user_id', $user->id);
            // Rebuild with actual filters
            return [
                'user_id'          => $user->id,
                'full_name'        => $user->full_name,
                'total_minutes'    => (int) ($agg->total_minutes ?? 0),
                'billable_minutes' => (int) ($agg->billable_minutes ?? 0),
                'total_value'      => (float) ($agg->total_value ?? 0),
            ];
        });

        // Fix timeByUser properly with filtered aggregation
        $timeByUser = User::where('firm_id', $firmId)->where('is_active', true)
            ->when($userId, fn ($q) => $q->where('id', $userId))
            ->get(['id', 'full_name', 'firm_id'])
            ->map(function ($u) use ($firmId, $matterId, $userId, $dateFrom, $dateTo) {
                $q = TimeEntry::where('firm_id', $firmId)->where('user_id', $u->id);
                if ($matterId) $q->where('matter_id', $matterId);
                if ($dateFrom && $dateTo) $q->whereBetween('date', [$dateFrom->toDateString(), $dateTo->toDateString()]);
                $agg = $q->selectRaw('SUM(duration_minutes) as total_minutes, SUM(CASE WHEN billable = true THEN duration_minutes ELSE 0 END) as billable_minutes, SUM(COALESCE(amount, 0)) as total_value')->first();
                return [
                    'user_id'          => $u->id,
                    'full_name'        => $u->full_name,
                    'total_minutes'    => (int) ($agg->total_minutes ?? 0),
                    'billable_minutes' => (int) ($agg->billable_minutes ?? 0),
                    'total_value'      => (float) ($agg->total_value ?? 0),
                ];
            })->filter(fn ($r) => $r['total_minutes'] > 0 || !$matterId && !$dateFrom)->values();

        // Matters by practice area - respects timeframe (opened_at) + filters
        $mattersByPracticeArea = Matter::where('firm_id', $firmId)
            ->when($status, fn ($q) => $q->where('status', $status), fn ($q) => $q->whereIn('status', Matter::ACTIVE_STATUSES))
            ->when($practiceArea, fn ($q) => $q->where('practice_area', $practiceArea))
            ->when($matterId, fn ($q) => $q->where('id', $matterId))
            ->when($userId, fn ($q) => $q->where('responsible_user_id', $userId))
            ->when($dateFrom && $dateTo, fn ($q) => $q->whereBetween('created_at', [$dateFrom, $dateTo]))
            ->select('practice_area', DB::raw('COUNT(*) as count'))
            ->groupBy('practice_area')
            ->orderBy('count', 'desc')
            ->get();

        $filters = $request->only(['timeframe', 'date_from', 'date_to', 'date_field', 'matter_id', 'user_id', 'practice_area', 'status', 'tab']);
        $filterOptions = [
            'matters' => Matter::where('firm_id', $firmId)->orderBy('name')->get(['id', 'name', 'matter_number']),
            'users' => User::where('firm_id', $firmId)->where('is_active', true)->get(['id', 'full_name']),
        ];

        if ($request->input('export') === 'csv') {
            return $this->exportCsv($request->input('tab', 'financial'), $financialSummary, $timeByUser, $mattersByPracticeArea);
        }

        return Inertia::render('Reports/Index', [
            'financialSummary'      => $financialSummary,
            'timeByUser'            => $timeByUser,
            'mattersByPracticeArea' => $mattersByPracticeArea,
            'filters'               => $filters,
            'filterOptions'         => $filterOptions,
        ]);
    }

    private function exportCsv(string $tab, array $summary, $timeByUser, $mattersByPracticeArea)
    {
        $lines = [];
        $lines[] = ['SimpleLaw Reports — ' . ucfirst($tab)];
        $lines[] = ['Generated ' . now()->toDateTimeString()];
        $lines[] = [];

        if ($tab === 'financial') {
            $lines[] = ['Financial Summary'];
            $lines[] = ['Metric', 'Amount'];
            $lines[] = ['Total Invoiced', number_format($summary['total_invoiced'], 2)];
            $lines[] = ['Total Collected', number_format($summary['total_collected'], 2)];
            $lines[] = ['Outstanding', number_format($summary['total_outstanding'], 2)];
            $lines[] = [];
            $lines[] = ['Invoices by Matter'];
            $lines[] = ['Matter', 'Invoices', 'Total', 'Collected', 'Outstanding'];
            foreach ($summary['invoices_by_matter'] as $row) {
                $lines[] = [
                    $row->matter ? ($row->matter->matter_number . ' - ' . $row->matter->name) : $row->matter_id,
                    $row->count,
                    number_format($row->total_amount, 2),
                    number_format($row->collected_amount, 2),
                    number_format($row->outstanding_amount, 2),
                ];
            }
        } elseif ($tab === 'time') {
            $lines[] = ['Time by User'];
            $lines[] = ['User', 'Total Hours', 'Billable Hours', 'Billable %', 'Total Value'];
            foreach ($timeByUser as $row) {
                $billablePct = $row['total_minutes'] > 0
                    ? round($row['billable_minutes'] / $row['total_minutes'] * 100, 1)
                    : 0;
                $lines[] = [
                    $row['full_name'],
                    number_format($row['total_minutes'] / 60, 2),
                    number_format($row['billable_minutes'] / 60, 2),
                    $billablePct . '%',
                    number_format($row['total_value'], 2),
                ];
            }
        } else {
            $lines[] = ['Matters by Practice Area'];
            $lines[] = ['Practice Area', 'Open Matters'];
            foreach ($mattersByPracticeArea as $row) {
                $lines[] = [$row->practice_area ?? 'Unspecified', $row->count];
            }
        }

        $csv = '';
        foreach ($lines as $line) {
            if (empty($line)) {
                $csv .= "\r\n";
                continue;
            }
            $csv .= implode(',', array_map(fn ($v) => $this->csvEscape($v), $line)) . "\r\n";
        }

        return response()->make($csv, 200, [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => 'attachment; filename="reports-' . $tab . '-' . now()->format('Y-m-d') . '.csv"',
        ]);
    }

    private function csvEscape($v): string
    {
        $s = (string) $v;
        if ($s === '') {
            return '';
        }

        $s = str_replace('"', '""', $s);
        $needsQuote = preg_match('/[,\n\r"]/', $s) || preg_match('/^\s|\s$/', $s);

        return $needsQuote ? '"' . $s . '"' : $s;
    }
}