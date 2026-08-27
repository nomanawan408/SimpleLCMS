<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('firms', function (Blueprint $table) {
            // Setup links set the firm administrator's password, so they must
            // not stay valid forever once forwarded or leaked from a mailbox.
            $table->timestamp('setup_token_expires_at')->nullable()->after('setup_token');
        });

        // Give already-issued tokens a deadline rather than leaving them open.
        DB::table('firms')
            ->whereNotNull('setup_token')
            ->update(['setup_token_expires_at' => now()->addHours(72)]);
    }

    public function down(): void
    {
        Schema::table('firms', function (Blueprint $table) {
            $table->dropColumn('setup_token_expires_at');
        });
    }
};
