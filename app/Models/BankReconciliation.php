<?php

namespace App\Models;

use App\Models\Concerns\BelongsToFirm;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Spatie\Activitylog\Support\LogOptions;
use Spatie\Activitylog\Models\Concerns\LogsActivity;

class BankReconciliation extends Model
{
    use BelongsToFirm, HasUuids, LogsActivity;

    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'firm_id',
        'as_at_date',
        'reconciliation_date',
        'paper_statement_balance',
        'system_cash_sheet_balance',
        'aggregate_client_ledger_balance',
        'discrepancy',
        'status',
        'notes',
        'performed_by',
    ];

    protected function casts(): array
    {
        return [
            'as_at_date'                      => 'date',
            'reconciliation_date'             => 'date',
            'paper_statement_balance'         => 'decimal:2',
            'system_cash_sheet_balance'       => 'decimal:2',
            'aggregate_client_ledger_balance' => 'decimal:2',
            'discrepancy'                     => 'decimal:2',
        ];
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()->logFillable();
    }

    public function firm(): BelongsTo { return $this->belongsTo(Firm::class); }
    public function performer(): BelongsTo { return $this->belongsTo(User::class, 'performed_by'); }
}
