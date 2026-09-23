import { Head, Link } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TaskDueBadge } from '@/components/ui/task-due-badge';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDate, MATTER_STATUS_LABELS } from '@/lib/utils';
import {
    AlertTriangle, Archive, ArrowDownLeft, ArrowRight, Briefcase, CheckSquare,
    Clock, Loader, Pause, Plus, PoundSterling, TrendingUp,
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
    opened_matters: number;
    in_progress_matters: number;
    on_hold_matters: number;
    closed_matters: number;
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
    sublabel?: string;
}

const statusColors: Record<string, 'default' | 'success' | 'warning' | 'destructive' | 'secondary'> = {
    open: 'success',
    in_progress: 'warning',
    in_review: 'warning',
    actively_progressing: 'warning',
    reviewing: 'warning',
    being_worked: 'warning',
    pending_court_date: 'warning',
    awaiting_client: 'secondary',
    awaiting_opponent: 'secondary',
    awaiting_response: 'secondary',
    awaiting_third_party: 'secondary',
    awaiting_respondent_solicitors: 'secondary',
    awaiting_claimant_solicitors: 'secondary',
    on_hold: 'secondary',
    closed: 'default',
    archived: 'secondary',
};

const toneConfig = {
    primary: {
        strip: 'bg-primary',
        iconBg: 'bg-primary/8',
        iconText: 'text-primary',
        valueGlow: 'bg-primary/5',
        hoverBorder: 'hover:border-primary/25',
    },
    ink: {
        strip: 'bg-slate-500',
        iconBg: 'bg-slate-500/8',
        iconText: 'text-slate-600',
        valueGlow: 'bg-slate-500/5',
        hoverBorder: 'hover:border-slate-300',
    },
    violet: {
        strip: 'bg-violet-500',
        iconBg: 'bg-violet-500/8',
        iconText: 'text-violet-600',
        valueGlow: 'bg-violet-500/5',
        hoverBorder: 'hover:border-violet-300',
    },
    warning: {
        strip: 'bg-amber-500',
        iconBg: 'bg-amber-500/8',
        iconText: 'text-amber-600',
        valueGlow: 'bg-amber-500/5',
        hoverBorder: 'hover:border-amber-300',
    },
} as const;

function KpiCard({ kpi }: { kpi: KpiCard }) {
    const cfg = toneConfig[kpi.tone];

    return (
        <Link href={kpi.href} className="group block">
            <div className={`relative h-full overflow-hidden rounded-xl border border-border/40 bg-white transition-all duration-300 ${cfg.hoverBorder} hover:shadow-[0_8px_30px_-8px_rgba(0,0,0,0.08)]`}>
                {/* Left accent strip */}
                <div className={`absolute left-0 top-0 h-full w-1 ${cfg.strip} rounded-l-xl`} />

                {/* Subtle background glow */}
                <div className={`absolute -right-6 -top-6 h-20 w-20 rounded-full ${cfg.valueGlow} blur-2xl transition-opacity duration-300 opacity-0 group-hover:opacity-100`} />

                <div className="relative flex items-center gap-3 pl-4 pr-4 py-3.5">
                    {/* Icon */}
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${cfg.iconBg} transition-transform duration-300 group-hover:scale-105`}>
                        {kpi.tone === 'warning' ? (
                            <AlertTriangle className={`h-4 w-4 ${cfg.iconText}`} />
                        ) : (
                            <kpi.icon className={`h-4 w-4 ${cfg.iconText}`} />
                        )}
                    </div>

                    {/* Value & label */}
                    <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">{kpi.label}</p>
                        <p className="mt-1 text-xl font-bold leading-none tracking-[-0.03em] tabular-nums text-foreground">{kpi.value}</p>
                        {kpi.sublabel && (
                            <p className="mt-0.5 text-[10px] text-muted-foreground/70">{kpi.sublabel}</p>
                        )}
                    </div>
                </div>
            </div>
        </Link>
    );
}


function SectionHeading({ title, href, action, icon: Icon }: { title: string; href: string; action: string; icon: React.ComponentType<{ className?: string }> }) {
    return (
        <div className="flex items-center justify-between px-6 py-5 pb-3">
            <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/8">
                    <Icon className="h-4 w-4 text-primary" />
                </div>
                <h3 className="text-[15px] font-semibold tracking-tight text-foreground">{title}</h3>
            </div>
            <Button asChild variant="ghost" size="sm" className="h-8 gap-1.5 rounded-lg px-2.5 text-xs font-medium text-muted-foreground hover:text-primary">
                <Link href={href}>{action}<ArrowRight className="h-3.5 w-3.5" /></Link>
            </Button>
        </div>
    );
}

function getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
}

export default function Dashboard({ stats, viewFinancial, recentMatters, upcomingTasks }: Props) {
    const greeting = getGreeting();
    const matterKpis: KpiCard[] = [
        { label: 'Opened Matters', value: String(stats.opened_matters), href: '/matters?category=open', icon: Briefcase, tone: 'primary' },
        { label: 'In Progress Matters', value: String(stats.in_progress_matters), href: '/matters?status=in_progress', icon: Loader, tone: 'ink' },
        { label: 'On Hold Matters', value: String(stats.on_hold_matters), href: '/matters?status=on_hold', icon: Pause, tone: 'ink' },
        { label: 'Closed Matters', value: String(stats.closed_matters), href: '/matters?category=closed', icon: Archive, tone: 'violet' },
    ];
    const workKpis: KpiCard[] = [
        { label: 'Hours Today', value: `${stats.hours_today}h`, href: '/time', icon: Clock, tone: 'primary', sublabel: `${stats.hours_week}h this week` },
        { label: 'Overdue Tasks', value: String(stats.overdue_tasks), href: '/tasks', icon: AlertTriangle, tone: 'warning' },
        ...(viewFinancial ? [
            { label: 'Total Received', value: formatCurrency(stats.total_received), href: '/transactions', icon: ArrowDownLeft, tone: 'ink' },
            { label: 'Outstanding Invoices', value: formatCurrency(stats.outstanding_invoices), href: '/billing', icon: PoundSterling, tone: 'violet' },
        ] as KpiCard[] : [
            { label: 'Hours This Week', value: `${stats.hours_week}h`, href: '/time', icon: TrendingUp, tone: 'violet' },
        ] as KpiCard[]),
    ];

    return (
        <AppLayout title="Dashboard">
            <Head title="Dashboard" />

            {/* Greeting */}
            <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                    <h1 className="text-[1.65rem] font-bold tracking-[-0.03em] text-foreground">{greeting}</h1>
                    <p className="mt-1 text-sm text-muted-foreground">Here's what's happening across your matters today.</p>
                </div>
                <Button asChild className="h-10 rounded-xl px-5 shadow-sm bg-primary hover:bg-primary-hover text-white font-medium">
                    <Link href="/matters/create"><Plus className="mr-2 h-4 w-4" />New matter</Link>
                </Button>
            </div>

            {/* Matter states */}
            <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {matterKpis.map((kpi) => <KpiCard key={kpi.label} kpi={kpi} />)}
            </div>

            {/* Work + money */}
            <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {workKpis.map((kpi) => <KpiCard key={kpi.label} kpi={kpi} />)}
            </div>

            {/* Lists */}
            <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[1.45fr_1fr]">
                {/* Recent matters */}
                <div className="overflow-hidden rounded-2xl border border-border/40 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                    <SectionHeading title="Recent matters" href="/matters" action="View all" icon={Briefcase} />
                    <div className="p-0">
                        {recentMatters.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-14 text-center">
                                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/8">
                                    <Briefcase className="h-7 w-7 text-primary/60" />
                                </div>
                                <p className="font-semibold text-foreground">No matters yet</p>
                                <p className="mt-1 text-sm text-muted-foreground">Create your first matter to get started</p>
                                <Button asChild size="sm" className="mt-5 rounded-xl">
                                    <Link href="/matters/create"><Plus className="h-4 w-4 mr-1.5" />New matter</Link>
                                </Button>
                            </div>
                        ) : (
                            <div className="divide-y divide-border/40">
                                {recentMatters.map((matter, index) => (
                                    <Link key={matter.id} href={`/matters/${matter.id}`} className="group flex items-center gap-4 px-6 py-4 transition-all duration-200 hover:bg-primary/[0.02]">
                                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/8 text-xs font-bold text-primary/70 transition-colors duration-200 group-hover:bg-primary/12 group-hover:text-primary">{String(index + 1).padStart(2, '0')}</span>
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-semibold text-foreground transition-colors duration-200 group-hover:text-primary">{matter.name}</p>
                                            <p className="mt-0.5 truncate text-xs text-muted-foreground">{matter.matter_number} <span className="px-1 opacity-40">·</span> {matter.responsible_user?.full_name ?? 'Unassigned'}</p>
                                        </div>
                                        <Badge variant={statusColors[matter.status] ?? 'default'} className="shrink-0 rounded-md text-[11px] font-semibold">{MATTER_STATUS_LABELS[matter.status]}</Badge>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Upcoming tasks */}
                <div className="overflow-hidden rounded-2xl border border-border/40 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                    <SectionHeading title="Upcoming tasks" href="/tasks" action="View all" icon={CheckSquare} />
                    <div className="p-0">
                        {upcomingTasks.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-14 text-center">
                                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/8">
                                    <CheckSquare className="h-7 w-7 text-primary/60" />
                                </div>
                                <p className="font-semibold text-foreground">No upcoming tasks</p>
                                <p className="mt-1 text-sm text-muted-foreground">Tasks with due dates will appear here</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-border/40">
                                {upcomingTasks.map((task) => (
                                    <Link
                                        key={task.id}
                                        href={task.matter_id ? `/matters/${task.matter_id}?tab=tasks&task=${task.id}` : '/tasks'}
                                        title={task.matter_id ? `Open in matter tasks: ${task.title}` : 'Open tasks'}
                                        className="group flex cursor-pointer items-center gap-3 px-6 py-4 transition-all duration-200 hover:bg-primary/[0.02]"
                                    >
                                        <span className={`h-2.5 w-2.5 shrink-0 rounded-full transition-transform duration-200 group-hover:scale-125 ${task.priority === 'high' ? 'bg-destructive' : task.priority === 'medium' ? 'bg-amber-400' : 'bg-muted-foreground/30'}`} />
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-semibold text-foreground">{task.title}</p>
                                            <div className="mt-1 flex items-center gap-1.5">
                                                <TaskDueBadge dueDate={task.due_date} done={task.status === 'done'} />
                                                {task.assignee && <span className="truncate text-xs text-muted-foreground opacity-60">{task.assignee.full_name}</span>}
                                            </div>
                                        </div>
                                        <Badge variant={task.priority === 'high' ? 'destructive' : task.priority === 'medium' ? 'warning' : 'secondary'} className="shrink-0 rounded-md text-[11px] font-semibold capitalize">{task.priority}</Badge>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
