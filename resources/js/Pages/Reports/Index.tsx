import { useState } from 'react';
import { Head } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDuration, PRACTICE_AREA_LABELS, cn } from '@/lib/utils';
import { Download, TrendingUp, Users, Briefcase } from 'lucide-react';

interface FinancialSummary {
    total_invoiced: number;
    total_collected: number;
    total_outstanding: number;
    invoices_by_matter: {
        matter_id: string;
        count: number;
        total_amount: number;
        paid_amount: number;
        matter?: { id: string; name: string; matter_number: string };
    }[];
}

interface TimeByUser {
    user_id: string;
    full_name: string;
    total_minutes: number;
    billable_minutes: number;
    total_value: number;
}

interface MatterByArea {
    practice_area: string;
    count: number;
}

interface Props {
    financialSummary: FinancialSummary;
    timeByUser: TimeByUser[];
    mattersByPracticeArea: MatterByArea[];
}

const TABS = [
    { key: 'financial', label: 'Financial Summary', icon: TrendingUp },
    { key: 'time', label: 'Time by User', icon: Users },
    { key: 'matters', label: 'Open Matters by Area', icon: Briefcase },
];

export default function ReportsIndex({ financialSummary, timeByUser, mattersByPracticeArea }: Props) {
    const [tab, setTab] = useState('financial');

    const maxMattersCount = Math.max(...mattersByPracticeArea.map((m) => m.count), 1);

    return (
        <AppLayout title="Reports">
            <Head title="Reports" />

            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
                <Button variant="outline" className="gap-2" asChild>
                    <a href={`/reports?export=csv&tab=${tab}`}>
                        <Download className="h-4 w-4" />
                        Export CSV
                    </a>
                </Button>
            </div>

            {/* Tab bar */}
            <div className="flex gap-2 mb-6 border-b border-border/60">
                {TABS.map((t) => (
                    <button
                        key={t.key}
                        onClick={() => setTab(t.key)}
                        className={cn(
                            'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
                            tab === t.key
                                ? 'border-primary text-foreground'
                                : 'border-transparent text-muted-foreground hover:text-foreground',
                        )}
                    >
                        <t.icon className="h-4 w-4" />
                        {t.label}
                    </button>
                ))}
            </div>

            {tab === 'financial' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        {[
                            { label: 'Total Invoiced', value: formatCurrency(financialSummary.total_invoiced), color: 'text-foreground' },
                            { label: 'Total Collected', value: formatCurrency(financialSummary.total_collected), color: 'text-success' },
                            { label: 'Outstanding', value: formatCurrency(financialSummary.total_outstanding), color: 'text-warning' },
                        ].map((s) => (
                            <Card key={s.label}>
                                <CardContent className="p-5">
                                    <p className="text-xs text-muted-foreground uppercase tracking-[0.05em] mb-1">{s.label}</p>
                                    <p className={cn('text-2xl font-bold', s.color)}>{s.value}</p>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Invoices by Matter</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            {financialSummary.invoices_by_matter.length === 0 ? (
                                <p className="px-6 py-6 text-sm text-muted-foreground">No invoice data.</p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b bg-muted/30 text-muted-foreground">
                                                <th className="text-left px-4 py-3 font-medium">Matter</th>
                                                <th className="text-right px-4 py-3 font-medium">Invoices</th>
                                                <th className="text-right px-4 py-3 font-medium">Total</th>
                                                <th className="text-right px-4 py-3 font-medium">Collected</th>
                                                <th className="text-right px-4 py-3 font-medium">Outstanding</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border/60">
                                            {financialSummary.invoices_by_matter.map((row) => (
                                                <tr key={row.matter_id} className="hover:bg-muted/30">
                                                    <td className="px-4 py-3">
                                                        {row.matter ? (
                                                            <span>{row.matter.matter_number} — {row.matter.name}</span>
                                                        ) : row.matter_id.slice(0, 8)}
                                                    </td>
                                                    <td className="px-4 py-3 text-right text-muted-foreground">{row.count}</td>
                                                    <td className="px-4 py-3 text-right font-medium">{formatCurrency(row.total_amount)}</td>
                                                    <td className="px-4 py-3 text-right text-success">{formatCurrency(row.paid_amount)}</td>
                                                    <td className="px-4 py-3 text-right text-warning">{formatCurrency(row.total_amount - row.paid_amount)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}

            {tab === 'time' && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Time by User</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        {timeByUser.length === 0 ? (
                            <p className="px-6 py-6 text-sm text-muted-foreground">No time entries recorded.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b bg-muted/30 text-muted-foreground">
                                            <th className="text-left px-4 py-3 font-medium">User</th>
                                            <th className="text-right px-4 py-3 font-medium">Total Hours</th>
                                            <th className="text-right px-4 py-3 font-medium">Billable Hours</th>
                                            <th className="text-right px-4 py-3 font-medium">Billable %</th>
                                            <th className="text-right px-4 py-3 font-medium">Total Value</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/60">
                                        {timeByUser.map((row) => {
                                            const billablePct = row.total_minutes > 0
                                                ? Math.round((row.billable_minutes / row.total_minutes) * 100)
                                                : 0;
                                            return (
                                                <tr key={row.user_id} className="hover:bg-muted/30">
                                                    <td className="px-4 py-3 font-medium">{row.full_name}</td>
                                                    <td className="px-4 py-3 text-right text-muted-foreground">{formatDuration(row.total_minutes)}</td>
                                                    <td className="px-4 py-3 text-right text-muted-foreground">{formatDuration(row.billable_minutes)}</td>
                                                    <td className="px-4 py-3 text-right">
                                                        <Badge variant={billablePct >= 80 ? 'success' : billablePct >= 50 ? 'warning' : 'secondary'} className="text-xs">
                                                            {billablePct}%
                                                        </Badge>
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-medium">{formatCurrency(row.total_value)}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {tab === 'matters' && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Open Matters by Practice Area</CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                        {mattersByPracticeArea.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No open matters.</p>
                        ) : (
                            <div className="space-y-3">
                                {mattersByPracticeArea.map((row) => (
                                    <div key={row.practice_area} className="space-y-1">
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="font-medium">{PRACTICE_AREA_LABELS[row.practice_area] ?? row.practice_area}</span>
                                            <span className="text-muted-foreground">{row.count} {row.count === 1 ? 'matter' : 'matters'}</span>
                                        </div>
                                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-primary rounded-full transition-all"
                                                style={{ width: `${(row.count / maxMattersCount) * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}
        </AppLayout>
    );
}
