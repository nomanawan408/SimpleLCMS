import { useEffect, useRef, useState } from 'react';
import { Link, router, usePage } from '@inertiajs/react';
import { Bell, CheckCheck, FileText, Gavel, Receipt, SquareCheck } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { cn, formatRelativeTime } from '@/lib/utils';
import type { PageProps } from '@/types';

interface NotificationData {
    title: string;
    message: string;
    url: string;
    icon?: string;
}

interface NotificationRecord {
    id: string;
    data: NotificationData;
    read_at: string | null;
    created_at: string;
}

const ICONS: Record<string, typeof Bell> = {
    task: SquareCheck,
    document: FileText,
    hearing: Gavel,
    invoice: Receipt,
};

// How often the panel re-checks for anything new while the user is sitting
// on a page. This app has no real-time transport configured (no WebSocket
// server actually running), so polling is the honest choice rather than
// pretending to be live.
const POLL_INTERVAL_MS = 45_000;

function csrfToken(): string | undefined {
    return (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement | null)?.content;
}

/**
 * The header's bell: an anchored dropdown (Popover, not a full-screen
 * dialog like global search) showing recent notifications with an unread
 * badge. The badge count starts from the Inertia shared prop (free, already
 * correct on every page load) and is refreshed by polling /notifications/recent,
 * which also backs the list itself once the panel is opened.
 */
export function NotificationBell() {
    const { unreadNotificationsCount } = usePage<PageProps>().props;

    const [open, setOpen] = useState(false);
    const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
    const [unreadCount, setUnreadCount] = useState(unreadNotificationsCount);
    const [loaded, setLoaded] = useState(false);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // The shared prop refreshes on every Inertia navigation; keep the local
    // count in step with it rather than only trusting the poll.
    useEffect(() => {
        setUnreadCount(unreadNotificationsCount);
    }, [unreadNotificationsCount]);

    const refresh = () => {
        fetch('/notifications/recent', { headers: { Accept: 'application/json' } })
            .then((res) => res.json())
            .then((data) => {
                setNotifications(data.notifications ?? []);
                setUnreadCount(data.unread_count ?? 0);
                setLoaded(true);
            })
            .catch(() => {});
    };

    useEffect(() => {
        refresh();
        pollRef.current = setInterval(refresh, POLL_INTERVAL_MS);
        return () => {
            if (pollRef.current) clearInterval(pollRef.current);
        };
    }, []);

    // Also refresh right as the panel opens, so it never shows something
    // stale from up to POLL_INTERVAL_MS ago at the moment someone checks it.
    useEffect(() => {
        if (open) refresh();
    }, [open]);

    const markRead = (id: string) => {
        setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)));
        setUnreadCount((prev) => Math.max(0, prev - 1));

        fetch(`/notifications/${id}/read`, {
            method: 'POST',
            headers: { Accept: 'application/json', 'X-CSRF-TOKEN': csrfToken() ?? '' },
        }).catch(() => {});
    };

    const select = (notification: NotificationRecord) => {
        if (!notification.read_at) markRead(notification.id);
        setOpen(false);
        router.visit(notification.data.url);
    };

    const markAllRead = () => {
        setNotifications((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
        setUnreadCount(0);

        fetch('/notifications/read-all', {
            method: 'POST',
            headers: { Accept: 'application/json', 'X-CSRF-TOKEN': csrfToken() ?? '' },
        }).catch(() => {});
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9 relative text-muted-foreground">
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[0.65rem] font-bold leading-none text-destructive-foreground">
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-0">
                <div className="flex items-center justify-between border-b px-3 py-2.5">
                    <span className="text-sm font-semibold">Notifications</span>
                    {unreadCount > 0 && (
                        <button
                            type="button"
                            onClick={markAllRead}
                            className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                        >
                            <CheckCheck className="h-3.5 w-3.5" />
                            Mark all read
                        </button>
                    )}
                </div>

                <div className="max-h-96 overflow-y-auto">
                    {!loaded ? (
                        <p className="px-3 py-8 text-center text-sm text-muted-foreground">Loading…</p>
                    ) : notifications.length === 0 ? (
                        <div className="px-3 py-8 text-center">
                            <Bell className="mx-auto mb-2 h-6 w-6 text-muted-foreground/40" />
                            <p className="text-sm text-muted-foreground">You&apos;re all caught up.</p>
                        </div>
                    ) : (
                        <ul>
                            {notifications.map((notification) => {
                                const Icon = ICONS[notification.data.icon ?? ''] ?? Bell;
                                const unread = !notification.read_at;

                                return (
                                    <li key={notification.id}>
                                        <button
                                            type="button"
                                            onClick={() => select(notification)}
                                            className={cn(
                                                'flex w-full items-start gap-2.5 border-b border-border/60 px-3 py-2.5 text-left last:border-0 hover:bg-muted/50',
                                                unread && 'bg-secondary/40',
                                            )}
                                        >
                                            <span className={cn(
                                                'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
                                                unread ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground',
                                            )}>
                                                <Icon className="h-3.5 w-3.5" />
                                            </span>
                                            <span className="min-w-0 flex-1">
                                                <span className="flex items-center gap-1.5">
                                                    <span className={cn('truncate text-sm', unread ? 'font-semibold text-foreground' : 'font-medium text-muted-foreground')}>
                                                        {notification.data.title}
                                                    </span>
                                                    {unread && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
                                                </span>
                                                <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                                                    {notification.data.message}
                                                </span>
                                                <span className="mt-0.5 block text-[0.7rem] text-muted-foreground/70">
                                                    {formatRelativeTime(notification.created_at)}
                                                </span>
                                            </span>
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>

                <Link
                    href="/notifications"
                    onClick={() => setOpen(false)}
                    className="block border-t px-3 py-2.5 text-center text-xs font-medium text-primary hover:underline"
                >
                    View all notifications
                </Link>
            </PopoverContent>
        </Popover>
    );
}
