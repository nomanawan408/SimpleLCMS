<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Auth;
use Laravel\Socialite\Facades\Socialite;

class SocialiteController extends Controller
{
    public function redirect(string $provider): RedirectResponse
    {
        abort_unless(in_array($provider, ['google', 'microsoft']), 404);
        return Socialite::driver($provider)->redirect();
    }

    public function callback(string $provider): RedirectResponse
    {
        abort_unless(in_array($provider, ['google', 'microsoft']), 404);

        try {
            $socialUser = Socialite::driver($provider)->user();
        } catch (\Exception) {
            return redirect()->route('login')->withErrors(['email' => 'SSO authentication failed. Please try again.']);
        }

        $field    = $provider === 'google' ? 'google_id' : 'microsoft_id';
        $emailKey = $socialUser->getEmail();

        $user = User::where($field, $socialUser->getId())
            ->orWhere('email', $emailKey)
            ->first();

        if (! $user) {
            return redirect()->route('login')->withErrors([
                'email' => 'No account found for this SSO identity. Please contact your firm administrator.',
            ]);
        }

        if (! $user->is_active) {
            return redirect()->route('login')->withErrors(['email' => 'Your account has been deactivated.']);
        }

        $user->update([
            $field          => $socialUser->getId(),
            'avatar_url'    => $socialUser->getAvatar(),
            'last_login_at' => now(),
        ]);

        Auth::login($user, remember: true);

        activity()->causedBy($user)->withProperties(['provider' => $provider])->log('sso_login');

        return redirect()->intended(route('dashboard'));
    }
}
