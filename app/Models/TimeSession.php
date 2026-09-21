<?php

namespace App\Models;

use App\Models\Concerns\BelongsToFirm;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TimeSession extends Model
{
    use BelongsToFirm, HasUuids;

    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'firm_id', 'user_id', 'matter_id', 'matter_name', 'matter_number',
        'activity_type', 'description', 'rate',
        'started_at', 'paused_at', 'total_paused_seconds', 'status',
    ];

    protected function casts(): array
    {
        return [
            'started_at'           => 'datetime',
            'paused_at'            => 'datetime',
            'rate'                 => 'decimal:2',
            'total_paused_seconds' => 'int',
        ];
    }

    /**
     * The user's currently running (or paused) timer, if any — session
     * first, DB row as fallback (session lost, device switch). Shared on
     * every Inertia response so the header pill can follow the timer
     * across pages. Read-only: callers that need a live session write it
     * themselves (see TimeController).
     */
    public static function currentFor(User $user): ?array
    {
        $session = session('active_timer_' . $user->id);
        if ($session) {
            return $session;
        }

        $db = static::where('user_id', $user->id)->first();
        if (! $db) {
            return null;
        }

        return [
            'matter_id'            => $db->matter_id,
            'matter_name'          => $db->matter_name,
            'matter_number'        => $db->matter_number,
            'started_at'           => $db->started_at->toIso8601String(),
            'activity_type'        => $db->activity_type,
            'description'          => $db->description ?? '',
            'paused_at'            => $db->paused_at?->toIso8601String(),
            'total_paused_seconds' => (int) $db->total_paused_seconds,
            'rate'                 => (float) $db->rate,
        ];
    }

    public function firm(): BelongsTo { return $this->belongsTo(Firm::class); }
    public function user(): BelongsTo { return $this->belongsTo(User::class); }
    public function matter(): BelongsTo { return $this->belongsTo(Matter::class); }

    public function scopeActive($q) { return $q->where('status', 'active'); }
    public function scopePaused($q) { return $q->where('status', 'paused'); }

    /** Live elapsed minutes, excluding paused time (including a current pause). */
    public function getElapsedMinutesAttribute(): int
    {
        if (!$this->started_at) return 0;

        $end = $this->paused_at ?? now();
        $minutes = $this->started_at->diffInMinutes($end) - ($this->total_paused_seconds / 60);

        return (int) max(1, round($minutes));
    }
}