<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Http\Controllers\Controller;
use App\Models\Firm;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

class UserController extends Controller
{
    public function index(Request $request): Response
    {
        abort_unless($request->user()->hasRole('super_admin'), 403);

        $query = User::with('firm')
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

    public function update(Request $request, User $user): RedirectResponse
    {
        abort_unless($request->user()->hasRole('super_admin'), 403);

        $validated = $request->validate([
            'full_name' => ['sometimes', 'string', 'max:255'],
            'email'     => ['sometimes', 'email', 'max:255'],
            'role'      => ['sometimes', 'string', 'max:50'],
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

        $newPassword = Str::random(12);
        $user->update(['password' => Hash::make($newPassword)]);

        activity()->causedBy($request->user())->performedOn($user)->log('password_reset_by_superadmin');

        return back()->with('success', "Password reset for '{$user->full_name}'. New password: {$newPassword}");
    }
}
