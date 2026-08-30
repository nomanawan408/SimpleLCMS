<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Every method here reaches a notification through $request->user()->notifications(),
 * a MorphMany relation scoped to notifiable_id = the authenticated user. That is
 * what makes it impossible to read or mark another user's notification: a
 * mismatched id 404s rather than needing a separate ownership check that
 * could be forgotten.
 */
class NotificationController extends Controller
{
    private const RECENT_LIMIT = 8;

    /** The full history, for the "View all" page. */
    public function index(Request $request): Response
    {
        $notifications = $request->user()->notifications()
            ->orderByDesc('created_at')
            ->paginate(25);

        return Inertia::render('Notifications/Index', [
            'notifications' => $notifications,
        ]);
    }

    /** Backs the bell dropdown: a short recent list plus the unread count, polled from the client. */
    public function recent(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json([
            'notifications' => $user->notifications()
                ->orderByDesc('created_at')
                ->limit(self::RECENT_LIMIT)
                ->get(),
            'unread_count' => $user->unreadNotifications()->count(),
        ]);
    }

    public function markRead(Request $request, string $notification): RedirectResponse|JsonResponse
    {
        $record = $request->user()->notifications()->findOrFail($notification);
        $record->markAsRead();

        if ($request->expectsJson()) {
            return response()->json(['unread_count' => $request->user()->unreadNotifications()->count()]);
        }

        return back();
    }

    public function markAllRead(Request $request): RedirectResponse|JsonResponse
    {
        $request->user()->unreadNotifications->markAsRead();

        if ($request->expectsJson()) {
            return response()->json(['unread_count' => 0]);
        }

        return back();
    }
}
