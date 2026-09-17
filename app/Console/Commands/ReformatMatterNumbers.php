<?php

namespace App\Console\Commands;

use App\Models\Firm;
use App\Models\Matter;
use Illuminate\Console\Command;

class ReformatMatterNumbers extends Command
{
    protected $signature = 'matters:reformat-numbers {--dry-run : Show what would change without saving} {--firm= : Only reformat this firm_id}';
    protected $description = 'Rewrite matter_number date segments (YYYYMMDD) as year + 4 random digits, keeping initials and serial. Collision-safe per firm.';

    public function handle(): int
    {
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

            foreach ($matters as $m) {
                // Expected shape: 8 digits + '-' + initials + '-' + serial.
                if (! preg_match('/^(\d{4})\d{4}-([A-Za-z]{1,10})-(\d+)$/', $m->matter_number, $parts)) {
                    $this->warn("  Skip {$m->matter_number} | {$m->name} (unrecognized format)");
                    continue;
                }

                [, $year, $initials, $serial] = $parts;

                $newNumber = null;
                for ($attempt = 0; $attempt < 50; $attempt++) {
                    $candidate = $year . str_pad((string) random_int(0, 9999), 4, '0', STR_PAD_LEFT)
                        . "-{$initials}-{$serial}";
                    $taken = Matter::withTrashed()
                        ->where('firm_id', $firm->id)
                        ->where('matter_number', $candidate)
                        ->where('id', '!=', $m->id)
                        ->exists();
                    if (! $taken) {
                        $newNumber = $candidate;
                        break;
                    }
                }

                if ($newNumber === null) {
                    $this->error("  Could not find a free number for {$m->matter_number} | {$m->name}, skipping");
                    continue;
                }

                if ($newNumber === $m->matter_number) {
                    $this->line("  Keep {$m->matter_number} | {$m->name}");
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
            $this->info('Done.');
        }

        return 0;
    }
}
