<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Http\Controllers\Controller;
use App\Models\Firm;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Password;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class UserController extends Controller
{
    /**
     * Roles the platform console may see and manage. Firm end-users
     * (solicitors, secretaries, …) are managed by their own firm admins —
     * listing them here would expose every firm's staff directory to
     * platform operators. Fellow super_admins stay visible so platform
     * ownership remains auditable.
     */
    private const MANAGEABLE_ROLES = ['firm_admin', 'super_admin'];

    public function index(Request $request): Response
    {
        abort_unless($request->user()->hasRole('super_admin'), 403);

        $query = User::role(self::MANAGEABLE_ROLES)
            ->with('firm')
            ->orderBy('created_at', 'desc');

        if ($request->filled('firm_id')) {
            $query->where('firm_id', $request->firm_id);
        }

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('full_name', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%");
            });
        }

        if ($request->filled('role')) {
            $query->where('role', $request->role);
        }

        $users = $query->paginate(25)->withQueryString();
        $firms = Firm::orderBy('name')->get(['id', 'name']);

        return Inertia::render('SuperAdmin/Users/Index', [
            'users'  => $users,
            'firms'  => $firms,
            'filters' => $request->only(['firm_id', 'search', 'role']),
        ]);
    }

    /**
     * Filtering the list alone would be theater — direct URLs must fail
     * closed too, without confirming the account exists.
     */
    private function ensureManageable(User $user): void
    {
        abort_unless($user->hasAnyRole(self::MANAGEABLE_ROLES), 404);
    }

    public function update(Request $request, User $user): RedirectResponse
    {
        abort_unless($request->user()->hasRole('super_admin'), 403);
        $this->ensureManageable($user);

        $validated = $request->validate([
            'full_name' => ['sometimes', 'string', 'max:255'],
            'email'     => ['sometimes', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
            'role'      => ['sometimes', 'string', Rule::exists('roles', 'name')->where('guard_name', 'web')],
            'is_active' => ['sometimes', 'boolean'],
            'firm_id'   => ['sometimes', 'nullable', 'string', 'exists:firms,id'],
        ]);

        $user->update($validated);

        if (isset($validated['role'])) {
            $user->syncRoles([$validated['role']]);
        }

        activity()->causedBy($request->user())->performedOn($user)->log('user_updated_by_superadmin');

        return back()->with('success', "User '{$user->full_name}' updated.");
    }

    public function destroy(Request $request, User $user): RedirectResponse
    {
        abort_unless($request->user()->hasRole('super_admin'), 403);
        $this->ensureManageable($user);

        if ($user->id === $request->user()->id) {
            return back()->with('error', 'You cannot delete your own account.');
        }

        $userName = $user->full_name;
        $user->delete();

        activity()->causedBy($request->user())->log('user_deleted_by_superadmin');

        return back()->with('success', "User '{$userName}' deleted.");
    }

    public function resetPassword(Request $request, User $user): RedirectResponse
    {
        abort_unless($request->user()->hasRole('super_admin'), 403);
        $this->ensureManageable($user);

        // Never mint a plaintext password and echo it back -- a flash message
        // travels through the session into the page payload and any log or APM
        // that captures response bodies. Send a signed, expiring link instead.
        $status = Password::sendResetLink(['email' => $user->email]);

        activity()->causedBy($request->user())->performedOn($user)->log('password_reset_link_sent_by_superadmin');

        if ($status !== Password::RESET_LINK_SENT) {
            return back()->with('error', "Could not send a reset link to {$user->email}.");
        }

        return back()->with('success', "A password reset link has been emailed to {$user->email}.");
    }
}
