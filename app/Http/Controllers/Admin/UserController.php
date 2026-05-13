<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreUserRequest;
use App\Http\Requests\Admin\UpdateUserRequest;
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
        $this->authorize('viewAny', User::class);

        $users = User::where('firm_id', $request->user()->firm_id)
            ->orderBy('full_name')
            ->paginate(20);

        return Inertia::render('Admin/Users/Index', [
            'users' => $users,
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

        $tempPassword = Str::password(16);

        $user = User::create([
            ...$validated,
            'firm_id'  => $firmId,
            'password' => Hash::make($tempPassword),
        ]);

        activity()->causedBy($request->user())->performedOn($user)->log('user_invited');

        return redirect()->route('admin.users.index')->with('success', "User {$user->full_name} has been invited.");
    }

    public function update(UpdateUserRequest $request, User $user): RedirectResponse
    {
        $this->authorize('update', $user);

        $user->update($request->validated());

        activity()->causedBy($request->user())->performedOn($user)->log('user_updated');

        return back()->with('success', 'User updated.');
    }
}
