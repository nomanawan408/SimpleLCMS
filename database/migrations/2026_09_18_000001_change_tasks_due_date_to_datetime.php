<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Deadlines now carry a time (default 17:00, close of business), so the
     * column must hold more than a bare date. doctrine/dbal is not
     * installed, so the type change is raw SQL per driver instead of
     * $table->change(). Existing values convert to midnight and keep
     * displaying date-only until re-saved.
     */
    public function up(): void
    {
        $driver = DB::getDriverName();

        if ($driver === 'mysql') {
            DB::statement('ALTER TABLE tasks MODIFY due_date DATETIME NULL');
        } elseif ($driver === 'pgsql') {
            DB::statement('ALTER TABLE tasks ALTER COLUMN due_date TYPE TIMESTAMP USING due_date::timestamp');
        } else {
            DB::statement('ALTER TABLE tasks ALTER COLUMN due_date TYPE TIMESTAMP');
        }
    }

    public function down(): void
    {
        $driver = DB::getDriverName();

        if ($driver === 'mysql') {
            DB::statement('ALTER TABLE tasks MODIFY due_date DATE NULL');
        } elseif ($driver === 'pgsql') {
            DB::statement('ALTER TABLE tasks ALTER COLUMN due_date TYPE DATE USING due_date::date');
        } else {
            DB::statement('ALTER TABLE tasks ALTER COLUMN due_date TYPE DATE');
        }
    }
};
