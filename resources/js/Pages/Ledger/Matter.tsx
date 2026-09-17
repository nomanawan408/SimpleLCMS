import { useState } from 'react';
import { Head, Link, router, usePage } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import {
    Table, TableHeader, TableHeaderRow, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn, formatCurrency, formatDate, hasPermission } from '@/lib/utils';
import { ArrowLeft, Plus, Minus, ArrowRightLeft, Undo2 } from 'lucide-react';
import type { LedgerPosting, PageProps } from '@/types';

interface Props {
    matter: { id: string; name: string; matter_number: string; status: string };
    postings: LedgerPosting[];
    balances: { client: string; office: string };
}

type EntryKind = 'client_receipt' | 'client_payment' | 'client_to_office_transfer';

const KIND_META: Record<EntryKind, { title: string; submit: string; needsReference: boolean }> = {
    client_receipt: { title: 'Record Client Receipt', submit: 'Post Receipt', needsReference: false },
    client_payment: { title: 'Record Client Payment', submit: 'Post Payment', needsReference: false },
    client_to_office_transfer: { title: 'Transfer to Office', submit: 'Post Transfer', needsReference: true },
};

const TXN_LABEL: Record<string, string> = {
    client_receipt: 'Receipt',
    client_payment: 'Payment',
    client_to_office_transfer: 'Transfer',
    reversal: 'Reversal',
};

function gbp(value: string | number): string {
    return formatCurrency(typeof value === 'string' ? parseFloat(value) : value);
}

export default function MatterLedger({ matter, postings, balances }: Props) {
    const { auth } = usePage<PageProps>().props;
    const canPost = hasPermission(auth.user?.permissions, 'post_ledger');
    const canTransfer = hasPermission(auth.user?.permissions, 'transfer_client_funds');
    const canReverse = hasPermission(auth.user?.permissions, 'reverse_ledger_entries');

    const [entryKind, setEntryKind] = useState<EntryKind | null>(null);
    const [form, setForm] = useState({ amount: '', transaction_date: new Date().toISOString().slice(0, 10), narrative: '', reference: '' });
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);
    const [reversingId, setReversingId] = useState<string | null>(null);
    const [reverseNarrative, setReverseNarrative] = useState('');

    const clientBalance = parseFloat(balances.client);
    const officeBalance = parseFloat(balances.office);

    function openEntry(kind: EntryKind) {
        setForm({ amount: '', transaction_date: new Date().toISOString().slice(0, 10), narrative: '', reference: '' });
        setFormErrors({});
        setEntryKind(kind);
    }

    function submitEntry() {
        if (!entryKind) return;
        setSaving(true);
        router.post('/ledger/entries', {
            matter_id: matter.id,
            transaction_type: entryKind,
            amount: form.amount,
            transaction_date: form.transaction_date,
            narrative: form.narrative,
            reference: form.reference || undefined,
        }, {
            preserveScroll: true,
            onSuccess: () => setEntryKind(null),
            onError: (errors) => setFormErrors(errors as Record<string, string>),
            onFinish: () => setSaving(false),
        });
    }

    function submitReversal() {
        if (!reversingId) return;
        setSaving(true);
        router.post(`/ledger/reversals/${reversingId}`, { narrative: reverseNarrative }, {
            preserveScroll: true,
            onSuccess: () => { setReversingId(null); setReverseNarrative(''); },
            onError: (errors) => setFormErrors(errors as Record<string, string>),
            onFinish: () => setSaving(false),
        });
    }

    const seenTxn = new Set<string>();

    return (
        <AppLayout title={`Ledger — ${matter.name}`}>
            <Head title={`Ledger — ${matter.name}`} />

            <div className="mb-6 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground hover:text-foreground">
                            <Link href={`/matters/${matter.id}`} className="inline-flex items-center gap-1.5">
                                <ArrowLeft className="h-4 w-4" />
                                {matter.matter_number}
                            </Link>
                        </Button>
                        <h1 className="text-2xl font-extrabold tracking-tight">Matter Ledger</h1>
                    </div>
                    <div className="flex items-center gap-2">
                        {canPost && (
                            <>
                                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => openEntry('client_receipt')}>
                                    <Plus className="h-4 w-4" />Receipt
                                </Button>
                                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => openEntry('client_payment')}>
                                    <Minus className="h-4 w-4" />Payment
                                </Button>
                            </>
                        )}
                        {canTransfer && (
                            <Button size="sm" className="gap-1.5" onClick={() => openEntry('client_to_office_transfer')}>
                                <ArrowRightLeft className="h-4 w-4" />Transfer to Office
                            </Button>
                        )}
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <span className={cn(
                        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold',
                        clientBalance < 0 ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700',
                    )}>
                        Client {gbp(balances.client)} {clientBalance < 0 ? 'DR' : 'CR'}
                    </span>
                    <span className={cn(
                        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold',
                        officeBalance < 0
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : 'border-amber-200 bg-amber-50 text-amber-800',
                    )}>
                        Office {gbp(Math.abs(officeBalance))} {officeBalance < 0 ? 'CR' : 'DR'}
                    </span>
                </div>
            </div>

            <Card className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">
                <CardContent className="p-0">
                    {postings.length === 0 ? (
                        <div className="py-16 text-center">
                            <p className="font-medium text-foreground mb-1">No ledger entries yet</p>
                            <p className="text-sm text-muted-foreground">Record the first receipt to open this matter&apos;s ledger.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table className="min-w-[900px]">
                                <TableHeader>
                                    <TableHeaderRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead className="min-w-[220px]">Details / Narrative</TableHead>
                                        <TableHead>Ref</TableHead>
                                        <TableHead>Type</TableHead>
                                        <TableHead className="text-right">Client DR</TableHead>
                                        <TableHead className="text-right">Client CR</TableHead>
                                        <TableHead className="text-right">Client Bal</TableHead>
                                        <TableHead className="text-right">Office DR</TableHead>
                                        <TableHead className="text-right">Office CR</TableHead>
                                        <TableHead className="text-right">Office Bal</TableHead>
                                        {canReverse && <TableHead><span className="sr-only">Actions</span></TableHead>}
                                    </TableHeaderRow>
                                </TableHeader>
                                <TableBody>
                                    {postings.map((posting) => {
                                        const txn = posting.transaction;
                                        const firstOfTxn = txn ? !seenTxn.has(txn.id) : true;
                                        if (txn) seenTxn.add(txn.id);
                                        const isClient = posting.account_type === 'matter_client';
                                        return (
                                            <TableRow key={posting.id} className={cn(txn?.transaction_type === 'reversal' && 'bg-muted/30')}>
                                                <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(posting.value_date)}</TableCell>
                                                <TableCell className="max-w-[260px]">
                                                    <p className="truncate text-sm text-foreground" title={txn?.narrative}>{txn?.narrative ?? '—'}</p>
                                                </TableCell>
                                                <TableCell className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">{txn?.reference ?? '—'}</TableCell>
                                                <TableCell>
                                                    <span className={cn(
                                                        'inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium',
                                                        txn?.transaction_type === 'reversal'
                                                            ? 'border-zinc-300 bg-zinc-100 text-zinc-600'
                                                            : 'border-border bg-muted/40 text-muted-foreground',
                                                    )}>
                                                        {TXN_LABEL[txn?.transaction_type ?? ''] ?? '—'}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-right tabular-nums">{isClient && posting.entry_type === 'debit' ? gbp(posting.amount) : '—'}</TableCell>
                                                <TableCell className="text-right tabular-nums">{isClient && posting.entry_type === 'credit' ? gbp(posting.amount) : '—'}</TableCell>
                                                <TableCell className="text-right tabular-nums font-medium">
                                                    {isClient && posting.balance_after !== null ? (
                                                        <>{gbp(posting.balance_after)} <span className="text-muted-foreground">{parseFloat(posting.balance_after) < 0 ? 'DR' : 'CR'}</span></>
                                                    ) : '—'}
                                                </TableCell>
                                                <TableCell className="text-right tabular-nums">{!isClient && posting.entry_type === 'debit' ? gbp(posting.amount) : '—'}</TableCell>
                                                <TableCell className="text-right tabular-nums">{!isClient && posting.entry_type === 'credit' ? gbp(posting.amount) : '—'}</TableCell>
                                                <TableCell className="text-right tabular-nums font-medium">
                                                    {!isClient && posting.balance_after !== null ? (
                                                        <>{gbp(Math.abs(parseFloat(posting.balance_after)))} <span className="text-muted-foreground">{parseFloat(posting.balance_after) < 0 ? 'CR' : 'DR'}</span></>
                                                    ) : '—'}
                                                </TableCell>
                                                {canReverse && (
                                                    <TableCell className="text-right">
                                                        {firstOfTxn && txn && (
                                                            <button
                                                                type="button"
                                                                title="Post reversing entry"
                                                                onClick={() => { setReversingId(txn.id); setReverseNarrative(''); setFormErrors({}); }}
                                                                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                                            >
                                                                <Undo2 className="h-3.5 w-3.5" />
                                                                Reverse
                                                            </button>
                                                        )}
                                                    </TableCell>
                                                )}
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Entry dialog */}
            <Dialog open={entryKind !== null} onOpenChange={(open) => { if (!open) setEntryKind(null); }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>{entryKind ? KIND_META[entryKind].title : ''}</DialogTitle>
                        <DialogDescription>{matter.name} · {matter.matter_number}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label htmlFor="ledger_amount">Amount (£)</Label>
                                <Input id="ledger_amount" inputMode="decimal" placeholder="0.00" value={form.amount} onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))} />
                                {formErrors.amount && <p className="text-xs text-destructive">{formErrors.amount}</p>}
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="ledger_date">Date</Label>
                                <Input id="ledger_date" type="date" max={new Date().toISOString().slice(0, 10)} value={form.transaction_date} onChange={(e) => setForm((p) => ({ ...p, transaction_date: e.target.value }))} />
                                {formErrors.transaction_date && <p className="text-xs text-destructive">{formErrors.transaction_date}</p>}
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="ledger_narrative">Narrative</Label>
                            <Textarea id="ledger_narrative" rows={2} placeholder="e.g. Funds received from PRs" value={form.narrative} onChange={(e) => setForm((p) => ({ ...p, narrative: e.target.value }))} />
                            {formErrors.narrative && <p className="text-xs text-destructive">{formErrors.narrative}</p>}
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="ledger_reference">
                                Reference {entryKind && KIND_META[entryKind].needsReference ? '(bill / invoice number — required)' : '(optional)'}
                            </Label>
                            <Input id="ledger_reference" placeholder="e.g. CHQ-501, BACS-99, INV-1024" value={form.reference} onChange={(e) => setForm((p) => ({ ...p, reference: e.target.value }))} />
                            {formErrors.reference && <p className="text-xs text-destructive">{formErrors.reference}</p>}
                        </div>
                        {formErrors.matter_id && <p className="text-xs text-destructive">{formErrors.matter_id}</p>}
                    </div>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setEntryKind(null)} disabled={saving}>Cancel</Button>
                        <Button onClick={submitEntry} disabled={saving || !form.amount || !form.narrative}>
                            {saving ? 'Posting…' : (entryKind ? KIND_META[entryKind].submit : 'Post')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Reversal dialog */}
            <Dialog open={reversingId !== null} onOpenChange={(open) => { if (!open) setReversingId(null); }}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Post reversing entry?</DialogTitle>
                        <DialogDescription>
                            A mirror entry is posted and linked. The original stays untouched for the audit trail.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-1.5 py-2">
                        <Label htmlFor="reverse_narrative">Reason</Label>
                        <Textarea id="reverse_narrative" rows={2} placeholder="e.g. Entered against the wrong matter" value={reverseNarrative} onChange={(e) => setReverseNarrative(e.target.value)} />
                        {formErrors.amount && <p className="text-xs text-destructive">{formErrors.amount}</p>}
                        {formErrors.narrative && <p className="text-xs text-destructive">{formErrors.narrative}</p>}
                    </div>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setReversingId(null)} disabled={saving}>Cancel</Button>
                        <Button onClick={submitReversal} disabled={saving || !reverseNarrative}>
                            {saving ? 'Posting…' : 'Post Reversal'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
