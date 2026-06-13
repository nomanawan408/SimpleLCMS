import { Head, Link } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/utils';
import { Building2, Users, CreditCard, TrendingUp, ShieldCheck, Clock } from 'lucide-react';

interface Stats {
    total_firms: number;
    active_firms: number;
    trial_firms: number;
    cancelled_firms: number;
    total_users: number;
    active_users: number;
}

interface RecentFirm {
    id: string;
    name: string;
    slug: string;
    plan: string;
    subscription_status: string;
    trial_ends_at: string | null;
    users_count: number;
    created_at: string;
}

interface Props {
    stats: Stats;
    recentFirms: RecentFirm[];
    planBreakdown: Record<string, number>;
}

const statusVariant: Record<string, 'default' | 'success' | 'warning' | 'destructive' | 'secondary'> = {
    active: 'success',
    trial: 'warning',
    past_due: 'destructive',
    cancelled: 'secondary',
};

const planLabels: Record<string, string> = {
    starter: 'Starter',
    professional: 'Professional',
    enterprise: 'Enterprise',
};

const kpiCards = (stats: Stats) => [
    { label: 'Total Firms', value: stats.total_firms, icon: Building2, color: 'text-primary', bg: 'bg-primary/15' },
    { label: 'Active Subscriptions', value: stats.active_firms, icon: ShieldCheck, color: 'text-success', bg: 'bg-success/15' },
    { label: 'Trial Firms', value: stats.trial_firms, icon: Clock, color: 'text-warning', bg: 'bg-warning/15' },
    { label: 'Cancelled', value: stats.cancelled_firms, icon: TrendingUp, color: 'text-destructive', bg: 'bg-destructive/15' },
    { label: 'Total Users', value: stats.total_users, icon: Users, color: 'text-info', bg: 'bg-info/15' },
    { label: 'Active Users', value: stats.active_users, icon: CreditCard, color: 'text-accent', bg: 'bg-accent/15' },
];

export default function SuperAdminDashboard({ stats, recentFirms, planBreakdown }: Props) {
    return (
        <AppLayout title="Platform Dashboard">
            <Head title="Platform Dashboard" />

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

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <Card className="surface-card lg:col-span-2">
                    <CardHeader className="flex flex-row items-center justify-between pb-3">
                        <CardTitle className="text-base tracking-tight">Recent Firms</CardTitle>
                        <Button asChild size="sm" variant="outline">
                            <Link href="/superadmin/firms">
                                <Building2 className="h-4 w-4 mr-1" />
                                Manage Firms
                            </Link>
                        </Button>
                    </CardHeader>
                    <CardContent className="p-0">
                        {recentFirms.length === 0 ? (
                            <div className="px-6 py-10 text-center text-sm text-muted-foreground">
                                No firms registered yet.
                            </div>
                        ) : (
                            <div className="divide-y divide-border/60">
                                {recentFirms.map((firm) => (
                                    <div key={firm.id} className="flex items-center gap-3 px-6 py-3">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium truncate">{firm.name}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {firm.users_count} user{firm.users_count !== 1 ? 's' : ''} &middot; Created {formatDate(firm.created_at)}
                                            </p>
                                        </div>
                                        <Badge variant="outline" className="shrink-0">
                                            {planLabels[firm.plan] ?? firm.plan}
                                        </Badge>
                                        <Badge variant={statusVariant[firm.subscription_status] ?? 'default'} className="shrink-0 capitalize">
                                            {firm.subscription_status}
                                        </Badge>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className="surface-card">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base tracking-tight">Plan Breakdown</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {Object.entries(planBreakdown).length === 0 ? (
                            <p className="text-sm text-muted-foreground">No data.</p>
                        ) : (
                            Object.entries(planBreakdown).map(([plan, count]) => (
                                <div key={plan} className="flex items-center justify-between">
                                    <span className="text-sm capitalize">{planLabels[plan] ?? plan}</span>
                                    <Badge variant="secondary">{count}</Badge>
                                </div>
                            ))
                        )}
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}
