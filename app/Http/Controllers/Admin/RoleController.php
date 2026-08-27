<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class RoleController extends Controller
{
    private const BUILT_IN_ROLES = ['super_admin', 'firm_admin'];

    public function index(Request $request): Response
    {
        $this->authorize('viewAny', \App\Models\User::class);

        $firmId = $request->user()->firm_id;

        $roles = Role::where(function ($q) use ($firmId) {
                $q->where('firm_id', $firmId)->orWhereNull('firm_id');
            })
            ->withCount('permissions')
            ->withCount('users')
            ->orderByDesc('is_system')
            ->orderBy('name')
            ->get(['id', 'name', 'guard_name', 'description', 'is_system', 'firm_id', 'permissions_count', 'users_count']);

        // Group permissions by entity for the UI
        $permissions = Permission::where('guard_name', 'web')
            ->orderBy('name')
            ->get(['id', 'name'])
            ->groupBy(function ($p) {
                // Extract entity from permission name (e.g., "view_matters" → "matters")
                $parts = explode('_', $p->name, 2);
                return $parts[1] ?? 'other';
            })
            ->map(fn ($perms) => $perms->map(fn ($p) => ['id' => $p->id, 'name' => $p->name])->values()->toArray())
            ->toArray();

        // Load permissions for each role
        $rolesWithPerms = $roles->map(function ($role) {
            $role->load('permissions:id,name');
            return [
                'id'                 => $role->id,
                'name'               => $role->name,
                'description'        => $role->description,
                'is_system'          => $role->is_system,
                'is_builtin'         => in_array($role->name, self::BUILT_IN_ROLES),
                'firm_id'            => $role->firm_id,
                'permissions_count'  => $role->permissions_count,
                'users_count'        => $role->users_count,
                'permissions'        => $role->permissions->pluck('name')->toArray(),
            ];
        });

        return Inertia::render('Admin/Roles/Index', [
            'roles'                => $rolesWithPerms,
            'groupedPermissions'   => $permissions,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $this->authorize('create', \App\Models\User::class);

        $validated = $request->validate([
            'name'        => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:500'],
            'permissions' => ['required', 'array'],
            'permissions.*' => ['string', 'exists:permissions,name'],
        ]);

        $this->assertGrantable($request->user(), $validated['permissions']);

        $firmId = $request->user()->firm_id;

        // Check for duplicate name within firm scope
        $exists = Role::where('name', $validated['name'])
            ->where('guard_name', 'web')
            ->where(function ($q) use ($firmId) {
                $q->where('firm_id', $firmId)->orWhereNull('firm_id');
            })
            ->exists();

        if ($exists) {
            return back()->withErrors(['name' => 'A role with this name already exists.']);
        }

        DB::transaction(function () use ($validated, $firmId) {
            $role = Role::create([
                'name'        => $validated['name'],
                'guard_name'  => 'web',
                'description' => $validated['description'] ?? null,
                'firm_id'     => $firmId,
                'is_system'   => false,
            ]);

            $role->syncPermissions($validated['permissions']);
        });

        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        activity()->causedBy($request->user())->log('role_created');

        return redirect()->route('admin.roles.index')->with('success', "Role '{$validated['name']}' created.");
    }

    public function update(Request $request, Role $role): RedirectResponse
    {
        $this->authorize('editAny', \App\Models\User::class);

        // Prevent editing built-in roles
        if (in_array($role->name, self::BUILT_IN_ROLES)) {
            return back()->withErrors(['name' => 'Built-in roles cannot be edited.']);
        }

        // A firm may only edit roles it owns. Shared system roles (firm_id IS
        // NULL) are platform-wide -- editing one would change permissions for
        // every other firm on the platform.
        $firmId = $request->user()->firm_id;
        abort_unless($role->firm_id !== null && $role->firm_id === $firmId, 403);

        $validated = $request->validate([
            'name'        => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:500'],
            'permissions' => ['required', 'array'],
            'permissions.*' => ['string', 'exists:permissions,name'],
        ]);

        $this->assertGrantable($request->user(), $validated['permissions']);

        DB::transaction(function () use ($role, $validated) {
            $role->update([
                'name'        => $validated['name'],
                'description' => $validated['description'] ?? null,
            ]);

            $role->syncPermissions($validated['permissions']);
        });

        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        activity()->causedBy($request->user())->log('role_updated');

        return back()->with('success', "Role '{$role->name}' updated.");
    }

    public function destroy(Request $request, Role $role): RedirectResponse
    {
        $this->authorize('deleteAny', \App\Models\User::class);

        // Prevent deleting built-in roles
        if (in_array($role->name, self::BUILT_IN_ROLES)) {
            return back()->withErrors(['name' => 'Built-in roles cannot be deleted.']);
        }

        // As in update(): shared system roles are platform-wide and are never
        // deletable from a firm-scoped route.
        $firmId = $request->user()->firm_id;
        abort_unless($role->firm_id !== null && $role->firm_id === $firmId, 403);

        $roleName = $role->name;

        DB::transaction(function () use ($role) {
            $role->users()->detach();
            $role->delete();
        });

        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        activity()->causedBy($request->user())->log('role_deleted');

        return redirect()->route('admin.roles.index')->with('success', "Role '{$roleName}' deleted.");
    }

    /**
     * A role may only carry permissions the granting user holds themselves.
     * Without this, any admin could mint a role with the full permission
     * catalogue and assign it onward.
     */
    private function assertGrantable(\App\Models\User $actor, array $permissions): void
    {
        $held = $actor->getAllPermissions()->pluck('name')->all();

        $escalating = array_values(array_diff($permissions, $held));

        abort_if($escalating !== [], 403, 'You cannot grant permissions you do not hold: '.implode(', ', $escalating));
    }
}
