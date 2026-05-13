<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use PragmaRX\Google2FA\Google2FA;

class TwoFactorController extends Controller
{
    public function __construct(private readonly Google2FA $google2fa) {}

    public function challenge(): Response|RedirectResponse
    {
        if (! auth()->check()) {
            return redirect()->route('login');
        }

        if (request()->session()->get('totp_verified')) {
            return redirect()->route('dashboard');
        }

        return Inertia::render('Auth/TwoFactor');
    }

    public function verify(Request $request): RedirectResponse
    {
        $request->validate(['code' => ['required', 'string', 'digits:6']]);

        $user   = $request->user();
        $secret = $user->totp_secret;

        $valid = $this->google2fa->verifyKey($secret, $request->code, 1);

        if (! $valid) {
            return back()->withErrors(['code' => 'The verification code is invalid.']);
        }

        $request->session()->put('totp_verified', true);

        activity()->causedBy($user)->log('totp_verified');

        return redirect()->intended(route('dashboard'));
    }

    public function setup(Request $request): Response
    {
        $user = $request->user();

        if (! $user->totp_secret) {
            $secret = $this->google2fa->generateSecretKey();
            $user->update(['totp_secret' => $secret]);
        }

        $qrCodeUrl = $this->google2fa->getQRCodeUrl(
            config('app.name'),
            $user->email,
            $user->totp_secret
        );

        return Inertia::render('Auth/TwoFactorSetup', [
            'qrCodeUrl' => $qrCodeUrl,
            'secret'    => $user->totp_secret,
        ]);
    }

    public function enable(Request $request): RedirectResponse
    {
        $request->validate(['code' => ['required', 'string', 'digits:6']]);

        $user  = $request->user();
        $valid = $this->google2fa->verifyKey($user->totp_secret, $request->code, 1);

        if (! $valid) {
            return back()->withErrors(['code' => 'The verification code is invalid.']);
        }

        $user->update(['totp_enabled' => true]);

        activity()->causedBy($user)->log('totp_enabled');

        return redirect()->route('dashboard')->with('success', '2FA has been enabled successfully.');
    }

    public function disable(Request $request): RedirectResponse
    {
        $request->validate(['password' => ['required', 'current_password']]);

        $user = $request->user();
        $user->update(['totp_enabled' => false, 'totp_secret' => null]);

        activity()->causedBy($user)->log('totp_disabled');

        return redirect()->route('dashboard')->with('success', '2FA has been disabled.');
    }
}
