<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Spatie\Permission\Models\Role;

/**
 * Validates that a role name may be granted from a firm-scoped route.
 *
 * Grantable here: the shared lawyer and firm_admin roles, plus custom roles
 * owned by the acting user's own firm. super_admin lives in the platform
 * console and is never grantable from /admin. Platform roles are
 * additionally called out in PLATFORM_ROLES for list filtering.
 *
 * Spatie runs with `teams => false`, so roles live in one global namespace
 * and `Rule::exists('roles', 'name')` would happily accept another firm's
 * private role. This rule applies the two constraints the package cannot:
 *
 *   1. the value is a built-in grantable role or a role owned by the
 *      acting user's firm (never another firm's, never shared system
 *      roles beyond the built-ins), and
 *   2. the role row actually exists for the web guard.
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
     * Shared roles a firm admin may grant (the firm manages its own admins;
     * the platform console manages super_admin). Custom roles owned by the
     * actor's firm are additionally grantable via the ownership check below.
     */
    public const GRANTABLE_ROLES = ['lawyer', 'firm_admin'];

    public function __construct(private readonly ?\App\Models\User $actor) {}

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! is_string($value) || $value === '') {
            $fail('The selected role is invalid.');

            return;
        }

        $isBuiltinGrantable = in_array($value, self::GRANTABLE_ROLES, true);

        $exists = Role::query()
            ->where('name', $value)
            ->where('guard_name', 'web')
            ->where(function ($q) use ($isBuiltinGrantable) {
                if ($isBuiltinGrantable) {
                    // Built-ins are shared (firm_id IS NULL). A firm-owned
                    // row of the same name, if one ever exists, qualifies too.
                    // Nested closure so the OR binds to firm ownership only,
                    // and never widens the name/guard constraints above it.
                    $q->where('firm_id', $this->actor?->firm_id)->orWhereNull('firm_id');
                } else {
                    // Custom roles must be owned by the actor's own firm:
                    // never another firm's, never a shared system role.
                    $q->where('firm_id', $this->actor?->firm_id);
                }
            })
            ->exists();

        if (! $exists) {
            $fail('The selected role is invalid.');
        }
    }
}
