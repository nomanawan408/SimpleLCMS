<?php

use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        // MySQL does not use CHECK constraints for the role enum;
        // the enum type itself enforces allowed values.
    }

    public function down(): void
    {
        //
    }
};
