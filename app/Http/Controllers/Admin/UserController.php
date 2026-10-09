<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreUserRequest;
use App\Http\Requests\Admin\UpdateUserRequest;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rules\Password;
use Inertia\Inertia;
use Inertia\Response;
use Spatie\Permission\Models\Role;

class UserController extends Controller
{
    public function index(Request $request): Response
    {
        $this->authorize('viewAny', User::class);

        $firmId = $request->user()->firm_id;

        $users = User::where('firm_id', $firmId)
            ->with(['roles:id,name', 'permissions:id,name'])
            ->orderBy('full_name')
            ->get(['id', 'full_name', 'email', 'role', 'phone', 'rate_per_hour', 'is_active', 'totp_enabled', 'last_login_at', 'avatar_url', 'created_at']);

        // Get available roles for the firm (firm-specific + global)
        // Platform roles (super_admin) are never offered for assignment here.
        // The shared lawyer template is never offered: each firm assigns
        // its own lawyer row (provisioned at firm creation).
        $roles = Role::where(function ($q) use ($firmId) {
                $q->where('firm_id', $firmId)->orWhereNull('firm_id');
            })
            ->whereNotIn('name', \App\Rules\AssignableRole::PLATFORM_ROLES)
            ->where(function ($q) {
                $q->where('name', '!=', 'lawyer')->orWhereNotNull('firm_id');
            })
            ->orderByDesc('is_system')
            ->orderBy('name')
            ->get(['id', 'name', 'description', 'is_system']);

        return Inertia::render('Admin/Users/Index', [
            'users' => $users->map(fn ($user) => [
                'id'            => $user->id,
                'full_name'     => $user->full_name,
                'email'         => $user->email,
                'role'          => $user->role,
                'roles'         => $user->roles->pluck('name')->toArray(),
                'phone'         => $user->phone,
                'rate_per_hour' => $user->rate_per_hour,
                'is_active'         => $user->is_active,
                'can_view_finances' => $user->hasPermissionTo('view_finances'),
                'can_manage_finances' => $user->hasPermissionTo('manage_finances'),
                'totp_enabled'      => $user->totp_enabled,
                'last_login_at' => $user->last_login_at,
                'avatar_url'    => $user->avatar_url,
                'created_at'    => $user->created_at,
            ]),
            'availableRoles' => $roles,
        ]);
    }

    public function store(StoreUserRequest $request): RedirectResponse
    {
        $this->authorize('create', User::class);

        $validated = $request->validated();

        $firmId = $request->user()->firm_id;

        $roleName = $validated['role'];
        $financeFlags = [
            'can_view_finances' => $validated['can_view_finances'] ?? false,
            'can_manage_finances' => $validated['can_manage_finances'] ?? false,
        ];
        unset($validated['can_view_finances'], $validated['can_manage_finances']);

        // Every authorization decision happens before the first write: a
        // refused grant must never leave a half-created user behind.
        $role = $this->resolveGrantableRole($request->user(), $roleName);
        $this->assertRoleAssignable($request->user(), $role);
        $this->assertFlaggable($request->user(), $financeFlags);

        $user = \Illuminate\Support\Facades\DB::transaction(function () use ($validated, $firmId, $role, $financeFlags) {
            $user = User::create([
                ...$validated,
                'firm_id'  => $firmId,
                'password' => $validated['password'],
                // The administrator entered this address and set the password, so
                // the account starts verified rather than emailing the new user.
                'email_verified_at' => now(),
            ]);

            // Resolve by ID, never by bare name: two firms may both own a role
            // called e.g. "paralegal", and name-based attach would cross the
            // firm boundary. Validation already passed; this re-checks ownership.
            $user->assignRole($role);
            $this->syncFinancialFlags($user, $financeFlags);

            return $user;
        });

        activity()->causedBy($request->user())->performedOn($user)->log('user_created');

        return redirect()->route('admin.users.index')->with('success', "User {$user->full_name} has been created.");
    }

    public function update(UpdateUserRequest $request, User $user): RedirectResponse
    {
        $this->authorize('update', $user);
        $this->ensureManageableTarget($request->user(), $user);

        $validated = $request->validated();

        if (isset($validated['role'])) {
            $role = $this->resolveGrantableRole($request->user(), $validated['role']);
            $this->assertRoleAssignable($request->user(), $role, $user);
            $user->syncRoles([$role]);
            $user->role = $role->name;
            unset($validated['role']);
        }

        // Deactivation switches an account off: as destructive as deletion,
        // it needs the delete verb, not just edit.
        if (array_key_exists('is_active', $validated)
            && (bool) $validated['is_active'] !== (bool) $user->is_active) {
            abort_unless(
                $request->user()->isFirmAdmin()
                    || $request->user()->hasPermissionTo('delete_users')
                    || $request->user()->hasPermissionTo('manage_users'),
                403
            );
        }
        unset($validated['can_view_finances'], $validated['can_manage_finances']);

        $this->assertFlaggable($request->user(), $request->validated());

        // Non-admins can never change their own access: no self-promotion to
        // another role, no self-granted finance flags. Admins are exempt.
        if (! $request->user()->isFirmAdmin() && $user->id === $request->user()->id) {
            $flags = $request->validated();
            $flagChange = (array_key_exists('can_view_finances', $flags)
                    && (bool) $flags['can_view_finances'] !== $user->canViewFinances())
                || (array_key_exists('can_manage_finances', $flags)
                    && (bool) $flags['can_manage_finances'] !== $user->canManageFinances());
            abort_if($flagChange, 403, 'You cannot change your own financial access.');
        }

        $user->fill($validated);
        $user->save();

        $this->syncFinancialFlags($user, $request->validated());

        activity()->causedBy($request->user())->performedOn($user)->log('user_updated');

        return back()->with('success', 'User updated.');
    }

    /**
     * Resolve a grantable role row for this firm. The firm's own row wins
     * over a shared same-named row; anything else (another firm's role,
     * platform roles) fails closed. Mirrors AssignableRole's validation so
     * the validated name can never resolve to a different row than checked.
     */
    private function resolveGrantableRole(User $actor, string $name): Role
    {
        $role = Role::where('name', $name)
            ->where('guard_name', 'web')
            ->where(fn ($q) => $q
                ->where('firm_id', $actor->firm_id)
                ->orWhereNull('firm_id'))
            ->orderByRaw('firm_id IS NULL')
            ->first();

        abort_unless($role, 403);
        abort_unless(
            in_array($name, \App\Rules\AssignableRole::GRANTABLE_ROLES, true)
                || $role->firm_id === $actor->firm_id,
            403
        );

        return $role;
    }

    /**
     * Delegated user-managers must never touch platform/firm admins:
     * password resets and deactivation on those accounts stay firm_admin
     * only. firm_admin actors bypass (they own the firm).
     */
    private function ensureManageableTarget(User $actor, User $target): void
    {
        if ($actor->isFirmAdmin()) {
            return;
        }
        abort_if(
            $target->hasRole('super_admin') || $target->hasRole('firm_admin'),
            403
        );
    }

    /**
     * A non-admin may only assign roles that cannot escalate past them:
     * never firm_admin/super_admin, and never a role change on themselves
     * (no self-promotion). Ordinary assignments stay open so delegated
     * user management actually works.
     */
    private function assertRoleAssignable(User $actor, Role $role, ?User $target = null): void
    {
        if ($actor->isFirmAdmin()) {
            return;
        }
        abort_if(
            in_array($role->name, ['firm_admin', 'super_admin'], true),
            403,
            'Only a firm admin can grant this role.'
        );
        if ($target && $target->id === $actor->id
            && ! in_array($role->name, $target->roles->pluck('name')->all(), true)) {
            abort(403, 'You cannot change your own role.');
        }
    }

    /**
     * Financial access is granted per user (never by role): firm admins flip
     * these two flags on the user record. Only present keys are touched so
     * partial updates never wipe the other flag.
     */
    /**
     * Pre-check run before any write: non-admins may only switch on flags
     * they hold themselves (switching off is always safe). Otherwise user
     * management becomes a backdoor into money powers -- and the refusal
     * must happen before the user row exists, not after.
     */
    private function assertFlaggable(User $actor, array $validated): void
    {
        foreach (['can_view_finances' => 'view_finances', 'can_manage_finances' => 'manage_finances'] as $input => $permission) {
            if (! empty($validated[$input]) && ! $actor->isFirmAdmin()
                && ! $actor->hasPermissionTo($permission)) {
                abort(403, 'You cannot grant financial access you do not hold.');
            }
        }
    }

    private function syncFinancialFlags(User $user, array $validated): void
    {
        $changed = false;
        foreach (['can_view_finances' => 'view_finances', 'can_manage_finances' => 'manage_finances'] as $input => $permission) {
            if (! array_key_exists($input, $validated)) {
                continue;
            }
            if ($validated[$input]) {
                $user->givePermissionTo($permission);
            } else {
                $user->revokePermissionTo($permission);
            }
            $changed = true;
        }
        // User-level grants do not flush Spatie's cache (only Role writes
        // do), so long-lived processes would keep serving the old access.
        if ($changed) {
            app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();
        }
    }

    public function destroy(Request $request, User $user): RedirectResponse
    {
        $this->authorize('delete', $user);
        $this->ensureManageableTarget($request->user(), $user);

        $user->syncRoles([]);
        $user->delete();

        activity()->causedBy($request->user())->performedOn($user)->log('user_deleted');

        return back()->with('success', "User {$user->full_name} has been removed.");
    }

    public function resetPassword(Request $request, User $user): RedirectResponse
    {
        $this->authorize('update', $user);
        $this->ensureManageableTarget($request->user(), $user);

        $validated = $request->validate([
            'password' => ['required', 'confirmed', Password::min(12)],
        ]);

        $user->password = $validated['password'];
        $user->save();

        activity()->causedBy($request->user())->performedOn($user)->log('password_reset');

        return back()->with('success', "Password reset for {$user->full_name}.");
    }

    /**
     * Admin-assisted 2FA recovery: device lost AND recovery codes gone. The
     * user re-enrols at next sign-in; until then the account is
     * password-only, so the reset itself is audit-logged with the actor.
     */
    public function resetTwoFactor(Request $request, User $user): RedirectResponse
    {
        $this->authorize('update', $user);
        $this->ensureManageableTarget($request->user(), $user);

        $actor = $request->user();

        // Clearing a second factor is a stealthy account takeover in the wrong
        // hands, so this stays stricter than user editing: firm admins only
        // (delegated user-managers keep every other power), never on yourself
        // (the disable flow with password + code exists for that), and never
        // on an admin account.
        abort_unless($actor->isFirmAdmin(), 403, 'Only a firm admin can reset two-factor authentication.');
        abort_if($user->id === $actor->id, 403, 'Use the 2FA settings to manage your own second factor.');
        abort_if(
            $user->hasRole('firm_admin') || $user->hasRole('super_admin'),
            403,
            'Admin accounts cannot have 2FA reset this way.'
        );

        $had2fa = (bool) $user->totp_enabled;

        $user->forceFill([
            'totp_enabled' => false,
            'totp_secret' => null,
            'totp_recovery_codes' => null,
            'totp_last_timestamp' => null,
            'totp_failed_count' => 0,
            'locked_until' => null,
        ])->save();

        activity()->causedBy($actor)->performedOn($user)
            ->withProperties(['ip' => $request->ip(), 'had_2fa' => $had2fa])
            ->log('totp_reset_by_admin');

        return back()->with('success', "2FA has been reset for {$user->full_name}. They will set it up again at next sign-in.");
    }
}
