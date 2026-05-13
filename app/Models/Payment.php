<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Payment extends Model
{
    use HasUuids;

    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'firm_id', 'invoice_id', 'amount', 'method', 'stripe_charge_id', 'paid_at', 'notes',
    ];

    protected function casts(): array
    {
        return [
            'amount'  => 'decimal:2',
            'paid_at' => 'datetime',
        ];
    }

    public function firm(): BelongsTo { return $this->belongsTo(Firm::class); }
    public function invoice(): BelongsTo { return $this->belongsTo(Invoice::class); }
}
