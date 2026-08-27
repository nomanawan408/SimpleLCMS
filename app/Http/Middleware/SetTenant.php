<?php

namespace App\Http\Middleware;

use App\Support\TenantContext;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Establishes the firm that the rest of the request is confined to.
 *
 * The BelongsToFirm global scope reads what this sets, so every query and
 * every route-model binding downstream is automatically limited to the
 * caller's firm.
 */
class SetTenant
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        // Platform owners operate across firms by definition, so they are
        // never scoped. Their access is gated by role middleware instead.
        if ($user && $user->firm_id && ! $user->hasRole('super_admin')) {
            app(TenantContext::class)->set($user->firm_id);
        }

        return $next($request);
    }
}
