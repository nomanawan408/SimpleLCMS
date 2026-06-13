<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreUserRequest;
use App\Http\Requests\Admin\UpdateUserRequest;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
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
            ->with('roles:id,name')
            ->orderBy('full_name')
            ->get(['id', 'full_name', 'email', 'role', 'is_active', 'totp_enabled', 'last_login_at', 'avatar_url', 'created_at']);

        // Get available roles for the firm (firm-specific + global)
        $roles = Role::where(function ($q) use ($firmId) {
                $q->where('firm_id', $firmId)->orWhereNull('firm_id');
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
                'is_active'     => $user->is_active,
                'totp_enabled'  => $user->totp_enabled,
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

        if (User::where('firm_id', $firmId)->where('email', $validated['email'])->exists()) {
            return back()->withErrors(['email' => 'A user with this email already exists in your firm.']);
        }

        $roleName = $validated['role'];

        $user = User::create([
            ...$validated,
            'firm_id'  => $firmId,
            'password' => $validated['password'],
        ]);

        $user->assignRole($roleName);

        activity()->causedBy($request->user())->performedOn($user)->log('user_created');

        return redirect()->route('admin.users.index')->with('success', "User {$user->full_name} has been created.");
    }

    public function update(UpdateUserRequest $request, User $user): RedirectResponse
    {
        $this->authorize('update', $user);

        $validated = $request->validated();

        // If role is being changed, sync Spatie role
        if (isset($validated['role'])) {
            $user->syncRoles([$validated['role']]);
        }

        $user->update($validated);

        activity()->causedBy($request->user())->performedOn($user)->log('user_updated');

        return back()->with('success', 'User updated.');
    }
}
