<?php

namespace App\Http\Controllers;

use App\Models\Invoice;
use App\Models\Matter;
use App\Models\TimeEntry;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class ReportController extends Controller
{
    public function index(Request $request): Response
    {
        $firmId = $request->user()->firm_id;

        $financialSummary = [
            'total_invoiced'   => Invoice::where('firm_id', $firmId)->sum('total'),
            'total_collected'  => Invoice::where('firm_id', $firmId)->where('status', 'paid')->sum('total'),
            'total_outstanding' => Invoice::where('firm_id', $firmId)->whereIn('status', ['sent', 'partial'])->sum('total'),
            'invoices_by_matter' => Invoice::where('firm_id', $firmId)
                ->with('matter:id,name,matter_number')
                ->select('matter_id', DB::raw('COUNT(*) as count'), DB::raw('SUM(total) as total_amount'), DB::raw('SUM(CASE WHEN status = \'paid\' THEN total ELSE 0 END) as paid_amount'))
                ->groupBy('matter_id')
                ->orderBy('total_amount', 'desc')
                ->limit(20)
                ->get(),
        ];

        $timeByUser = User::where('firm_id', $firmId)
            ->where('is_active', true)
            ->get(['id', 'full_name'])
            ->map(function ($user) use ($firmId) {
                $entries = TimeEntry::where('firm_id', $firmId)
                    ->where('user_id', $user->id)
                    ->selectRaw('SUM(duration_minutes) as total_minutes, SUM(CASE WHEN billable = true THEN duration_minutes ELSE 0 END) as billable_minutes, SUM(COALESCE(amount, 0)) as total_value')
                    ->first();

                return [
                    'user_id'          => $user->id,
                    'full_name'        => $user->full_name,
                    'total_minutes'    => (int) ($entries->total_minutes ?? 0),
                    'billable_minutes' => (int) ($entries->billable_minutes ?? 0),
                    'total_value'      => (float) ($entries->total_value ?? 0),
                ];
            });

        $mattersByPracticeArea = Matter::where('firm_id', $firmId)
            ->where('status', 'open')
            ->select('practice_area', DB::raw('COUNT(*) as count'))
            ->groupBy('practice_area')
            ->orderBy('count', 'desc')
            ->get();

        return Inertia::render('Reports/Index', [
            'financialSummary'      => $financialSummary,
            'timeByUser'            => $timeByUser,
            'mattersByPracticeArea' => $mattersByPracticeArea,
        ]);
    }
}
