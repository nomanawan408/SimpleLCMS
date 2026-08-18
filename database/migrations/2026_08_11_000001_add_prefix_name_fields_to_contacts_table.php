<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('contacts', function (Blueprint $table) {
            $table->string('prefix', 20)->nullable()->after('type');
            $table->string('first_name', 255)->nullable()->after('prefix');
            $table->string('middle_name', 255)->nullable()->after('first_name');
            $table->string('last_name', 255)->nullable()->after('middle_name');
        });

        // Backfill names in PHP so fresh databases work consistently on MySQL,
        // PostgreSQL, and SQLite.
        \Illuminate\Support\Facades\DB::table('contacts')
            ->whereIn('type', ['individual', 'other_party'])
            ->whereNotNull('name')
            ->where('name', '!=', '')
            ->whereNull('first_name')
            ->select(['id', 'name'])
            ->orderBy('id')
            ->each(function (object $contact): void {
                $parts = preg_split('/\s+/', trim($contact->name), -1, PREG_SPLIT_NO_EMPTY) ?: [];

                if ($parts === []) {
                    return;
                }

                \Illuminate\Support\Facades\DB::table('contacts')
                    ->where('id', $contact->id)
                    ->update([
                        'first_name' => $parts[0],
                        'middle_name' => count($parts) > 2 ? implode(' ', array_slice($parts, 1, -1)) : null,
                        'last_name' => count($parts) > 1 ? $parts[count($parts) - 1] : null,
                    ]);
            });
    }

    public function down(): void
    {
        Schema::table('contacts', function (Blueprint $table) {
            $table->dropColumn(['prefix', 'first_name', 'middle_name', 'last_name']);
        });
    }
};
