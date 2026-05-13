<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Spatie\Activitylog\Support\LogOptions;
use Spatie\Activitylog\Models\Concerns\LogsActivity;

class TimeEntry extends Model
{
    use HasUuids, LogsActivity, SoftDeletes;

    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'firm_id', 'matter_id', 'user_id', 'invoice_id', 'date',
        'duration_minutes', 'rate', 'amount', 'billable', 'billed',
        'activity_type', 'description', 'is_locked',
    ];

    protected function casts(): array
    {
        return [
            'date'     => 'date',
            'rate'     => 'decimal:2',
            'amount'   => 'decimal:2',
            'billable' => 'boolean',
            'billed'   => 'boolean',
            'is_locked' => 'boolean',
        ];
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()->logFillable()->logOnlyDirty();
    }

    public function firm(): BelongsTo { return $this->belongsTo(Firm::class); }
    public function matter(): BelongsTo { return $this->belongsTo(Matter::class); }
    public function user(): BelongsTo { return $this->belongsTo(User::class); }
    public function invoice(): BelongsTo { return $this->belongsTo(Invoice::class); }

    public function getDurationFormattedAttribute(): string
    {
        $hours = intdiv($this->duration_minutes, 60);
        $mins  = $this->duration_minutes % 60;
        return sprintf('%d:%02d', $hours, $mins);
    }
}
