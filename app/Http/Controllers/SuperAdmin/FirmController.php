<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Http\Controllers\Controller;
use App\Models\Firm;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

class FirmController extends Controller
{
    public function index(Request $request): Response
    {
        abort_unless($request->user()->hasRole('super_admin'), 403);

        $firms = Firm::withCount(['users', 'matters'])
            ->orderBy('created_at', 'desc')
            ->get();

        return Inertia::render('SuperAdmin/Firms/Index', [
            'firms' => $firms->map(fn ($firm) => [
                'id'                  => $firm->id,
                'name'                => $firm->name,
                'slug'                => $firm->slug,
                'plan'                => $firm->plan,
                'subscription_status' => $firm->subscription_status,
                'trial_ends_at'       => $firm->trial_ends_at,
                'email'               => $firm->email,
                'phone'               => $firm->phone,
                'city'                => $firm->city,
                'users_count'         => $firm->users_count,
                'matters_count'       => $firm->matters_count,
                'created_at'          => $firm->created_at,
            ]),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        abort_unless($request->user()->hasRole('super_admin'), 403);

        $validated = $request->validate([
            'name'               => ['required', 'string', 'max:255'],
            'slug'               => ['required', 'string', 'max:255', 'unique:firms,slug'],
            'email'              => ['nullable', 'email', 'max:255'],
            'phone'              => ['nullable', 'string', 'max:50'],
            'plan'               => ['required', 'in:starter,professional,enterprise'],
            'subscription_status'=> ['required', 'in:trial,active,past_due,cancelled'],
            'trial_ends_at'      => ['nullable', 'date'],
            'address_line1'      => ['nullable', 'string', 'max:255'],
            'city'               => ['nullable', 'string', 'max:100'],
            'postcode'           => ['nullable', 'string', 'max:20'],
            'timezone'           => ['nullable', 'string', 'max:50'],
            'default_hourly_rate'=> ['nullable', 'numeric', 'min:0'],
            'vat_rate'           => ['nullable', 'numeric', 'min:0', 'max:100'],
        ]);

        $firm = Firm::create([
            ...$validated,
            'invoice_prefix'     => strtoupper(Str::substr($validated['name'], 0, 3)),
            'invoice_sequence'   => 1,
            'payment_terms_days' => 30,
        ]);

        activity()->causedBy($request->user())->performedOn($firm)->log('firm_created');

        return redirect()->route('superadmin.firms.index')
            ->with('success', "Firm '{$firm->name}' created.");
    }

    public function update(Request $request, Firm $firm): RedirectResponse
    {
        abort_unless($request->user()->hasRole('super_admin'), 403);

        $validated = $request->validate([
            'name'               => ['sometimes', 'string', 'max:255'],
            'plan'               => ['sometimes', 'in:starter,professional,enterprise'],
            'subscription_status'=> ['sometimes', 'in:trial,active,past_due,cancelled'],
            'trial_ends_at'      => ['nullable', 'date'],
            'email'              => ['nullable', 'email', 'max:255'],
            'phone'              => ['nullable', 'string', 'max:50'],
            'address_line1'      => ['nullable', 'string', 'max:255'],
            'city'               => ['nullable', 'string', 'max:100'],
            'postcode'           => ['nullable', 'string', 'max:20'],
            'timezone'           => ['nullable', 'string', 'max:50'],
            'default_hourly_rate'=> ['nullable', 'numeric', 'min:0'],
            'vat_rate'           => ['nullable', 'numeric', 'min:0', 'max:100'],
        ]);

        $firm->update($validated);

        activity()->causedBy($request->user())->performedOn($firm)->log('firm_updated');

        return back()->with('success', "Firm '{$firm->name}' updated.");
    }

    public function destroy(Request $request, Firm $firm): RedirectResponse
    {
        abort_unless($request->user()->hasRole('super_admin'), 403);

        $firmName = $firm->name;

        $firm->users()->delete();
        $firm->delete();

        activity()->causedBy($request->user())->log('firm_deleted');

        return redirect()->route('superadmin.firms.index')
            ->with('success', "Firm '{$firmName}' and all its data deleted.");
    }
}
