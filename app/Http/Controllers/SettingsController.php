<?php

namespace App\Http\Controllers;

use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Self-service settings. Every action is scoped to the authenticated user
 * (or their firm): there are no ID parameters, so one user can never touch
 * another user's profile, password, or preferences by design.
 */
class SettingsController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();
        $firm = $user->firm;
        $firmId = $user->firm_id;

        $canEditFirm = $firm ? $user->can('update', $firm) : false;
        // Same gate as the sidebar Admin section.
        $canManageTeam = ! $user->hasRole('super_admin')
            && ($user->hasRole('firm_admin') || $user->hasPermissionTo('manage_users'));

        // Team data mirrors Admin\UserController@index / Admin\RoleController@index
        // so the embedded managers show exactly what their standalone pages show.
        $team = [];
        if ($canManageTeam) {
            $users = \App\Models\User::where('firm_id', $firmId)
                ->with('roles:id,name')
                ->orderBy('full_name')
                ->get(['id', 'full_name', 'email', 'role', 'phone', 'rate_per_hour', 'is_active', 'totp_enabled', 'last_login_at', 'avatar_url', 'created_at']);

            $team['users'] = $users->map(fn ($u) => [
                'id' => $u->id, 'full_name' => $u->full_name, 'email' => $u->email,
                'role' => $u->role, 'roles' => $u->roles->pluck('name')->toArray(),
                'phone' => $u->phone, 'rate_per_hour' => $u->rate_per_hour,
                'is_active' => $u->is_active, 'totp_enabled' => $u->totp_enabled,
                'last_login_at' => $u->last_login_at, 'avatar_url' => $u->avatar_url,
                'created_at' => $u->created_at,
            ]);
            // Platform roles (super_admin) are never listed in a firm context.
            $team['availableRoles'] = \Spatie\Permission\Models\Role::where(function ($q) use ($firmId) {
                    $q->where('firm_id', $firmId)->orWhereNull('firm_id');
                })
                ->whereNotIn('name', \App\Rules\AssignableRole::PLATFORM_ROLES)
                ->orderByDesc('is_system')
                ->orderBy('name')
                ->get(['id', 'name', 'description', 'is_system']);

            $roles = \Spatie\Permission\Models\Role::where(function ($q) use ($firmId) {
                    $q->where('firm_id', $firmId)->orWhereNull('firm_id');
                })
                ->whereNotIn('name', \App\Rules\AssignableRole::PLATFORM_ROLES)
                ->withCount('permissions')
                ->withCount('users')
                ->orderByDesc('is_system')
                ->orderBy('name')
                ->get(['id', 'name', 'guard_name', 'description', 'is_system', 'firm_id', 'permissions_count', 'users_count']);

            $team['roles'] = $roles->map(function ($role) {
                $role->load('permissions:id,name');
                return [
                    'id' => $role->id, 'name' => $role->name, 'description' => $role->description,
                    'is_system' => $role->is_system,
                    'is_builtin' => in_array($role->name, \App\Http\Controllers\Admin\RoleController::BUILT_IN_ROLES),
                    'firm_id' => $role->firm_id, 'permissions_count' => $role->permissions_count,
                    'users_count' => $role->users_count,
                    'permissions' => $role->permissions->pluck('name')->toArray(),
                ];
            });
            $team['groupedPermissions'] = \Spatie\Permission\Models\Permission::where('guard_name', 'web')
                ->orderBy('name')
                ->get(['id', 'name'])
                ->groupBy(function ($p) {
                    $parts = explode('_', $p->name, 2);
                    return $parts[1] ?? 'other';
                })
                ->map(fn ($perms) => $perms->map(fn ($p) => ['id' => $p->id, 'name' => $p->name])->values()->toArray())
                ->toArray();
        }

        return Inertia::render('Settings/Index', [
            'preferences' => $user->preferences ?? ['theme' => 'light'],
            'canEditFirm' => $canEditFirm,
            'canManageTeam' => $canManageTeam,
            'firm' => $canEditFirm ? $firm : null,
            'isSuperAdmin' => $user->hasRole('super_admin'),
            ...$team,
        ]);
    }

    public function updateProfile(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'full_name' => ['required', 'string', 'max:255'],
            'phone'     => ['nullable', 'string', 'max:50'],
        ]);

        $request->user()->update($validated);

        activity()->causedBy($request->user())->log('profile_updated');

        return back()->with('success', 'Profile updated.');
    }

    public function updatePreferences(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'theme' => ['sometimes', 'in:light,dark,system'],
        ]);

        $user = $request->user();
        // Merge, never replace: keys this client doesn't know survive.
        $user->forceFill([
            'preferences' => array_merge($user->preferences ?? [], $validated),
        ])->save();

        return back()->with('success', 'Preferences saved.');
    }

    public function updatePassword(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'current_password' => ['required', 'current_password'],
            'password'         => ['required', 'confirmed', Password::min(12)],
        ]);

        $user = $request->user();
        $user->forceFill(['password' => Hash::make($validated['password'])])->save();

        activity()->causedBy($user)->log('password_changed');

        return back()->with('success', 'Password changed.');
    }

}
