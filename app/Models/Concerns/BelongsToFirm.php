<?php

namespace App\Models\Concerns;

use App\Exceptions\CrossTenantWriteException;
use App\Support\TenantContext;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Confines a model to the firm of the current request.
 *
 * Before this existed, isolation depended on every controller remembering to
 * write `->where('firm_id', $firmId)`, and route-model binding had no
 * protection at all. The scope closes both: a record belonging to another firm
 * is simply not visible, so a forgotten filter fails closed.
 *
 * The scope is inert when there is no tenant -- console commands, queued jobs,
 * seeders, guest requests, and the super-admin console all run unscoped.
 */
trait BelongsToFirm
{
    public static function bootBelongsToFirm(): void
    {
        static::addGlobalScope('firm', function (Builder $builder) {
            $firmId = app(TenantContext::class)->firmId();

            if ($firmId !== null) {
                $builder->where(
                    $builder->getModel()->getTable().'.firm_id',
                    $firmId
                );
            }
        });

        // Stamp the owning firm on create so a caller cannot land a record in
        // another firm by omitting the column -- and refuse outright if one
        // was supplied that disagrees with the current tenant, rather than
        // silently rewriting it and hiding the bug.
        static::creating(function ($model) {
            $firmId = app(TenantContext::class)->firmId();

            if ($firmId === null) {
                return;
            }

            if ($model->firm_id === null) {
                $model->firm_id = $firmId;

                return;
            }

            if ($model->firm_id !== $firmId) {
                throw new CrossTenantWriteException(sprintf(
                    'Refusing to create %s for firm %s while the current tenant is %s.',
                    class_basename($model), $model->firm_id, $firmId
                ));
            }
        });
    }

    public function firm(): BelongsTo
    {
        return $this->belongsTo(\App\Models\Firm::class);
    }

    /**
     * Escape hatch for deliberate cross-firm queries. Grep for this to audit
     * every place tenant isolation is intentionally stepped around.
     */
    public static function acrossAllFirms(): Builder
    {
        return static::query()->withoutGlobalScope('firm');
    }
}
