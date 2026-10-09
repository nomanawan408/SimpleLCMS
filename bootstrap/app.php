<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
        then: function (): void {
            require __DIR__.'/../routes/webhooks.php';
        },
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->web(append: [
            \App\Http\Middleware\SecurityHeaders::class,
            \App\Http\Middleware\HandleInertiaRequests::class,
            \Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets::class,
            // Binds every session to the current password hash: changing the
            // password (settings, admin reset, recovery link) kills all other
            // sessions on their next request, so a stolen session does not
            // survive a legitimate password change. Mismatches throw
            // AuthenticationException, which the handlers below already turn
            // into the 409 login flow (Inertia) or 401 (JSON).
            \Illuminate\Session\Middleware\AuthenticateSession::class,
        ]);

        $middleware->alias([
            'set.tenant'          => \App\Http\Middleware\SetTenant::class,
            'requires.two.factor' => \App\Http\Middleware\RequiresTwoFactor::class,
            'firm.setup'          => \App\Http\Middleware\EnsureFirmSetupComplete::class,
            'redirect.super.admin'=> \App\Http\Middleware\RedirectSuperAdmin::class,
            'role'                => \Spatie\Permission\Middleware\RoleMiddleware::class,
            'permission'          => \Spatie\Permission\Middleware\PermissionMiddleware::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // Expired (or missing) session, handled per caller type. A plain
        // JSON 401 on an Inertia visit trips the client's fatal "must
        // receive a valid Inertia response" modal, so SPA visits instead get
        // the documented Inertia session-expiry flow: 409 plus
        // X-Inertia-Location, forcing a full-page visit to login with an
        // explanation, leaving no stale state behind.
        $toLogin = function ($request) {
            $request->session()->flash('status', 'Your session expired. Please sign in again.');
            return response('', 409, ['X-Inertia-Location' => route('login')]);
        };
        $exceptions->render(function (\Illuminate\Auth\AuthenticationException $e, $request) use ($toLogin) {
            // API-style callers (fetch pollers) speak JSON and degrade inline.
            if ($request->expectsJson()) {
                return response()->json(['message' => 'Unauthenticated.'], 401);
            }
            if ($request->header('X-Inertia')) {
                return $toLogin($request);
            }
            // Plain browser loads keep the framework default (redirect with
            // intended URL), plus the same explanation.
            return redirect()->guest(route('login'))->with('status', 'Your session expired. Please sign in again.');
        });

        // Same expiry, earlier tripwire: with a dead session, POST/PUT/PATCH
        // requests fail CSRF verification before authentication runs. Send
        // those to login too -- except on the auth pages themselves, which
        // have their own flows (a failed login CSRF must not loop strangely).
        $exceptions->render(function (\Illuminate\Session\TokenMismatchException $e, $request) use ($toLogin) {
            if ($request->expectsJson()) {
                return null;
            }
            if ($request->header('X-Inertia') && ! $request->routeIs(
                'login', 'login.*', 'register', 'register.*', 'password.*',
                'two-factor.*', 'verification.*', 'firm.setup.*'
            )) {
                return $toLogin($request);
            }

            return null;
        });

        // Page-access denials stay inside the SPA: an Inertia visit that the
        // backend refuses renders a branded error page instead of dumping
        // the user onto a blank Symfony error. API-style callers still get
        // JSON. This is presentation only -- every refusal is decided by
        // policies and controller gates before this ever runs.
        $exceptions->render(function (\Symfony\Component\HttpKernel\Exception\HttpException $e, $request) {
            $status = $e->getStatusCode();
            if (! in_array($status, [403, 404, 419, 500, 503], true)) {
                return null;
            }
            if ($request->expectsJson()) {
                return null;
            }
            if ($request->header('X-Inertia')) {
                return \Inertia\Inertia::render('Error', ['status' => $status])
                    ->toResponse($request)
                    ->setStatusCode($status);
            }

            return null;
        });
    })->create();
