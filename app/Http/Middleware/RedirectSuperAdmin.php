<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RedirectSuperAdmin
{
    public function handle(Request $request, Closure $next): Response
    {
        if ($request->user()?->hasRole('super_admin')) {
            return redirect()->route('superadmin.dashboard');
        }

        return $next($request);
    }
}
