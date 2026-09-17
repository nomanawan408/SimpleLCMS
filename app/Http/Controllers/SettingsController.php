<?php

namespace App\Http\Controllers;

use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Self-service settings. Every action is scoped to the authenticated user
 * (or their firm): there are no ID parameters, so one user can never touch
 * another user's profile, password, or preferences by design.
 */
class SettingsController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();
        $firm = $user->firm;

        return Inertia::render('Settings/Index', [
            'preferences' => $user->preferences ?? ['theme' => 'light'],
            'canEditFirm' => $firm ? $user->can('update', $firm) : false,
            'firmDefaults' => $firm ? [
                'name'                => $firm->name,
                'vat_rate'            => (float) $firm->vat_rate,
                'invoice_prefix'      => $firm->invoice_prefix,
                'payment_terms_days'  => (int) $firm->payment_terms_days,
                'default_hourly_rate' => (float) $firm->default_hourly_rate,
            ] : null,
        ]);
    }

    public function updateProfile(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'full_name' => ['required', 'string', 'max:255'],
            'phone'     => ['nullable', 'string', 'max:50'],
        ]);

        $request->user()->update($validated);

        activity()->causedBy($request->user())->log('profile_updated');

        return back()->with('success', 'Profile updated.');
    }

    public function updatePreferences(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'theme' => ['sometimes', 'in:light,dark,system'],
        ]);

        $user = $request->user();
        // Merge, never replace: keys this client doesn't know survive.
        $user->forceFill([
            'preferences' => array_merge($user->preferences ?? [], $validated),
        ])->save();

        return back()->with('success', 'Preferences saved.');
    }

    public function updatePassword(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'current_password' => ['required', 'current_password'],
            'password'         => ['required', 'confirmed', Password::min(12)],
        ]);

        $user = $request->user();
        $user->forceFill(['password' => Hash::make($validated['password'])])->save();

        activity()->causedBy($user)->log('password_changed');

        return back()->with('success', 'Password changed.');
    }

    public function updateFirm(Request $request): RedirectResponse
    {
        $firm = $request->user()->firm;
        abort_unless($firm, 404);
        $this->authorize('update', $firm);

        // Same rules as the admin firm form — a subset, same validation.
        $validated = $request->validate([
            'default_hourly_rate' => ['nullable', 'numeric', 'min:0'],
            'invoice_prefix'      => ['nullable', 'string', 'max:20'],
            'vat_rate'            => ['nullable', 'numeric', 'min:0', 'max:100'],
            'payment_terms_days'  => ['nullable', 'integer', 'min:1'],
        ]);

        $firm->update($validated);

        activity()->causedBy($request->user())->performedOn($firm)->log('firm_updated');

        return back()->with('success', 'Firm defaults updated.');
    }
}
