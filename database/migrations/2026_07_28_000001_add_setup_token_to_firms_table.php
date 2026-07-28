<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('firms', function (Blueprint $table) {
            $table->string('setup_token', 64)->nullable()->after('payment_instructions');
            $table->timestamp('setup_completed_at')->nullable()->after('setup_token');
        });
    }

    public function down(): void
    {
        Schema::table('firms', function (Blueprint $table) {
            $table->dropColumn(['setup_token', 'setup_completed_at']);
        });
    }
};
