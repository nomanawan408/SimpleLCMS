<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;
use PragmaRX\Google2FA\Google2FA;

class TwoFactorController extends Controller
{
    /**
     * Consecutive failed second-factor attempts before the account is locked
     * and the session torn down. The route throttle slows an attacker down;
     * this stops them.
     */
    private const MAX_ATTEMPTS = 5;

    /**
     * Accepted drift, in 30-second steps, either side of the current code.
     * Every extra step multiplies the guessable keyspace, so keep it tight.
     */
    private const WINDOW = 1;

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

        $user = $request->user();

        if (! $user->totp_enabled || ! $user->totp_secret) {
            return redirect()->route('dashboard');
        }

        if ($user->isLocked()) {
            return $this->rejectAndLogout($request, 'Account is locked. Contact your firm administrator.');
        }

        // verifyKeyNewer returns the timestamp slice of the matching code, or
        // false. Passing the last accepted slice makes each code single-use:
        // a code captured over the shoulder or from a phishing page cannot be
        // replayed for the remainder of its window.
        $timestamp = $this->google2fa->verifyKeyNewer(
            $user->totp_secret,
            $request->code,
            // 0 rather than null: with a null old-timestamp the library
            // returns a bare `true` instead of the matched time slice, which
            // would leave nothing to compare against on the next attempt.
            $user->totp_last_timestamp ?? 0,
            self::WINDOW
        );

        if ($timestamp === false) {
            $attempts = $user->totp_failed_count + 1;

            activity()->causedBy($user)
                ->withProperties(['ip' => $request->ip(), 'user_agent' => $request->userAgent(), 'attempt' => $attempts])
                ->log('totp_failed');

            if ($attempts >= self::MAX_ATTEMPTS) {
                $user->forceFill([
                    'totp_failed_count' => 0,
                    'locked_until' => now()->addMinutes(15),
                ])->save();

                activity()->causedBy($user)->log('totp_locked');

                return $this->rejectAndLogout($request, 'Too many incorrect codes. Your account is locked for 15 minutes.');
            }

            $user->forceFill(['totp_failed_count' => $attempts])->save();

            return back()->withErrors(['code' => 'The verification code is invalid.']);
        }

        $user->forceFill([
            'totp_last_timestamp' => $timestamp,
            'totp_failed_count' => 0,
            'locked_until' => null,
        ])->save();

        // Rotate the session id at the point the session actually gains its
        // full privilege level, not just at password entry.
        $request->session()->regenerate();
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
            'secret' => $user->totp_secret,
        ]);
    }

    public function enable(Request $request): RedirectResponse
    {
        $request->validate(['code' => ['required', 'string', 'digits:6']]);

        $user = $request->user();

        if (! $user->totp_secret) {
            return redirect()->route('two-factor.setup')
                ->withErrors(['code' => 'Start the setup again to generate a new secret.']);
        }

        $timestamp = $this->google2fa->verifyKeyNewer(
            $user->totp_secret,
            $request->code,
            // 0 rather than null: with a null old-timestamp the library
            // returns a bare `true` instead of the matched time slice, which
            // would leave nothing to compare against on the next attempt.
            $user->totp_last_timestamp ?? 0,
            self::WINDOW
        );

        if ($timestamp === false) {
            return back()->withErrors(['code' => 'The verification code is invalid.']);
        }

        $user->forceFill([
            'totp_enabled' => true,
            'totp_last_timestamp' => $timestamp,
            'totp_failed_count' => 0,
        ])->save();

        // Enrolling proves possession of the device, so this session is
        // second-factor verified from here on.
        $request->session()->put('totp_verified', true);

        activity()->causedBy($user)->log('totp_enabled');

        return redirect()->route('dashboard')->with('success', '2FA has been enabled successfully.');
    }

    public function disable(Request $request): RedirectResponse
    {
        // The password alone must never be enough to strip the second factor:
        // the route also carries `requires.two.factor`, so this session has
        // already presented a valid code.
        $request->validate([
            'password' => ['required', 'current_password'],
            'code' => ['required', 'string', 'digits:6'],
        ]);

        $user = $request->user();

        $timestamp = $this->google2fa->verifyKeyNewer(
            $user->totp_secret,
            $request->code,
            // 0 rather than null: with a null old-timestamp the library
            // returns a bare `true` instead of the matched time slice, which
            // would leave nothing to compare against on the next attempt.
            $user->totp_last_timestamp ?? 0,
            self::WINDOW
        );

        if ($timestamp === false) {
            return back()->withErrors(['code' => 'The verification code is invalid.']);
        }

        $user->forceFill([
            'totp_enabled' => false,
            'totp_secret' => null,
            'totp_last_timestamp' => null,
            'totp_failed_count' => 0,
        ])->save();

        activity()->causedBy($user)
            ->withProperties(['ip' => $request->ip(), 'user_agent' => $request->userAgent()])
            ->log('totp_disabled');

        return redirect()->route('dashboard')->with('success', '2FA has been disabled.');
    }

    /**
     * Tear the session down rather than leaving a half-authenticated one
     * sitting there after a rejected second factor.
     */
    private function rejectAndLogout(Request $request, string $message): RedirectResponse
    {
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect()->route('login')->withErrors(['email' => $message]);
    }
}
