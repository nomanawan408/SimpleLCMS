<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('firms', function (Blueprint $table) {
            $table->string('bank_name')->nullable()->after('payment_terms_days');
            $table->string('bank_sort_code', 10)->nullable()->after('bank_name');
            $table->string('bank_account_number', 30)->nullable()->after('bank_sort_code');
            $table->string('bank_account_name')->nullable()->after('bank_account_number');
            $table->string('bank_iban', 50)->nullable()->after('bank_account_name');
            $table->string('bank_swift_code', 20)->nullable()->after('bank_iban');
            $table->text('payment_instructions')->nullable()->after('bank_swift_code');
        });
    }

    public function down(): void
    {
        Schema::table('firms', function (Blueprint $table) {
            $table->dropColumn([
                'bank_name', 'bank_sort_code', 'bank_account_number',
                'bank_account_name', 'bank_iban', 'bank_swift_code',
                'payment_instructions',
            ]);
        });
    }
};
