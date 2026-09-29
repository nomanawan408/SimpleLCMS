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
        $exceptions->render(function (\Illuminate\Auth\AuthenticationException $e, $request) {
            if ($request->expectsJson() || $request->header('X-Inertia')) {
                return response()->json(['message' => $e->getMessage()], 401);
            }
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
