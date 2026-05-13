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
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
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
    }
}
