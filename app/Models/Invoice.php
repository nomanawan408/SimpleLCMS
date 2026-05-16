<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Spatie\Activitylog\Support\LogOptions;
use Spatie\Activitylog\Models\Concerns\LogsActivity;

class Invoice extends Model
{
    use HasFactory, HasUuids, LogsActivity, SoftDeletes;

    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'firm_id', 'matter_id', 'invoice_number', 'status',
        'subtotal', 'vat_amount', 'vat_rate', 'total',
        'discount_amount', 'discount_reason', 'due_date',
        'sent_at', 'paid_at', 'stripe_payment_intent_id', 'notes',
    ];

    protected function casts(): array
    {
        return [
            'subtotal'        => 'decimal:2',
            'vat_amount'      => 'decimal:2',
            'vat_rate'        => 'decimal:2',
            'total'           => 'decimal:2',
            'discount_amount' => 'decimal:2',
            'due_date'        => 'date',
            'sent_at'         => 'datetime',
            'paid_at'         => 'datetime',
        ];
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()->logFillable()->logOnlyDirty();
    }

    public function firm(): BelongsTo { return $this->belongsTo(Firm::class); }
    public function matter(): BelongsTo { return $this->belongsTo(Matter::class); }
    public function lineItems(): HasMany { return $this->hasMany(InvoiceLineItem::class); }
    public function payments(): HasMany { return $this->hasMany(Payment::class); }

    public function getAmountPaidAttribute(): float
    {
        return (float) $this->payments()->sum('amount');
    }

    public function getAmountOutstandingAttribute(): float
    {
        return max(0, $this->total - $this->amount_paid);
    }
}
