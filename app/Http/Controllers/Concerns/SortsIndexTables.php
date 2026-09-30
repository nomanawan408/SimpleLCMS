<?php

namespace App\Http\Controllers\Concerns;

/**
 * Server-side column sorting for index tables.
 *
 * Every sortable column is declared by the controller as a fixed SQL
 * expression chosen by an allowlisted key; the direction is validated to
 * asc/desc. No user input reaches the SQL except through those two gates,
 * so sort parameters can never inject. Empty values sink whichever way the
 * column points, identically on PostgreSQL and MySQL (whose native NULL
 * ordering disagrees with each other).
 *
 * Usage in an index method:
 *
 *     $sortBy = $request->input('sort_by');
 *     $sortDir = $this->normalizeSortDir($request->input('sort_dir'));
 *     $sortApplied = $this->applyTableSort($query, $map, $sortBy, $sortDir);
 *     if (! $sortApplied) { ...default order...; $sortBy = null; }
 *
 * and echo `sort_by => $sortBy, sort_dir => $sortBy ? $sortDir : null` back
 * in the filters prop so the UI and URL stay consistent.
 */
trait SortsIndexTables
{
    protected function normalizeSortDir(mixed $dir): string
    {
        return strtolower((string) $dir) === 'desc' ? 'desc' : 'asc';
    }

    /**
     * @param array<string, array{expr: string, bindings?: array}> $map
     */
    protected function applyTableSort(mixed $query, array $map, mixed $key, string $dir): bool
    {
        if (! is_string($key) || ! array_key_exists($key, $map)) {
            return false;
        }

        $expr = $map[$key]['expr'];
        $bindings = $map[$key]['bindings'] ?? [];
        $query->orderByRaw("({$expr}) IS NULL ASC")
            ->orderByRaw("{$expr} {$dir}", array_merge($bindings, $bindings));

        return true;
    }
}
