<?php

namespace App\Http\Controllers;

use App\Http\Requests\Matter\StoreMatterRequest;
use App\Http\Requests\Matter\UpdateMatterRequest;
use App\Models\CalendarEvent;
use App\Models\Contact;
use App\Models\Matter;
use App\Models\Task;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class MatterController extends Controller
{
    public function index(Request $request): Response
    {
        $this->authorize('viewAny', Matter::class);

        $query = Matter::where('firm_id', $request->user()->firm_id)
            ->with(['responsibleUser', 'contacts', 'tasks' => fn ($q) => $q->whereIn('status', ['todo', 'in_progress'])->whereNull('completed_at')->orderBy('due_date')->with('assignee'), 'calendarEvents' => fn ($q) => $q->where('is_court_date', true)->where('start_at', '>=', now())->orderBy('start_at')])
            ->orderBy('created_at', 'desc');

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('practice_area')) {
            $query->where('practice_area', $request->practice_area);
        }

        if ($request->filled('priority')) {
            $query->where('priority', $request->priority);
        }

        if ($request->filled('search')) {
            $query->where(function ($q) use ($request) {
                $q->where('name', 'like', "%{$request->search}%")
                  ->orWhere('matter_number', 'like', "%{$request->search}%");
            });
        }

        $matters = $query->paginate(20)->withQueryString();

        return Inertia::render('Matters/Index', [
            'matters' => $matters,
            'filters' => $request->only('status', 'practice_area', 'priority', 'search'),
        ]);
    }

    public function create(Request $request): Response
    {
        $this->authorize('create', Matter::class);

        $firmId = $request->user()->firm_id;

        $prefillContactId = null;
        if ($request->filled('contact_id')) {
            $prefillContactId = Contact::where('firm_id', $firmId)
                ->where('id', $request->input('contact_id'))
                ->value('id');
        }

        return Inertia::render('Matters/Create', [
            'users' => User::where('firm_id', $firmId)
                ->where('is_active', true)
                ->whereHas('roles', fn ($q) => $q->whereIn('name', ['firm_admin', 'manager', 'solicitor', 'lawyer', 'barrister', 'consultant']))
                ->get(['id', 'full_name', 'role']),
            'contacts' => Contact::where('firm_id', $firmId)
                ->orderBy('name')
                ->get(['id', 'name', 'type', 'email']),
            'prefill_contact_id' => $prefillContactId,
            'viewFinancial' => $request->user()->canAccessFinancials(),
        ]);
    }

    public function store(StoreMatterRequest $request): RedirectResponse
    {
        $this->authorize('create', Matter::class);

        $firm   = $request->user()->firm;
        $number = $firm->nextInvoiceNumber();

        $matter = Matter::create([
            ...$request->validated(),
            'firm_id'       => $request->user()->firm_id,
            'matter_number' => $this->generateMatterNumber($request->user()->firm_id, $request->contact_ids[0] ?? null),
            'opened_at'     => now(),
        ]);

        if ($request->filled('contact_ids')) {
            foreach ($request->contact_ids as $contactId) {
                $matter->contacts()->attach($contactId, ['role' => 'client']);
            }
        }

        activity()->causedBy($request->user())->performedOn($matter)->log('created');

        return redirect()->route('matters.show', $matter)->with('success', 'Matter created successfully.');
    }

    public function show(Matter $matter, Request $request): Response
    {
        $this->authorize('view', $matter);

        $viewFinancial = $request->user()->canAccessFinancials();

        $matter->load([
            'responsibleUser', 'originatingUser', 'contacts',
            'notes' => fn ($q) => $q->latest()->take(10),
            'notes.user',
            'tasks' => fn ($q) => $q->where('status', '!=', 'done')->orderBy('due_date'),
            'timeEntries' => fn ($q) => $q->latest()->take(10),
            'timeEntries.user',
            'documents' => fn ($q) => $q->latest()->take(10),
            'documents.uploadedBy',
        ]);

        // Financial relations (invoices, expenses, trust entries) are only
        // loaded for roles that can view financials (firm_admin, accounts).
        if ($viewFinancial) {
            $matter->load([
                'invoices' => fn ($q) => $q->latest()->take(5)->withSum('payments as amount_paid', 'amount'),
                // Not take(10): the expenses tab shows a count and a Total
                // computed from this collection, so a slice made both wrong.
                'expenses' => fn ($q) => $q->latest(),
                'expenses.user',
                'trustEntries' => fn ($q) => $q->latest()->take(10),
            ]);
        }

        return Inertia::render('Matters/Show', [
            'matter' => $matter,
            'users'  => User::where('firm_id', $matter->firm_id)
                ->where('is_active', true)
                ->get(['id', 'full_name']),
            'viewFinancial' => $viewFinancial,
            'activeTimer' => session('active_timer_' . $request->user()->id),
        ]);
    }

    public function edit(Matter $matter, Request $request): Response
    {
        $this->authorize('update', $matter);

        $firmId = $request->user()->firm_id;

        $matter->load(['contacts']);

        return Inertia::render('Matters/Edit', [
            'matter' => $matter,
            'users' => User::where('firm_id', $firmId)
                ->where('is_active', true)
                ->whereHas('roles', fn ($q) => $q->whereIn('name', ['firm_admin', 'manager', 'solicitor', 'lawyer', 'barrister', 'consultant']))
                ->get(['id', 'full_name', 'role']),
            'contacts' => Contact::where('firm_id', $firmId)
                ->orderBy('name')
                ->get(['id', 'name', 'type', 'email']),
            'viewFinancial' => $request->user()->canAccessFinancials(),
        ]);
    }

    public function update(UpdateMatterRequest $request, Matter $matter): RedirectResponse
    {
        $this->authorize('update', $matter);

        $matter->update($request->validated());

        activity()->causedBy($request->user())->performedOn($matter)->log('updated');

        return back()->with('success', 'Matter updated successfully.');
    }

    public function destroy(Matter $matter, Request $request): RedirectResponse
    {
        $this->authorize('delete', $matter);

        $matter->delete();

        activity()->causedBy($request->user())->performedOn($matter)->log('deleted');

        return redirect()->route('matters.index')->with('success', 'Matter deleted.');
    }

    public function updateHearingDate(Matter $matter, Request $request): RedirectResponse
    {
        $this->authorize('update', $matter);

        $validated = $request->validate([
            'hearing_date' => ['nullable', 'date'],
        ]);

        $date = $validated['hearing_date'] ?? null;

        $existing = CalendarEvent::where('matter_id', $matter->id)
            ->where('is_court_date', true)
            ->where('start_at', '>=', now())
            ->orderBy('start_at')
            ->first();

        if ($date) {
            if ($existing) {
                $existing->update(['start_at' => $date . ' 10:00:00']);
            } else {
                CalendarEvent::create([
                    'firm_id'       => $matter->firm_id,
                    'matter_id'     => $matter->id,
                    'created_by_id' => $request->user()->id,
                    'title'         => 'Court Hearing — ' . $matter->name,
                    'type'          => 'court_date',
                    'start_at'      => $date . ' 10:00:00',
                    'end_at'        => $date . ' 11:00:00',
                    'is_court_date' => true,
                ]);
            }
        } elseif ($existing) {
            $existing->delete();
        }

        return back()->with('success', 'Hearing date updated.');
    }

    public function updateDeadline(Matter $matter, Request $request): RedirectResponse
    {
        $this->authorize('update', $matter);

        $validated = $request->validate([
            'deadline' => ['nullable', 'date'],
        ]);

        $date = $validated['deadline'] ?? null;

        // Find the task that currently represents the deadline (earliest non-null due_date)
        $task = $matter->tasks()
            ->whereIn('status', ['todo', 'in_progress'])
            ->whereNull('completed_at')
            ->whereNotNull('due_date')
            ->orderBy('due_date')
            ->first();

        if ($task) {
            $task->update(['due_date' => $date]);
        } elseif ($date) {
            // No task has a due_date — update the first open task or create one
            $firstTask = $matter->tasks()
                ->whereIn('status', ['todo', 'in_progress'])
                ->whereNull('completed_at')
                ->first();

            if ($firstTask) {
                $firstTask->update(['due_date' => $date]);
            } else {
                Task::create([
                    'firm_id'       => $matter->firm_id,
                    'matter_id'     => $matter->id,
                    'created_by_id' => $request->user()->id,
                    'title'         => 'Deadline — ' . $matter->name,
                    'priority'      => 'high',
                    'status'        => 'todo',
                    'due_date'      => $date,
                ]);
            }
        }

        return back()->with('success', 'Deadline updated.');
    }

    private function generateMatterNumber(string $firmId, ?string $contactId = null): string
    {
        $datePart = now()->format('Ymd');

        $initials = 'XX';
        if ($contactId) {
            $contact = Contact::where('id', $contactId)->first();
            if ($contact) {
                $parts = array_filter([
                    $contact->first_name,
                    $contact->last_name,
                ]);
                if (count($parts) >= 2) {
                    $initials = strtoupper(mb_substr($parts[0], 0, 1) . mb_substr($parts[1], 0, 1));
                } elseif (count($parts) === 1) {
                    $initials = strtoupper(mb_substr($parts[0], 0, 2));
                } else {
                    $nameParts = array_filter(explode(' ', trim($contact->name ?? '')));
                    if (count($nameParts) >= 2) {
                        $initials = strtoupper(mb_substr($nameParts[0], 0, 1) . mb_substr($nameParts[1], 0, 1));
                    } elseif (count($nameParts) === 1) {
                        $initials = strtoupper(mb_substr($nameParts[0], 0, 2));
                    }
                }
            }
        }

        $prefix = "{$datePart}-{$initials}";

        // Global sequential per firm — suffix must progress across all matters,
        // not reset per date+initials (bug: every new client/day got 00001).
        // Requirement: sequence starts at 00100. Use MAX suffix so jumping to
        // 00100 for existing data is respected and soft-deleted numbers are still
        // reserved.
        $maxSuffix = Matter::where('firm_id', $firmId)
            ->withTrashed()
            ->get(['matter_number'])
            ->map(fn ($m) => (int) substr($m->matter_number, -5))
            ->filter(fn ($n) => $n > 0)
            ->max();

        $serial = max(100, ($maxSuffix ?? 99) + 1);

        $candidate = $prefix . '-' . str_pad($serial, 5, '0', STR_PAD_LEFT);
        while (Matter::where('firm_id', $firmId)->withTrashed()->where('matter_number', $candidate)->exists()) {
            $serial++;
            $candidate = $prefix . '-' . str_pad($serial, 5, '0', STR_PAD_LEFT);
        }

        return $candidate;
    }
}
