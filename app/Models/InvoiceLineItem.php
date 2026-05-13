<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InvoiceLineItem extends Model
{
    use HasUuids;

    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'invoice_id', 'description', 'quantity', 'unit_rate', 'amount', 'vat_amount', 'type',
    ];

    protected function casts(): array
    {
        return [
            'quantity'   => 'decimal:2',
            'unit_rate'  => 'decimal:2',
            'amount'     => 'decimal:2',
            'vat_amount' => 'decimal:2',
        ];
    }

    public function invoice(): BelongsTo { return $this->belongsTo(Invoice::class); }
}
