import { Head, Link, useForm } from '@inertiajs/react';
import { useState, useMemo, useCallback, useRef } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Plus, Trash2, Clock, Receipt, PlusCircle, Send, Save } from 'lucide-react';
import { cn, formatCurrency, formatDuration } from '@/lib/utils';
import type { Matter, TimeEntry, Expense } from '@/types';

interface MatterWithContacts extends Matter {
    contacts?: { id: string; name: string; pivot?: { role: string } }[];
}

interface Props {
    matters: MatterWithContacts[];
    unbilledTime: TimeEntry[];
    unbilledExpenses: Expense[];
    nextInvoiceNumber: string;
    firmVatRate: number;
    paymentTermsDays: number;
}

interface LineItem {
    id: string;
    description: string;
    quantity: number;
    unit_rate: number;
    amount: number;
    vat_amount: number;
    type: 'time' | 'expense' | 'fixed';
    source_id?: string;
}

function dueDate(days: number): string {
    return new Date(Date.now() + days * 86400000).toISOString().split('T')[0];
}

export default function CreateInvoice({ matters, unbilledTime, unbilledExpenses, nextInvoiceNumber, firmVatRate, paymentTermsDays }: Props) {
    const { data, setData, post, processing, errors, transform } = useForm({
        matter_id:           '',
        invoice_number:      nextInvoiceNumber,
        issue_date:          new Date().toISOString().split('T')[0],
        due_date:            dueDate(paymentTermsDays),
        vat_rate:            firmVatRate,
        line_items:          [] as LineItem[],
        discount_amount:     0,
        discount_reason:     '',
        notes:               '',
        bill_time_entry_ids: [] as string[],
        bill_expense_ids:    [] as string[],
        action:              'draft' as 'draft' | 'send',
    });

    const actionRef = useRef<'draft' | 'send'>('draft');

    const [selectedMatter, setSelectedMatter] = useState<MatterWithContacts | null>(null);

    const subtotal    = useMemo(() => data.line_items.reduce((s, i) => s + i.amount, 0), [data.line_items]);
    const vatTotal    = useMemo(() => data.line_items.reduce((s, i) => s + i.vat_amount, 0), [data.line_items]);
    const discount    = data.discount_amount || 0;
    const grandTotal  = Math.max(0, subtotal + vatTotal - discount);

    const matterTime     = useMemo(() => selectedMatter ? unbilledTime.filter(t => t.matter_id === selectedMatter.id) : [], [selectedMatter, unbilledTime]);
    const matterExpenses = useMemo(() => selectedMatter ? unbilledExpenses.filter(e => e.matter_id === selectedMatter.id) : [], [selectedMatter, unbilledExpenses]);

    const clientName = useMemo(() => {
        if (!selectedMatter?.contacts?.length) return null;
        const clients = selectedMatter.contacts.filter(c => ['client','claimant','applicant'].includes(c.pivot?.role ?? ''));
        const list = clients.length ? clients : selectedMatter.contacts;
        return list.map(c => c.name).join(', ');
    }, [selectedMatter]);

    const handleMatterChange = (matterId: string) => {
        const m = matters.find(x => x.id === matterId) ?? null;
        setData({ ...data, matter_id: matterId, line_items: [], bill_time_entry_ids: [], bill_expense_ids: [] });
        setSelectedMatter(m);
    };

    const recomputeVat = useCallback((items: LineItem[], rate: number): LineItem[] =>
        items.map(i => ({ ...i, vat_amount: round2(i.amount * rate / 100) })),
    []);

    const handleVatChange = (rate: number) => {
        setData({ ...data, vat_rate: rate, line_items: recomputeVat(data.line_items, rate) });
    };

    const handleTermsChange = (days: string) => {
        setData('due_date', dueDate(parseInt(days)));
    };

    const ACTIVITY_LABELS: Record<string, string> = {
        advising: 'Advising', drafting: 'Drafting', research: 'Research',
        court_attendance: 'Court Attendance', travel: 'Travel', telephone: 'Telephone',
        correspondence: 'Correspondence', meeting: 'Meeting', other: 'Other',
    };

    const timeEntryDescription = (entry: TimeEntry): string => {
        const solicitor = entry.user?.full_name ?? '';
        const activity  = ACTIVITY_LABELS[entry.activity_type] ?? entry.activity_type ?? '';
        const duration  = formatDuration(entry.duration_minutes);
        const rate      = Number(entry.rate) || 0;
        const parts: string[] = [];
        if (solicitor) parts.push(solicitor);
        if (activity)  parts.push(activity);
        const label = parts.join(' – ');
        return entry.description
            ? `${label ? label + ': ' : ''}${entry.description} (${duration} @ ${formatCurrency(rate)}/hr)`
            : `${label} (${duration} @ ${formatCurrency(rate)}/hr)`;
    };

    const mkItem = (overrides: Partial<LineItem>): LineItem => ({
        id: Math.random().toString(36).slice(2, 11),
        description: '', quantity: 1, unit_rate: 0, amount: 0, vat_amount: 0, type: 'fixed',
        ...overrides,
        vat_amount: round2((overrides.amount ?? 0) * data.vat_rate / 100),
    });

    const addTimeEntry = (entry: TimeEntry) => {
        const hours  = round2(entry.duration_minutes / 60);
        const rate   = Number(entry.rate) || 0;
        const amount = round2((entry.duration_minutes / 60) * rate);
        const item   = mkItem({ description: timeEntryDescription(entry), quantity: hours, unit_rate: rate, amount, type: 'time', source_id: entry.id });
        setData({
            ...data,
            line_items:          [...data.line_items, item],
            bill_time_entry_ids: [...data.bill_time_entry_ids, entry.id],
        });
    };

    const addAllTime = () => {
        const toAdd  = matterTime.filter(e => !data.bill_time_entry_ids.includes(e.id));
        const items  = toAdd.map(e => {
            const hours  = round2(e.duration_minutes / 60);
            const rate   = Number(e.rate) || 0;
            const amount = round2((e.duration_minutes / 60) * rate);
            return mkItem({ description: timeEntryDescription(e), quantity: hours, unit_rate: rate, amount, type: 'time', source_id: e.id });
        });
        setData({
            ...data,
            line_items:          [...data.line_items, ...items],
            bill_time_entry_ids: [...data.bill_time_entry_ids, ...toAdd.map(e => e.id)],
        });
    };

    const addExpense = (expense: Expense) => {
        const amount = Number(expense.amount);
        const item   = mkItem({ description: expense.description, quantity: 1, unit_rate: amount, amount, type: 'expense', source_id: expense.id });
        setData({
            ...data,
            line_items:       [...data.line_items, item],
            bill_expense_ids: [...data.bill_expense_ids, expense.id],
        });
    };

    const addAllExpenses = () => {
        const toAdd = matterExpenses.filter(e => !data.bill_expense_ids.includes(e.id));
        const items = toAdd.map(e => {
            const amount = Number(e.amount);
            return mkItem({ description: e.description, quantity: 1, unit_rate: amount, amount, type: 'expense', source_id: e.id });
        });
        setData({
            ...data,
            line_items:       [...data.line_items, ...items],
            bill_expense_ids: [...data.bill_expense_ids, ...toAdd.map(e => e.id)],
        });
    };

    const addFixedFee = () => {
        setData('line_items', [...data.line_items, mkItem({ type: 'fixed' })]);
    };

    const updateLineItem = (id: string, updates: Partial<LineItem>) => {
        setData('line_items', data.line_items.map(item => {
            if (item.id !== id) return item;
            const u = { ...item, ...updates };
            if (updates.quantity !== undefined || updates.unit_rate !== undefined) {
                u.amount     = round2(u.quantity * u.unit_rate);
                u.vat_amount = round2(u.amount * data.vat_rate / 100);
            }
            return u;
        }));
    };

    const removeLineItem = (id: string) => {
        const item = data.line_items.find(i => i.id === id);
        if (item?.source_id) {
            if (item.type === 'time')    setData('bill_time_entry_ids', data.bill_time_entry_ids.filter(x => x !== item.source_id));
            if (item.type === 'expense') setData('bill_expense_ids',    data.bill_expense_ids.filter(x => x !== item.source_id));
        }
        setData('line_items', data.line_items.filter(i => i.id !== id));
    };

    const submit = (action: 'draft' | 'send') => (e: React.FormEvent) => {
        e.preventDefault();
        actionRef.current = action;
        transform((d) => ({ ...d, action: actionRef.current }));
        post('/billing');
    };

    const TYPE_COLOURS: Record<string, string> = {
        time:    'bg-blue-100 text-blue-700',
        expense: 'bg-amber-100 text-amber-700',
        fixed:   'bg-purple-100 text-purple-700',
    };
    const TYPE_LABELS: Record<string, string> = { time: 'Time', expense: 'Expense', fixed: 'Fixed' };

    return (
        <AppLayout title="New Invoice">
            <Head title="New Invoice" />

            <div className="max-w-5xl mx-auto">
                <div className="mb-6">
                    <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                        <Link href="/billing">
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back to Billing
                        </Link>
                    </Button>
                </div>

                <form className="space-y-5">
                    {/* ── Invoice Details ── */}
                    <Card className="surface-card">
                        <CardHeader className="pb-4">
                            <CardTitle className="text-lg tracking-tight">Invoice Details</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-5">
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label>Matter *</Label>
                                    <Select value={data.matter_id || '_none'} onValueChange={(v) => handleMatterChange(v === '_none' ? '' : v)}>
                                        <SelectTrigger className="h-10"><SelectValue placeholder="Select matter…" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="_none">Select matter…</SelectItem>
                                            {matters.map(m => {
                                                const clients = (m.contacts ?? []).filter(c => ['client','claimant','applicant'].includes(c.pivot?.role ?? ''));
                                                const label   = clients.length ? clients.map(c => c.name).join(', ') : (m.contacts?.[0]?.name ?? '');
                                                return (
                                                    <SelectItem key={m.id} value={m.id}>
                                                        {m.matter_number} — {m.name}{label ? ` (${label})` : ''}
                                                    </SelectItem>
                                                );
                                            })}
                                        </SelectContent>
                                    </Select>
                                    {selectedMatter && clientName && (
                                        <p className="text-xs text-muted-foreground">Client: <span className="font-medium">{clientName}</span></p>
                                    )}
                                    {errors.matter_id && <p className="text-xs text-destructive">{errors.matter_id}</p>}
                                </div>

                                <div className="space-y-2">
                                    <Label>Invoice Number *</Label>
                                    <Input value={data.invoice_number} onChange={e => setData('invoice_number', e.target.value)} className="h-10" />
                                    {errors.invoice_number && <p className="text-xs text-destructive">{errors.invoice_number}</p>}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                                <div className="space-y-2">
                                    <Label>Issue Date</Label>
                                    <Input type="date" value={data.issue_date} onChange={e => setData('issue_date', e.target.value)} className="h-10" />
                                </div>

                                <div className="space-y-2">
                                    <Label>Payment Terms</Label>
                                    <Select defaultValue={String(paymentTermsDays)} onValueChange={handleTermsChange}>
                                        <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="7">7 days</SelectItem>
                                            <SelectItem value="14">14 days</SelectItem>
                                            <SelectItem value="30">30 days</SelectItem>
                                            <SelectItem value="60">60 days</SelectItem>
                                            <SelectItem value="90">90 days</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label>Due Date *</Label>
                                    <Input type="date" value={data.due_date} onChange={e => setData('due_date', e.target.value)} className="h-10" />
                                    {errors.due_date && <p className="text-xs text-destructive">{errors.due_date}</p>}
                                </div>

                                <div className="space-y-2">
                                    <Label>VAT Rate (%)</Label>
                                    <Input type="number" step="0.01" min="0" max="100" value={data.vat_rate} onChange={e => handleVatChange(parseFloat(e.target.value) || 0)} className="h-10" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* ── Unbilled Items ── */}
                    {selectedMatter && (matterTime.length > 0 || matterExpenses.length > 0) && (
                        <Card className="surface-card">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base tracking-tight">Unbilled Items</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {matterTime.length > 0 && (
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <p className="text-sm font-semibold">Time Entries
                                                <span className="ml-2 text-xs text-muted-foreground font-normal">
                                                    {matterTime.length} entries · {formatCurrency(matterTime.reduce((s, e) => s + Number(e.amount), 0))}
                                                </span>
                                            </p>
                                            {matterTime.some(e => !data.bill_time_entry_ids.includes(e.id)) && (
                                                <Button type="button" variant="outline" size="sm" onClick={addAllTime} className="gap-1 h-7 text-xs">
                                                    <PlusCircle className="h-3.5 w-3.5" />
                                                    Add All
                                                </Button>
                                            )}
                                        </div>
                                        <div className="rounded-md border divide-y divide-border/50">
                                            {matterTime.map(entry => {
                                                const added = data.bill_time_entry_ids.includes(entry.id);
                                                return (
                                                    <div key={entry.id} className={cn('flex items-center justify-between px-3 py-2.5', added && 'opacity-50')}>
                                                        <div className="flex items-center gap-3 min-w-0">
                                                            <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                                            <div className="min-w-0">
                                                                <p className="text-sm font-medium truncate">{entry.description || 'Legal services'}</p>
                                                                <p className="text-xs text-muted-foreground">
                                                                    {entry.user?.full_name} · {formatDuration(entry.duration_minutes)} · {formatCurrency(Number(entry.rate))}/hr
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-3 shrink-0 ml-3">
                                                            <span className="text-sm font-semibold">{formatCurrency(Number(entry.amount))}</span>
                                                            <Button type="button" variant={added ? 'secondary' : 'outline'} size="sm" className="h-7 text-xs"
                                                                onClick={() => !added && addTimeEntry(entry)} disabled={added}>
                                                                {added ? '✓ Added' : 'Add'}
                                                            </Button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {matterExpenses.length > 0 && (
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <p className="text-sm font-semibold">Expenses
                                                <span className="ml-2 text-xs text-muted-foreground font-normal">
                                                    {matterExpenses.length} items · {formatCurrency(matterExpenses.reduce((s, e) => s + Number(e.amount), 0))}
                                                </span>
                                            </p>
                                            {matterExpenses.some(e => !data.bill_expense_ids.includes(e.id)) && (
                                                <Button type="button" variant="outline" size="sm" onClick={addAllExpenses} className="gap-1 h-7 text-xs">
                                                    <PlusCircle className="h-3.5 w-3.5" />
                                                    Add All
                                                </Button>
                                            )}
                                        </div>
                                        <div className="rounded-md border divide-y divide-border/50">
                                            {matterExpenses.map(expense => {
                                                const added = data.bill_expense_ids.includes(expense.id);
                                                return (
                                                    <div key={expense.id} className={cn('flex items-center justify-between px-3 py-2.5', added && 'opacity-50')}>
                                                        <div className="flex items-center gap-3 min-w-0">
                                                            <Receipt className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                                            <div className="min-w-0">
                                                                <p className="text-sm font-medium truncate">{expense.description}</p>
                                                                <p className="text-xs text-muted-foreground">{expense.vendor ?? ''}</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-3 shrink-0 ml-3">
                                                            <span className="text-sm font-semibold">{formatCurrency(Number(expense.amount))}</span>
                                                            <Button type="button" variant={added ? 'secondary' : 'outline'} size="sm" className="h-7 text-xs"
                                                                onClick={() => !added && addExpense(expense)} disabled={added}>
                                                                {added ? '✓ Added' : 'Add'}
                                                            </Button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {selectedMatter && matterTime.length === 0 && matterExpenses.length === 0 && (
                        <p className="text-sm text-muted-foreground px-1">No unbilled billable items for this matter.</p>
                    )}

                    {/* ── Line Items ── */}
                    <Card className="surface-card">
                        <CardHeader className="pb-3 flex flex-row items-center justify-between">
                            <CardTitle className="text-base tracking-tight">Line Items</CardTitle>
                            <Button type="button" variant="outline" size="sm" onClick={addFixedFee} className="gap-1">
                                <Plus className="h-4 w-4" />
                                Add Fixed Item
                            </Button>
                        </CardHeader>
                        <CardContent>
                            {data.line_items.length === 0 ? (
                                <div className="text-center py-8 text-sm text-muted-foreground">
                                    No line items yet.<br />
                                    Add from unbilled items above, or add a fixed fee item.
                                </div>
                            ) : (
                                <>
                                    {/* Headers */}
                                    <div className="grid grid-cols-12 gap-2 mb-1 px-1">
                                        <div className="col-span-1" />
                                        <div className="col-span-4 text-xs font-medium text-muted-foreground uppercase tracking-wide">Description</div>
                                        <div className="col-span-2 text-xs font-medium text-muted-foreground uppercase tracking-wide text-right">Qty / Hrs</div>
                                        <div className="col-span-2 text-xs font-medium text-muted-foreground uppercase tracking-wide text-right">Rate (£)</div>
                                        <div className="col-span-2 text-xs font-medium text-muted-foreground uppercase tracking-wide text-right">Amount</div>
                                        <div className="col-span-1" />
                                    </div>
                                    <div className="space-y-2">
                                        {data.line_items.map(item => (
                                            <div key={item.id} className="grid grid-cols-12 gap-2 items-center p-2.5 bg-muted/30 rounded-md border border-border/40">
                                                <div className="col-span-1 flex justify-center">
                                                    <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-semibold', TYPE_COLOURS[item.type])}>
                                                        {TYPE_LABELS[item.type]}
                                                    </span>
                                                </div>
                                                <div className="col-span-4">
                                                    <Input
                                                        placeholder="Description"
                                                        value={item.description}
                                                        onChange={e => updateLineItem(item.id, { description: e.target.value })}
                                                        className="h-9 text-sm"
                                                    />
                                                </div>
                                                <div className="col-span-2">
                                                    <Input
                                                        type="number" step="0.01" min="0"
                                                        value={round2(item.quantity)}
                                                        onChange={e => updateLineItem(item.id, { quantity: parseFloat(e.target.value) || 0 })}
                                                        className="h-9 text-sm text-right"
                                                    />
                                                </div>
                                                <div className="col-span-2">
                                                    <Input
                                                        type="number" step="0.01" min="0"
                                                        value={item.unit_rate}
                                                        onChange={e => updateLineItem(item.id, { unit_rate: parseFloat(e.target.value) || 0 })}
                                                        className="h-9 text-sm text-right"
                                                    />
                                                </div>
                                                <div className="col-span-2 text-right pr-1">
                                                    <span className="text-sm font-semibold tabular-nums">{formatCurrency(item.amount)}</span>
                                                    {data.vat_rate > 0 && (
                                                        <p className="text-xs text-muted-foreground">+{formatCurrency(item.vat_amount)} VAT</p>
                                                    )}
                                                </div>
                                                <div className="col-span-1 flex justify-end">
                                                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                        onClick={() => removeLineItem(item.id)}>
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </CardContent>
                    </Card>

                    {/* ── Totals + Discount ── */}
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                        {/* Notes */}
                        <Card className="surface-card">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base tracking-tight">Notes</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Textarea
                                    value={data.notes}
                                    onChange={e => setData('notes', e.target.value)}
                                    placeholder="Payment details, bank account, terms, etc."
                                    rows={4}
                                    className="resize-none text-sm"
                                />
                            </CardContent>
                        </Card>

                        {/* Summary */}
                        <Card className="surface-card">
                            <CardContent className="p-5 space-y-3">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Subtotal</span>
                                    <span className="font-medium tabular-nums">{formatCurrency(subtotal)}</span>
                                </div>
                                {data.vat_rate > 0 && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">VAT ({data.vat_rate}%)</span>
                                        <span className="font-medium tabular-nums">{formatCurrency(vatTotal)}</span>
                                    </div>
                                )}

                                {/* Discount row */}
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-muted-foreground shrink-0">Discount (£)</span>
                                    <Input
                                        type="number" step="0.01" min="0"
                                        value={data.discount_amount || ''}
                                        onChange={e => setData('discount_amount', parseFloat(e.target.value) || 0)}
                                        placeholder="0.00"
                                        className="h-8 text-sm text-right w-28 ml-auto"
                                    />
                                </div>
                                {data.discount_amount > 0 && (
                                    <Input
                                        value={data.discount_reason}
                                        onChange={e => setData('discount_reason', e.target.value)}
                                        placeholder="Reason for discount…"
                                        className="h-8 text-sm"
                                    />
                                )}

                                <Separator />
                                <div className="flex justify-between text-lg font-bold">
                                    <span>Total</span>
                                    <span className="text-primary tabular-nums">{formatCurrency(grandTotal)}</span>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* ── Actions ── */}
                    <div className="flex gap-3 justify-end pb-6">
                        <Button type="button" variant="outline" asChild>
                            <Link href="/billing">Cancel</Link>
                        </Button>
                        <Button
                            type="submit"
                            variant="outline"
                            disabled={processing || data.line_items.length === 0 || !data.matter_id}
                            onClick={submit('draft')}
                            className="gap-2"
                        >
                            <Save className="h-4 w-4" />
                            {processing && data.action === 'draft' ? 'Saving…' : 'Save as Draft'}
                        </Button>
                        <Button
                            type="submit"
                            disabled={processing || data.line_items.length === 0 || !data.matter_id}
                            onClick={submit('send')}
                            className="gap-2"
                        >
                            <Send className="h-4 w-4" />
                            {processing && data.action === 'send' ? 'Creating…' : 'Create & Mark Sent'}
                        </Button>
                    </div>
                </form>
            </div>
        </AppLayout>
    );
}

function round2(n: number): number { return Math.round(n * 100) / 100; }
