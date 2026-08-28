<?php

namespace App\Http\Controllers;

use App\Models\Contact;
use App\Models\Document;
use App\Models\Invoice;
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
            ->when($request->search, fn ($q, $search) => $q->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('first_name', 'like', "%{$search}%")
                  ->orWhere('last_name', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%")
                  ->orWhere('phone', 'like', "%{$search}%");
            }))
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
            'prefix'     => ['nullable', 'string', 'max:20'],
            'first_name' => ['nullable', 'string', 'max:255'],
            'middle_name'=> ['nullable', 'string', 'max:255'],
            'last_name'  => ['nullable', 'string', 'max:255'],
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
            'notes.user:id,full_name',
        ]);

        // Load invoices for this contact's matters
        $matterIds = $contact->matters->pluck('id');
        $invoices = Invoice::whereIn('matter_id', $matterIds)
            ->with(['matter', 'payments'])
            ->orderBy('created_at', 'desc')
            ->get();

        // Documents belong to matters, so a contact's documents are those on
        // the matters they are party to.
        $canViewDocuments = $request->user()->hasPermissionTo('view_documents');

        $documents = $canViewDocuments && $matterIds->isNotEmpty()
            ? Document::whereIn('matter_id', $matterIds)
                ->with(['matter:id,name,matter_number', 'uploadedBy:id,full_name'])
                ->orderBy('created_at', 'desc')
                ->get(['id', 'matter_id', 'uploaded_by_id', 'name', 'original_name', 'mime_type', 'size_bytes', 'created_at'])
            : collect();

        return Inertia::render('Contacts/Show', [
            'contact'  => $contact,
            'invoices' => $invoices,
            'documents' => $documents,
            'canEditContact' => $request->user()->can('update', $contact),
            'canViewDocuments' => $canViewDocuments,
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
            'prefix'     => ['nullable', 'string', 'max:20'],
            'first_name' => ['nullable', 'string', 'max:255'],
            'middle_name'=> ['nullable', 'string', 'max:255'],
            'last_name'  => ['nullable', 'string', 'max:255'],
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
