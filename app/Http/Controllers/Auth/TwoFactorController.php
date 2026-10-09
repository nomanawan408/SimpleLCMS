<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
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
        $request->validate(['code' => ['required', 'string', 'max:32']]);

        $user = $request->user();

        if (! $user->totp_enabled || ! $user->totp_secret) {
            return redirect()->route('dashboard');
        }

        if ($user->isLocked()) {
            return $this->rejectAndLogout($request, 'Account is locked. Contact your firm administrator.');
        }

        // Six digits: authenticator app. Anything else: single-use recovery
        // code (device lost). Recovery guesses count toward lockout exactly
        // like TOTP guesses, so the codes cannot be brute-forced online.
        if (! preg_match('/^\d{6}$/', $request->code)) {
            return $this->verifyRecoveryCode($request, $user);
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
            return $this->recordFailedAttempt($request, $user);
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

    /**
     * Single-use recovery-code path. The presented code is compared against
     * bcrypt hashes and removed on first use; misses share the TOTP failure
     * budget (lockout), so online guessing is no easier than guessing TOTP.
     */
    private function verifyRecoveryCode(Request $request, User $user): RedirectResponse
    {
        // Users retype codes from paper: accept them with or without the
        // dashes (and any stray spaces), so a formatting slip does not burn
        // lockout budget. Stored codes are always the dashed form.
        $compact = strtoupper((string) preg_replace('/[^A-Z0-9]/i', '', $request->code));
        $candidates = [$request->code];
        if (strlen($compact) === 12) {
            $candidates[] = substr($compact, 0, 4) . '-' . substr($compact, 4, 4) . '-' . substr($compact, 8, 4);
        }

        $hashes = $user->totp_recovery_codes ?? [];
        $matched = null;
        foreach ($hashes as $index => $hash) {
            foreach ($candidates as $candidate) {
                if (\Illuminate\Support\Facades\Hash::check($candidate, $hash)) {
                    $matched = $index;
                    break 2;
                }
            }
        }

        if ($matched === null) {
            return $this->recordFailedAttempt($request, $user);
        }

        unset($hashes[$matched]);
        $user->forceFill([
            'totp_recovery_codes' => array_values($hashes),
            'totp_failed_count' => 0,
            'locked_until' => null,
        ])->save();

        $request->session()->regenerate();
        $request->session()->put('totp_verified', true);

        activity()->causedBy($user)
            ->withProperties(['remaining' => count($hashes)])
            ->log('totp_recovery_used');

        return redirect()->intended(route('dashboard'));
    }

    /**
     * Shared failure budget for TOTP and recovery guesses: audit, count,
     * lock out at the threshold. A miss always ends the attempt here.
     */
    private function recordFailedAttempt(Request $request, User $user): RedirectResponse
    {
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

    public function setup(Request $request): Response
    {
        $user = $request->user();

        if (! $user->totp_secret) {
            $secret = $this->google2fa->generateSecretKey();
            $user->forceFill(['totp_secret' => $secret])->save();
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
        // Enrolling an authenticator hands the account to whoever holds the
        // device, so the password alone is not enough to start it and a code
        // alone is not enough to finish it: both, like disable/regenerate.
        $request->validate([
            'password' => ['required', 'current_password'],
            'code' => ['required', 'string', 'digits:6'],
        ]);

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

        $plainCodes = $this->freshRecoveryCodes();
        $user->forceFill([
            'totp_enabled' => true,
            'totp_last_timestamp' => $timestamp,
            'totp_failed_count' => 0,
            'totp_recovery_codes' => array_map(
                fn ($code) => \Illuminate\Support\Facades\Hash::make($code),
                $plainCodes
            ),
        ])->save();

        // Enrolling proves possession of the device, so this session is
        // second-factor verified from here on.
        $request->session()->put('totp_verified', true);

        activity()->causedBy($user)->log('totp_enabled');

        // Recovery codes travel in flash (one request only): the next page
        // renders them once, and a revisit or bookmark finds nothing.
        return redirect()->route('two-factor.recovery')->with('recovery_codes', $plainCodes);
    }

    /**
     * One-time display of freshly generated recovery codes. Without flash
     * data (revisit, bookmark, back-button) there is nothing to show, so
     * this redirects away rather than rendering an empty page.
     */
    public function recovery(Request $request): Response|RedirectResponse
    {
        $codes = $request->session()->get('recovery_codes');
        if (! is_array($codes) || $codes === []) {
            return redirect()->route('dashboard');
        }

        return Inertia::render('Auth/RecoveryCodes', ['codes' => $codes]);
    }

    /**
     * Rotate recovery codes: the old set dies with this request. Guarded
     * like disable (password plus a live TOTP code) because rotation
     * destroys the holder's only device-loss fallback.
     */
    public function regenerateRecovery(Request $request): RedirectResponse
    {
        $request->validate([
            'password' => ['required', 'current_password'],
            'code' => ['required', 'string', 'digits:6'],
        ]);

        $user = $request->user();

        $timestamp = $this->google2fa->verifyKeyNewer(
            $user->totp_secret,
            $request->code,
            $user->totp_last_timestamp ?? 0,
            self::WINDOW
        );

        if ($timestamp === false) {
            return back()->withErrors(['code' => 'The verification code is invalid.']);
        }

        $plainCodes = $this->freshRecoveryCodes();
        $user->forceFill([
            'totp_recovery_codes' => array_map(
                fn ($code) => \Illuminate\Support\Facades\Hash::make($code),
                $plainCodes
            ),
        ])->save();

        activity()->causedBy($user)->log('totp_recovery_regenerated');

        return redirect()->route('two-factor.recovery')->with('recovery_codes', $plainCodes);
    }

    /**
     * Eight single-use codes in a typable grouped format. Cryptographically
     * random; stored only as bcrypt hashes by the callers.
     *
     * @return string[]
     */
    private function freshRecoveryCodes(): array
    {
        $codes = [];
        for ($i = 0; $i < 8; $i++) {
            $raw = strtoupper(\Illuminate\Support\Str::random(12));
            $codes[] = substr($raw, 0, 4) . '-' . substr($raw, 4, 4) . '-' . substr($raw, 8, 4);
        }

        return $codes;
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
            'totp_recovery_codes' => null,
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
