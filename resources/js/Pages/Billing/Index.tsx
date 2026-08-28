import { Head, Link, router } from '@inertiajs/react';
import { useState, useEffect, useRef } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableHeaderRow, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import { Plus, Search, FileText, AlertCircle, CheckCircle, Clock, X, Filter, Calendar, Briefcase, User } from 'lucide-react';
import type { Invoice, PaginatedData } from '@/types';

function useDebounce(value: string, delay: number) {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => { const t = setTimeout(() => setDebounced(value), delay); return () => clearTimeout(t); }, [value, delay]);
    return debounced;
}

interface Props {
    invoices: PaginatedData<Invoice & { amount_paid?: number }>;
    stats: { total_outstanding: number; overdue_amount: number; paid_this_month: number; draft_count: number; };
    filters: { status?: string; search?: string; matter_id?: string; user_id?: string; timeframe?: string; date_from?: string; date_to?: string; date_field?: string; };
    filterOptions: { matters: { id: string; name: string; matter_number: string }[]; users: { id: string; full_name: string }[]; };
}

const statusVariant: Record<string, 'default' | 'success' | 'warning' | 'destructive' | 'secondary'> = {
    draft: 'secondary', sent: 'warning', partial: 'warning', paid: 'success', written_off: 'secondary', cancelled: 'destructive',
};
const statusLabel: Record<string, string> = {
    draft: 'Draft', sent: 'Sent', partial: 'Partial', paid: 'Paid', written_off: 'Written Off', cancelled: 'Cancelled',
};
const TIMEFRAMES = [
    { value: 'all', label: 'All Time' }, { value: 'today', label: 'Today' }, { value: 'week', label: 'Week' },
    { value: 'month', label: 'Month' }, { value: 'quarter', label: 'Quarter' }, { value: 'ytd', label: 'YTD' }, { value: 'custom', label: 'Custom' },
];

export default function BillingIndex({ invoices, stats, filters, filterOptions }: Props) {
    const [search, setSearch] = useState(filters.search ?? '');
    const [status, setStatus] = useState(filters.status ?? 'all');
    const [timeframe, setTimeframe] = useState(filters.timeframe ?? 'all');
    const [dateFrom, setDateFrom] = useState(filters.date_from ?? '');
    const [dateTo, setDateTo] = useState(filters.date_to ?? '');
    const [matterId, setMatterId] = useState(filters.matter_id ?? 'all');
    const [userId, setUserId] = useState(filters.user_id ?? 'all');
    const debounced = useDebounce(search, 300);
    const isFirstRun = useRef(true);

    const buildParams = (overrides: Record<string, string | undefined> = {}) => {
        const base: Record<string, string | undefined> = {
            search: debounced || undefined,
            status: status === 'all' ? undefined : status,
            timeframe: timeframe !== 'all' ? timeframe : undefined,
            date_from: timeframe === 'custom' && dateFrom ? dateFrom : undefined,
            date_to: timeframe === 'custom' && dateTo ? dateTo : undefined,
            matter_id: matterId !== 'all' ? matterId : undefined,
            user_id: userId !== 'all' ? userId : undefined,
        };
        return { ...base, ...overrides };
    };

    const pushFilters = (overrides: Record<string, string | undefined> = {}) => {
        router.get('/billing', buildParams(overrides) as any, { preserveState: true, replace: true });
    };

    // Search is debounced; all other filters are reactive via direct handlers below.
    useEffect(() => {
        if (isFirstRun.current) { isFirstRun.current = false; return; }
        router.get('/billing', buildParams() as any, { preserveState: true, replace: true });
        // eslint-disable-next-line
    }, [debounced]);

    const applyFilters = () => pushFilters();
    const clearFilters = () => {
        setSearch(''); setStatus('all'); setTimeframe('all'); setDateFrom(''); setDateTo(''); setMatterId('all'); setUserId('all');
        router.get('/billing', {}, { preserveState: true, replace: true });
    };

    const handleStatusChange = (v: string) => {
        setStatus(v);
        router.get('/billing', buildParams({ status: v === 'all' ? undefined : v }) as any, { preserveState: true, replace: true });
    };
    const handleMatterChange = (v: string) => {
        setMatterId(v);
        router.get('/billing', buildParams({ matter_id: v === 'all' ? undefined : v }) as any, { preserveState: true, replace: true });
    };
    const handleUserChange = (v: string) => {
        setUserId(v);
        router.get('/billing', buildParams({ user_id: v === 'all' ? undefined : v }) as any, { preserveState: true, replace: true });
    };
    const handleTimeframe = (v: string) => {
        setTimeframe(v);
        // When switching away from custom, drop dates; when to custom, keep current dates
        const params: Record<string, string | undefined> = {
            timeframe: v === 'all' ? undefined : v,
            date_from: v === 'custom' && dateFrom ? dateFrom : undefined,
            date_to: v === 'custom' && dateTo ? dateTo : undefined,
        };
        router.get('/billing', buildParams(params) as any, { preserveState: true, replace: true });
    };
    const handleDateChange = (field: 'date_from' | 'date_to', value: string) => {
        if (field === 'date_from') setDateFrom(value);
        else setDateTo(value);
        // Apply only when both dates present or on blur; push immediately for responsiveness
        const nextFrom = field === 'date_from' ? value : dateFrom;
        const nextTo = field === 'date_to' ? value : dateTo;
        if (timeframe === 'custom' && nextFrom && nextTo) {
            router.get('/billing', buildParams({ date_from: nextFrom, date_to: nextTo }) as any, { preserveState: true, replace: true });
        }
    };

    const hasActiveFilters = status !== 'all' || timeframe !== 'all' || matterId !== 'all' || userId !== 'all' || !!search;

    return (
        <AppLayout title="Billing">
            <Head title="Billing" />

            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                <div>
                    <h1 className="text-2xl font-extrabold tracking-tight">Billing</h1>
                    <p className="text-sm text-muted-foreground mt-1">Invoices, payments and outstanding — filter by timeframe, matter and team.</p>
                </div>
                <Button asChild className="rounded-xl gap-2 bg-primary"><Link href="/billing/create"><Plus className="h-4 w-4" /> New Invoice</Link></Button>
            </div>

            {/* Stats - transaction style: just colored icons, values stay black */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-6">
                {[
                    { label: 'Outstanding', value: formatCurrency(stats.total_outstanding), icon: Clock, iconBg: 'bg-amber-50', iconColor: 'text-amber-600' },
                    { label: 'Overdue', value: formatCurrency(stats.overdue_amount), icon: AlertCircle, iconBg: 'bg-red-50', iconColor: 'text-red-600' },
                    { label: 'Collected', value: formatCurrency(stats.paid_this_month), sub: timeframe !== 'all' ? 'Filtered period' : 'This month', icon: CheckCircle, iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600' },
                    { label: 'Drafts', value: String(stats.draft_count), icon: FileText, iconBg: 'bg-slate-100', iconColor: 'text-slate-600' },
                ].map(s => (
                    <div key={s.label} className="rounded-xl border border-border/60 bg-card p-5 flex items-center justify-between shadow-sm">
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">{s.label}</p>
                            <p className="text-xl font-extrabold tracking-tight tabular-nums mt-1.5 leading-none text-foreground">{s.value}</p>
                            {s.sub && <p className="text-xs text-muted-foreground mt-1">{s.sub}</p>}
                        </div>
                        <div className={cn('flex h-10 w-10 items-center justify-center rounded-full shrink-0', s.iconBg)}>
                            <s.icon className={cn('h-5 w-5', s.iconColor)} />
                        </div>
                    </div>
                ))}
            </div>

            {/* Enterprise Filter Bar */}
            <Card className="surface-card border border-border/60 mb-6">
                <CardContent className="p-4 space-y-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                        <div className="space-y-2">
                            <Label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5"><Calendar className="h-3 w-3" /> Timeframe</Label>
                            <div className="flex flex-wrap gap-1.5">
                                {TIMEFRAMES.map(t => (
                                    <button key={t.value} onClick={() => handleTimeframe(t.value)} className={cn('rounded-full px-3.5 py-1.5 text-xs font-medium border transition-colors', timeframe === t.value ? 'bg-primary text-primary-foreground border-primary shadow-sm' : 'bg-muted text-muted-foreground border-transparent hover:bg-muted/80 hover:text-foreground')}>{t.label}</button>
                                ))}
                            </div>
                            {timeframe === 'custom' && (
                                <div className="flex gap-2 pt-1">
                                    <Input type="date" value={dateFrom} onChange={e => handleDateChange('date_from', e.target.value)} className="h-9 rounded-xl w-[160px]" />
                                    <span className="self-center text-muted-foreground">—</span>
                                    <Input type="date" value={dateTo} onChange={e => handleDateChange('date_to', e.target.value)} className="h-9 rounded-xl w-[160px]" />
                                </div>
                            )}
                        </div>
                        <div className="flex gap-2 shrink-0">
                            <Button onClick={applyFilters} className="h-9 rounded-xl px-5 gap-1.5"><Filter className="h-3.5 w-3.5" /> Apply</Button>
                            <Button variant="ghost" onClick={clearFilters} disabled={!hasActiveFilters} className="h-9 rounded-xl gap-1 disabled:opacity-40"><X className="h-3.5 w-3.5" /> Clear</Button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input className="pl-9 h-9 rounded-xl" placeholder="Invoice # or matter..." value={search} onChange={e => setSearch(e.target.value)} />
                        </div>
                        <Select value={status} onValueChange={handleStatusChange}>
                            <SelectTrigger className="h-9 rounded-xl"><SelectValue placeholder="Status" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All statuses</SelectItem>
                                <SelectItem value="draft">Draft</SelectItem><SelectItem value="sent">Sent</SelectItem><SelectItem value="partial">Partial</SelectItem>
                                <SelectItem value="paid">Paid</SelectItem><SelectItem value="written_off">Written Off</SelectItem><SelectItem value="cancelled">Cancelled</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={matterId} onValueChange={handleMatterChange}>
                            <SelectTrigger className="h-9 rounded-xl"><span className="flex items-center gap-1.5"><Briefcase className="h-3.5 w-3.5 text-muted-foreground" /> <SelectValue placeholder="All matters" /></span></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All matters</SelectItem>
                                {filterOptions.matters.map(m => <SelectItem key={m.id} value={m.id}>{m.matter_number} — {m.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Select value={userId} onValueChange={handleUserChange}>
                            <SelectTrigger className="h-9 rounded-xl"><span className="flex items-center gap-1.5"><User className="h-3.5 w-3.5 text-muted-foreground" /> <SelectValue placeholder="All users" /></span></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All users</SelectItem>
                                {filterOptions.users.map(u => <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* Status pills quick filter */}
            <div className="flex flex-wrap gap-1.5 mb-4">
                {['all', 'draft', 'sent', 'partial', 'paid', 'overdue'].map(s => {
                    const active = (s === 'all' ? status === 'all' : status === s) || (s === 'overdue' && status === 'sent');
                    return (
                        <button key={s} onClick={() => handleStatusChange(s === 'overdue' ? 'sent' : s)}
                            className={cn('rounded-full px-3 py-1 text-xs font-medium border transition-colors capitalize', active ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border text-muted-foreground hover:bg-muted')}>
                            {s}
                        </button>
                    );
                })}
            </div>

            {/* Invoices Table */}
            <Card className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">
                <CardContent className="p-0">
                    {invoices.data.length === 0 ? (
                        <div className="py-16 text-center">
                            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-4"><FileText className="h-7 w-7 text-muted-foreground" /></div>
                            <p className="font-medium">No invoices found</p>
                            <p className="text-sm text-muted-foreground mt-1">Try adjusting filters or create a new invoice.</p>
                            <div className="flex gap-2 justify-center mt-4">
                                {hasActiveFilters && <Button variant="outline" size="sm" onClick={clearFilters} className="rounded-xl">Clear filters</Button>}
                                <Button asChild size="sm" className="rounded-xl"><Link href="/billing/create">New Invoice</Link></Button>
                            </div>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader><TableHeaderRow><TableHead>Invoice #</TableHead><TableHead>Matter</TableHead><TableHead className="hidden md:table-cell">Date</TableHead><TableHead className="hidden lg:table-cell">Due</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Status</TableHead></TableHeaderRow></TableHeader>
                                <TableBody>
                                    {invoices.data.map((invoice: any) => {
                                        const paid = Number(invoice.amount_paid ?? 0);
                                        const outstanding = Math.max(0, Number(invoice.total) - paid);
                                        const isOverdue = ['sent', 'partial'].includes(invoice.status) && invoice.due_date && new Date(invoice.due_date) < new Date();
                                        return (
                                            <TableRow key={invoice.id} className="group cursor-pointer" onClick={() => router.visit(`/billing/${invoice.id}`)}>
                                                <TableCell><p className="font-medium text-sm">{invoice.invoice_number}</p></TableCell>
                                                <TableCell><p className="font-medium text-sm truncate max-w-[180px]">{invoice.matter?.name}</p><p className="text-xs text-muted-foreground truncate">{invoice.matter?.responsible_user?.full_name}</p></TableCell>
                                                <TableCell className="hidden md:table-cell text-muted-foreground">{formatDate(invoice.created_at)}</TableCell>
                                                <TableCell className="hidden lg:table-cell">
                                                    <span className={cn(isOverdue && 'text-destructive font-medium')}>{formatDate(invoice.due_date)}</span>
                                                    {isOverdue && <Badge variant="destructive" className="ml-2 text-sm rounded-full">Overdue</Badge>}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <p className="font-medium text-sm tabular-nums">{formatCurrency(invoice.total)}</p>
                                                    {invoice.status === 'partial' && <p className="text-xs text-muted-foreground tabular-nums">{formatCurrency(paid)} paid • {formatCurrency(outstanding)} due</p>}
                                                </TableCell>
                                                <TableCell><Badge variant={statusVariant[invoice.status]} className="rounded-full text-xs">{statusLabel[invoice.status]}</Badge></TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                    {invoices.last_page > 1 && (
                        <div className="flex items-center justify-between px-4 py-4 border-t">
                            <p className="text-sm text-muted-foreground">Showing {invoices.from} to {invoices.to} of {invoices.total}</p>
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" className="rounded-xl" disabled={!invoices.prev_page_url} onClick={() => invoices.prev_page_url && router.visit(invoices.prev_page_url)}>Previous</Button>
                                <Button variant="outline" size="sm" className="rounded-xl" disabled={!invoices.next_page_url} onClick={() => invoices.next_page_url && router.visit(invoices.next_page_url)}>Next</Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </AppLayout>
    );
}