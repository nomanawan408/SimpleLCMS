<?php

namespace App\Models;

use App\Models\Concerns\BelongsToFirm;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Spatie\Activitylog\Support\LogOptions;
use Spatie\Activitylog\Models\Concerns\LogsActivity;

class Matter extends Model
{
    use BelongsToFirm, HasFactory, HasUuids, LogsActivity, SoftDeletes;

    protected $keyType = 'string';
    public $incrementing = false;

    /**
     * Every status the database column will currently accept. This is the
     * single source of truth for validation -- the database enum has grown
     * across a few migrations, so hand-listing the values again anywhere
     * else is exactly how a value ends up accepted by one layer and rejected
     * by another.
     */
    public const ALL_STATUSES = [
        'open', 'pending_court_date', 'awaiting_client', 'awaiting_opponent',
        'on_hold', 'closed', 'archived',
        'actively_progressing', 'reviewing', 'being_worked', 'in_progress', 'in_review',
        'awaiting_response', 'awaiting_third_party',
        'awaiting_respondent_solicitors', 'awaiting_claimant_solicitors',
    ];

    /**
     * Statuses that mean "this matter is currently open and being worked",
     * as opposed to waiting on someone else's action (the awaiting_*
     * statuses) or a terminal/paused state (on_hold, closed, archived).
     *
     * Several places used to check status = 'open' specifically to decide
     * whether a matter counts toward the dashboard's open-matters figure,
     * whether it is eligible to appear in the invoice-creation matter
     * picker, and the reports page's default filter. A matter moved into
     * one of the newer "actively working" statuses would otherwise vanish
     * from all three without anything actually changing about the work. Use
     * this list wherever "open" was meant loosely rather than literally.
     */
    public const ACTIVE_STATUSES = [
        'open', 'actively_progressing', 'reviewing', 'being_worked', 'in_progress', 'in_review',
    ];

    protected $fillable = [
        'firm_id', 'matter_number', 'name', 'description', 'status', 'priority',
        'practice_area', 'fee_arrangement', 'responsible_user_id',
        'originating_user_id', 'court', 'court_reference',
        'opened_at', 'closed_at', 'custom_fields',
    ];

    protected function casts(): array
    {
        return [
            'opened_at'     => 'datetime',
            'closed_at'     => 'datetime',
            'custom_fields' => 'array',
        ];
    }

    protected $appends = ['next_step', 'next_deadline', 'client_names', 'hearing_date'];

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()->logFillable()->logOnlyDirty();
    }

    public function firm(): BelongsTo
    {
        return $this->belongsTo(Firm::class);
    }

    public function responsibleUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'responsible_user_id');
    }

    public function originatingUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'originating_user_id');
    }

    public function contacts(): BelongsToMany
    {
        return $this->belongsToMany(Contact::class, 'matter_contacts')
            ->withPivot('role')
            ->withTimestamps();
    }

    public function timeEntries(): HasMany
    {
        return $this->hasMany(TimeEntry::class);
    }

    public function expenses(): HasMany
    {
        return $this->hasMany(Expense::class);
    }

    public function invoices(): HasMany
    {
        return $this->hasMany(Invoice::class);
    }

    public function documents(): HasMany
    {
        return $this->hasMany(Document::class);
    }

    public function tasks(): HasMany
    {
        return $this->hasMany(Task::class);
    }

    public function calendarEvents(): HasMany
    {
        return $this->hasMany(CalendarEvent::class);
    }

    public function notes(): HasMany
    {
        return $this->hasMany(Note::class);
    }

    public function trustEntries(): HasMany
    {
        return $this->hasMany(TrustEntry::class);
    }

    public function getTrustBalanceAttribute(): float
    {
        $receipts = (float) $this->trustEntries()->where('type', 'receipt')->sum('amount');
        $disbursements = (float) $this->trustEntries()->where('type', 'disbursement')->sum('amount');
        return $receipts - $disbursements;
    }

    public function getUnbilledTimeValueAttribute(): float
    {
        return (float) $this->timeEntries()->where('billable', true)->where('billed', false)->sum('amount');
    }

    public function getNextStepAttribute(): ?string
    {
        $task = $this->tasks()
            ->whereIn('status', ['todo', 'in_progress'])
            ->whereNull('completed_at')
            ->orderBy('due_date')
            ->first();
        return $task?->title;
    }

    public function getNextDeadlineAttribute(): ?string
    {
        $task = $this->tasks()
            ->whereIn('status', ['todo', 'in_progress'])
            ->whereNull('completed_at')
            ->whereNotNull('due_date')
            ->orderBy('due_date')
            ->first();
        return $task?->due_date?->format('Y-m-d');
    }

    public function getClientNamesAttribute(): ?string
    {
        $clients = $this->contacts()
            ->wherePivotIn('role', ['client', 'claimant', 'applicant', 'petitioner'])
            ->get()
            ->map(fn ($c) => $c->full_name ?: $c->name);
        if ($clients->isEmpty()) {
            $clients = $this->contacts()->get()->map(fn ($c) => $c->full_name ?: $c->name);
        }
        return $clients->isEmpty() ? null : $clients->join(', ');
    }

    public function getHearingDateAttribute(): ?string
    {
        $event = $this->calendarEvents()
            ->where('is_court_date', true)
            ->where('start_at', '>=', now())
            ->orderBy('start_at')
            ->first();
        return $event?->start_at?->format('Y-m-d');
    }
}
