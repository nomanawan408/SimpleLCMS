import { useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bell, CheckCheck, FileText, Gavel, Receipt, SquareCheck } from 'lucide-react';
import { cn, formatDate, formatRelativeTime } from '@/lib/utils';
import type { PaginatedData } from '@/types';

interface NotificationRecord {
    id: string;
    data: { title: string; message: string; url: string; icon?: string };
    read_at: string | null;
    created_at: string;
}

interface Props {
    notifications: PaginatedData<NotificationRecord>;
}

const ICONS: Record<string, typeof Bell> = {
    task: SquareCheck,
    document: FileText,
    hearing: Gavel,
    invoice: Receipt,
};

function csrfToken(): string | undefined {
    return (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement | null)?.content;
}

export default function NotificationsIndex({ notifications }: Props) {
    const [items, setItems] = useState(notifications.data);

    const select = (notification: NotificationRecord) => {
        if (!notification.read_at) {
            setItems((prev) => prev.map((n) => (n.id === notification.id ? { ...n, read_at: new Date().toISOString() } : n)));
            fetch(`/notifications/${notification.id}/read`, {
                method: 'POST',
                headers: { Accept: 'application/json', 'X-CSRF-TOKEN': csrfToken() ?? '' },
            }).catch(() => {});
        }
        router.visit(notification.data.url);
    };

    const markAllRead = () => {
        setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
        fetch('/notifications/read-all', {
            method: 'POST',
            headers: { Accept: 'application/json', 'X-CSRF-TOKEN': csrfToken() ?? '' },
        }).catch(() => {});
    };

    const hasUnread = items.some((n) => !n.read_at);

    return (
        <AppLayout title="Notifications">
            <Head title="Notifications" />

            <div className="mb-6 flex items-center justify-between">
                <h1 className="text-2xl font-extrabold tracking-tight">Notifications</h1>
                {hasUnread && (
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={markAllRead}>
                        <CheckCheck className="h-4 w-4" />
                        Mark all read
                    </Button>
                )}
            </div>

            <Card className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">
                <CardHeader className="py-4 px-6 border-b border-border/60 bg-muted/[0.12]">
                    <CardTitle className="text-[14px] font-bold tracking-tight flex items-center gap-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-foreground text-background">
                            <Bell className="h-3.5 w-3.5" />
                        </span>
                        All notifications
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {items.length === 0 ? (
                        <div className="px-6 py-14 text-center">
                            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-3">
                                <Bell className="h-6 w-6 text-muted-foreground/50" />
                            </div>
                            <p className="text-sm font-semibold text-foreground">No notifications yet</p>
                            <p className="text-xs text-muted-foreground mt-1">
                                Task assignments, approaching deadlines and hearings, and overdue invoices will show up here.
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y divide-border/40">
                            {items.map((notification) => {
                                const Icon = ICONS[notification.data.icon ?? ''] ?? Bell;
                                const unread = !notification.read_at;

                                return (
                                    <button
                                        key={notification.id}
                                        type="button"
                                        onClick={() => select(notification)}
                                        className={cn(
                                            'flex w-full items-start gap-3 px-6 py-4 text-left transition-colors hover:bg-muted/10',
                                            unread && 'bg-secondary/30',
                                        )}
                                    >
                                        <span className={cn(
                                            'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                                            unread ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground',
                                        )}>
                                            <Icon className="h-4 w-4" />
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className={cn('text-sm', unread ? 'font-semibold text-foreground' : 'font-medium text-muted-foreground')}>
                                                    {notification.data.title}
                                                </span>
                                                {unread && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
                                            </div>
                                            <p className="mt-0.5 text-sm text-muted-foreground">{notification.data.message}</p>
                                            <p className="mt-1 text-xs text-muted-foreground/70" title={formatDate(notification.created_at)}>
                                                {formatRelativeTime(notification.created_at)}
                                            </p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {notifications.last_page > 1 && (
                        <div className="flex items-center justify-between px-6 py-3 border-t border-border/60">
                            <p className="text-sm text-muted-foreground">
                                {notifications.from}–{notifications.to} of {notifications.total}
                            </p>
                            <div className="flex gap-2">
                                {notifications.links.map((link, i) => (
                                    link.url ? (
                                        <Link
                                            key={i}
                                            href={link.url}
                                            className={cn(
                                                'px-3 py-1.5 text-xs rounded border transition-colors',
                                                link.active
                                                    ? 'bg-primary text-primary-foreground border-primary'
                                                    : 'hover:bg-muted border-border',
                                            )}
                                            dangerouslySetInnerHTML={{ __html: link.label }}
                                        />
                                    ) : (
                                        <span
                                            key={i}
                                            className="px-3 py-1.5 text-xs rounded border border-border text-muted-foreground opacity-50"
                                            dangerouslySetInnerHTML={{ __html: link.label }}
                                        />
                                    )
                                ))}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </AppLayout>
    );
}
