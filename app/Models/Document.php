<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Spatie\Activitylog\Support\LogOptions;
use Spatie\Activitylog\Models\Concerns\LogsActivity;

class Document extends Model
{
    use HasFactory, HasUuids, LogsActivity, SoftDeletes;

    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'firm_id', 'matter_id', 'uploaded_by_id', 'parent_id', 'name',
        'original_name', 's3_key', 's3_bucket', 'folder', 'version',
        'mime_type', 'size_bytes', 'is_client_visible', 'is_signed',
        'signed_at', 'signer_data', 'docuseal_submission_id',
    ];

    protected function casts(): array
    {
        return [
            's3_key'           => 'encrypted',
            'signer_data'      => 'array',
            'is_client_visible' => 'boolean',
            'is_signed'        => 'boolean',
            'signed_at'        => 'datetime',
        ];
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()->logFillable()->logOnlyDirty();
    }

    public function firm(): BelongsTo { return $this->belongsTo(Firm::class); }
    public function matter(): BelongsTo { return $this->belongsTo(Matter::class); }
    public function uploadedBy(): BelongsTo { return $this->belongsTo(User::class, 'uploaded_by_id'); }
    public function parent(): BelongsTo { return $this->belongsTo(Document::class, 'parent_id'); }
}
