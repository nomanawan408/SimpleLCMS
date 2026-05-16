import { Head, Link } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDate, cn } from '@/lib/utils';
import type { PaginatedData } from '@/types';

interface ActivityItem {
    id: string;
    causer: { full_name: string } | null;
    log_name: string;
    description: string;
    subject_type: string | null;
    subject_id: string | null;
    created_at: string;
    properties: any;
}

interface Props {
    activities: PaginatedData<ActivityItem>;
}

function subjectLabel(type: string | null): string {
    if (!type) return '—';
    const parts = type.split('\\');
    return parts[parts.length - 1];
}

const ACTION_COLORS: Record<string, 'success' | 'destructive' | 'default' | 'secondary'> = {
    created: 'success',
    deleted: 'destructive',
    updated: 'default',
    uploaded: 'default',
};

export default function ActivitiesIndex({ activities }: Props) {
    return (
        <AppLayout title="Activity Log">
            <Head title="Activity Log" />

            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold tracking-tight">Activity Log</h1>
            </div>

            <Card>
                <CardContent className="p-0">
                    {activities.data.length === 0 ? (
                        <p className="px-6 py-10 text-center text-sm text-muted-foreground">No activity recorded yet.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b bg-muted/30 text-muted-foreground">
                                        <th className="text-left px-4 py-3 font-medium">Date / Time</th>
                                        <th className="text-left px-4 py-3 font-medium">User</th>
                                        <th className="text-left px-4 py-3 font-medium">Action</th>
                                        <th className="text-left px-4 py-3 font-medium">Subject</th>
                                        <th className="text-left px-4 py-3 font-medium">Details</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/60">
                                    {activities.data.map((item) => (
                                        <tr key={item.id} className="hover:bg-muted/30">
                                            <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                                                {formatDate(item.created_at, {
                                                    day: '2-digit',
                                                    month: 'short',
                                                    year: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                })}
                                            </td>
                                            <td className="px-4 py-3 font-medium">
                                                {item.causer?.full_name ?? 'System'}
                                            </td>
                                            <td className="px-4 py-3">
                                                <Badge
                                                    variant={ACTION_COLORS[item.description] ?? 'secondary'}
                                                    className="text-xs capitalize"
                                                >
                                                    {item.description}
                                                </Badge>
                                            </td>
                                            <td className="px-4 py-3 text-muted-foreground">
                                                {subjectLabel(item.subject_type)}
                                                {item.subject_id && (
                                                    <span className="text-xs opacity-60 ml-1">#{item.subject_id.slice(0, 8)}</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-muted-foreground text-xs max-w-xs truncate">
                                                {item.log_name !== 'default' && (
                                                    <span className="mr-2 font-medium text-foreground">[{item.log_name}]</span>
                                                )}
                                                {item.properties && typeof item.properties === 'object' && Object.keys(item.properties).length > 0
                                                    ? JSON.stringify(item.properties).slice(0, 120)
                                                    : '—'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {activities.last_page > 1 && (
                        <div className="flex items-center justify-between px-4 py-3 border-t">
                            <p className="text-sm text-muted-foreground">
                                {activities.from}–{activities.to} of {activities.total}
                            </p>
                            <div className="flex gap-2">
                                {activities.links.map((link, i) => (
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
