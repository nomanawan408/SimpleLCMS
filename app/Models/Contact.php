<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Spatie\Activitylog\Support\LogOptions;
use Spatie\Activitylog\Models\Concerns\LogsActivity;

class Contact extends Model
{
    use HasFactory, HasUuids, LogsActivity, SoftDeletes;

    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'firm_id', 'type', 'name', 'email', 'phone', 'phone_secondary',
        'address', 'national_insurance_number', 'dob', 'company_number',
        'id_verification_status', 'source', 'source_detail', 'tags', 'gdpr_consent_at',
        'gdpr_consent_version', 'marketing_consent', 'conflict_check_cleared_at',
        'lead_status',
    ];

    protected function casts(): array
    {
        return [
            'address'                   => 'array',
            'tags'                      => 'array',
            'national_insurance_number' => 'encrypted',
            'dob'                       => 'encrypted',
            'gdpr_consent_at'           => 'datetime',
            'conflict_check_cleared_at' => 'datetime',
            'marketing_consent'         => 'boolean',
        ];
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()->logFillable()->logOnlyDirty();
    }

    public function firm(): BelongsTo
    {
        return $this->belongsTo(Firm::class);
    }

    public function matters(): BelongsToMany
    {
        return $this->belongsToMany(Matter::class, 'matter_contacts')
            ->withPivot('role')
            ->withTimestamps();
    }

    public function gdprConsents(): HasMany
    {
        return $this->hasMany(GdprConsent::class);
    }
}
