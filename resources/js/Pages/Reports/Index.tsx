import { useState, useEffect, useRef } from 'react';
import { Head, router } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableHeaderRow, TableBody, TableFooter, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency, formatDuration, PRACTICE_AREA_LABELS, cn } from '@/lib/utils';
import { Download, TrendingUp, Users, Briefcase, Calendar, Filter, X, PoundSterling, Clock, BarChart3, PieChart } from 'lucide-react';

interface FinancialSummary {
    total_invoiced: number;
    total_collected: number;
    total_outstanding: number;
    invoices_by_matter: { matter_id: string; count: number; total_amount: number; collected_amount: number; outstanding_amount: number; matter?: { id: string; name: string; matter_number: string } }[];
}
interface TimeByUser { user_id: string; full_name: string; total_minutes: number; billable_minutes: number; total_value: number; }
interface MatterByArea { practice_area: string; count: number; }
interface FilterOptions { matters: { id: string; name: string; matter_number: string }[]; users: { id: string; full_name: string }[]; }
interface Filters { timeframe?: string; date_from?: string; date_to?: string; date_field?: string; matter_id?: string; user_id?: string; practice_area?: string; status?: string; tab?: string; }
interface Props { financialSummary: FinancialSummary; timeByUser: TimeByUser[]; mattersByPracticeArea: MatterByArea[]; filters: Filters; filterOptions: FilterOptions; }

const TABS = [
    { key: 'financial', label: 'Financial', icon: TrendingUp },
    { key: 'time', label: 'Time', icon: Users },
    { key: 'matters', label: 'Matters', icon: Briefcase },
];
const TIMEFRAMES = [
    { value: 'all', label: 'All Time' }, { value: 'today', label: 'Today' }, { value: 'week', label: 'Week' },
    { value: 'month', label: 'Month' }, { value: 'quarter', label: 'Quarter' }, { value: 'ytd', label: 'YTD' }, { value: 'custom', label: 'Custom' },
];

export default function ReportsIndex({ financialSummary, timeByUser, mattersByPracticeArea, filters, filterOptions }: Props) {
    const [tab, setTab] = useState(filters.tab ?? 'financial');
    const [timeframe, setTimeframe] = useState(filters.timeframe ?? 'all');
    const [dateFrom, setDateFrom] = useState(filters.date_from ?? '');
    const [dateTo, setDateTo] = useState(filters.date_to ?? '');
    const [matterId, setMatterId] = useState(filters.matter_id ?? 'all');
    const [userId, setUserId] = useState(filters.user_id ?? 'all');
    const [practiceArea, setPracticeArea] = useState(filters.practice_area ?? 'all');
    const [status, setStatus] = useState(filters.status ?? 'all');

    const isFirstRun = useRef(true);

    const buildParams = (overrides: Partial<{ tab: string; timeframe: string; dateFrom: string; dateTo: string; matterId: string; userId: string; practiceArea: string; status: string }> = {}) => {
        const _tab = overrides.tab ?? tab;
        const _timeframe = overrides.timeframe ?? timeframe;
        const _dateFrom = overrides.dateFrom ?? dateFrom;
        const _dateTo = overrides.dateTo ?? dateTo;
        const _matterId = overrides.matterId ?? matterId;
        const _userId = overrides.userId ?? userId;
        const _practiceArea = overrides.practiceArea ?? practiceArea;
        const _status = overrides.status ?? status;
        return {
            tab: _tab,
            timeframe: _timeframe !== 'all' ? _timeframe : undefined,
            date_from: _timeframe === 'custom' && _dateFrom ? _dateFrom : undefined,
            date_to: _timeframe === 'custom' && _dateTo ? _dateTo : undefined,
            matter_id: _matterId !== 'all' ? _matterId : undefined,
            user_id: _userId !== 'all' ? _userId : undefined,
            practice_area: _practiceArea !== 'all' ? _practiceArea : undefined,
            status: _status !== 'all' ? _status : undefined,
        } as Record<string, string | undefined>;
    };

    // Instant dynamic filtering — any filter change pushes new query without clicking Apply
    useEffect(() => {
        if (isFirstRun.current) { isFirstRun.current = false; return; }
        router.get('/reports', buildParams() as any, { preserveState: true, replace: true });
    }, [tab, timeframe, dateFrom, dateTo, matterId, userId, practiceArea, status]);

    const handleTabSwitch = (newTab: string) => {
        setTab(newTab);
    };

    const clearFilters = () => {
        setTimeframe('all'); setDateFrom(''); setDateTo(''); setMatterId('all'); setUserId('all'); setPracticeArea('all'); setStatus('all');
    };

    const hasActiveFilters = timeframe !== 'all' || matterId !== 'all' || userId !== 'all' || practiceArea !== 'all' || status !== 'all';
    const activeChips: { label: string; onClear: () => void }[] = [];
    if (timeframe !== 'all') activeChips.push({ label: TIMEFRAMES.find(t=>t.value===timeframe)?.label ?? timeframe, onClear: () => setTimeframe('all') });
    if (matterId !== 'all') activeChips.push({ label: filterOptions.matters.find(m=>m.id===matterId)?.name ?? matterId.slice(0,8), onClear: () => setMatterId('all') });
    if (userId !== 'all') activeChips.push({ label: filterOptions.users.find(u=>u.id===userId)?.full_name ?? userId.slice(0,8), onClear: () => setUserId('all') });
    if (practiceArea !== 'all') activeChips.push({ label: PRACTICE_AREA_LABELS[practiceArea] ?? practiceArea, onClear: () => setPracticeArea('all') });
    if (status !== 'all') activeChips.push({ label: status, onClear: () => setStatus('all') });

    const maxMattersCount = Math.max(...mattersByPracticeArea.map((m) => m.count), 1);
    const totalTimeValue = timeByUser.reduce((s, r) => s + r.total_value, 0);
    const totalBillableMins = timeByUser.reduce((s, r) => s + r.billable_minutes, 0);
    const totalMins = timeByUser.reduce((s, r) => s + r.total_minutes, 0);

    const exportHref = `/reports?export=csv&tab=${tab}` +
        (timeframe !== 'all' ? `&timeframe=${timeframe}` : '') +
        (timeframe === 'custom' && dateFrom ? `&date_from=${dateFrom}` : '') +
        (timeframe === 'custom' && dateTo ? `&date_to=${dateTo}` : '') +
        (matterId !== 'all' ? `&matter_id=${matterId}` : '') +
        (userId !== 'all' ? `&user_id=${userId}` : '') +
        (practiceArea !== 'all' ? `&practice_area=${practiceArea}` : '') +
        (status !== 'all' ? `&status=${status}` : '');

    return (
        <AppLayout title="Reports">
            <Head title="Reports" />

            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                <div>
                    <h1 className="text-2xl font-extrabold tracking-tight">Reports</h1>
                    <p className="text-sm text-muted-foreground mt-1">Financial, time and matter analytics — filter by timeframe, matter, and team.</p>
                </div>
                <Button variant="outline" className="gap-2 rounded-xl" asChild>
                    <a href={exportHref}><Download className="h-4 w-4" /> Export CSV</a>
                </Button>
            </div>

            {/* Enterprise Filter Bar */}
            <Card className="surface-card border border-border/60 mb-6">
                <CardContent className="p-4 space-y-4">
                    {/* Row 1: timeframe pills + custom dates */}
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                        <div className="space-y-2">
                            <Label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5"><Calendar className="h-3 w-3" /> Timeframe</Label>
                            <div className="flex flex-wrap gap-1.5">
                                {TIMEFRAMES.map(t => (
                                    <button key={t.value} onClick={() => setTimeframe(t.value)}
                                        className={cn('rounded-full px-3.5 py-1.5 text-xs font-medium border transition-colors whitespace-nowrap', timeframe === t.value ? 'bg-primary text-primary-foreground border-primary shadow-sm' : 'bg-muted text-muted-foreground border-transparent hover:bg-muted/80 hover:text-foreground')}>
                                        {t.label}
                                    </button>
                                ))}
                            </div>
                            {timeframe === 'custom' && (
                                <div className="flex gap-2 pt-1">
                                    <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-9 rounded-xl w-[160px]" />
                                    <span className="self-center text-muted-foreground">—</span>
                                    <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-9 rounded-xl w-[160px]" />
                                </div>
                            )}
                        </div>
                        <div className="flex gap-2 shrink-0">
                            <Button variant="ghost" onClick={clearFilters} disabled={!hasActiveFilters} className="h-9 rounded-xl gap-1 disabled:opacity-40"><X className="h-3.5 w-3.5" /> Clear</Button>
                        </div>
                    </div>

                    {/* Row 2: selects */}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Matter</Label>
                            <Select value={matterId} onValueChange={setMatterId}>
                                <SelectTrigger className="h-9 rounded-xl"><SelectValue placeholder="All matters" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All matters</SelectItem>
                                    {filterOptions.matters.map(m => <SelectItem key={m.id} value={m.id}>{m.matter_number} — {m.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Team Member</Label>
                            <Select value={userId} onValueChange={setUserId}>
                                <SelectTrigger className="h-9 rounded-xl"><SelectValue placeholder="All users" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All users</SelectItem>
                                    {filterOptions.users.map(u => <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Practice Area</Label>
                            <Select value={practiceArea} onValueChange={setPracticeArea}>
                                <SelectTrigger className="h-9 rounded-xl"><SelectValue placeholder="All areas" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All areas</SelectItem>
                                    {Object.entries(PRACTICE_AREA_LABELS).map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Status</Label>
                            <Select value={status} onValueChange={setStatus}>
                                <SelectTrigger className="h-9 rounded-xl"><SelectValue placeholder="All statuses" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All statuses</SelectItem>
                                    <SelectItem value="draft">Draft</SelectItem><SelectItem value="sent">Sent</SelectItem><SelectItem value="partial">Partial</SelectItem>
                                    <SelectItem value="paid">Paid</SelectItem><SelectItem value="written_off">Written Off</SelectItem><SelectItem value="cancelled">Cancelled</SelectItem>
                                    <SelectItem value="open">Open (matters)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {activeChips.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                            {activeChips.map((c, i) => (
                                <Badge key={i} variant="secondary" className="gap-1 pr-1 rounded-full">
                                    {c.label}
                                    <button onClick={c.onClear} className="ml-1 rounded-full p-0.5 hover:bg-black/10"><X className="h-3 w-3" /></button>
                                </Badge>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Tab bar */}
            <div className="flex gap-2 mb-6 border-b border-border/60 overflow-x-auto">
                {TABS.map((t) => (
                    <button key={t.key} onClick={() => handleTabSwitch(t.key)}
                        className={cn('flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors', tab === t.key ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}>
                        <t.icon className="h-4 w-4" /> {t.label}
                    </button>
                ))}
            </div>

            {tab === 'financial' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-6">
                        {[
                            { label: 'Total Invoiced', value: formatCurrency(financialSummary.total_invoiced), sub: hasActiveFilters ? 'Filtered' : 'All time', icon: PoundSterling, iconBg: 'bg-blue-50', iconColor: 'text-blue-600' },
                            { label: 'Total Collected', value: formatCurrency(financialSummary.total_collected), sub: 'Payments received', icon: TrendingUp, iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600' },
                            { label: 'Outstanding', value: formatCurrency(financialSummary.total_outstanding), sub: 'Sent + Partial', icon: BarChart3, iconBg: 'bg-amber-50', iconColor: 'text-amber-600' },
                            { label: 'Collection Rate', value: financialSummary.total_invoiced > 0 ? `${Math.round(financialSummary.total_collected / financialSummary.total_invoiced * 100)}%` : '—', sub: 'Collected / Invoiced', icon: PieChart, iconBg: 'bg-slate-100', iconColor: 'text-slate-600' },
                        ].map((s) => (
                            <div key={s.label} className="rounded-xl border border-border/60 bg-card p-5 flex items-center justify-between shadow-sm">
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">{s.label}</p>
                                    <p className="text-xl font-extrabold tracking-tight tabular-nums mt-1.5 leading-none text-foreground">{s.value}</p>
                                    <p className="text-xs text-muted-foreground mt-1">{s.sub}</p>
                                </div>
                                <div className={cn('flex h-10 w-10 items-center justify-center rounded-full shrink-0', s.iconBg)}>
                                    <s.icon className={cn('h-5 w-5', s.iconColor)} />
                                </div>
                            </div>
                        ))}
                    </div>

                    <Card className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">
                        <CardHeader className="flex flex-row items-center justify-between pb-3">
                            <CardTitle className="text-base">Invoices by Matter</CardTitle>
                            <Badge variant="secondary" className="rounded-full">{financialSummary.invoices_by_matter.length} matters</Badge>
                        </CardHeader>
                        <CardContent className="p-0">
                            {financialSummary.invoices_by_matter.length === 0 ? (
                                <div className="py-16 text-center"><Briefcase className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" /><p className="text-sm text-muted-foreground">No invoice data for these filters.</p><Button variant="ghost" size="sm" onClick={clearFilters} className="mt-3">Clear filters</Button></div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader><TableHeaderRow><TableHead>Matter</TableHead><TableHead className="text-right">Invoices</TableHead><TableHead className="text-right">Total</TableHead><TableHead className="text-right">Collected</TableHead><TableHead className="text-right">Outstanding</TableHead><TableHead className="hidden lg:table-cell w-24"></TableHead></TableHeaderRow></TableHeader>
                                        <TableBody>
                                            {financialSummary.invoices_by_matter.map((row) => {
                                                const pct = row.total_amount > 0 ? Math.min(100, Math.round(row.collected_amount / row.total_amount * 100)) : 0;
                                                return (
                                                    <TableRow key={row.matter_id}>
                                                        <TableCell><span className="font-medium text-sm">{row.matter ? `${row.matter.matter_number} — ${row.matter.name}` : row.matter_id.slice(0,8)}</span></TableCell>
                                                        <TableCell className="text-right text-muted-foreground">{row.count}</TableCell>
                                                        <TableCell className="text-right font-medium tabular-nums">{formatCurrency(row.total_amount)}</TableCell>
                                                        <TableCell className="text-right text-success tabular-nums">{formatCurrency(row.collected_amount)}</TableCell>
                                                        <TableCell className="text-right text-warning tabular-nums">{formatCurrency(row.outstanding_amount)}</TableCell>
                                                        <TableCell className="hidden lg:table-cell"><div className="h-1.5 bg-muted rounded-full overflow-hidden w-20 ml-auto"><div className="h-full bg-success rounded-full" style={{ width: `${pct}%` }} /></div></TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}

            {tab === 'time' && (
                <Card className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div><CardTitle className="text-base">Time by User</CardTitle><p className="text-xs text-muted-foreground mt-1">Billable utilisation and value — {timeByUser.length} active {timeByUser.length===1?'member':'members'} {hasActiveFilters && '· filtered'}</p></div>
                        <Badge variant="secondary" className="rounded-full">{formatCurrency(totalTimeValue)} total</Badge>
                    </CardHeader>
                    <CardContent className="p-0">
                        {timeByUser.length === 0 ? (
                            <div className="py-16 text-center"><Clock className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" /><p className="text-sm text-muted-foreground">No time entries for these filters.</p></div>
                        ) : (
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader><TableHeaderRow><TableHead>User</TableHead><TableHead className="text-right">Total</TableHead><TableHead className="text-right">Billable</TableHead><TableHead className="text-right">Utilisation</TableHead><TableHead className="text-right">Total Value</TableHead></TableHeaderRow></TableHeader>
                                    <TableBody>
                                        {timeByUser.map((row) => {
                                            const pct = row.total_minutes > 0 ? Math.round(row.billable_minutes / row.total_minutes * 100) : 0;
                                            return (
                                                <TableRow key={row.user_id}>
                                                    <TableCell>
                                                        <div className="flex items-center gap-3">
                                                            <div className="h-8 w-8 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-bold">{row.full_name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()}</div>
                                                            <span className="font-medium text-sm">{row.full_name}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right text-muted-foreground tabular-nums">{formatDuration(row.total_minutes)}</TableCell>
                                                    <TableCell className="text-right text-muted-foreground tabular-nums">{formatDuration(row.billable_minutes)}</TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <div className="h-1.5 w-16 bg-muted rounded-full overflow-hidden hidden sm:block"><div className={cn('h-full rounded-full', pct>=80?'bg-success':pct>=50?'bg-warning':'bg-muted-foreground')} style={{ width: `${pct}%` }} /></div>
                                                            <Badge variant={pct >= 80 ? 'success' : pct >= 50 ? 'warning' : 'secondary'} className="text-xs rounded-full">{pct}%</Badge>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right font-medium tabular-nums">{formatCurrency(row.total_value)}</TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                    <TableFooter><TableRow className="border-t-2 font-semibold"><TableCell>Total</TableCell><TableCell className="text-right tabular-nums">{formatDuration(totalMins)}</TableCell><TableCell className="text-right tabular-nums">{formatDuration(totalBillableMins)}</TableCell><TableCell className="text-right"><Badge variant="secondary" className="rounded-full">{totalMins>0?Math.round(totalBillableMins/totalMins*100):0}% avg</Badge></TableCell><TableCell className="text-right tabular-nums">{formatCurrency(totalTimeValue)}</TableCell></TableRow></TableFooter>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {tab === 'matters' && (
                <Card className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">
                    <CardHeader><CardTitle className="text-base">Open Matters by Practice Area</CardTitle></CardHeader>
                    <CardContent className="p-6">
                        {mattersByPracticeArea.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No open matters for these filters.</p>
                        ) : (
                            <div className="space-y-3">
                                {mattersByPracticeArea.map((row) => (
                                    <div key={row.practice_area} className="group flex items-center gap-4 p-2 -mx-2 rounded-xl hover:bg-muted/40 transition-colors">
                                        <span className="text-sm font-medium min-w-[140px]">{PRACTICE_AREA_LABELS[row.practice_area] ?? row.practice_area ?? 'Unspecified'}</span>
                                        <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden"><div className="h-full bg-primary rounded-full transition-all" style={{ width: `${(row.count / maxMattersCount) * 100}%` }} /></div>
                                        <span className="text-sm text-muted-foreground tabular-nums w-20 text-right">{row.count} {row.count === 1 ? 'matter' : 'matters'}</span>
                                        <span className="text-xs text-muted-foreground w-12 text-right">{Math.round(row.count / mattersByPracticeArea.reduce((s,r)=>s+r.count,0)*100)}%</span>
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