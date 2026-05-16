<?php

namespace App\Http\Controllers;

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

        return Inertia::render('Accounts/Index', [
            'entries'  => $entries,
            'summary'  => $summary,
            'matters'  => Matter::where('firm_id', $firmId)->orderBy('name')->get(['id', 'name']),
            'filters'  => $request->only('matter_id'),
        ]);
    }
}
