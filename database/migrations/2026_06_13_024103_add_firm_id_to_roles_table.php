<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('roles', function (Blueprint $table) {
            $table->foreignUuid('firm_id')->nullable()->after('id')->constrained('firms')->nullOnDelete();
            $table->string('description')->nullable()->after('guard_name');
            $table->boolean('is_system')->default(false)->after('description');

            // Replace the unique constraint to include firm_id
            $table->dropUnique('roles_name_guard_name_unique');
            $table->unique(['name', 'guard_name', 'firm_id'], 'roles_name_guard_name_firm_unique');
        });
    }

    public function down(): void
    {
        Schema::table('roles', function (Blueprint $table) {
            $table->dropUnique('roles_name_guard_name_firm_unique');
            $table->unique(['name', 'guard_name'], 'roles_name_guard_name_unique');

            $table->dropColumn(['firm_id', 'description', 'is_system']);
        });
    }
};
