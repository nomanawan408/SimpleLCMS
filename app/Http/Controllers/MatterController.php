<?php

namespace App\Http\Controllers;

use App\Http\Requests\Matter\StoreMatterRequest;
use App\Http\Requests\Matter\UpdateMatterRequest;
use App\Models\Contact;
use App\Models\Matter;
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
            ->with(['responsibleUser', 'contacts', 'tasks' => fn ($q) => $q->whereIn('status', ['todo', 'in_progress'])->whereNull('completed_at')->orderBy('due_date'), 'calendarEvents' => fn ($q) => $q->where('is_court_date', true)->where('start_at', '>=', now())->orderBy('start_at')])
            ->orderBy('created_at', 'desc');

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('practice_area')) {
            $query->where('practice_area', $request->practice_area);
        }

        if ($request->filled('search')) {
            $query->where(function ($q) use ($request) {
                $q->where('name', 'ilike', "%{$request->search}%")
                  ->orWhere('matter_number', 'ilike', "%{$request->search}%");
            });
        }

        $matters = $query->paginate(20)->withQueryString();

        return Inertia::render('Matters/Index', [
            'matters' => $matters,
            'filters' => $request->only('status', 'practice_area', 'search'),
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
                ->whereIn('role', ['administrator', 'manager', 'solicitor', 'lawyer', 'barrister', 'consultant'])
                ->get(['id', 'full_name', 'role']),
            'contacts' => Contact::where('firm_id', $firmId)
                ->orderBy('name')
                ->get(['id', 'name', 'type', 'email']),
            'prefill_contact_id' => $prefillContactId,
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
            'matter_number' => $this->generateMatterNumber($request->user()->firm_id),
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

        $matter->load([
            'responsibleUser', 'originatingUser', 'contacts',
            'notes' => fn ($q) => $q->latest()->take(10),
            'notes.user',
            'tasks' => fn ($q) => $q->where('status', '!=', 'done')->orderBy('due_date'),
            'invoices' => fn ($q) => $q->latest()->take(5),
            'timeEntries' => fn ($q) => $q->latest()->take(10),
            'timeEntries.user',
            'expenses' => fn ($q) => $q->latest()->take(10),
            'documents' => fn ($q) => $q->latest()->take(10),
            'documents.uploadedBy',
            'trustEntries' => fn ($q) => $q->latest()->take(10),
        ]);

        return Inertia::render('Matters/Show', [
            'matter' => $matter,
            'users'  => User::where('firm_id', $matter->firm_id)
                ->where('is_active', true)
                ->get(['id', 'full_name']),
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
                ->whereIn('role', ['administrator', 'manager', 'solicitor', 'lawyer', 'barrister', 'consultant'])
                ->get(['id', 'full_name', 'role']),
            'contacts' => Contact::where('firm_id', $firmId)
                ->orderBy('name')
                ->get(['id', 'name', 'type', 'email']),
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

    private function generateMatterNumber(string $firmId): string
    {
        $count = Matter::where('firm_id', $firmId)->withTrashed()->count() + 1;
        return 'M-' . now()->year . '-' . str_pad($count, 4, '0', STR_PAD_LEFT);
    }
}
