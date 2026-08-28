<?php

namespace App\Console\Commands;

use App\Models\Firm;
use App\Models\Matter;
use Illuminate\Console\Command;

class BackfillMatterNumbers extends Command
{
    protected $signature = 'matters:backfill {--start=100 : Starting suffix e.g. 100 for 00100} {--dry-run : Show what would change without saving} {--firm= : Only backfill this firm_id}';
    protected $description = 'Backfill matter_numbers to be globally sequential per firm, starting at given suffix (default 00100). Keeps date+initials prefix.';

    public function handle(): int
    {
        $start = (int) $this->option('start');
        $dryRun = $this->option('dry-run');
        $firmFilter = $this->option('firm');

        $firms = $firmFilter
            ? Firm::where('id', $firmFilter)->get()
            : Firm::all();

        if ($firms->isEmpty()) {
            $this->error('No firms found.');
            return 1;
        }

        foreach ($firms as $firm) {
            $this->info("Firm: {$firm->name} ({$firm->id})");

            $matters = Matter::withTrashed()
                ->where('firm_id', $firm->id)
                ->orderBy('created_at')
                ->get();

            if ($matters->isEmpty()) {
                $this->line('  No matters.');
                continue;
            }

            $this->line("  Found {$matters->count()} matters (incl. soft-deleted), start={$start}");

            foreach ($matters as $idx => $m) {
                $newSuffix = str_pad($start + $idx, 5, '0', STR_PAD_LEFT);
                $pos = strrpos($m->matter_number, '-');
                $prefix = $pos === false ? $m->matter_number : substr($m->matter_number, 0, $pos);
                $newNumber = $prefix . '-' . $newSuffix;

                if ($m->matter_number === $newNumber) {
                    $this->line("  Keep {$m->matter_number} | {$m->name}");
                    continue;
                }

                // Safety: ensure newNumber not already taken by another matter (should not happen in ordered rebuild per firm)
                $exists = Matter::withTrashed()->where('firm_id', $firm->id)->where('matter_number', $newNumber)->where('id', '!=', $m->id)->exists();
                if ($exists) {
                    $this->error("  Collision: {$newNumber} already exists, skipping {$m->matter_number}");
                    continue;
                }

                $this->line("  {$m->matter_number} -> {$newNumber} | {$m->name}" . ($dryRun ? ' [dry-run]' : ''));

                if (! $dryRun) {
                    $m->matter_number = $newNumber;
                    $m->save();
                }
            }
        }

        if ($dryRun) {
            $this->warn('Dry run — no changes saved. Remove --dry-run to apply.');
        } else {
            $this->info('Done. Future matters will auto-continue from max suffix +1 (now >= '.str_pad($start,5,'0',STR_PAD_LEFT).').');
        }

        return 0;
    }
}
