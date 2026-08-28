import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Table, TableHeader, TableHeaderRow, TableBody, TableFooter, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import { PoundSterling, TrendingUp, Clock, AlertCircle, Plus, CreditCard } from 'lucide-react';
import type { PaginatedData } from '@/types';

interface TransactionRow {
    id: string;
    amount: number;
    method: string;
    paid_at: string;
    notes: string | null;
    invoice: {
        id: string;
        invoice_number: string;
        total: number;
        status: string;
        matter: {
            id: string;
            name: string;
            matter_number: string;
            contacts?: { id: string; name: string }[];
        } | null;
    } | null;
}

interface OpenInvoice {
    id: string;
    invoice_number: string;
    total: number;
    status: string;
    matter_name: string;
    matter_number: string;
}

interface Props {
    transactions: PaginatedData<TransactionRow>;
    stats: {
        total_received: number;
        received_this_month: number;
        received_this_week: number;
        outstanding: number;
    };
    matters: { id: string; name: string; matter_number: string }[];
    openInvoices: OpenInvoice[];
    filters: { matter_id?: string; method?: string; date_from?: string; date_to?: string };
}

const METHOD_LABELS: Record<string, string> = {
    cash:          'Cash',
    cheque:        'Cheque',
    bank_transfer: 'Bank Transfer',
    stripe_card:   'Card Payment',
    stripe_sepa:   'Bank Debit (SEPA)',
};

const METHOD_COLOURS: Record<string, string> = {
    cash:          'bg-amber-100 text-amber-800',
    cheque:        'bg-blue-100 text-blue-800',
    bank_transfer: 'bg-green-100 text-green-800',
    stripe_card:   'bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary',
    stripe_sepa:   'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400',
};

export default function TransactionsIndex({ transactions, stats, matters, openInvoices, filters }: Props) {
    const [recordOpen, setRecordOpen] = useState(false);
    const [recForm, setRecForm] = useState({
        invoice_id: '',
        amount: '',
        method: 'bank_transfer',
        paid_at: new Date().toISOString().slice(0, 10),
        notes: '',
    });
    const [recSaving, setRecSaving] = useState(false);

    function setFilter(key: string, value: string) {
        const actual = value === '_all' ? '' : value;
        router.get('/transactions', { ...filters, [key]: actual || undefined }, { preserveState: true, replace: true });
    }

    function submitRecord() {
        if (!recForm.invoice_id || !recForm.amount || !recForm.paid_at) return;
        setRecSaving(true);
        router.post('/transactions', {
            invoice_id: recForm.invoice_id,
            amount:     parseFloat(recForm.amount),
            method:     recForm.method,
            paid_at:    recForm.paid_at,
            notes:      recForm.notes || undefined,
        }, {
            onFinish: () => {
                setRecSaving(false);
                setRecordOpen(false);
                setRecForm({ invoice_id: '', amount: '', method: 'bank_transfer', paid_at: new Date().toISOString().slice(0, 10), notes: '' });
            },
        });
    }

    const statsCards = [
        { label: 'Total Received',    value: formatCurrency(stats.total_received),      icon: PoundSterling, iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600' },
        { label: 'This Month',        value: formatCurrency(stats.received_this_month),  icon: TrendingUp,    iconBg: 'bg-blue-50', iconColor: 'text-blue-600' },
        { label: 'This Week',         value: formatCurrency(stats.received_this_week),   icon: Clock,         iconBg: 'bg-slate-100', iconColor: 'text-slate-600' },
        { label: 'Outstanding',       value: formatCurrency(stats.outstanding),          icon: AlertCircle,   iconBg: 'bg-amber-50', iconColor: 'text-amber-600' },
    ];

    return (
        <AppLayout title="Transactions">
            <Head title="Transactions" />

            <div className="flex items-center justify-between mb-6">
                <h1 className="text-[26px] font-extrabold tracking-tight">Transactions</h1>
                <Button onClick={() => setRecordOpen(true)} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Record Payment
                </Button>
            </div>

            {/* Stats - enterprise matter style */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 mb-6">
                {statsCards.map((s) => (
                    <div key={s.label} className="rounded-xl border border-border/60 bg-card p-5 flex items-center justify-between shadow-sm">
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">{s.label}</p>
                            <p className="text-[22px] font-extrabold tracking-tight tabular-nums mt-1.5 leading-none text-foreground">{s.value}</p>
                        </div>
                        <div className={cn('flex h-10 w-10 items-center justify-center rounded-full shrink-0', s.iconBg)}>
                            <s.icon className={cn('h-5 w-5', s.iconColor)} />
                        </div>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3 mb-4">
                <Select value={filters.matter_id || '_all'} onValueChange={(v) => setFilter('matter_id', v)}>
                    <SelectTrigger className="w-52 h-9"><SelectValue placeholder="All matters" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="_all">All matters</SelectItem>
                        {matters.map((m) => (
                            <SelectItem key={m.id} value={m.id}>{m.matter_number} — {m.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select value={filters.method || '_all'} onValueChange={(v) => setFilter('method', v)}>
                    <SelectTrigger className="w-44 h-9"><SelectValue placeholder="All methods" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="_all">All methods</SelectItem>
                        {Object.entries(METHOD_LABELS).map(([k, v]) => (
                            <SelectItem key={k} value={k}>{v}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Input
                    type="date" className="w-36 h-9" value={filters.date_from ?? ''}
                    onChange={(e) => setFilter('date_from', e.target.value)}
                />
                <Input
                    type="date" className="w-36 h-9" value={filters.date_to ?? ''}
                    onChange={(e) => setFilter('date_to', e.target.value)}
                />
            </div>

            {/* Table */}
            <Card className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">
                <CardContent className="p-0">
                    {transactions.data.length === 0 ? (
                        <div className="py-16 text-center">
                            <CreditCard className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                            <p className="text-sm text-muted-foreground mb-4">No transactions recorded yet.</p>
                            <Button size="sm" onClick={() => setRecordOpen(true)}>Record first payment</Button>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableHeaderRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Client</TableHead>
                                        <TableHead className="hidden md:table-cell">Matter</TableHead>
                                        <TableHead className="hidden lg:table-cell">Invoice</TableHead>
                                        <TableHead className="hidden md:table-cell">Method</TableHead>
                                        <TableHead className="text-right">Amount</TableHead>
                                        <TableHead className="hidden lg:table-cell">Notes</TableHead>
                                    </TableHeaderRow>
                                </TableHeader>
                                <TableBody>
                                    {transactions.data.map((tx) => {
                                        const contacts = tx.invoice?.matter?.contacts ?? [];
                                        const clientName = contacts.map((c) => c.full_name || c.name).join(', ') || '—';
                                        return (
                                            <TableRow key={tx.id}>
                                                <TableCell className="whitespace-nowrap text-muted-foreground">
                                                    {formatDate(tx.paid_at)}
                                                </TableCell>
                                                <TableCell>
                                                    <p className="font-medium text-sm">{clientName}</p>
                                                </TableCell>
                                                <TableCell className="hidden md:table-cell">
                                                    {tx.invoice?.matter ? (
                                                        <Link href={`/matters/${tx.invoice.matter.id}`} className="hover:text-primary transition-colors">
                                                            <p className="font-medium text-sm">{tx.invoice.matter.name}</p>
                                                            <p className="text-xs text-muted-foreground">{tx.invoice.matter.matter_number}</p>
                                                        </Link>
                                                    ) : '—'}
                                                </TableCell>
                                                <TableCell className="hidden lg:table-cell">
                                                    {tx.invoice ? (
                                                        <Link href={`/billing/${tx.invoice.id}`} className="text-primary hover:underline text-sm">
                                                            {tx.invoice.invoice_number}
                                                        </Link>
                                                    ) : '—'}
                                                </TableCell>
                                                <TableCell className="hidden md:table-cell">
                                                    <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium', METHOD_COLOURS[tx.method] ?? 'bg-muted text-muted-foreground')}>
                                                        {METHOD_LABELS[tx.method] ?? tx.method}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <span className="font-bold text-success text-sm">{formatCurrency(Number(tx.amount))}</span>
                                                </TableCell>
                                                <TableCell className="hidden lg:table-cell text-muted-foreground max-w-xs truncate">
                                                    {tx.notes || '—'}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                                <TableFooter>
                                    <TableRow className="font-semibold">
                                        <TableCell colSpan={5} className="text-right text-muted-foreground uppercase tracking-wide hidden md:table-cell">Page total</TableCell>
                                        <TableCell colSpan={3} className="text-right text-muted-foreground uppercase tracking-wide md:hidden">Page total</TableCell>
                                        <TableCell className="text-right text-success font-bold">
                                            {formatCurrency(transactions.data.reduce((s, t) => s + Number(t.amount), 0))}
                                        </TableCell>
                                        <TableCell className="hidden lg:table-cell" />
                                    </TableRow>
                                </TableFooter>
                            </Table>
                        </div>
                    )}

                    {/* Pagination */}
                    {transactions.last_page > 1 && (
                        <div className="flex items-center justify-between px-4 py-3 border-t">
                            <p className="text-sm text-muted-foreground">{transactions.from}–{transactions.to} of {transactions.total}</p>
                            <div className="flex gap-1">
                                {transactions.links.map((link, i) => (
                                    link.url ? (
                                        <Link key={i} href={link.url}
                                            className={cn('px-3 py-1.5 text-xs rounded border transition-colors', link.active ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted border-border')}
                                            dangerouslySetInnerHTML={{ __html: link.label }}
                                        />
                                    ) : (
                                        <span key={i} className="px-3 py-1.5 text-xs rounded border border-border text-muted-foreground opacity-40"
                                            dangerouslySetInnerHTML={{ __html: link.label }} />
                                    )
                                ))}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Record Payment Dialog */}
            <Dialog open={recordOpen} onOpenChange={setRecordOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Record Client Payment</DialogTitle>
                        <DialogDescription>Log a payment received against an invoice.</DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Invoice</Label>
                            {openInvoices.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No open invoices. <Link href="/billing/create" className="underline text-primary">Create one</Link> first.</p>
                            ) : (
                                <Select value={recForm.invoice_id || '_none'} onValueChange={(v) => {
                                    const inv = openInvoices.find((i) => i.id === v);
                                    setRecForm((p) => ({ ...p, invoice_id: v === '_none' ? '' : v, amount: inv ? String(inv.total) : p.amount }));
                                }}>
                                    <SelectTrigger className="h-10"><SelectValue placeholder="Select invoice…" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="_none">Select invoice…</SelectItem>
                                        {openInvoices.map((inv) => (
                                            <SelectItem key={inv.id} value={inv.id}>
                                                {inv.invoice_number} — {inv.matter_number} — {formatCurrency(inv.total)}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Amount (£)</Label>
                                <Input
                                    type="number" min="0.01" step="0.01"
                                    value={recForm.amount}
                                    onChange={(e) => setRecForm((p) => ({ ...p, amount: e.target.value }))}
                                    placeholder="0.00"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Date Received</Label>
                                <Input
                                    type="date"
                                    value={recForm.paid_at}
                                    onChange={(e) => setRecForm((p) => ({ ...p, paid_at: e.target.value }))}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Payment Method</Label>
                            <Select value={recForm.method} onValueChange={(v) => setRecForm((p) => ({ ...p, method: v }))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {Object.entries(METHOD_LABELS).map(([k, v]) => (
                                    <SelectItem key={k} value={k}>{v}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Notes (optional)</Label>
                            <Input
                                value={recForm.notes}
                                onChange={(e) => setRecForm((p) => ({ ...p, notes: e.target.value }))}
                                placeholder="Reference number, cheque no., etc."
                            />
                        </div>
                    </div>

                    <Separator />

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setRecordOpen(false)}>Cancel</Button>
                        <Button
                            disabled={recSaving || !recForm.invoice_id || !recForm.amount || !recForm.paid_at}
                            onClick={submitRecord}
                        >
                            {recSaving ? 'Saving…' : 'Record Payment'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
