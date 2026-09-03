import { Head, Link } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDate, MATTER_STATUS_LABELS } from '@/lib/utils';
import {
    AlertTriangle, ArrowDownLeft, ArrowUpRight, Briefcase, CheckSquare,
    Clock, Plus, PoundSterling, Receipt, TrendingUp, Wallet,
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

function KpiCard({ kpi }: { kpi: KpiCard }) {
    // Average shade between Vivid #02b88e and Dark #014034 → #017c61
    const avgCard = 'bg-[#017c61] text-white';
    const toneStyles = {
        primary: avgCard,
        ink: avgCard,
        violet: avgCard,
        warning: avgCard,
    }[kpi.tone];

    const iconStyles = {
        primary: 'bg-white text-[#017c61]',
        ink: 'bg-white text-[#017c61]',
        violet: 'bg-white text-[#017c61]',
        warning: 'bg-white text-[#017c61]',
    }[kpi.tone];

    return (
        <Link href={kpi.href} className="group block">
            <Card className={`h-full rounded-[12px] border border-transparent shadow-none transition-all duration-200 group-hover:-translate-y-0.5 group-hover:border-white/80 group-hover:shadow-lg group-hover:ring-2 group-hover:ring-white/20 ${toneStyles}`}>
                <CardContent className="flex min-h-[124px] flex-col justify-between p-5">
                    <div className="flex items-start justify-between gap-3">
                        <p className="text-xs font-semibold tracking-tight text-white">
                            {kpi.label}
                        </p>
                        {kpi.tone === 'warning' ? (
                            <span className="flex h-9 w-9 items-center justify-center shrink-0 rounded-[10px] bg-white">
                                <svg viewBox="0 0 24 24" className="h-7 w-7 shrink-0" aria-hidden="true">
                                    <path d="M12 3.5 L21.2 20.5 H2.8 Z" fill="white" stroke="#DC2626" strokeWidth="1.8" strokeLinejoin="round" />
                                    <path d="M12 8.5 v6" stroke="black" strokeWidth="2.2" strokeLinecap="round" />
                                    <circle cx="12" cy="17.2" r="1.4" fill="black" />
                                </svg>
                            </span>
                        ) : (
                            <span className={`rounded-[10px] p-2 ${iconStyles}`}>
                                <kpi.icon className="h-4 w-4" />
                            </span>
                        )}
                    </div>
                    <p className="text-2xl font-semibold leading-none tracking-[-0.04em] tabular-nums">{kpi.value}</p>
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

function getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
}

export default function Dashboard({ stats, viewFinancial, recentMatters, upcomingTasks }: Props) {
    const greeting = getGreeting();
    const kpis: KpiCard[] = [
        { label: 'Hours Today', value: `${stats.hours_today}h`, href: '/time', icon: Clock, tone: 'primary' },
        { label: 'Open Matters', value: String(stats.open_matters), href: '/matters', icon: Briefcase, tone: 'primary' },
        { label: viewFinancial ? 'Outstanding Invoices' : 'Hours This Week', value: viewFinancial ? formatCurrency(stats.outstanding_invoices) : `${stats.hours_week}h`, href: viewFinancial ? '/billing' : '/time', icon: viewFinancial ? PoundSterling : TrendingUp, tone: 'ink' },
        { label: 'Overdue Tasks', value: String(stats.overdue_tasks), href: '/tasks', icon: AlertTriangle, tone: 'warning' },
    ];

    return (
        <AppLayout title="Dashboard">
            <Head title="Dashboard" />

            <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
                <div>
                    <p className="mb-1 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Workspace overview</p>
                    <h2 className="text-2xl font-semibold tracking-[-0.04em] text-foreground">{greeting}</h2>
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
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                                <Briefcase className="h-6 w-6 text-primary" />
                            </div>
                            <p className="text-foreground font-medium mb-1">No matters yet</p>
                            <p className="text-muted-foreground text-sm mb-4">Create your first matter to get started</p>
                            <Button asChild size="sm">
                                <Link href="/matters/create"><Plus className="h-4 w-4 mr-2" />New matter</Link>
                            </Button>
                        </div>
                        ) : (
                            <div className="divide-y divide-border/60">
                                {recentMatters.map((matter, index) => (
                                    <Link key={matter.id} href={`/matters/${matter.id}`} className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/35">
                                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-xs font-semibold text-primary">{String(index + 1).padStart(2, '0')}</span>
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-medium group-hover:text-primary">{matter.name}</p>
                                            <p className="mt-1 truncate text-xs text-muted-foreground">{matter.matter_number} <span className="px-1">·</span> {matter.responsible_user?.full_name ?? 'Unassigned'}</p>
                                        </div>
                                        <Badge variant={statusColors[matter.status] ?? 'default'} className="shrink-0 text-sm">{MATTER_STATUS_LABELS[matter.status]}</Badge>
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
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                                <CheckSquare className="h-6 w-6 text-primary" />
                            </div>
                            <p className="text-foreground font-medium mb-1">No upcoming tasks</p>
                            <p className="text-muted-foreground text-sm">Tasks with due dates will appear here</p>
                        </div>
                        ) : (
                            <div className="divide-y divide-border/60">
                                {upcomingTasks.map((task) => (
                                    <div key={task.id} className="flex items-center gap-3 px-5 py-4">
                                        <span className={`h-2 w-2 shrink-0 rounded-full ${task.priority === 'high' ? 'bg-destructive' : task.priority === 'medium' ? 'bg-warning' : 'bg-muted-foreground/40'}`} />
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-medium">{task.title}</p>
                                            <p className="mt-1 truncate text-xs text-muted-foreground">{task.due_date ? `Due ${formatDate(task.due_date)}` : 'No due date'}{task.assignee && ` · ${task.assignee.full_name}`}</p>
                                        </div>
                                        <Badge variant={task.priority === 'high' ? 'destructive' : task.priority === 'medium' ? 'warning' : 'secondary'} className="shrink-0 text-sm capitalize">{task.priority}</Badge>
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
