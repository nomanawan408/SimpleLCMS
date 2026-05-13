<?php

use App\Http\Controllers\Admin\FirmController;
use App\Http\Controllers\Admin\UserController;
use App\Http\Controllers\Auth\LoginController;
use App\Http\Controllers\Auth\PasswordResetController;
use App\Http\Controllers\Auth\RegisterController;
use App\Http\Controllers\Auth\SocialiteController;
use App\Http\Controllers\Auth\TwoFactorController;
use App\Http\Controllers\ContactController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\InvoiceController;
use App\Http\Controllers\MatterExpenseController;
use App\Http\Controllers\MatterController;
use App\Http\Controllers\MatterNoteController;
use App\Http\Controllers\MatterTimeEntryController;
use Illuminate\Support\Facades\Route;

Route::get('/', fn () => redirect()->route('dashboard'));

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

    Route::get('/auth/{provider}/redirect', [SocialiteController::class, 'redirect'])->name('socialite.redirect');
    Route::get('/auth/{provider}/callback', [SocialiteController::class, 'callback'])->name('socialite.callback');
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
Route::middleware(['auth', 'set.tenant', 'requires.two.factor'])->group(function () {
    Route::get('/dashboard', [DashboardController::class, 'index'])->name('dashboard');

    // Matters
    Route::resource('matters', MatterController::class);
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

    // Admin
    Route::middleware('role:firm_admin')->prefix('admin')->name('admin.')->group(function () {
        Route::get('/firm/setup', [FirmController::class, 'setup'])->name('firm.setup');
        Route::put('/firm', [FirmController::class, 'update'])->name('firm.update');

        Route::get('/users', [UserController::class, 'index'])->name('users.index');
        Route::post('/users', [UserController::class, 'store'])->name('users.store');
        Route::put('/users/{user}', [UserController::class, 'update'])->name('users.update');
    });
});
