<?php

namespace App\Http\Middleware;

use Illuminate\Http\Request;
use Inertia\Middleware;
use Tighten\Ziggy\Ziggy;

class HandleInertiaRequests extends Middleware
{
    protected $rootView = 'app';

    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    public function share(Request $request): array
    {
        $user = $request->user();

        return array_merge(parent::share($request), [
            'auth' => [
                'user' => $user ? [
                    'id'           => $user->id,
                    'full_name'    => $user->full_name,
                    'email'        => $user->email,
                    'role'         => $user->role,
                    'avatar_url'   => $user->avatar_url,
                    'totp_enabled' => $user->totp_enabled,
                    'firm'         => $user->firm ? [
                        'id'             => $user->firm->id,
                        'name'           => $user->firm->name,
                        'logo_path'      => $user->firm->logo_path,
                        'plan'           => $user->firm->plan,
                        'vat_rate'       => $user->firm->vat_rate,
                        'invoice_prefix' => $user->firm->invoice_prefix,
                    ] : null,
                ] : null,
            ],
            'flash' => [
                'success' => session('success'),
                'error'   => session('error'),
                'warning' => session('warning'),
            ],
            'ziggy' => fn () => [
                ...(new Ziggy)->toArray(),
                'location' => $request->url(),
            ],
        ]);
    }
}
