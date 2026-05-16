<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Spatie\Activitylog\Models\Activity;

class ActivityController extends Controller
{
    public function index(Request $request): Response
    {
        $firmId = $request->user()->firm_id;

        $userIds = User::where('firm_id', $firmId)->pluck('id');

        $activities = Activity::whereIn('causer_id', $userIds)
            ->where('causer_type', 'App\\Models\\User')
            ->with('causer')
            ->orderBy('created_at', 'desc')
            ->paginate(50)
            ->withQueryString();

        return Inertia::render('Activities/Index', [
            'activities' => $activities,
        ]);
    }
}
