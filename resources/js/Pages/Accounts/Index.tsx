import { Head, Link, router } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import { ArrowDownCircle, ArrowUpCircle, Wallet } from 'lucide-react';
import type { TrustEntry, PaginatedData } from '@/types';

interface Props {
    entries: PaginatedData<TrustEntry & { matter: { name: string } }>;
    summary: { total_receipts: number; total_disbursements: number; balance: number };
    matters: { id: string; name: string }[];
    filters: { matter_id?: string };
}

const TYPE_COLORS: Record<string, 'success' | 'destructive' | 'default'> = {
    receipt: 'success',
    disbursement: 'destructive',
    transfer: 'default',
};

export default function AccountsIndex({ entries, summary, matters, filters }: Props) {
    const setFilter = (key: string, value: string) => {
        const actual = value === '_all' ? '' : value;
        router.get('/accounts', { ...filters, [key]: actual || undefined }, { preserveState: true, replace: true });
    };

    return (
        <AppLayout title="Accounts">
            <Head title="Accounts" />

            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold tracking-tight">Client Funds (Trust Account)</h1>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-6">
                <Card>
                    <CardContent className="p-5 flex items-center gap-4">
                        <div className="bg-success/15 p-2.5 rounded-lg">
                            <ArrowDownCircle className="h-5 w-5 text-success" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground uppercase tracking-[0.05em]">Total Receipts</p>
                            <p className="text-xl font-bold">{formatCurrency(summary.total_receipts)}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-5 flex items-center gap-4">
                        <div className="bg-destructive/15 p-2.5 rounded-lg">
                            <ArrowUpCircle className="h-5 w-5 text-destructive" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground uppercase tracking-[0.05em]">Total Disbursements</p>
                            <p className="text-xl font-bold">{formatCurrency(summary.total_disbursements)}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-5 flex items-center gap-4">
                        <div className="bg-primary/15 p-2.5 rounded-lg">
                            <Wallet className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground uppercase tracking-[0.05em]">Current Balance</p>
                            <p className={cn('text-xl font-bold', summary.balance < 0 && 'text-destructive')}>
                                {formatCurrency(summary.balance)}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Filter */}
            <div className="flex items-center gap-3 mb-5">
                <Select value={filters.matter_id || '_all'} onValueChange={(v) => setFilter('matter_id', v)}>
                    <SelectTrigger className="w-52 h-9">
                        <SelectValue placeholder="All matters" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="_all">All matters</SelectItem>
                        {matters.map((m) => (
                            <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <Card>
                <CardContent className="p-0">
                    {entries.data.length === 0 ? (
                        <p className="px-6 py-10 text-center text-sm text-muted-foreground">No trust entries found.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b bg-muted/30 text-muted-foreground">
                                        <th className="text-left px-4 py-3 font-medium">Date</th>
                                        <th className="text-left px-4 py-3 font-medium">Matter</th>
                                        <th className="text-left px-4 py-3 font-medium">Type</th>
                                        <th className="text-left px-4 py-3 font-medium">Description</th>
                                        <th className="text-right px-4 py-3 font-medium">Amount</th>
                                        <th className="text-right px-4 py-3 font-medium">Balance After</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/60">
                                    {entries.data.map((entry) => (
                                        <tr key={entry.id} className="hover:bg-muted/30">
                                            <td className="px-4 py-3 text-muted-foreground">{formatDate(entry.date)}</td>
                                            <td className="px-4 py-3">
                                                {entry.matter?.name ?? '—'}
                                            </td>
                                            <td className="px-4 py-3">
                                                <Badge variant={TYPE_COLORS[entry.type] ?? 'default'} className="text-xs capitalize">
                                                    {entry.type}
                                                </Badge>
                                            </td>
                                            <td className="px-4 py-3 text-muted-foreground">{entry.description || '—'}</td>
                                            <td className="px-4 py-3 text-right font-medium">
                                                <span className={entry.type === 'receipt' ? 'text-success' : entry.type === 'disbursement' ? 'text-destructive' : ''}>
                                                    {entry.type === 'disbursement' ? '-' : ''}{formatCurrency(Number(entry.amount))}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right text-muted-foreground">
                                                {formatCurrency(Number(entry.balance_after))}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {entries.last_page > 1 && (
                        <div className="flex items-center justify-between px-4 py-3 border-t">
                            <p className="text-sm text-muted-foreground">
                                {entries.from}–{entries.to} of {entries.total}
                            </p>
                            <div className="flex gap-2">
                                {entries.links.map((link, i) => (
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
