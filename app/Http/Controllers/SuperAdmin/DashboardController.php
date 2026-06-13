<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Http\Controllers\Controller;
use App\Models\Firm;
use App\Models\User;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function index(Request $request): Response
    {
        abort_unless($request->user()->hasRole('super_admin'), 403);

        $totalFirms = Firm::count();
        $activeFirms = Firm::where('subscription_status', 'active')->count();
        $trialFirms = Firm::where('subscription_status', 'trial')->count();
        $cancelledFirms = Firm::where('subscription_status', 'cancelled')->count();

        $totalUsers = User::count();
        $activeUsers = User::where('is_active', true)->count();

        $recentFirms = Firm::withCount('users')
            ->latest()
            ->take(5)
            ->get(['id', 'name', 'slug', 'plan', 'subscription_status', 'trial_ends_at', 'created_at']);

        $planBreakdown = Firm::selectRaw('plan, count(*) as count')
            ->groupBy('plan')
            ->pluck('count', 'plan');

        return Inertia::render('SuperAdmin/Dashboard', [
            'stats' => [
                'total_firms'    => $totalFirms,
                'active_firms'   => $activeFirms,
                'trial_firms'    => $trialFirms,
                'cancelled_firms'=> $cancelledFirms,
                'total_users'    => $totalUsers,
                'active_users'   => $activeUsers,
            ],
            'recentFirms'    => $recentFirms,
            'planBreakdown'  => $planBreakdown,
        ]);
    }
}
