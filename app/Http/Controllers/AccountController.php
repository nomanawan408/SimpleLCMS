<?php

namespace App\Http\Controllers;

use App\Models\Contact;
use App\Models\Matter;
use App\Models\TrustEntry;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class AccountController extends Controller
{
    public function index(Request $request): Response
    {
        $firmId = $request->user()->firm_id;
        $firm   = $request->user()->firm;

        // Trust entries
        $query = TrustEntry::where('firm_id', $firmId)
            ->with('matter')
            ->orderBy('date', 'desc')
            ->orderBy('created_at', 'desc');

        if ($request->filled('matter_id')) {
            $query->where('matter_id', $request->matter_id);
        }

        $entries = $query->paginate(30)->withQueryString();

        $summary = [
            'total_receipts'      => TrustEntry::where('firm_id', $firmId)->where('type', 'receipt')->sum('amount'),
            'total_disbursements' => TrustEntry::where('firm_id', $firmId)->where('type', 'disbursement')->sum('amount'),
            'balance'             => TrustEntry::where('firm_id', $firmId)->where('type', 'receipt')->sum('amount')
                                   - TrustEntry::where('firm_id', $firmId)->where('type', 'disbursement')->sum('amount'),
        ];

        // Firm bank account details
        $firmAccount = [
            'bank_name'           => $firm->bank_name,
            'bank_sort_code'      => $firm->bank_sort_code,
            'bank_account_number' => $firm->bank_account_number,
            'bank_account_name'   => $firm->bank_account_name,
            'bank_iban'           => $firm->bank_iban,
            'bank_swift_code'     => $firm->bank_swift_code,
            'payment_instructions'=> $firm->payment_instructions,
        ];

        // Client accounts: contacts with their matter links
        $clientAccounts = Contact::where('firm_id', $firmId)
            ->whereHas('matters')
            ->with(['matters' => fn ($q) => $q->select('matters.id', 'matters.name', 'matters.matter_number', 'matters.status')->where('status', 'open')])
            ->orderBy('name')
            ->get(['id', 'name', 'type', 'email', 'phone', 'contact_person_name', 'contact_person_email']);

        return Inertia::render('Accounts/Index', [
            'entries'       => $entries,
            'summary'       => $summary,
            'firmAccount'   => $firmAccount,
            'clientAccounts'=> $clientAccounts,
            'matters'       => Matter::where('firm_id', $firmId)->orderBy('name')->get(['id', 'name']),
            'filters'       => $request->only('matter_id'),
        ]);
    }
}
