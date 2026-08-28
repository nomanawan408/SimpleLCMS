<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // All valid statuses after this migration: keeps legacy + the 3 from 2026_08_28
    // plus short aliases requested ("In Progress", "In Review").
    private const ALL_STATUSES = [
        'open',
        'pending_court_date',
        'awaiting_client',
        'awaiting_opponent',
        'on_hold',
        'closed',
        'archived',
        'actively_progressing',
        'reviewing',
        'being_worked',
        'in_progress',
        'in_review',
    ];

    public function up(): void
    {
        Schema::table('matters', function (Blueprint $table) {
            $table->enum('priority', ['low', 'medium', 'high'])->default('medium')->after('status');
        });

        // Expand status enum/check to include short aliases
        if (Schema::getConnection()->getDriverName() === 'pgsql') {
            $list = "'" . implode("','", self::ALL_STATUSES) . "'";
            DB::statement('ALTER TABLE matters DROP CONSTRAINT IF EXISTS matters_status_check');
            DB::statement("ALTER TABLE matters ADD CONSTRAINT matters_status_check CHECK (status IN ({$list}))");
        } else {
            $list = "'" . implode("','", self::ALL_STATUSES) . "'";
            DB::statement("ALTER TABLE matters MODIFY status ENUM({$list}) NOT NULL DEFAULT 'open'");
        }
    }

    public function down(): void
    {
        Schema::table('matters', function (Blueprint $table) {
            $table->dropColumn('priority');
        });

        $old = ['open','pending_court_date','awaiting_client','awaiting_opponent','on_hold','closed','archived','actively_progressing','reviewing','being_worked'];
        if (Schema::getConnection()->getDriverName() === 'pgsql') {
            DB::statement("UPDATE matters SET status='open' WHERE status IN ('in_progress','in_review')");
            $list = "'" . implode("','", $old) . "'";
            DB::statement('ALTER TABLE matters DROP CONSTRAINT IF EXISTS matters_status_check');
            DB::statement("ALTER TABLE matters ADD CONSTRAINT matters_status_check CHECK (status IN ({$list}))");
        } else {
            DB::statement("UPDATE matters SET status='open' WHERE status IN ('in_progress','in_review')");
            $list = "'" . implode("','", $old) . "'";
            DB::statement("ALTER TABLE matters MODIFY status ENUM({$list}) NOT NULL DEFAULT 'open'");
        }
    }
};
