<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureFirmSetupComplete
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user && $user->firm) {
            $firm = $user->firm;
            $isSetupComplete = $firm->name && $firm->vat_number;

            if (! $isSetupComplete && ! $request->routeIs('admin.firm.*', 'logout')) {
                return redirect()->route('admin.firm.setup');
            }
        }

        return $next($request);
    }
}
