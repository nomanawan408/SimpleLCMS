<?php

use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        // Role enum is already up-to-date in the base users migration.
    }

    public function down(): void
    {
        //
    }
};
