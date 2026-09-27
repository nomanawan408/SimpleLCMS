<?php

namespace App\Http\Controllers;

use App\Models\CalendarEvent;
use App\Models\Matter;
use App\Models\Task;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class CalendarController extends Controller
{
    public function index(Request $request): Response
    {
        abort_unless($request->user()->is_active, 403);

        $firmId = $request->user()->firm_id;
        $year   = (int) ($request->query('year', now()->year));
        $month  = (int) ($request->query('month', now()->month));

        $start = \Carbon\Carbon::create($year, $month, 1)->startOfMonth();
        $end   = $start->copy()->endOfMonth();

        $events = CalendarEvent::where('firm_id', $firmId)
            ->when(! $request->user()->isFirmAdmin(), fn ($q) => $q->where(function ($qq) use ($request) {
                $qq->where('created_by_id', $request->user()->id)
                    ->orWhereHas('matter', fn ($qqq) => $qqq->visibleTo($request->user()));
            }))
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
            ->visibleTo($request->user())
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
                    // due_date is a full datetime (deadlines carry a time) —
                    // show the real stored time instead of a pinned hour.
                    'start_at'      => $task->due_date->toIso8601String(),
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
            'matters' => Matter::where('firm_id', $firmId)->visibleTo($request->user())->orderBy('name')->get(['id', 'name', 'matter_number']),
            'year'    => $year,
            'month'   => $month,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        abort_unless($request->user()->is_active, 403);

        $firmId = $request->user()->firm_id;

        $validated = $request->validate([
            'title'        => ['required', 'string', 'max:255'],
            'type'         => ['required', 'in:appointment,court_date,deadline,consultation,other'],
            'matter_id'    => ['nullable', 'uuid', Rule::exists('matters', 'id')->where(fn ($q) => $q->where('firm_id', $firmId))],
            'start_at'     => ['required', 'date'],
            'end_at'       => ['nullable', 'date', 'after_or_equal:start_at'],
            'location'     => ['nullable', 'string', 'max:255'],
            'is_court_date' => ['boolean'],
        ]);

        if (! empty($validated['matter_id'])) {
            $target = Matter::where('firm_id', $firmId)
                ->visibleTo($request->user())
                ->where('id', $validated['matter_id'])
                ->first();
            abort_unless($target, 403);
            $target->ensureMutableBy($request->user());
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
        abort_unless($request->user()->is_active, 403);

        if ($event->firm_id !== $request->user()->firm_id) {
            abort(403);
        }

        $firmId = $request->user()->firm_id;

        $validated = $request->validate([
            'title'        => ['sometimes', 'required', 'string', 'max:255'],
            'type'         => ['sometimes', 'required', 'in:appointment,court_date,deadline,consultation,other'],
            'matter_id'    => ['nullable', 'uuid', Rule::exists('matters', 'id')->where(fn ($q) => $q->where('firm_id', $firmId))],
            'start_at'     => ['sometimes', 'required', 'date'],
            'end_at'       => ['nullable', 'date'],
            'location'     => ['nullable', 'string', 'max:255'],
            'is_court_date' => ['boolean'],
        ]);

        if (isset($validated['end_at']) && $validated['end_at'] === null && isset($validated['start_at'])) {
            $validated['end_at'] = \Carbon\Carbon::parse($validated['start_at'])->addHour();
        }

        $this->authorizeEvent($request, $event);

        // Moving to another matter needs visibility of the destination too.
        // Detaching to a personal event only needs the access just checked.
        if (array_key_exists('matter_id', $validated)
            && $validated['matter_id'] !== null
            && $validated['matter_id'] !== $event->matter_id
            && ! $request->user()->isFirmAdmin()
        ) {
            $destination = Matter::where('firm_id', $request->user()->firm_id)
                ->visibleTo($request->user())
                ->where('id', $validated['matter_id'])
                ->first();
            abort_unless($destination, 403);
            $destination->ensureMutableBy($request->user());
        }

        $event->update($validated);

        activity()->causedBy($request->user())->performedOn($event)->log('updated');

        return response()->json(['event' => $event->load(['matter', 'createdBy'])]);
    }

    /**
     * Firm admins act on any firm event. Everyone else: personal events are
     * creator-only, matter events require a visible AND open matter (closed
     * files are a frozen archive for lawyers).
     */
    private function authorizeEvent(Request $request, CalendarEvent $event): void
    {
        $user = $request->user();
        if ($user->isFirmAdmin()) {
            return;
        }
        if ($event->matter_id === null) {
            abort_unless($event->created_by_id === $user->id, 403);
            return;
        }
        $matter = Matter::where('firm_id', $user->firm_id)->visibleTo($user)->where('id', $event->matter_id)->first();
        abort_unless($matter, 403);
        $matter->ensureMutableBy($user);
    }

    public function destroy(Request $request, CalendarEvent $event): JsonResponse
    {
        abort_unless($request->user()->is_active, 403);

        if ($event->firm_id !== $request->user()->firm_id) {
            abort(403);
        }

        $this->authorizeEvent($request, $event);

        activity()->causedBy($request->user())->performedOn($event)->log('deleted');

        $event->delete();

        return response()->json(['message' => 'Event deleted.']);
    }
}
