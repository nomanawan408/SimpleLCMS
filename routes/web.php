<?php

use App\Http\Controllers\Admin\FirmController;
use App\Http\Controllers\Admin\RoleController;
use App\Http\Controllers\Admin\UserController;
use App\Http\Controllers\Auth\LoginController;
use App\Http\Controllers\Auth\PasswordResetController;
use App\Http\Controllers\Auth\RegisterController;
use App\Http\Controllers\Auth\TwoFactorController;
use App\Http\Controllers\AccountController;
use App\Http\Controllers\ActivityController;
use App\Http\Controllers\CalendarController;
use App\Http\Controllers\ContactController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\DocumentController;
use App\Http\Controllers\InvoiceController;
use App\Http\Controllers\MatterExpenseController;
use App\Http\Controllers\MatterController;
use App\Http\Controllers\MatterNoteController;
use App\Http\Controllers\MatterTimeEntryController;
use App\Http\Controllers\ReportController;
use App\Http\Controllers\SuperAdmin\DashboardController as SuperAdminDashboardController;
use App\Http\Controllers\SuperAdmin\FirmController as SuperAdminFirmController;
use App\Http\Controllers\TaskController;
use App\Http\Controllers\TimeController;
use App\Http\Controllers\TransactionController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    if (auth()->check() && auth()->user()->hasRole('super_admin')) {
        return redirect()->route('superadmin.dashboard');
    }
    return redirect()->route('dashboard');
});

// --- Auth ---
Route::middleware('guest')->group(function () {
    Route::get('/login', [LoginController::class, 'create'])->name('login');
    Route::post('/login', [LoginController::class, 'store'])->name('login.store');
    Route::get('/register', [RegisterController::class, 'create'])->name('register');
    Route::post('/register', [RegisterController::class, 'store'])->name('register.store');

    Route::get('/forgot-password', [PasswordResetController::class, 'create'])->name('password.request');
    Route::post('/forgot-password', [PasswordResetController::class, 'store'])->name('password.email');
    Route::get('/reset-password/{token}', [PasswordResetController::class, 'edit'])->name('password.reset');
    Route::post('/reset-password', [PasswordResetController::class, 'update'])->name('password.update');

    // Socialite routes removed to enforce simple email/password login
});

// --- Two-Factor ---
Route::middleware('auth')->group(function () {
    Route::get('/two-factor', [TwoFactorController::class, 'challenge'])->name('two-factor.challenge');
    Route::post('/two-factor', [TwoFactorController::class, 'verify'])->name('two-factor.verify');
    Route::get('/two-factor/setup', [TwoFactorController::class, 'setup'])->name('two-factor.setup');
    Route::post('/two-factor/enable', [TwoFactorController::class, 'enable'])->name('two-factor.enable');
    Route::delete('/two-factor', [TwoFactorController::class, 'disable'])->name('two-factor.disable');
    Route::post('/logout', [LoginController::class, 'destroy'])->name('logout');
});

// --- Authenticated & Tenant-Scoped ---
Route::middleware(['auth', 'set.tenant', 'requires.two.factor', 'redirect.super.admin'])->group(function () {
    Route::get('/dashboard', [DashboardController::class, 'index'])->name('dashboard');

    // Matters
    Route::resource('matters', MatterController::class);
    Route::put('/matters/{matter}/hearing-date', [MatterController::class, 'updateHearingDate'])->name('matters.hearing-date');
    Route::put('/matters/{matter}/deadline', [MatterController::class, 'updateDeadline'])->name('matters.deadline');
    Route::post('/matters/{matter}/notes', [MatterNoteController::class, 'store'])->name('matters.notes.store');
    Route::post('/matters/{matter}/time-entries', [MatterTimeEntryController::class, 'store'])->name('matters.time-entries.store');
    Route::post('/matters/{matter}/expenses', [MatterExpenseController::class, 'store'])->name('matters.expenses.store');

    // Contacts
    Route::resource('contacts', ContactController::class);

    // Billing
    Route::get('/billing', [InvoiceController::class, 'index'])->name('billing.index');
    Route::get('/billing/create', [InvoiceController::class, 'create'])->name('billing.create');
    Route::post('/billing', [InvoiceController::class, 'store'])->name('billing.store');
    Route::get('/billing/{invoice}', [InvoiceController::class, 'show'])->name('billing.show');
    Route::post('/billing/{invoice}', [InvoiceController::class, 'update'])->name('billing.update');
    Route::delete('/billing/{invoice}', [InvoiceController::class, 'destroy'])->name('billing.destroy');
    Route::post('/billing/{invoice}/payments', [InvoiceController::class, 'recordPayment'])->name('billing.payments.store');
    Route::post('/billing/{invoice}/send-email', [InvoiceController::class, 'sendEmail'])->name('billing.send-email');

    // Time Tracking / Check-in & Check-out
    Route::post('/time/checkin',  [TimeController::class, 'checkIn'])->name('time.checkin');
    Route::post('/time/checkout', [TimeController::class, 'checkOut'])->name('time.checkout');
    Route::post('/time/discard',  [TimeController::class, 'discardSession'])->name('time.discard');
    Route::post('/time/pause',    [TimeController::class, 'pauseSession'])->name('time.pause');
    Route::post('/time/resume',   [TimeController::class, 'resumeSession'])->name('time.resume');
    Route::post('/time/timer/start', [TimeController::class, 'startTimer'])->name('time.timer.start');
    Route::post('/time/timer/stop',  [TimeController::class, 'stopTimer'])->name('time.timer.stop');
    Route::post('/time/invoice', [TimeController::class, 'createInvoice'])->name('time.invoice');
    Route::get('/time', [TimeController::class, 'index'])->name('time.index');
    Route::post('/time', [TimeController::class, 'store'])->name('time.store');
    Route::put('/time/{entry}', [TimeController::class, 'update'])->name('time.update');
    Route::delete('/time/{entry}', [TimeController::class, 'destroy'])->name('time.destroy');

    // Transactions
    Route::get('/transactions',  [TransactionController::class, 'index'])->name('transactions.index');
    Route::post('/transactions', [TransactionController::class, 'store'])->name('transactions.store');

    // Tasks
    Route::get('/tasks', [TaskController::class, 'index'])->name('tasks.index');
    Route::post('/tasks', [TaskController::class, 'store'])->name('tasks.store');
    Route::put('/tasks/{task}', [TaskController::class, 'update'])->name('tasks.update');
    Route::delete('/tasks/{task}', [TaskController::class, 'destroy'])->name('tasks.destroy');

    // Calendar
    Route::get('/calendar', [CalendarController::class, 'index'])->name('calendar.index');
    Route::post('/calendar', [CalendarController::class, 'store'])->name('calendar.store');
    Route::put('/calendar/{event}', [CalendarController::class, 'update'])->name('calendar.update');
    Route::delete('/calendar/{event}', [CalendarController::class, 'destroy'])->name('calendar.destroy');

    // Documents
    Route::get('/documents', [DocumentController::class, 'index'])->name('documents.index');
    Route::post('/documents', [DocumentController::class, 'store'])->name('documents.store');
    Route::get('/documents/{document}/view', [DocumentController::class, 'view'])->name('documents.view');
    Route::get('/documents/{document}/download', [DocumentController::class, 'download'])->name('documents.download');
    Route::delete('/documents/{document}', [DocumentController::class, 'destroy'])->name('documents.destroy');

    // Accounts
    Route::get('/accounts', [AccountController::class, 'index'])->name('accounts.index');

    // Activities
    Route::get('/activities', [ActivityController::class, 'index'])->name('activities.index');

    // Reports
    Route::get('/reports', [ReportController::class, 'index'])->name('reports.index');

    // Admin
    Route::middleware('can:admin-panel')->prefix('admin')->name('admin.')->group(function () {
        Route::get('/firm/setup', [FirmController::class, 'setup'])->name('firm.setup');
        Route::put('/firm', [FirmController::class, 'update'])->name('firm.update');

        Route::get('/users', [UserController::class, 'index'])->name('users.index');
        Route::post('/users', [UserController::class, 'store'])->name('users.store');
        Route::put('/users/{user}', [UserController::class, 'update'])->name('users.update');
        Route::delete('/users/{user}', [UserController::class, 'destroy'])->name('users.destroy');
        Route::put('/users/{user}/reset-password', [UserController::class, 'resetPassword'])->name('users.reset-password');

        Route::get('/roles', [RoleController::class, 'index'])->name('roles.index');
        Route::post('/roles', [RoleController::class, 'store'])->name('roles.store');
        Route::put('/roles/{role}', [RoleController::class, 'update'])->name('roles.update');
        Route::delete('/roles/{role}', [RoleController::class, 'destroy'])->name('roles.destroy');
    });
});

// --- Super Admin (Platform Owner) ---
Route::middleware(['auth', 'requires.two.factor'])->prefix('superadmin')->name('superadmin.')->group(function () {
    Route::get('/dashboard', [SuperAdminDashboardController::class, 'index'])->name('dashboard');

    Route::get('/firms', [SuperAdminFirmController::class, 'index'])->name('firms.index');
    Route::post('/firms', [SuperAdminFirmController::class, 'store'])->name('firms.store');
    Route::put('/firms/{firm}', [SuperAdminFirmController::class, 'update'])->name('firms.update');
    Route::delete('/firms/{firm}', [SuperAdminFirmController::class, 'destroy'])->name('firms.destroy');
});
