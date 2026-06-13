<?php

namespace App\Http\Controllers;

use App\Models\Contact;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response as SymfonyResponse;
use Inertia\Inertia;
use Inertia\Response;

class ContactController extends Controller
{
    public function index(Request $request): Response
    {
        $this->authorize('viewAny', Contact::class);

        $contacts = Contact::where('firm_id', $request->user()->firm_id)
            ->when($request->search, fn ($q) => $q->where('name', 'ilike', "%{$request->search}%")
                ->orWhere('email', 'ilike', "%{$request->search}%"))
            ->when($request->type, fn ($q) => $q->where('type', $request->type))
            ->when($request->lead_status, fn ($q) => $q->where('lead_status', $request->lead_status))
            ->orderBy('name')
            ->paginate(25)
            ->withQueryString();

        return Inertia::render('Contacts/Index', [
            'contacts' => $contacts,
            'filters'  => $request->only('search', 'type', 'lead_status'),
        ]);
    }

    public function create(): Response
    {
        $this->authorize('create', Contact::class);
        return Inertia::render('Contacts/Create');
    }

    public function store(Request $request): SymfonyResponse
    {
        $this->authorize('create', Contact::class);

        $validated = $request->validate([
            'type'       => ['required', 'in:individual,company,other_party'],
            'name'       => ['required', 'string', 'max:255'],
            'email'      => ['nullable', 'email', 'max:255'],
            'phone'      => ['nullable', 'string', 'max:50'],
            'national_insurance_number' => ['nullable', 'string'],
            'dob'        => ['nullable', 'date'],
            'address'    => ['nullable', 'array'],
            'source'        => ['nullable', 'string'],
            'source_detail' => ['nullable', 'string', 'max:255'],
            'tags'          => ['nullable', 'array'],
            'contact_person_name'  => ['nullable', 'string', 'max:255'],
            'contact_person_email' => ['nullable', 'email', 'max:255'],
            'contact_person_phone' => ['nullable', 'string', 'max:50'],
        ]);

        $duplicate = Contact::where('firm_id', $request->user()->firm_id)
            ->where('name', $validated['name'])
            ->where('email', $validated['email'] ?? null)
            ->exists();

        if ($duplicate && ! $request->boolean('confirm_duplicate')) {
            return back()->withErrors(['duplicate' => 'A contact with this name and email already exists.'])
                ->with('show_duplicate_warning', true);
        }

        $contact = Contact::create([
            ...$validated,
            'firm_id' => $request->user()->firm_id,
        ]);

        activity()->causedBy($request->user())->performedOn($contact)->log('created');

        if ($request->expectsJson()) {
            return response()->json([
                'contact' => $contact,
            ]);
        }

        return redirect()->route('contacts.show', $contact)->with('success', 'Contact created.');
    }

    public function show(Contact $contact, Request $request): Response
    {
        $this->authorize('view', $contact);

        $contact->load([
            'gdprConsents',
            'matters' => fn ($q) => $q->with('responsibleUser')->orderBy('opened_at', 'desc'),
        ]);

        return Inertia::render('Contacts/Show', [
            'contact' => $contact,
        ]);
    }

    public function edit(Contact $contact): Response
    {
        $this->authorize('update', $contact);
        return Inertia::render('Contacts/Edit', [
            'contact' => $contact,
        ]);
    }

    public function update(Request $request, Contact $contact): RedirectResponse
    {
        $this->authorize('update', $contact);

        $contact->update($request->validate([
            'type'       => ['sometimes', 'in:individual,company,other_party'],
            'name'       => ['sometimes', 'string', 'max:255'],
            'email'      => ['nullable', 'email'],
            'phone'      => ['nullable', 'string'],
            'national_insurance_number' => ['nullable', 'string'],
            'dob'        => ['nullable', 'date'],
            'address'    => ['nullable', 'array'],
            'tags'       => ['nullable', 'array'],
            'lead_status'   => ['nullable', 'in:enquiry,consultation_booked,engaged,matter_opened,declined'],
            'source'        => ['nullable', 'string'],
            'source_detail' => ['nullable', 'string', 'max:255'],
            'contact_person_name'  => ['nullable', 'string', 'max:255'],
            'contact_person_email' => ['nullable', 'email', 'max:255'],
            'contact_person_phone' => ['nullable', 'string', 'max:50'],
        ]));

        activity()->causedBy($request->user())->performedOn($contact)->log('updated');

        return back()->with('success', 'Contact updated.');
    }

    public function destroy(Contact $contact, Request $request): RedirectResponse
    {
        $this->authorize('delete', $contact);

        $contact->delete();

        activity()->causedBy($request->user())->performedOn($contact)->log('deleted');

        return redirect()->route('contacts.index')->with('success', 'Contact deleted.');
    }
}
