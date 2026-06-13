<?php

namespace App\Http\Controllers;

use App\Models\CalendarEvent;
use App\Models\Matter;
use App\Models\Task;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class CalendarController extends Controller
{
    public function index(Request $request): Response
    {
        $firmId = $request->user()->firm_id;
        $year   = (int) ($request->query('year', now()->year));
        $month  = (int) ($request->query('month', now()->month));

        $start = \Carbon\Carbon::create($year, $month, 1)->startOfMonth();
        $end   = $start->copy()->endOfMonth();

        $events = CalendarEvent::where('firm_id', $firmId)
            ->whereBetween('start_at', [$start, $end])
            ->with(['matter', 'createdBy'])
            ->orderBy('start_at')
            ->get()
            ->map(function ($event) {
                return [
                    'id'            => $event->id,
                    'firm_id'       => $event->firm_id,
                    'matter_id'     => $event->matter_id,
                    'title'         => $event->title,
                    'type'          => $event->type,
                    'start_at'      => $event->start_at->toIso8601String(),
                    'end_at'        => $event->end_at?->toIso8601String(),
                    'location'      => $event->location,
                    'is_court_date' => $event->is_court_date,
                    'source'        => 'event',
                    'matter'        => $event->matter ? [
                        'id'            => $event->matter->id,
                        'name'          => $event->matter->name,
                        'matter_number' => $event->matter->matter_number,
                    ] : null,
                    'status'        => null,
                ];
            });

        $tasks = Task::where('firm_id', $firmId)
            ->whereNotNull('due_date')
            ->whereBetween('due_date', [$start->toDateString(), $end->toDateString()])
            ->with('matter')
            ->get()
            ->map(function ($task) use ($year, $month) {
                return [
                    'id'            => $task->id,
                    'firm_id'       => $task->firm_id,
                    'matter_id'     => $task->matter_id,
                    'title'         => $task->title,
                    'type'          => 'task_deadline',
                    'start_at'      => $task->due_date->setTime(9, 0)->toIso8601String(),
                    'end_at'        => null,
                    'location'      => null,
                    'is_court_date' => false,
                    'source'        => 'task',
                    'matter'        => $task->matter ? [
                        'id'            => $task->matter->id,
                        'name'          => $task->matter->name,
                        'matter_number' => $task->matter->matter_number,
                    ] : null,
                    'status'        => $task->status,
                ];
            });

        $allEvents = collect($events)->merge($tasks)->sortBy('start_at')->values()->all();

        return Inertia::render('Calendar/Index', [
            'events'  => $allEvents,
            'matters' => Matter::where('firm_id', $firmId)->orderBy('name')->get(['id', 'name', 'matter_number']),
            'year'    => $year,
            'month'   => $month,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'title'        => ['required', 'string', 'max:255'],
            'type'         => ['required', 'in:appointment,court_date,deadline,consultation,other'],
            'matter_id'    => ['nullable', 'uuid', 'exists:matters,id'],
            'start_at'     => ['required', 'date'],
            'end_at'       => ['nullable', 'date', 'after_or_equal:start_at'],
            'location'     => ['nullable', 'string', 'max:255'],
            'is_court_date' => ['boolean'],
        ]);

        if (!empty($validated['matter_id'])) {
            $matter = Matter::find($validated['matter_id']);
            if ($matter && $matter->firm_id !== $request->user()->firm_id) {
                abort(403);
            }
        }

        $event = CalendarEvent::create([
            ...$validated,
            'end_at'        => $validated['end_at'] ?? \Carbon\Carbon::parse($validated['start_at'])->addHour(),
            'firm_id'       => $request->user()->firm_id,
            'created_by_id' => $request->user()->id,
        ]);

        activity()->causedBy($request->user())->performedOn($event)->log('created');

        return response()->json(['event' => $event->load(['matter', 'createdBy'])]);
    }

    public function update(Request $request, CalendarEvent $event): JsonResponse
    {
        if ($event->firm_id !== $request->user()->firm_id) {
            abort(403);
        }

        $validated = $request->validate([
            'title'        => ['sometimes', 'required', 'string', 'max:255'],
            'type'         => ['sometimes', 'required', 'in:appointment,court_date,deadline,consultation,other'],
            'matter_id'    => ['nullable', 'uuid', 'exists:matters,id'],
            'start_at'     => ['sometimes', 'required', 'date'],
            'end_at'       => ['nullable', 'date'],
            'location'     => ['nullable', 'string', 'max:255'],
            'is_court_date' => ['boolean'],
        ]);

        if (isset($validated['end_at']) && $validated['end_at'] === null && isset($validated['start_at'])) {
            $validated['end_at'] = \Carbon\Carbon::parse($validated['start_at'])->addHour();
        }

        $event->update($validated);

        activity()->causedBy($request->user())->performedOn($event)->log('updated');

        return response()->json(['event' => $event->load(['matter', 'createdBy'])]);
    }

    public function destroy(Request $request, CalendarEvent $event): JsonResponse
    {
        if ($event->firm_id !== $request->user()->firm_id) {
            abort(403);
        }

        activity()->causedBy($request->user())->performedOn($event)->log('deleted');

        $event->delete();

        return response()->json(['message' => 'Event deleted.']);
    }
}
