<?php

namespace App\Support;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;

class Timeframe
{
    public const PRESETS = ['today', 'week', 'month', 'quarter', 'ytd', 'custom', 'all'];

    /**
     * Resolve preset + date_from/date_to into [?Carbon, ?Carbon] inclusive range.
     * Returns [null, null] for 'all' / empty.
     */
    public static function resolve(?string $preset, ?string $from, ?string $to): array
    {
        $preset = $preset ? strtolower($preset) : 'all';

        if ($preset === 'all' || $preset === '') {
            return [null, null];
        }

        if (!in_array($preset, self::PRESETS, true)) {
            return [null, null];
        }

        if ($preset === 'custom') {
            if (!$from || !$to) {
                return [null, null];
            }
            $start = Carbon::parse($from)->startOfDay();
            $end = Carbon::parse($to)->endOfDay();
            if ($end->lt($start)) {
                [$start, $end] = [$end->copy()->startOfDay(), $start->copy()->endOfDay()];
            }
            return [$start, $end];
        }

        $now = Carbon::now();
        return match ($preset) {
            'today'   => [$now->copy()->startOfDay(), $now->copy()->endOfDay()],
            'week'    => [$now->copy()->startOfWeek(), $now->copy()->endOfWeek()],
            'month'   => [$now->copy()->startOfMonth(), $now->copy()->endOfMonth()],
            'quarter' => [$now->copy()->startOfQuarter(), $now->copy()->endOfQuarter()],
            'ytd'     => [$now->copy()->startOfYear(), $now->copy()->endOfDay()],
            default   => [null, null],
        };
    }

    public static function apply(Builder $q, string $column, ?Carbon $start, ?Carbon $end): Builder
    {
        if ($start && $end) {
            $q->whereBetween($column, [$start, $end]);
        } elseif ($start) {
            $q->where($column, '>=', $start);
        } elseif ($end) {
            $q->where($column, '<=', $end);
        }
        return $q;
    }

    public static function label(?string $preset, ?string $from, ?string $to): string
    {
        $map = [
            'today' => 'Today', 'week' => 'This Week', 'month' => 'This Month',
            'quarter' => 'This Quarter', 'ytd' => 'Year to Date', 'custom' => $from && $to ? "$from → $to" : 'Custom', 'all' => 'All Time',
        ];
        return $map[$preset ?? 'all'] ?? 'All Time';
    }
}