<?php

use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        // firm_id is already nullable in the base users migration.
        // No RLS policies to drop on MySQL.
    }

    public function down(): void
    {
        //
    }
};
