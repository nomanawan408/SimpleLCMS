import { Head, Link } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDate, MATTER_STATUS_LABELS } from '@/lib/utils';
import { Clock, Briefcase, Receipt, Wallet, AlertTriangle, CheckSquare, TrendingUp, Plus } from 'lucide-react';
import type { Matter, Task } from '@/types';

interface Stats {
    hours_today: number;
    hours_week: number;
    hours_month: number;
    hours_billed: number;
    outstanding_invoices: number;
    trust_balance: number;
    open_matters: number;
    overdue_tasks: number;
}

interface Props {
    stats: Stats;
    recentMatters: Matter[];
    upcomingTasks: Task[];
}

const kpiCards = (stats: Stats) => [
    { label: 'Hours Today',           value: `${stats.hours_today}h`,          icon: Clock,         color: 'text-primary',   bg: 'bg-primary/15' },
    { label: 'Hours This Week',        value: `${stats.hours_week}h`,           icon: TrendingUp,    color: 'text-accent',   bg: 'bg-accent/15' },
    { label: 'Open Matters',           value: stats.open_matters,               icon: Briefcase,     color: 'text-info',    bg: 'bg-info/15' },
    { label: 'Outstanding Invoices',   value: formatCurrency(stats.outstanding_invoices), icon: Receipt, color: 'text-warning', bg: 'bg-warning/15' },
    { label: 'Trust Balance',          value: formatCurrency(stats.trust_balance), icon: Wallet,     color: 'text-success',  bg: 'bg-success/15' },
    { label: 'Overdue Tasks',          value: stats.overdue_tasks,              icon: AlertTriangle, color: stats.overdue_tasks > 0 ? 'text-destructive' : 'text-muted-foreground', bg: stats.overdue_tasks > 0 ? 'bg-destructive/15' : 'bg-muted' },
];

const statusColors: Record<string, 'default' | 'success' | 'warning' | 'destructive' | 'secondary'> = {
    open: 'success',
    pending_court_date: 'warning',
    awaiting_client: 'info' as any,
    awaiting_opponent: 'info' as any,
    on_hold: 'secondary',
    closed: 'default',
    archived: 'secondary',
};

export default function Dashboard({ stats, recentMatters, upcomingTasks }: Props) {
    return (
        <AppLayout title="Dashboard">
            <Head title="Dashboard" />

            {/* KPI Grid */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6 mb-8">
                {kpiCards(stats).map((kpi) => (
                    <Card key={kpi.label} className="surface-card">
                        <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-[0.05em]">{kpi.label}</p>
                                    <p className={`mt-1 text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
                                </div>
                                <div className={`${kpi.bg} p-2 rounded-md`}>
                                    <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Recent Matters */}
                <Card className="surface-card">
                    <CardHeader className="flex flex-row items-center justify-between pb-3">
                        <CardTitle className="text-base tracking-tight">Recent Matters</CardTitle>
                        <Button asChild size="sm" variant="outline">
                            <Link href="/matters/create">
                                <Plus className="h-4 w-4 mr-1" />
                                New Matter
                            </Link>
                        </Button>
                    </CardHeader>
                    <CardContent className="p-0">
                        {recentMatters.length === 0 ? (
                            <div className="px-6 py-10 text-center text-sm text-muted-foreground">
                                No matters yet.{' '}
                                <Link href="/matters/create" className="text-primary hover:underline">
                                    Open your first matter →
                                </Link>
                            </div>
                        ) : (
                            <div className="divide-y divide-border/60">
                                {recentMatters.map((matter) => (
                                    <Link
                                        key={matter.id}
                                        href={`/matters/${matter.id}`}
                                        className="group flex items-center gap-3 px-6 py-3 hover:bg-muted/40 transition-colors"
                                    >
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{matter.name}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {matter.matter_number} · {matter.responsible_user?.full_name ?? 'Unassigned'}
                                            </p>
                                        </div>
                                        <Badge variant={statusColors[matter.status] ?? 'default'} className="shrink-0">
                                            {MATTER_STATUS_LABELS[matter.status]}
                                        </Badge>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Upcoming Tasks */}
                <Card className="surface-card">
                    <CardHeader className="flex flex-row items-center justify-between pb-3">
                        <CardTitle className="text-base tracking-tight">Upcoming Tasks</CardTitle>
                        <Button asChild size="sm" variant="outline">
                            <Link href="/tasks">
                                <CheckSquare className="h-4 w-4 mr-1" />
                                All Tasks
                            </Link>
                        </Button>
                    </CardHeader>
                    <CardContent className="p-0">
                        {upcomingTasks.length === 0 ? (
                            <div className="px-6 py-10 text-center text-sm text-muted-foreground">
                                No upcoming tasks.
                            </div>
                        ) : (
                            <div className="divide-y divide-border/60">
                                {upcomingTasks.map((task) => (
                                    <div key={task.id} className="flex items-center gap-3 px-6 py-3">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium truncate">{task.title}</p>
                                            <p className="text-xs text-muted-foreground">
                                                Due {formatDate(task.due_date)}
                                                {task.assignee && ` · ${task.assignee.full_name}`}
                                            </p>
                                        </div>
                                        <Badge
                                            variant={task.priority === 'high' ? 'destructive' : task.priority === 'medium' ? 'warning' : 'secondary'}
                                            className="shrink-0 capitalize"
                                        >
                                            {task.priority}
                                        </Badge>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}
