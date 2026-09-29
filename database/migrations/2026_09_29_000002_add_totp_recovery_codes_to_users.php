<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * 2FA recovery codes: single-use fallback sign-in when the authenticator
 * device is lost. Stored as bcrypt hashes (never plaintext); each code is
 * removed the moment it is used. No admin reset path exists by design --
 * self-service recovery keeps device loss from becoming a support override.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->text('totp_recovery_codes')->nullable()->after('totp_secret');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('totp_recovery_codes');
        });
    }
};
