import { Head, Link } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDate, MATTER_STATUS_LABELS } from '@/lib/utils';
import { Clock, Briefcase, Receipt, Wallet, AlertTriangle, CheckSquare, TrendingUp, Plus, CircleDollarSign, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import type { Matter, Task } from '@/types';

interface Stats {
    hours_today: number;
    hours_week: number;
    hours_month: number;
    hours_billed: number;
    total_invoiced: number;
    outstanding_invoices: number;
    total_received: number;
    pending_amount: number;
    trust_balance: number;
    open_matters: number;
    overdue_tasks: number;
}

interface Props {
    stats: Stats;
    recentMatters: Matter[];
    upcomingTasks: Task[];
}

interface KpiCard {
    label: string;
    value: string;
    href: string | null;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    bg: string;
}

const kpiCards = (stats: Stats): KpiCard[] => [
    { label: 'Hours Today',           value: `${stats.hours_today}h`,           href: '/time',           icon: Clock,              color: 'text-primary',  bg: 'bg-primary/15' },
    { label: 'Hours This Week',       value: `${stats.hours_week}h`,            href: '/time',           icon: TrendingUp,         color: 'text-accent',   bg: 'bg-accent/15' },
    { label: 'Hours Month',           value: `${stats.hours_month}h`,           href: '/time',           icon: Clock,              color: 'text-primary',  bg: 'bg-primary/15' },
    { label: 'Hours Billed',          value: `${stats.hours_billed}h`,          href: '/time',           icon: TrendingUp,         color: 'text-accent',   bg: 'bg-accent/15' },
    { label: 'Open Matters',          value: String(stats.open_matters),        href: '/matters',        icon: Briefcase,          color: 'text-info',     bg: 'bg-info/15' },
    { label: 'Total Invoiced',        value: formatCurrency(stats.total_invoiced), href: '/billing',     icon: Receipt,            color: 'text-muted-foreground', bg: 'bg-muted/50' },
    { label: 'Outstanding',           value: formatCurrency(stats.outstanding_invoices), href: '/billing', icon: Receipt,     color: 'text-warning',  bg: 'bg-warning/15' },
    { label: 'Total Received',        value: formatCurrency(stats.total_received), href: '/transactions', icon: ArrowDownLeft,    color: 'text-success',  bg: 'bg-success/15' },
    { label: 'Pending Amount',        value: formatCurrency(stats.pending_amount), href: '/billing',     icon: ArrowUpRight,      color: stats.pending_amount > 0 ? 'text-destructive' : 'text-muted-foreground', bg: stats.pending_amount > 0 ? 'bg-destructive/15' : 'bg-muted' },
    { label: 'Trust Balance',         value: formatCurrency(stats.trust_balance), href: '/accounts',    icon: Wallet,            color: 'text-success',  bg: 'bg-success/15' },
    { label: 'Overdue Tasks',         value: String(stats.overdue_tasks),       href: '/tasks',         icon: AlertTriangle,      color: stats.overdue_tasks > 0 ? 'text-destructive' : 'text-muted-foreground', bg: stats.overdue_tasks > 0 ? 'bg-destructive/15' : 'bg-muted' },
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

function KpiCard({ kpi }: { kpi: KpiCard }) {
    const content = (
        <CardContent className="p-4">
            <div className="flex items-start justify-between">
                <div className="min-w-0">
                    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-[0.05em] truncate">{kpi.label}</p>
                    <p className={`mt-1 text-xl font-bold ${kpi.color}`}>{kpi.value}</p>
                </div>
                <div className={`${kpi.bg} p-2 rounded-md shrink-0 ml-2`}>
                    <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                </div>
            </div>
        </CardContent>
    );

    if (!kpi.href) {
        return <Card className="surface-card">{content}</Card>;
    }

    return (
        <Link href={kpi.href} className="block rounded-lg hover:shadow-md transition-shadow border border-transparent hover:border-border/50">
            <Card className="surface-card">
                {content}
            </Card>
        </Link>
    );
}

export default function Dashboard({ stats, recentMatters, upcomingTasks }: Props) {
    return (
        <AppLayout title="Dashboard">
            <Head title="Dashboard" />

            {/* KPI Grid */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 mb-6">
                {kpiCards(stats).map((kpi) => (
                    <KpiCard key={kpi.label} kpi={kpi} />
                ))}
            </div>

            {/* Payment Summary Strip */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 mb-6">
                <Link href="/transactions" className="block">
                    <Card className="surface-card border-l-4 border-l-success">
                        <CardContent className="p-4 flex items-center gap-3">
                            <div className="bg-success/15 p-2.5 rounded-xl">
                                <ArrowDownLeft className="h-5 w-5 text-success" />
                            </div>
                            <div>
                                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Total Received</p>
                                <p className="text-lg font-bold text-success tabular-nums">{formatCurrency(stats.total_received)}</p>
                            </div>
                        </CardContent>
                    </Card>
                </Link>
                <Link href="/billing" className="block">
                    <Card className="surface-card border-l-4 border-l-warning">
                        <CardContent className="p-4 flex items-center gap-3">
                            <div className="bg-warning/15 p-2.5 rounded-xl">
                                <Receipt className="h-5 w-5 text-warning" />
                            </div>
                            <div>
                                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Outstanding Invoices</p>
                                <p className="text-lg font-bold text-warning tabular-nums">{formatCurrency(stats.outstanding_invoices)}</p>
                            </div>
                        </CardContent>
                    </Card>
                </Link>
                <Link href="/billing" className="block">
                    <Card className="surface-card border-l-4 border-l-destructive">
                        <CardContent className="p-4 flex items-center gap-3">
                            <div className="bg-destructive/15 p-2.5 rounded-xl">
                                <ArrowUpRight className="h-5 w-5 text-destructive" />
                            </div>
                            <div>
                                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Pending Payment</p>
                                <p className={`text-lg font-bold tabular-nums ${stats.pending_amount > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>{formatCurrency(stats.pending_amount)}</p>
                            </div>
                        </CardContent>
                    </Card>
                </Link>
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
                                                {task.due_date
                                                    ? `Due ${formatDate(task.due_date)}`
                                                    : 'No due date'}
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
