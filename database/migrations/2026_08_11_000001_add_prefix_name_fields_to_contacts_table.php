<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('contacts', function (Blueprint $table) {
            $table->string('prefix', 20)->nullable()->after('type');
            $table->string('first_name', 255)->nullable()->after('prefix');
            $table->string('middle_name', 255)->nullable()->after('first_name');
            $table->string('last_name', 255)->nullable()->after('middle_name');
        });

        // Backfill name column from existing data where possible
        // For existing contacts, the 'name' column already holds the full name.
        // We attempt to split it into first_name / last_name for individuals.
        DB::statement('
            UPDATE contacts
            SET first_name = TRIM(SUBSTRING_INDEX(name, \' \', 1)),
                last_name  = TRIM(SUBSTRING_INDEX(name, \' \', -1))
            WHERE type IN (\'individual\', \'other_party\')
              AND name IS NOT NULL
              AND name != \'\'
              AND first_name IS NULL
        ');

        // For contacts with 3+ parts, try to fill middle_name
        DB::statement('
            UPDATE contacts
            SET middle_name = TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(name, \' \', 2), \' \', -1))
            WHERE type IN (\'individual\', \'other_party\')
              AND name IS NOT NULL
              AND (LENGTH(name) - LENGTH(REPLACE(name, \' \', \'\'))) >= 2
              AND middle_name IS NULL
        ');
    }

    public function down(): void
    {
        Schema::table('contacts', function (Blueprint $table) {
            $table->dropColumn(['prefix', 'first_name', 'middle_name', 'last_name']);
        });
    }
};
