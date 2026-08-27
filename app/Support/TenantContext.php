<?php

namespace App\Support;

/**
 * The firm the current request belongs to.
 *
 * Populated once per request by the SetTenant middleware and read by the
 * BelongsToFirm global scope, so tenant isolation is enforced in one place
 * rather than by a `where('firm_id', ...)` remembered in every controller.
 *
 * Deliberately a container singleton rather than static state: it resets with
 * the application instance, so console commands, queued jobs, seeders and
 * tests all start with no tenant and therefore no scope.
 */
class TenantContext
{
    private ?string $firmId = null;

    /** The user id the current value was resolved for, to detect changes. */
    private ?string $resolvedFor = null;

    private bool $resolved = false;

    /** Set while a deliberate cross-firm read is in progress. */
    private bool $bypassed = false;

    public function set(?string $firmId): void
    {
        $this->firmId = $firmId;
        $this->resolved = true;
        $this->resolvedFor = auth()->id();
    }

    public function firmId(): ?string
    {
        if ($this->bypassed) {
            return null;
        }

        // Resolve on first read rather than relying on middleware order:
        // SubstituteBindings runs inside the `web` group, ahead of the
        // route-level SetTenant, so route-model binding would otherwise
        // resolve unscoped -- exactly the case the scope exists to catch.
        // Re-resolve whenever the authenticated identity changes, so a value
        // worked out while unauthenticated can never persist into a request
        // that does have a user (and vice versa).
        if (! $this->resolved || $this->resolvedFor !== auth()->id()) {
            $this->resolveFromAuth();
        }

        return $this->firmId;
    }

    private function resolveFromAuth(): void
    {
        $this->resolved = true;
        $this->resolvedFor = auth()->id();
        $this->firmId = null;

        $user = auth()->user();

        // Platform owners read across firms by definition.
        if ($user && $user->firm_id && ! $user->hasRole('super_admin')) {
            $this->firmId = $user->firm_id;
        }
    }

    public function hasTenant(): bool
    {
        return $this->firmId() !== null;
    }

    /**
     * Run a callback with tenant scoping suspended.
     *
     * For the rare legitimate cross-firm read outside the super-admin console.
     * Keeping it explicit means every such place is greppable.
     */
    public function withoutScope(callable $callback): mixed
    {
        $previous = $this->bypassed;
        $this->bypassed = true;

        try {
            return $callback();
        } finally {
            $this->bypassed = $previous;
        }
    }
}
