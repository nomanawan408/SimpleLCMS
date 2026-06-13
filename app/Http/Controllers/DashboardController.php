<?php

namespace App\Http\Controllers;

use App\Models\Invoice;
use App\Models\Matter;
use App\Models\Task;
use App\Models\TimeEntry;
use App\Models\TrustEntry;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
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

        $today   = Carbon::today();
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

        $outstandingInvoices = Invoice::where('firm_id', $firmId)
            ->whereIn('status', ['sent', 'partial'])
            ->sum('total');

        $trustBalance = TrustEntry::where('firm_id', $firmId)
            ->latest('created_at')
            ->value('balance_after') ?? 0;

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
            ->whereDate('due_date', '>=', $today)
            ->orderBy('due_date')
            ->take(5)
            ->get();

        return Inertia::render('Dashboard', [
            'stats' => [
                'hours_today'          => round($hoursToday, 1),
                'hours_week'           => round($hoursWeek, 1),
                'hours_month'          => round($hoursMonth, 1),
                'hours_billed'         => round($hoursBilled, 1),
                'outstanding_invoices' => $outstandingInvoices,
                'trust_balance'        => $trustBalance,
                'open_matters'         => $openMattersCount,
                'overdue_tasks'        => $overdueTasks,
            ],
            'recentMatters' => $recentMatters,
            'upcomingTasks' => $upcomingTasks,
        ]);
    }
}
