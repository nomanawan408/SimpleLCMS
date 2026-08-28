<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Adds four more "awaiting" statuses alongside the existing awaiting_client /
 * awaiting_opponent pair: awaiting_response, awaiting_third_party,
 * awaiting_respondent_solicitors, awaiting_claimant_solicitors.
 *
 * These behave like the existing awaiting_* statuses, not like the
 * actively_progressing/in_progress family added just before this: a matter
 * waiting on someone else's action is not counted in Matter::ACTIVE_STATUSES,
 * matching how awaiting_client/awaiting_opponent already work today.
 */
return new class extends Migration
{
    private const PREVIOUS_STATUSES = [
        'open', 'pending_court_date', 'awaiting_client', 'awaiting_opponent',
        'on_hold', 'closed', 'archived',
        'actively_progressing', 'reviewing', 'being_worked', 'in_progress', 'in_review',
    ];

    private const NEW_STATUSES = [
        'awaiting_response', 'awaiting_third_party',
        'awaiting_respondent_solicitors', 'awaiting_claimant_solicitors',
    ];

    private const ALL_STATUSES = [...self::PREVIOUS_STATUSES, ...self::NEW_STATUSES];

    public function up(): void
    {
        if (Schema::getConnection()->getDriverName() === 'pgsql') {
            $list = "'".implode("','", self::ALL_STATUSES)."'";
            DB::statement('ALTER TABLE matters DROP CONSTRAINT IF EXISTS matters_status_check');
            DB::statement("ALTER TABLE matters ADD CONSTRAINT matters_status_check CHECK (status IN ({$list}))");

            return;
        }

        $list = "'".implode("','", self::ALL_STATUSES)."'";
        DB::statement("ALTER TABLE matters MODIFY status ENUM({$list}) NOT NULL DEFAULT 'open'");
    }

    public function down(): void
    {
        DB::table('matters')->whereIn('status', self::NEW_STATUSES)->update(['status' => 'open']);

        $list = "'".implode("','", self::PREVIOUS_STATUSES)."'";

        if (Schema::getConnection()->getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE matters DROP CONSTRAINT IF EXISTS matters_status_check');
            DB::statement("ALTER TABLE matters ADD CONSTRAINT matters_status_check CHECK (status IN ({$list}))");

            return;
        }

        DB::statement("ALTER TABLE matters MODIFY status ENUM({$list}) NOT NULL DEFAULT 'open'");
    }
};
