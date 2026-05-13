<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class GdprConsent extends Model
{
    use HasUuids;

    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'firm_id', 'contact_id', 'basis', 'purpose', 'version', 'given_at', 'withdrawn_at',
    ];

    protected function casts(): array
    {
        return [
            'given_at'     => 'datetime',
            'withdrawn_at' => 'datetime',
        ];
    }

    public function firm(): BelongsTo { return $this->belongsTo(Firm::class); }
    public function contact(): BelongsTo { return $this->belongsTo(Contact::class); }
}
