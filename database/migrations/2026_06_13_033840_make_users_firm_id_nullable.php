<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Drop the RLS policy that references firm_id
        DB::statement('DROP POLICY IF EXISTS firm_isolation ON users');

        // Make firm_id nullable
        DB::statement('ALTER TABLE users ALTER COLUMN firm_id DROP NOT NULL');
    }

    public function down(): void
    {
        // Make firm_id NOT NULL again
        DB::statement('ALTER TABLE users ALTER COLUMN firm_id SET NOT NULL');

        // Recreate the RLS policy
        DB::statement("CREATE POLICY firm_isolation ON users USING (firm_id = current_setting('app.current_firm_id', true)::uuid)");
    }
};
