<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Adds three finer-grained "matter is actively being worked" statuses
 * alongside the existing open/pending/awaiting/on_hold/closed/archived set:
 * actively_progressing, reviewing, being_worked.
 *
 * See App\Models\Matter::ACTIVE_STATUSES -- every place that previously
 * checked status = 'open' to mean "an active matter" (the dashboard's open
 * matters count, the invoice-creation matter picker, the reports default
 * filter, the client-accounts list) now checks against that list instead, so
 * a matter does not silently disappear from any of them just for moving into
 * one of these new statuses.
 */
return new class extends Migration
{
    private const OLD_VALUES = ['open', 'pending_court_date', 'awaiting_client', 'awaiting_opponent', 'on_hold', 'closed', 'archived'];
    private const NEW_VALUES = [...self::OLD_VALUES, 'actively_progressing', 'reviewing', 'being_worked'];

    public function up(): void
    {
        if (Schema::getConnection()->getDriverName() === 'pgsql') {
            $list = "'".implode("','", self::NEW_VALUES)."'";
            DB::statement('ALTER TABLE matters DROP CONSTRAINT IF EXISTS matters_status_check');
            DB::statement("ALTER TABLE matters ADD CONSTRAINT matters_status_check CHECK (status IN ({$list}))");

            return;
        }

        // MySQL/SQLite: rebuilt as a plain string, matching the precedent set
        // for invoices.status and expenses.category -- the allowed values are
        // enforced by UpdateMatterRequest's Rule::in(), not the database, on
        // these drivers.
        Schema::table('matters', function (Blueprint $table) {
            $table->string('status')->default('open')->change();
        });
    }

    public function down(): void
    {
        DB::table('matters')
            ->whereIn('status', ['actively_progressing', 'reviewing', 'being_worked'])
            ->update(['status' => 'open']);

        if (Schema::getConnection()->getDriverName() === 'pgsql') {
            $list = "'".implode("','", self::OLD_VALUES)."'";
            DB::statement('ALTER TABLE matters DROP CONSTRAINT IF EXISTS matters_status_check');
            DB::statement("ALTER TABLE matters ADD CONSTRAINT matters_status_check CHECK (status IN ({$list}))");

            return;
        }

        Schema::table('matters', function (Blueprint $table) {
            $table->string('status')->default('open')->change();
        });
    }
};
