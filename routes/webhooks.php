<?php

use Illuminate\Support\Facades\Route;

Route::prefix('webhooks')->name('webhooks.')->group(function () {
    // Stripe, DocuSeal, and other signed webhooks should be defined here.
});
