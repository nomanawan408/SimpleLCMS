<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Spatie\Permission\Models\Role;

/**
 * Validates that a role name may be granted from a firm-scoped route.
 *
 * Only staff and firm_admin may be granted here: super_admin lives in the
 * platform console and is never grantable from /admin. Platform roles are
 * additionally called out in PLATFORM_ROLES for list filtering.
 *
 * Spatie runs with `teams => false`, so roles live in one global namespace
 * and `Rule::exists('roles', 'name')` would happily accept another firm's
 * private role. This rule applies the two constraints the package cannot:
 *
 *   1. only lawyer and firm_admin are grantable from firm routes, and
 *   2. the role must be owned by the acting user's firm, or be shared
 *      (firm_id IS NULL).
 */
class AssignableRole implements ValidationRule
{
    /**
     * Roles carrying platform-wide authority. These may only be granted from
     * the super-admin console, never from /admin. Also used to filter role
     * listings in firm context.
     */
    public const PLATFORM_ROLES = ['super_admin'];

    /**
     * Firm admins may grant staff, and may promote to firm_admin (the firm
     * manages its own admins; the platform console manages super_admin).
     */
    public const GRANTABLE_ROLES = ['lawyer', 'firm_admin'];

    public function __construct(private readonly ?\App\Models\User $actor) {}

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! is_string($value) || $value === '') {
            $fail('The selected role is invalid.');

            return;
        }

        if (! in_array($value, self::GRANTABLE_ROLES, true)) {
            $fail('The selected role is invalid.');

            return;
        }

        $exists = Role::query()
            ->where('name', $value)
            ->where('guard_name', 'web')
            // Nested closure so the OR binds to firm ownership only, and never
            // widens the name/guard constraints above it.
            ->where(fn ($q) => $q
                ->where('firm_id', $this->actor?->firm_id)
                ->orWhereNull('firm_id'))
            ->exists();

        if (! $exists) {
            $fail('The selected role is invalid.');
        }
    }
}
