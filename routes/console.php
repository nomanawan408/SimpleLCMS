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
