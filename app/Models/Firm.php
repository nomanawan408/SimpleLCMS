<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Spatie\Activitylog\Support\LogOptions;
use Spatie\Activitylog\Models\Concerns\LogsActivity;

class Firm extends Model
{
    use HasFactory, HasUuids, LogsActivity;

    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'name', 'slug', 'plan', 'vat_number', 'sra_number',
        'logo_path', 'settings', 'subscription_status', 'trial_ends_at',
        'address_line1', 'address_line2', 'city', 'county', 'postcode',
        'phone', 'email', 'website', 'timezone', 'default_hourly_rate',
        'invoice_prefix', 'invoice_sequence', 'vat_rate', 'payment_terms_days',
        'bank_name', 'bank_sort_code', 'bank_account_number', 'bank_account_name',
        'bank_iban', 'bank_swift_code', 'payment_instructions',
    ];

    protected function casts(): array
    {
        return [
            'settings'        => 'array',
            'trial_ends_at'   => 'datetime',
            'default_hourly_rate' => 'decimal:2',
            'vat_rate'        => 'decimal:2',
        ];
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()->logFillable()->logOnlyDirty();
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    public function matters(): HasMany
    {
        return $this->hasMany(Matter::class);
    }

    public function contacts(): HasMany
    {
        return $this->hasMany(Contact::class);
    }

    public function nextInvoiceNumber(): string
    {
        $number = str_pad($this->invoice_sequence, 4, '0', STR_PAD_LEFT);
        return "{$this->invoice_prefix}-" . now()->year . "-{$number}";
    }
}
