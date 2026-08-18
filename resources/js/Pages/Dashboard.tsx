import { Head, Link } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDate, MATTER_STATUS_LABELS } from '@/lib/utils';
import {
    AlertTriangle, ArrowDownLeft, ArrowUpRight, Briefcase, CheckSquare,
    Clock, Plus, Receipt, TrendingUp, Wallet,
} from 'lucide-react';
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
    viewFinancial: boolean;
    recentMatters: Matter[];
    upcomingTasks: Task[];
}

interface KpiCard {
    label: string;
    value: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    tone: 'primary' | 'ink' | 'violet' | 'warning';
}

const statusColors: Record<string, 'default' | 'success' | 'warning' | 'destructive' | 'secondary'> = {
    open: 'success',
    pending_court_date: 'warning',
    awaiting_client: 'secondary',
    awaiting_opponent: 'secondary',
    on_hold: 'secondary',
    closed: 'default',
    archived: 'secondary',
};

function KpiCard({ kpi }: { kpi: KpiCard }) {
    const toneStyles = {
        primary: 'bg-[#FF4000] text-primary-foreground',
        ink: 'bg-[#242427] text-white',
        violet: 'bg-accent text-white',
        warning: 'bg-white text-foreground',
    }[kpi.tone];

    const iconStyles = {
        primary: 'bg-white text-[#FF4000]',
        ink: 'bg-white text-[#272727]',
        violet: 'bg-white text-accent',
        warning: 'bg-[#FF4000] text-white',
    }[kpi.tone];

    return (
        <Link href={kpi.href} className="group block">
            <Card className={`h-full rounded-[18px] border-0 shadow-none transition-transform group-hover:-translate-y-0.5 ${toneStyles}`}>
                <CardContent className="flex min-h-[124px] flex-col justify-between p-5">
                    <div className="flex items-start justify-between gap-3">
                        <p className={`text-xs font-semibold tracking-tight ${kpi.tone === 'warning' ? 'text-muted-foreground' : 'text-white'}`}>
                            {kpi.label}
                        </p>
                        <span className={`rounded-xl p-2 ${iconStyles}`}>
                            <kpi.icon className="h-4 w-4" />
                        </span>
                    </div>
                    <p className="text-[28px] font-semibold leading-none tracking-[-0.04em] tabular-nums">{kpi.value}</p>
                </CardContent>
            </Card>
        </Link>
    );
}

function SectionHeading({ title, href, action }: { title: string; href: string; action: string }) {
    return (
        <CardHeader className="flex flex-row items-center justify-between px-7 pb-4 pt-6">
            <CardTitle className="text-lg font-semibold tracking-tight">{title}</CardTitle>
            <Button asChild size="sm" variant="ghost" className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground">
                <Link href={href}>{action}</Link>
            </Button>
        </CardHeader>
    );
}

export default function Dashboard({ stats, viewFinancial, recentMatters, upcomingTasks }: Props) {
    const kpis: KpiCard[] = [
        { label: 'Hours Today', value: `${stats.hours_today}h`, href: '/time', icon: Clock, tone: 'primary' },
        { label: 'Open Matters', value: String(stats.open_matters), href: '/matters', icon: Briefcase, tone: 'primary' },
        { label: viewFinancial ? 'Outstanding Invoices' : 'Hours This Week', value: viewFinancial ? formatCurrency(stats.outstanding_invoices) : `${stats.hours_week}h`, href: viewFinancial ? '/billing' : '/time', icon: viewFinancial ? Receipt : TrendingUp, tone: 'ink' },
        { label: 'Overdue Tasks', value: String(stats.overdue_tasks), href: '/tasks', icon: AlertTriangle, tone: 'warning' },
    ];

    return (
        <AppLayout title="Dashboard">
            <Head title="Dashboard" />

            <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
                <div>
                    <p className="mb-1 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Workspace overview</p>
                    <h2 className="text-2xl font-semibold tracking-[-0.04em] text-foreground">Good morning</h2>
                </div>
                <Button asChild className="h-10 rounded-xl px-4 shadow-none">
                    <Link href="/matters/create"><Plus className="mr-2 h-4 w-4" />New matter</Link>
                </Button>
            </div>

            <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {kpis.map((kpi) => <KpiCard key={kpi.label} kpi={kpi} />)}
            </div>

            {viewFinancial && (
                <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-3">
                    <Link href="/transactions" className="group rounded-[18px] border-0 bg-card p-4 transition-colors hover:shadow-sm">
                        <div className="flex items-center gap-3">
                            <span className="rounded-xl bg-success/12 p-2.5 text-success"><ArrowDownLeft className="h-4 w-4" /></span>
                            <div><p className="text-xs text-muted-foreground">Total received</p><p className="mt-0.5 text-lg font-semibold tabular-nums">{formatCurrency(stats.total_received)}</p></div>
                        </div>
                    </Link>
                    <Link href="/billing" className="group rounded-[18px] border-0 bg-card p-4 transition-colors hover:shadow-sm">
                        <div className="flex items-center gap-3">
                            <span className="rounded-xl bg-warning/12 p-2.5 text-warning"><Receipt className="h-4 w-4" /></span>
                            <div><p className="text-xs text-muted-foreground">Pending invoices</p><p className="mt-0.5 text-lg font-semibold tabular-nums">{formatCurrency(stats.pending_amount)}</p></div>
                        </div>
                    </Link>
                    <Link href="/accounts" className="group rounded-[18px] border-0 bg-card p-4 transition-colors hover:shadow-sm">
                        <div className="flex items-center gap-3">
                            <span className="rounded-xl bg-accent/12 p-2.5 text-accent"><Wallet className="h-4 w-4" /></span>
                            <div><p className="text-xs text-muted-foreground">Trust balance</p><p className="mt-0.5 text-lg font-semibold tabular-nums">{formatCurrency(stats.trust_balance)}</p></div>
                        </div>
                    </Link>
                </div>
            )}

            <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[1.45fr_1fr]">
                <Card className="dashboard-list-card overflow-hidden">
                    <SectionHeading title="Recent matters" href="/matters" action="View all" />
                    <CardContent className="p-0">
                        {recentMatters.length === 0 ? (
                            <div className="px-5 py-12 text-center text-sm text-muted-foreground">No matters yet. <Link href="/matters/create" className="text-primary hover:underline">Open your first matter</Link></div>
                        ) : (
                            <div className="divide-y divide-border/60">
                                {recentMatters.map((matter) => (
                                    <Link key={matter.id} href={`/matters/${matter.id}`} className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/35">
                                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-xs font-semibold text-primary">{matter.matter_number.slice(-2)}</span>
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-medium group-hover:text-primary">{matter.name}</p>
                                            <p className="mt-1 truncate text-xs text-muted-foreground">{matter.matter_number} <span className="px-1">·</span> {matter.responsible_user?.full_name ?? 'Unassigned'}</p>
                                        </div>
                                        <Badge variant={statusColors[matter.status] ?? 'default'} className="shrink-0 text-[10px]">{MATTER_STATUS_LABELS[matter.status]}</Badge>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className="dashboard-list-card overflow-hidden">
                    <SectionHeading title="Upcoming tasks" href="/tasks" action="View all" />
                    <CardContent className="p-0">
                        {upcomingTasks.length === 0 ? (
                            <div className="px-5 py-12 text-center text-sm text-muted-foreground">No upcoming tasks.</div>
                        ) : (
                            <div className="divide-y divide-border/60">
                                {upcomingTasks.map((task) => (
                                    <div key={task.id} className="flex items-center gap-3 px-5 py-4">
                                        <span className={`h-2 w-2 shrink-0 rounded-full ${task.priority === 'high' ? 'bg-primary' : task.priority === 'medium' ? 'bg-warning' : 'bg-accent'}`} />
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-medium">{task.title}</p>
                                            <p className="mt-1 truncate text-xs text-muted-foreground">{task.due_date ? `Due ${formatDate(task.due_date)}` : 'No due date'}{task.assignee && ` · ${task.assignee.full_name}`}</p>
                                        </div>
                                        <Badge variant={task.priority === 'high' ? 'destructive' : task.priority === 'medium' ? 'warning' : 'secondary'} className="shrink-0 text-[10px] capitalize">{task.priority}</Badge>
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
