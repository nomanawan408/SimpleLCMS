<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Spatie\Activitylog\Support\LogOptions;
use Spatie\Activitylog\Models\Concerns\LogsActivity;
use Spatie\Permission\Traits\HasRoles;

class User extends Authenticatable implements MustVerifyEmail
{
    use HasFactory, HasRoles, HasUuids, LogsActivity, Notifiable, SoftDeletes;

    protected $keyType = 'string';
    public $incrementing = false;

    /**
     * totp_secret / totp_enabled / totp_recovery_codes are deliberately NOT
     * fillable: every write goes through forceFill in TwoFactorController,
     * so no request payload can ever flip second-factor state via mass
     * assignment. Recovery codes are stored as bcrypt hashes, shown once.
     */
    protected $fillable = [
        'firm_id',
        'full_name',
        'email',
        'password',
        'role',
        'phone',
        'rate_per_hour',
        'is_active',
        'google_id',
        'microsoft_id',
        'avatar_url',
        'email_verified_at',
        'last_login_at',
        'failed_login_count',
        'locked_until',
    ];

    protected $hidden = [
        'password',
        'remember_token',
        'totp_secret',
        'totp_recovery_codes',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'last_login_at'     => 'datetime',
            'locked_until'      => 'datetime',
            'password'          => 'hashed',
            'totp_secret'       => 'encrypted',
            'totp_recovery_codes' => 'array',
            'totp_enabled'      => 'boolean',
            'is_active'         => 'boolean',
            'rate_per_hour'     => 'decimal:2',
            'preferences'       => 'array',
        ];
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logFillable()
            ->logOnlyDirty();
    }

    public function firm(): BelongsTo
    {
        return $this->belongsTo(Firm::class);
    }

    public function matters(): HasMany
    {
        return $this->hasMany(Matter::class, 'responsible_user_id');
    }

    public function timeEntries(): HasMany
    {
        return $this->hasMany(TimeEntry::class);
    }

    public function tasks(): HasMany
    {
        return $this->hasMany(Task::class, 'assignee_id');
    }

    public function isLocked(): bool
    {
        return $this->locked_until !== null && $this->locked_until->isFuture();
    }

    public function isFirmAdmin(): bool
    {
        return $this->hasRole('super_admin') || $this->hasRole('firm_admin');
    }

    public function isLawyer(): bool
    {
        return $this->hasRole('lawyer');
    }

    /**
     * Matters explicitly assigned to this user (plus responsible matters
     * via Matter::isAssignedTo).
     */
    public function assignedMatters(): BelongsToMany
    {
        return $this->belongsToMany(Matter::class, 'matter_user')->using(MatterUser::class)->withTimestamps();
    }

    /**
     * Financial visibility: firm admins always, staff only with the
     * view_finances grant. Guards every money widget and report.
     */
    public function canViewFinances(): bool
    {
        return $this->is_active && ($this->isFirmAdmin() || $this->hasPermissionTo('view_finances'));
    }

    /**
     * Financial mutation: firm admins always, staff only with the
     * manage_finances grant. Guards invoicing, payments, transfers,
     * reconciliations and trust writes.
     */
    public function canManageFinances(): bool
    {
        return $this->is_active && ($this->isFirmAdmin() || $this->hasPermissionTo('manage_finances'));
    }

    public function canAccessFinancials(): bool
    {
        return $this->canViewFinances();
    }
}
