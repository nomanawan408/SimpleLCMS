<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE users MODIFY role VARCHAR(255) NOT NULL DEFAULT \'solicitor\'');
    }

    public function down(): void
    {
        // Cannot safely revert to enum since custom roles may exist
    }
};
