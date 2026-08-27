<?php

namespace App\Rules;

use App\Models\User;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Spatie\Permission\Models\Role;

/**
 * Validates that a role name may be granted by the acting user from a
 * firm-scoped (tenant-facing) route.
 *
 * Spatie's permission package runs with `teams => false`, so roles live in one
 * global namespace and `Rule::exists('roles', 'name')` would happily accept
 * `super_admin` or another firm's private role. This rule applies the two
 * constraints the package cannot:
 *
 *   1. platform roles are never grantable from a firm-scoped route, and
 *   2. the role must be owned by the acting user's firm, or be a shared
 *      system role (firm_id IS NULL).
 */
class AssignableRole implements ValidationRule
{
    /**
     * Roles carrying platform-wide authority. These may only be granted from
     * the super-admin console, never from /admin.
     */
    public const PLATFORM_ROLES = ['super_admin'];

    public function __construct(private readonly ?User $actor) {}

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! is_string($value) || $value === '') {
            $fail('The selected role is invalid.');

            return;
        }

        if (in_array($value, self::PLATFORM_ROLES, true)) {
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
