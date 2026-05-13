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
            if (! $request->routeIs('two-factor.*')) {
                return redirect()->route('two-factor.challenge');
            }
        }

        return $next($request);
    }
}
