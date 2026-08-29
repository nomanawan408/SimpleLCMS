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
use App\Http\Controllers\ContactNoteController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\DocumentController;
use App\Http\Controllers\InvoiceController;
use App\Http\Controllers\MatterExpenseController;
use App\Http\Controllers\MatterController;
use App\Http\Controllers\MatterNoteController;
use App\Http\Controllers\MatterTimeEntryController;
use App\Http\Controllers\ReportController;
use App\Http\Controllers\SearchController;
use App\Http\Controllers\FirmSetupController;
use App\Http\Controllers\SuperAdmin\DashboardController as SuperAdminDashboardController;
use App\Http\Controllers\SuperAdmin\FirmController as SuperAdminFirmController;
use App\Http\Controllers\SuperAdmin\UserController as SuperAdminUserController;
use App\Http\Controllers\SuperAdmin\BackupController;
use App\Http\Controllers\TaskController;
use App\Http\Controllers\TimeController;
use App\Http\Controllers\TransactionController;
use Illuminate\Auth\Events\Verified;
use Illuminate\Foundation\Auth\EmailVerificationRequest;
use Illuminate\Http\Request;
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

// --- Firm Setup (public token link) ---
// Unauthenticated and password-setting, so both ends are rate limited.
Route::middleware('throttle:10,1')->group(function () {
    Route::get('/firm/setup/{token}', [FirmSetupController::class, 'show'])->name('firm.setup.complete');
    Route::put('/firm/setup/{token}', [FirmSetupController::class, 'update'])->name('firm.setup.update');
});

// --- Two-Factor ---
Route::middleware('auth')->group(function () {
    // The challenge itself is reachable before the second factor is presented.
    Route::get('/two-factor', [TwoFactorController::class, 'challenge'])->name('two-factor.challenge');
    Route::post('/two-factor', [TwoFactorController::class, 'verify'])
        ->middleware('throttle:5,1')
        ->name('two-factor.verify');

    // Enrolling in or removing 2FA requires a session that has already cleared
    // the challenge -- otherwise a stolen password alone could disable it.
    Route::middleware('requires.two.factor')->group(function () {
        Route::get('/two-factor/setup', [TwoFactorController::class, 'setup'])->name('two-factor.setup');
        Route::post('/two-factor/enable', [TwoFactorController::class, 'enable'])
            ->middleware('throttle:5,1')
            ->name('two-factor.enable');
        Route::delete('/two-factor', [TwoFactorController::class, 'disable'])
            ->middleware('throttle:5,1')
            ->name('two-factor.disable');
    });

    Route::post('/logout', [LoginController::class, 'destroy'])->name('logout');
});

// --- Email verification ---
Route::middleware('auth')->group(function () {
    Route::get('/email/verify', fn (Request $request) => inertia('Auth/VerifyEmail', [
        'status' => session('status'),
        'email'  => $request->user()->email,
    ]))->name('verification.notice');

    // EmailVerificationRequest validates the signature and the id/hash pair.
    Route::get('/email/verify/{id}/{hash}', function (EmailVerificationRequest $request) {
        if ($request->user()->hasVerifiedEmail()) {
            return redirect()->route('dashboard');
        }

        if ($request->user()->markEmailAsVerified()) {
            event(new Verified($request->user()));
        }

        return redirect()->route('dashboard')->with('success', 'Email verified.');
    })->middleware(['signed', 'throttle:6,1'])->name('verification.verify');

    Route::post('/email/verification-notification', function (Request $request) {
        if ($request->user()->hasVerifiedEmail()) {
            return redirect()->route('dashboard');
        }

        $request->user()->sendEmailVerificationNotification();

        return back()->with('status', 'verification-link-sent');
    })->middleware('throttle:6,1')->name('verification.send');
});

// --- Authenticated & Tenant-Scoped ---
Route::middleware(['auth', 'verified', 'set.tenant', 'requires.two.factor', 'redirect.super.admin'])->group(function () {
    Route::get('/dashboard', [DashboardController::class, 'index'])->name('dashboard');

    // Matters
    Route::resource('matters', MatterController::class);
    Route::put('/matters/{matter}/hearing-date', [MatterController::class, 'updateHearingDate'])->name('matters.hearing-date');
    Route::put('/matters/{matter}/deadline', [MatterController::class, 'updateDeadline'])->name('matters.deadline');
    Route::post('/matters/{matter}/notes', [MatterNoteController::class, 'store'])->name('matters.notes.store');
    Route::post('/matters/{matter}/time-entries', [MatterTimeEntryController::class, 'store'])->name('matters.time-entries.store');
    Route::post('/matters/{matter}/expenses', [MatterExpenseController::class, 'store'])->name('matters.expenses.store');
    Route::put('/matters/{matter}/expenses/{expense}', [MatterExpenseController::class, 'update'])->name('matters.expenses.update');
    Route::delete('/matters/{matter}/expenses/{expense}', [MatterExpenseController::class, 'destroy'])->name('matters.expenses.destroy');

    // Contacts
    Route::resource('contacts', ContactController::class);
    Route::post('/contacts/{contact}/notes', [ContactNoteController::class, 'store'])->name('contacts.notes.store');
    Route::put('/contacts/{contact}/notes/{note}', [ContactNoteController::class, 'update'])->name('contacts.notes.update');
    Route::delete('/contacts/{contact}/notes/{note}', [ContactNoteController::class, 'destroy'])->name('contacts.notes.destroy');

    // Billing
    Route::get('/billing', [InvoiceController::class, 'index'])->name('billing.index');
    Route::get('/billing/create', [InvoiceController::class, 'create'])->name('billing.create');
    Route::post('/billing', [InvoiceController::class, 'store'])->name('billing.store');
    Route::get('/billing/{invoice}', [InvoiceController::class, 'show'])->name('billing.show');
    Route::post('/billing/{invoice}', [InvoiceController::class, 'update'])->name('billing.update');
    Route::delete('/billing/{invoice}', [InvoiceController::class, 'destroy'])->name('billing.destroy');
    Route::post('/billing/{invoice}/payments', [InvoiceController::class, 'recordPayment'])->name('billing.payments.store');
    Route::post('/billing/{invoice}/send-email', [InvoiceController::class, 'sendEmail'])->name('billing.send-email');
    Route::get('/billing/{invoice}/pdf', [InvoiceController::class, 'downloadPdf'])->name('billing.pdf');

    // Time Tracking / Check-in & Check-out
    Route::post('/time/checkin',  [TimeController::class, 'checkIn'])->name('time.checkin');
    Route::post('/time/checkout', [TimeController::class, 'checkOut'])->name('time.checkout');
    Route::post('/time/discard',  [TimeController::class, 'discardSession'])->name('time.discard');
    Route::post('/time/pause',    [TimeController::class, 'pauseSession'])->name('time.pause');
    Route::post('/time/resume',   [TimeController::class, 'resumeSession'])->name('time.resume');
    Route::post('/time/timer/start', [TimeController::class, 'startTimer'])->name('time.timer.start');
    Route::post('/time/timer/stop',  [TimeController::class, 'stopTimer'])->name('time.timer.stop');
    Route::post('/time/invoice', [TimeController::class, 'createInvoice'])->name('time.invoice');
    Route::get('/time/sessions', [TimeController::class, 'sessions'])->name('time.sessions');
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

    // Global search (the header's command palette)
    Route::get('/search', [SearchController::class, 'index'])->name('search');

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
Route::middleware(['auth', 'verified', 'requires.two.factor', 'role:super_admin'])->prefix('superadmin')->name('superadmin.')->group(function () {
    Route::get('/dashboard', [SuperAdminDashboardController::class, 'index'])->name('dashboard');

    Route::get('/firms', [SuperAdminFirmController::class, 'index'])->name('firms.index');
    Route::post('/firms', [SuperAdminFirmController::class, 'store'])->name('firms.store');
    Route::get('/firms/{firm}', [SuperAdminFirmController::class, 'show'])->name('firms.show');
    Route::put('/firms/{firm}', [SuperAdminFirmController::class, 'update'])->name('firms.update');
    Route::delete('/firms/{firm}', [SuperAdminFirmController::class, 'destroy'])->name('firms.destroy');

    Route::get('/users', [SuperAdminUserController::class, 'index'])->name('users.index');
    Route::put('/users/{user}', [SuperAdminUserController::class, 'update'])->name('users.update');
    Route::delete('/users/{user}', [SuperAdminUserController::class, 'destroy'])->name('users.destroy');
    Route::put('/users/{user}/reset-password', [SuperAdminUserController::class, 'resetPassword'])->name('users.reset-password');
    
    // Backup System
    Route::get('/backups', [BackupController::class, 'index'])->name('backups.index');
    Route::post('/backups', [BackupController::class, 'store'])->name('backups.store');
    Route::get('/backups/{filename}', [BackupController::class, 'download'])->name('backups.download');
    Route::post('/backups/restore', [BackupController::class, 'restore'])->name('backups.restore');
    Route::delete('/backups/{filename}', [BackupController::class, 'destroy'])->name('backups.destroy');
});
