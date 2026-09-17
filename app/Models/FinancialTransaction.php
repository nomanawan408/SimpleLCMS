<?php

namespace App\Models;

use App\Models\Concerns\BelongsToFirm;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Spatie\Activitylog\Support\LogOptions;
use Spatie\Activitylog\Models\Concerns\LogsActivity;

class FinancialTransaction extends Model
{
    use BelongsToFirm, HasUuids, LogsActivity;

    protected $keyType = 'string';
    public $incrementing = false;

    public const TYPES = [
        'client_receipt',
        'client_payment',
        'client_to_office_transfer',
        'reversal',
    ];

    protected $fillable = [
        'firm_id',
        'matter_id',
        'transaction_date',
        'reference',
        'narrative',
        'transaction_type',
        'reversal_of_id',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'transaction_date' => 'date',
        ];
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()->logFillable()->logOnlyDirty();
    }

    public function firm(): BelongsTo { return $this->belongsTo(Firm::class); }
    public function matter(): BelongsTo { return $this->belongsTo(Matter::class); }
    public function creator(): BelongsTo { return $this->belongsTo(User::class, 'created_by'); }
    public function reversedTransaction(): BelongsTo { return $this->belongsTo(self::class, 'reversal_of_id'); }
    public function postings(): HasMany { return $this->hasMany(LedgerPosting::class, 'transaction_id'); }
}
