<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * The app deliberately offers "No category" as a choice when logging an
 * expense, and validation already treats category as nullable -- but the
 * column itself was NOT NULL, so choosing "No category" inserted an explicit
 * NULL and the database rejected it with a constraint violation (a 500,
 * exactly like the earlier category-enum mismatch this app already fixed
 * once). This makes the column agree with the validation and the UI.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::getConnection()->getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE expenses ALTER COLUMN category DROP NOT NULL');
            DB::statement('ALTER TABLE expenses ALTER COLUMN category DROP DEFAULT');

            return;
        }

        // MySQL/SQLite: rebuild as a plain string, same as the invoices.status
        // precedent -- the allowed values are already enforced in
        // MatterExpenseController, not by the database.
        Schema::table('expenses', function (Blueprint $table) {
            $table->string('category')->nullable()->default(null)->change();
        });
    }

    public function down(): void
    {
        if (Schema::getConnection()->getDriverName() === 'pgsql') {
            DB::statement("UPDATE expenses SET category = 'other' WHERE category IS NULL");
            DB::statement("ALTER TABLE expenses ALTER COLUMN category SET DEFAULT 'other'");
            DB::statement('ALTER TABLE expenses ALTER COLUMN category SET NOT NULL');

            return;
        }

        Schema::table('expenses', function (Blueprint $table) {
            $table->string('category')->default('other')->nullable(false)->change();
        });
    }
};
