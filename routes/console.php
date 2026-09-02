<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Task-due, hearing-approaching and invoice-overdue notifications. This does
// nothing on its own -- the server needs one cron entry running
// `php artisan schedule:run` every minute, which is what actually decides
// when to fire this. See app/Console/Commands/SendDeadlineNotifications.php.
Schedule::command('app:send-deadline-notifications')->dailyAt('07:00');

// Forgotten timers: if an employee forgets to checkout, the TimeSession row
// keeps counting forever (elapsed_minutes grows without bound) while the PHP
// session may already be gone — so the dashboard shows "Start timer" while
// server still counts. This hourly job auto-checks out anything older than
// 12h. See app/Console/Commands/AutoCheckoutStaleSessions.php.
Schedule::command('app:auto-checkout-stale-sessions')->hourly();
