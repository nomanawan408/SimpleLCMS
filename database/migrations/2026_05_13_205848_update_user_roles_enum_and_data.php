<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Step 1: relax the column to plain varchar (drop the old enum check constraint)
        DB::statement('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check');
        DB::statement('ALTER TABLE users ALTER COLUMN role TYPE varchar(50)');

        // Step 2: remap old role values to new ones
        $map = [
            'firm_admin'       => 'administrator',
            'senior_solicitor' => 'solicitor',
            'paralegal'        => 'clerk',
            // 'solicitor', 'accounts' stay the same
        ];

        foreach ($map as $old => $new) {
            DB::table('users')->where('role', $old)->update(['role' => $new]);
        }

        // Step 3: add the new check constraint with the correct roles
        DB::statement(
            "ALTER TABLE users ADD CONSTRAINT users_role_check
             CHECK (role IN ('solicitor','lawyer','barrister','clerk','consultant','administrator','manager','accounts'))"
        );
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::statement('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check');

        $reverseMap = [
            'administrator' => 'firm_admin',
            'clerk'         => 'paralegal',
        ];

        foreach ($reverseMap as $new => $old) {
            DB::table('users')->where('role', $new)->update(['role' => $old]);
        }

        DB::statement(
            "ALTER TABLE users ADD CONSTRAINT users_role_check
             CHECK (role IN ('firm_admin','senior_solicitor','solicitor','paralegal','accounts'))"
        );
    }
};
