<?php

namespace App\Http\Controllers;

use App\Models\Firm;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;
use Inertia\Inertia;
use Inertia\Response;

class FirmSetupController extends Controller
{
    public function show(string $token): Response|RedirectResponse
    {
        $firm = $this->firmForToken($token);

        return Inertia::render('FirmSetup/Complete', [
            // Only what the form needs -- the whole model would ship the setup
            // token and every bank field to the browser.
            'firm'  => [
                'id'   => $firm->id,
                'name' => $firm->name,
                'city' => $firm->city,
            ],
            'token' => $token,
        ]);
    }

    /**
     * Resolve an unexpired, unused setup token or 404.
     */
    private function firmForToken(string $token): Firm
    {
        $firm = Firm::whereNotNull('setup_token')
            ->whereNull('setup_completed_at')
            ->get()
            ->first(fn (Firm $candidate) => hash_equals((string) $candidate->setup_token, $token));

        abort_unless($firm, 404);

        // An invitation that was never used should not stay live indefinitely.
        if ($firm->setup_token_expires_at && $firm->setup_token_expires_at->isPast()) {
            abort(410, 'This setup link has expired. Ask your administrator to send a new one.');
        }

        return $firm;
    }

    public function update(Request $request, string $token): RedirectResponse
    {
        $firm = $this->firmForToken($token);

        $validated = $request->validate([
            'password'             => ['required', 'confirmed', Password::min(12)],
            'vat_number'           => ['nullable', 'string', 'max:50'],
            'sra_number'          => ['nullable', 'string', 'max:50'],
            'website'             => ['nullable', 'url', 'max:255'],
            'address_line1'       => ['nullable', 'string', 'max:255'],
            'address_line2'       => ['nullable', 'string', 'max:255'],
            'city'                => ['nullable', 'string', 'max:100'],
            'county'              => ['nullable', 'string', 'max:100'],
            'postcode'            => ['nullable', 'string', 'max:10'],
            'default_hourly_rate' => ['nullable', 'numeric', 'min:0'],
            'vat_rate'            => ['nullable', 'numeric', 'min:0', 'max:100'],
            'invoice_prefix'      => ['nullable', 'string', 'max:20'],
            'payment_terms_days'  => ['nullable', 'integer', 'min:1'],
            'bank_name'           => ['nullable', 'string', 'max:255'],
            'bank_sort_code'      => ['nullable', 'string', 'max:10'],
            'bank_account_number' => ['nullable', 'string', 'max:30'],
            'bank_account_name'   => ['nullable', 'string', 'max:255'],
            'bank_iban'           => ['nullable', 'string', 'max:50'],
            'bank_swift_code'     => ['nullable', 'string', 'max:20'],
            'payment_instructions'=> ['nullable', 'string', 'max:2000'],
        ]);

        $password = $validated['password'];
        unset($validated['password']);

        $firm->update([
            ...$validated,
            'setup_completed_at' => now(),
            'setup_token'        => null,
            'setup_token_expires_at' => null,
        ]);

        $admin = User::where('firm_id', $firm->id)->where('role', 'firm_admin')->first();
        if ($admin) {
            $admin->update(['password' => Hash::make($password)]);
        }

        activity()->performedOn($firm)
            ->withProperties(['ip' => $request->ip(), 'user_agent' => $request->userAgent()])
            ->log('firm_setup_completed');

        return redirect('/login')->with('success', 'Firm setup complete! You can now log in.');
    }
}
