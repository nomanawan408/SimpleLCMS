<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // Timestamp slice of the last accepted TOTP code, so a code can
            // never be replayed inside its validity window.
            $table->unsignedBigInteger('totp_last_timestamp')->nullable()->after('totp_enabled');
            // Failed second-factor attempts, tracked separately from password
            // failures so one cannot mask the other.
            $table->unsignedInteger('totp_failed_count')->default(0)->after('totp_last_timestamp');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['totp_last_timestamp', 'totp_failed_count']);
        });
    }
};
