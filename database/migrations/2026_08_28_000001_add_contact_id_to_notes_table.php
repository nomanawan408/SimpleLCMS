<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Notes could only ever hang off a matter, so the Notes tab on a contact had
 * nothing to show. A note now belongs to a matter or a contact.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('notes', function (Blueprint $table) {
            $table->uuid('contact_id')->nullable()->after('matter_id');
            $table->foreign('contact_id')->references('id')->on('contacts')->cascadeOnDelete();
            $table->index(['contact_id', 'logged_at']);
        });

        // A contact note has no matter, so matter_id can no longer be required.
        Schema::table('notes', function (Blueprint $table) {
            $table->uuid('matter_id')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('notes', function (Blueprint $table) {
            $table->dropForeign(['contact_id']);
            $table->dropIndex(['contact_id', 'logged_at']);
            $table->dropColumn('contact_id');
        });
    }
};
