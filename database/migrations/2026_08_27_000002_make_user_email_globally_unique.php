<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Authentication resolves users by email alone (Auth::attempt, sendResetLink,
 * and password_reset_tokens which is keyed on email). A (firm_id, email)
 * constraint therefore let two rows share a login identity, leaving which one
 * authenticates undefined. Make the database agree with how auth behaves.
 */
return new class extends Migration
{
    public function up(): void
    {
        $duplicates = DB::table('users')
            ->select('email')
            ->groupBy('email')
            ->havingRaw('COUNT(*) > 1')
            ->pluck('email');

        if ($duplicates->isNotEmpty()) {
            throw new RuntimeException(
                'Cannot add a unique index on users.email: these addresses appear more than once — '
                .$duplicates->implode(', ')
                .'. Resolve them manually, then re-run this migration.'
            );
        }

        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique('users_firm_id_email_unique');
            $table->unique('email');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique(['email']);
            $table->unique(['firm_id', 'email']);
        });
    }
};
