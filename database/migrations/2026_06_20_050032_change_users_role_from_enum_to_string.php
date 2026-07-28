<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE users ALTER COLUMN role TYPE VARCHAR(255), ALTER COLUMN role SET DEFAULT \'solicitor\', ALTER COLUMN role SET NOT NULL');
        } else {
            DB::statement('ALTER TABLE users MODIFY role VARCHAR(255) NOT NULL DEFAULT \'solicitor\'');
        }
    }

    public function down(): void
    {
        // Cannot safely revert to enum since custom roles may exist
    }
};
