<?php

namespace App\Models;

use App\Models\Concerns\BelongsToFirm;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Spatie\Activitylog\Support\LogOptions;
use Spatie\Activitylog\Models\Concerns\LogsActivity;

class LedgerPosting extends Model
{
    use BelongsToFirm, HasUuids, LogsActivity;

    protected $keyType = 'string';
    public $incrementing = false;

    public const ACCOUNT_TYPES = [
        'matter_client',
        'matter_business',
        'cash_sheet_client',
        'cash_sheet_business',
    ];

    protected $fillable = [
        'firm_id',
        'transaction_id',
        'matter_id',
        'account_type',
        'entry_type',
        'amount',
        'value_date',
        'balance_after',
    ];

    protected function casts(): array
    {
        return [
            'amount'        => 'decimal:2',
            'balance_after' => 'decimal:2',
            'value_date'    => 'date',
        ];
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()->logFillable();
    }

    public function firm(): BelongsTo { return $this->belongsTo(Firm::class); }
    public function transaction(): BelongsTo { return $this->belongsTo(FinancialTransaction::class, 'transaction_id'); }
    public function matter(): BelongsTo { return $this->belongsTo(Matter::class); }
}
