<?php

namespace App\Http\Controllers;

use App\Models\Invoice;
use App\Models\Matter;
use App\Models\Payment;
use App\Models\Task;
use App\Models\TimeEntry;
use App\Models\TrustEntry;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function index(Request $request): Response|\Illuminate\Http\RedirectResponse
    {
        if ($request->user()->hasRole('super_admin')) {
            return redirect()->route('superadmin.dashboard');
        }

        $user   = $request->user();
        $firmId = $user->firm_id;

        abort_unless($user->is_active, 403);
        $isAdmin = $user->isFirmAdmin();

        $today     = Carbon::today();
        $weekStart = Carbon::now()->startOfWeek();
        $monthStart = Carbon::now()->startOfMonth();

        // Staff see their own hours; admins see the whole firm.
        $hoursScope = fn ($q) => $isAdmin ? $q : $q->where('user_id', $user->id);

        $hoursToday = $hoursScope(TimeEntry::where('firm_id', $firmId))
            ->whereDate('date', $today)
            ->sum('duration_minutes') / 60;

        $hoursWeek = $hoursScope(TimeEntry::where('firm_id', $firmId))
            ->whereBetween('date', [$weekStart, $today])
            ->sum('duration_minutes') / 60;

        $hoursMonth = $hoursScope(TimeEntry::where('firm_id', $firmId))
            ->whereBetween('date', [$monthStart, $today])
            ->sum('duration_minutes') / 60;

        // Open = everything still being worked, including all awaiting_*
        // statuses. Only closed/archived matters are finished (see
        // Matter::CLOSED_STATUSES). All counts respect matter visibility:
        // staff only ever count their assigned matters.
        $matterBase = Matter::where('firm_id', $firmId)->visibleTo($user);
        $openMattersCount = (clone $matterBase)->open()->count();

        // Dashboard matter-state row. The four buckets partition every
        // status, so the cards always add up to the visible total.
        $openedMattersCount     = (clone $matterBase)->whereIn('status', Matter::OPENED_STATUSES)->count();
        $inProgressMattersCount = (clone $matterBase)->whereIn('status', Matter::PROGRESS_STATUSES)->count();
        $onHoldMattersCount     = (clone $matterBase)->where('status', 'on_hold')->count();
        $closedMattersCount     = (clone $matterBase)->closed()->count();

        $taskBase = Task::where('firm_id', $firmId)->visibleTo($user);

        $overdueTasks = (clone $taskBase)
            ->where('status', '!=', 'done')
            ->whereDate('due_date', '<', $today)
            ->count();

        $recentMatters = Matter::where('firm_id', $firmId)
            ->visibleTo($user)
            ->with(['responsibleUser', 'contacts'])
            ->latest()
            ->take(5)
            ->get();

        // Widget window: overdue tasks stay listed only while within 3 days
        // past due. Older overdues remain in the overdue count and the Tasks
        // page — the widget stays actionable instead of clogging.
        $upcomingTasks = Task::where('firm_id', $firmId)
            ->visibleTo($user)
            ->where('status', '!=', 'done')
            ->where(function ($q) use ($today) {
                $q->whereNull('due_date')
                    ->orWhereDate('due_date', '>=', $today->copy()->subDays(3));
            })
            ->with('assignee')
            ->orderByRaw('due_date IS NULL, due_date ASC')
            ->take(5)
            ->get();

        // Financial KPIs + billing data are only exposed to roles that can view
        // financials (firm_admin, accounts). Everyone else gets a restricted,
        // non-financial dashboard scoped to their tasks and matters.
        $viewFinancial = $user->canAccessFinancials();

        $stats = [
            'hours_today'         => round($hoursToday, 1),
            'hours_week'          => round($hoursWeek, 1),
            'hours_month'         => round($hoursMonth, 1),
            'open_matters'        => $openMattersCount,
            'opened_matters'      => $openedMattersCount,
            'in_progress_matters' => $inProgressMattersCount,
            'on_hold_matters'     => $onHoldMattersCount,
            'closed_matters'      => $closedMattersCount,
            'overdue_tasks'       => $overdueTasks,
        ];

        if ($viewFinancial) {
            // Staff with financial access see money for their assigned
            // matters only; admins see the whole firm.
            $visibleMatterIds = $isAdmin ? null : Matter::where('firm_id', $firmId)
                ->visibleTo($user)
                ->pluck('id')
                ->all();
            $invoiceScope = fn ($q) => $visibleMatterIds === null
                ? $q
                : $q->whereIn('matter_id', $visibleMatterIds);

            $hoursBilled = $hoursScope(TimeEntry::where('firm_id', $firmId))
                ->where('billed', true)
                ->whereBetween('date', [$monthStart, $today])
                ->sum('duration_minutes') / 60;

            $totalInvoiced       = $invoiceScope(Invoice::where('firm_id', $firmId))->whereNotIn('status', ['cancelled'])->sum('total');
            $outstandingInvoices = $invoiceScope(Invoice::where('firm_id', $firmId))
                ->whereIn('status', ['sent', 'partial'])
                ->sum(DB::raw('GREATEST(0, total - COALESCE((SELECT SUM(amount) FROM payments WHERE payments.invoice_id = invoices.id), 0))'));

            $totalReceived = (float) Payment::where('firm_id', $firmId)
                ->when($visibleMatterIds !== null, fn ($q) => $q->whereHas('invoice', fn ($qq) => $qq->whereIn('matter_id', $visibleMatterIds)))
                ->sum('amount');

            $pendingAmount = (float) $invoiceScope(Invoice::where('firm_id', $firmId))
                ->whereNotIn('status', ['paid', 'cancelled'])
                ->sum(DB::raw('GREATEST(0, total - COALESCE((SELECT SUM(amount) FROM payments WHERE payments.invoice_id = invoices.id), 0))'));

            $trustBase = TrustEntry::where('firm_id', $firmId);
            if ($visibleMatterIds !== null) {
                $trustBase->whereIn('matter_id', $visibleMatterIds);
            }
            $trustReceipts      = (clone $trustBase)->where('type', 'receipt')->sum('amount');
            $trustDisbursements = (clone $trustBase)->where('type', 'disbursement')->sum('amount');

            $stats['hours_billed']          = round($hoursBilled, 1);
            $stats['total_invoiced']        = (float) $totalInvoiced;
            $stats['outstanding_invoices']  = $outstandingInvoices;
            $stats['total_received']        = $totalReceived;
            $stats['pending_amount']        = $pendingAmount;
            $stats['trust_balance']         = $trustReceipts - $trustDisbursements;
        }

        return Inertia::render('Dashboard', [
            'stats'         => $stats,
            'viewFinancial' => $viewFinancial,
            'recentMatters' => $recentMatters,
            'upcomingTasks' => $upcomingTasks,
        ]);
    }
}