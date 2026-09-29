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
        $user->assignRole($this->resolveGrantableRole($request->user(), $roleName));
        $this->syncFinancialFlags($user, $financeFlags);

        activity()->causedBy($request->user())->performedOn($user)->log('user_created');

        return redirect()->route('admin.users.index')->with('success', "User {$user->full_name} has been created.");
    }

    public function update(UpdateUserRequest $request, User $user): RedirectResponse
    {
        $this->authorize('update', $user);

        $validated = $request->validated();

        if (isset($validated['role'])) {
            $role = $this->resolveGrantableRole($request->user(), $validated['role']);
            $user->syncRoles([$role]);
            $user->role = $role->name;
            unset($validated['role']);
        }
        unset($validated['can_view_finances'], $validated['can_manage_finances']);

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
     * Financial access is granted per user (never by role): firm admins flip
     * these two flags on the user record. Only present keys are touched so
     * partial updates never wipe the other flag.
     */
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

        $user->syncRoles([]);
        $user->delete();

        activity()->causedBy($request->user())->performedOn($user)->log('user_deleted');

        return back()->with('success', "User {$user->full_name} has been removed.");
    }

    public function resetPassword(Request $request, User $user): RedirectResponse
    {
        $this->authorize('update', $user);

        $validated = $request->validate([
            'password' => ['required', 'confirmed', Password::min(12)],
        ]);

        $user->password = $validated['password'];
        $user->save();

        activity()->causedBy($request->user())->performedOn($user)->log('password_reset');

        return back()->with('success', "Password reset for {$user->full_name}.");
    }
}
