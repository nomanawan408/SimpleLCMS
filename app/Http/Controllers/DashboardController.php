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

        $today     = Carbon::today();
        $weekStart = Carbon::now()->startOfWeek();
        $monthStart = Carbon::now()->startOfMonth();

        $hoursToday = TimeEntry::where('firm_id', $firmId)
            ->whereDate('date', $today)
            ->sum('duration_minutes') / 60;

        $hoursWeek = TimeEntry::where('firm_id', $firmId)
            ->whereBetween('date', [$weekStart, $today])
            ->sum('duration_minutes') / 60;

        $hoursMonth = TimeEntry::where('firm_id', $firmId)
            ->whereBetween('date', [$monthStart, $today])
            ->sum('duration_minutes') / 60;

        $hoursBilled = TimeEntry::where('firm_id', $firmId)
            ->where('billed', true)
            ->whereBetween('date', [$monthStart, $today])
            ->sum('duration_minutes') / 60;

        $totalInvoiced     = Invoice::where('firm_id', $firmId)->sum('total');
        $outstandingInvoices = Invoice::where('firm_id', $firmId)
            ->whereIn('status', ['sent', 'partial'])
            ->sum('total');

        $totalReceived = (float) Payment::where('firm_id', $firmId)->sum('amount');

        $pendingAmount = (float) Invoice::where('firm_id', $firmId)
            ->whereNotIn('status', ['paid', 'cancelled'])
            ->sum(DB::raw('GREATEST(0, total - COALESCE((SELECT SUM(amount) FROM payments WHERE payments.invoice_id = invoices.id), 0))'));

        $trustReceipts      = TrustEntry::where('firm_id', $firmId)->where('type', 'receipt')->sum('amount');
        $trustDisbursements = TrustEntry::where('firm_id', $firmId)->where('type', 'disbursement')->sum('amount');
        $trustBalance       = $trustReceipts - $trustDisbursements;

        $openMattersCount = Matter::where('firm_id', $firmId)
            ->where('status', 'open')
            ->count();

        $overdueTasks = Task::where('firm_id', $firmId)
            ->where('status', '!=', 'done')
            ->whereDate('due_date', '<', $today)
            ->count();

        $recentMatters = Matter::where('firm_id', $firmId)
            ->with(['responsibleUser', 'contacts'])
            ->latest()
            ->take(5)
            ->get();

        $upcomingTasks = Task::where('firm_id', $firmId)
            ->where('status', '!=', 'done')
            ->with('assignee')
            ->orderByRaw('due_date IS NULL, due_date ASC')
            ->take(5)
            ->get();

        return Inertia::render('Dashboard', [
            'stats' => [
                'hours_today'         => round($hoursToday, 1),
                'hours_week'          => round($hoursWeek, 1),
                'hours_month'         => round($hoursMonth, 1),
                'hours_billed'        => round($hoursBilled, 1),
                'total_invoiced'      => (float) $totalInvoiced,
                'outstanding_invoices'=> $outstandingInvoices,
                'total_received'      => $totalReceived,
                'pending_amount'      => $pendingAmount,
                'trust_balance'       => $trustBalance,
                'open_matters'        => $openMattersCount,
                'overdue_tasks'       => $overdueTasks,
            ],
            'recentMatters' => $recentMatters,
            'upcomingTasks' => $upcomingTasks,
        ]);
    }
}
