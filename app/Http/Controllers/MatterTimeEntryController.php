<?php

namespace App\Http\Controllers;

use App\Models\Matter;
use App\Models\TimeEntry;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response as SymfonyResponse;

class MatterTimeEntryController extends Controller
{
    public function store(Matter $matter, Request $request): SymfonyResponse
    {
        $this->authorize('update', $matter);

        $validated = $request->validate([
            'date'             => ['required', 'date'],
            'duration_minutes' => ['required', 'integer', 'min:1'],
            'rate'             => ['nullable', 'numeric', 'min:0'],
            'billable'         => ['required', 'boolean'],
            'description'      => ['nullable', 'string'],
        ]);

        $rate = $validated['rate'] ?? ($request->user()->rate_per_hour ?? 0);
        $amount = ((float) $rate) * ((int) $validated['duration_minutes'] / 60);

        $entry = TimeEntry::create([
            'firm_id'          => $request->user()->firm_id,
            'matter_id'        => $matter->id,
            'user_id'          => $request->user()->id,
            'invoice_id'       => null,
            'date'             => $validated['date'],
            'duration_minutes' => (int) $validated['duration_minutes'],
            'rate'             => $rate,
            'amount'           => $amount,
            'billable'         => (bool) $validated['billable'],
            'billed'           => false,
            'activity_type'    => null,
            'description'      => $validated['description'] ?? null,
            'is_locked'        => false,
        ]);

        activity()->causedBy($request->user())->performedOn($matter)->log('time_logged');

        if ($request->expectsJson()) {
            return response()->json(['time_entry' => $entry->load('user')]);
        }

        return back()->with('success', 'Time logged.');
    }
}
