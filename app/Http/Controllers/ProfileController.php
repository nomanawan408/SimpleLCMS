<?php

namespace App\Http\Controllers;

use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

class ProfileController extends Controller
{
    public function show(Request $request): Response
    {
        $user = $request->user();

        return Inertia::render('Profile/Show', [
            'profileUser' => [
                'id'         => $user->id,
                'full_name'  => $user->full_name,
                'email'      => $user->email,
                'avatar_url' => $user->avatar_url,
            ],
        ]);
    }

    public function updateAvatar(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'avatar' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:2048'],
        ]);

        $user = $request->user();

        $this->deleteStoredAvatar($user->avatar_url);

        $path = $validated['avatar']->store("avatars/{$user->id}", 'public');

        $user->forceFill(['avatar_url' => Storage::url($path)])->save();

        activity()->causedBy($user)->performedOn($user)->log('avatar_updated');

        return back()->with('success', 'Profile picture updated.');
    }

    public function destroyAvatar(Request $request): RedirectResponse
    {
        $user = $request->user();

        $this->deleteStoredAvatar($user->avatar_url);

        $user->forceFill(['avatar_url' => null])->save();

        activity()->causedBy($user)->performedOn($user)->log('avatar_removed');

        return back()->with('success', 'Profile picture removed.');
    }

    /**
     * Only delete files this feature created (public-disk /storage/ URLs).
     * External URLs (e.g. social login avatars) are left untouched.
     */
    private function deleteStoredAvatar(?string $avatarUrl): void
    {
        if (! $avatarUrl || ! str_starts_with($avatarUrl, '/storage/')) {
            return;
        }

        $path = substr($avatarUrl, strlen('/storage/'));

        if ($path && Storage::disk('public')->exists($path)) {
            Storage::disk('public')->delete($path);
        }
    }
}
