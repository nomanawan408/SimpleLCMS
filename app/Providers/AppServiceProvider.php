<?php

namespace App\Providers;

use App\Models\Contact;
use App\Models\Firm;
use App\Models\Invoice;
use App\Models\Matter;
use App\Models\User;
use App\Policies\ContactPolicy;
use App\Policies\FirmPolicy;
use App\Policies\InvoicePolicy;
use App\Policies\MatterPolicy;
use App\Policies\UserPolicy;
use App\Support\TenantContext;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;
use Laravel\Horizon\Horizon;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        // One tenant per request; resolved by the SetTenant middleware and
        // read by the BelongsToFirm global scope.
        $this->app->singleton(TenantContext::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Gate::policy(Contact::class, ContactPolicy::class);
        Gate::policy(Matter::class, MatterPolicy::class);
        Gate::policy(Firm::class, FirmPolicy::class);
        Gate::policy(User::class, UserPolicy::class);
        Gate::policy(Invoice::class, InvoicePolicy::class);

        // Super-admin bypass: super_admin role can do anything
        Gate::before(function (User $user, string $ability): ?bool {
            if ($user->is_active && $user->hasRole('super_admin')) {
                return true;
            }
            return null;
        });

        // Admin panel access: admin role or manage_users permission
        Gate::define('admin-panel', fn (User $user): bool =>
            $user->is_active && ($user->hasRole('firm_admin') || $user->hasPermissionTo('manage_users'))
        );

        // Horizon exposes job payloads and failed-job traces, which routinely
        // carry client data. Without an explicit gate it falls back to
        // `app()->environment('local')`, which is open to anyone in a local or
        // misconfigured deployment.
        Gate::define('viewHorizon', fn (User $user): bool =>
            $user->is_active && $user->hasRole('super_admin')
        );

        Horizon::auth(fn ($request) => Gate::forUser($request->user())->allows('viewHorizon'));
    }
}
