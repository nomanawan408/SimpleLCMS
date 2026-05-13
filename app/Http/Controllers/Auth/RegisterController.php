<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\Firm;
use App\Models\User;
use Illuminate\Auth\Events\Registered;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;
use Inertia\Inertia;
use Inertia\Response;

class RegisterController extends Controller
{
    public function create(): Response
    {
        return Inertia::render('Auth/Register');
    }

    public function store(Request $request): RedirectResponse
    {
        $request->validate([
            'firm_name' => ['required', 'string', 'max:255'],
            'full_name' => ['required', 'string', 'max:255'],
            'email'     => ['required', 'string', 'email', 'max:255'],
            'password'  => ['required', 'confirmed', Password::min(12)],
        ]);

        $firm = Firm::create([
            'name'     => $request->firm_name,
            'slug'     => Str::slug($request->firm_name) . '-' . Str::random(6),
            'timezone' => 'Europe/Dublin',
        ]);

        $user = User::create([
            'firm_id'   => $firm->id,
            'full_name' => $request->full_name,
            'email'     => $request->email,
            'password'  => Hash::make($request->password),
            'role'      => 'firm_admin',
        ]);

        event(new Registered($user));

        Auth::login($user);

        activity()->causedBy($user)->log('registered');

        return redirect()->route('admin.firm.setup');
    }
}
