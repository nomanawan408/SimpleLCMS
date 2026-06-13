<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('contacts', function (Blueprint $table) {
            $table->string('contact_person_name')->nullable()->after('company_number');
            $table->string('contact_person_email')->nullable()->after('contact_person_name');
            $table->string('contact_person_phone')->nullable()->after('contact_person_email');
        });
    }

    public function down(): void
    {
        Schema::table('contacts', function (Blueprint $table) {
            $table->dropColumn(['contact_person_name', 'contact_person_email', 'contact_person_phone']);
        });
    }
};
