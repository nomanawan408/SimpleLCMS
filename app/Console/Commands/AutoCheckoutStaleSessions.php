<?php

namespace App\Console\Commands;

use App\Models\Matter;
use App\Models\TimeEntry;
use App\Models\TimeSession;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class AutoCheckoutStaleSessions extends Command
{
    protected $signature = 'app:auto-checkout-stale-sessions {--hours=12 : Max hours before auto-checkout} {--dry-run : Show what would be checked out without doing it}';

    protected $description = 'Auto-checkout forgotten timers that are still counting (overnight)';

    public function handle(): int
    {
        $hours = (int) ($this->option('hours') ?? 12);
        if ($hours < 1) {
            $this->error('Hours must be at least 1.');
            return self::FAILURE;
        }

        $dryRun = (bool) $this->option('dry-run');
        $cutoff = Carbon::now()->subHours($hours);
        $thresholdMinutes = $hours * 60;

        // Find stale sessions: started_at before cutoff OR live elapsed exceeds threshold.
        // elapsed_minutes is a PHP accessor (not a DB column) so we fetch and filter in PHP
        // after pulling candidates by started_at, plus a second pass for elapsed overflow.
        $byStartedAt = TimeSession::where('started_at', '<', $cutoff)->with(['user', 'matter'])->get();

        // Also check any session whose computed elapsed_minutes exceeds threshold but whose
        // started_at is still within the cutoff window (e.g. capped/rounding edge cases).
        $remaining = TimeSession::where('started_at', '>=', $cutoff)->with(['user', 'matter'])->get()
            ->filter(fn (TimeSession $s) => $s->elapsed_minutes > $thresholdMinutes);

        $staleSessions = $byStartedAt->concat($remaining)->unique('id')->values();

        // Also include any session from the first set whose elapsed already exceeds cap even if started_at check missed due to pause nuances
        // (already covered) — final fallback: if we missed anything, scan all.
        if ($staleSessions->isEmpty()) {
            // Ensure we also catch sessions where started_at < cutoff but elapsed is computed differently
            // (the primary query already covers this; this is a no-op safety net when counts are 0)
        }

        if ($staleSessions->isEmpty()) {
            $this->info('No stale sessions found (threshold: ' . $hours . 'h).');
            return self::SUCCESS;
        }

        $this->info('Found ' . $staleSessions->count() . ' stale session(s) (threshold: ' . $hours . 'h, cutoff: ' . $cutoff->toDateTimeString() . ').');

        if ($dryRun) {
            $this->warn('Dry-run mode: no changes will be made.');
        }

        $checkedOut = 0;
        $skipped = 0;

        foreach ($staleSessions as $session) {
            $matter = Matter::where('id', $session->matter_id)->first();

            if (!$matter) {
                $this->warn("Skipping session {$session->id} (user {$session->user_id}): matter {$session->matter_id} no longer exists.");
                $skipped++;
                continue;
            }

            if ((string) $matter->firm_id !== (string) $session->firm_id) {
                $this->warn("Skipping session {$session->id} (user {$session->user_id}): firm_id mismatch (session {$session->firm_id} vs matter {$matter->firm_id}).");
                $skipped++;
                continue;
            }

            // Duration calculation mirrors TimeController::checkOut exactly:
            // diffInMinutes(now) minus total_paused_seconds/60, subtracting current pause if paused.
            $startedAt = Carbon::parse($session->started_at);
            $durationMinutes = (int) max(1, $startedAt->diffInMinutes(Carbon::now()) - ($session->total_paused_seconds / 60));

            if ($session->paused_at) {
                $currentPause = Carbon::parse($session->paused_at)->diffInSeconds(Carbon::now());
                $durationMinutes = (int) max(1, $startedAt->diffInMinutes(Carbon::now()) - (($session->total_paused_seconds + $currentPause) / 60));
            }

            // Cap at 24h (1440 minutes) to avoid absurd overnight timers (e.g. forgotten for days).
            $capped = false;
            if ($durationMinutes > 1440) {
                $durationMinutes = 1440;
                $capped = true;
            }

            $rate = (float) $session->rate;
            $amount = round($rate * ($durationMinutes / 60), 2);

            $hoursElapsed = (int) max(1, round(Carbon::parse($session->started_at)->diffInMinutes(Carbon::now()) / 60));
            // Prefer actual elapsed hours in the suffix, falling back to the threshold.
            $suffix = ' [auto-checked out after ' . $hoursElapsed . 'h]';
            if (str_contains((string) $session->description, '[auto-checked out')) {
                $description = (string) $session->description;
            } else {
                $description = trim((string) ($session->description ?? '')) . $suffix;
            }

            $elapsedForLog = $session->elapsed_minutes;

            if ($dryRun) {
                $this->line("Would auto-checkout session {$session->id}: user {$session->user_id} matter {$session->matter_id} ({$session->matter_name}) duration {$durationMinutes}m elapsed {$elapsedForLog}m rate {$rate} amount {$amount}" . ($capped ? ' [capped at 24h]' : '') . ($session->status === 'paused' ? ' [paused]' : ''));
                $checkedOut++;
                continue;
            }

            try {
                DB::transaction(function () use ($session, $matter, $durationMinutes, $rate, $amount, $description) {
                    $entry = TimeEntry::create([
                        'firm_id' => $session->firm_id,
                        'matter_id' => $matter->id,
                        'user_id' => $session->user_id,
                        'invoice_id' => null,
                        'date' => Carbon::today()->toDateString(),
                        'duration_minutes' => $durationMinutes,
                        'rate' => $rate,
                        'amount' => $amount,
                        'billable' => true,
                        'billed' => false,
                        'activity_type' => $session->activity_type ?? 'other',
                        'description' => $description,
                        'is_locked' => false,
                    ]);

                    // Delete the stale session so it no longer blocks check-in.
                    $session->delete();

                    activity()
                        ->causedBy($session->user)
                        ->performedOn($entry)
                        ->log('auto_checked_out');
                });

                $capNote = $capped ? ' [capped at 24h]' : '';
                $pauseNote = $session->status === 'paused' ? ' [was paused]' : '';
                $this->info("Auto-checked out session {$session->id}: user {$session->user_id} matter {$session->matter_name} ({$session->matter_id}) duration {$durationMinutes}m amount {$amount}{$capNote}{$pauseNote}.");

                // Session cache (PHP session) cannot be cleared from a CLI command — the user's cookie/session
                // lives in Redis/database/file on the web tier. Emit a warning so operators know.
                $this->warn("Note: PHP session cache for user {$session->user_id} (key active_timer_{$session->user_id}) cannot be cleared from CLI; it will be reconciled on next web request or via restoreSessionFromDb().");

                $checkedOut++;
            } catch (\Throwable $e) {
                $this->error("Failed to auto-checkout session {$session->id}: " . $e->getMessage());
                $skipped++;
            }
        }

        $this->info("Done. Checked out: {$checkedOut}, skipped: {$skipped}.");

        return self::SUCCESS;
    }
}
