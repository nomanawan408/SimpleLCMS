<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RequiresTwoFactor
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user && $user->totp_enabled && ! $request->session()->get('totp_verified')) {
            // Only the challenge and its submission are reachable before the
            // second factor is presented. Exempting all of `two-factor.*`
            // would leave the disable endpoint open to a password-only
            // attacker who never completed the challenge.
            $allowed = $request->routeIs('two-factor.challenge', 'two-factor.verify', 'logout');

            if (! $allowed) {
                return redirect()->route('two-factor.challenge');
            }
        }

        return $next($request);
    }
}
