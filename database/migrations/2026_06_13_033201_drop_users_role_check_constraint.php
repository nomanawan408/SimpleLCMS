<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check');
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('solicitor','lawyer','barrister','clerk','consultant','administrator','manager','accounts'))");
    }
};
