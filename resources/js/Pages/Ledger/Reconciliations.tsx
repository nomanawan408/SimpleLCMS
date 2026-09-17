import { useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
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
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import { ArrowLeft, TriangleAlert, CircleCheck } from 'lucide-react';
import type { BankReconciliation, PaginatedData } from '@/types';

interface Props {
    reconciliations: PaginatedData<BankReconciliation>;
}

function gbp(value: string | number): string {
    return formatCurrency(typeof value === 'string' ? parseFloat(value) : value);
}

export default function Reconciliations({ reconciliations }: Props) {
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState({ as_at_date: new Date().toISOString().slice(0, 10), paper_statement_balance: '', notes: '' });
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);

    function submit() {
        setSaving(true);
        router.post('/ledger/reconciliations', {
            as_at_date: form.as_at_date,
            paper_statement_balance: form.paper_statement_balance,
            notes: form.notes || undefined,
        }, {
            preserveScroll: true,
            onSuccess: () => { setOpen(false); setForm((p) => ({ ...p, paper_statement_balance: '', notes: '' })); },
            onError: (errors) => setFormErrors(errors as Record<string, string>),
            onFinish: () => setSaving(false),
        });
    }

    return (
        <AppLayout title="SRA Reconciliation">
            <Head title="SRA Reconciliation" />

            <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground hover:text-foreground">
                        <Link href="/ledger/cash-sheet" className="inline-flex items-center gap-1.5">
                            <ArrowLeft className="h-4 w-4" />
                            Cash Sheet
                        </Link>
                    </Button>
                    <div>
                        <h1 className="text-2xl font-extrabold tracking-tight">5-Week Reconciliation</h1>
                        <p className="mt-0.5 text-sm text-muted-foreground">Bank statement = cash sheet = aggregate client ledgers (SRA Rule 8.5)</p>
                    </div>
                </div>
                <Button size="sm" className="gap-2" onClick={() => { setFormErrors({}); setOpen(true); }}>
                    Run Reconciliation
                </Button>
            </div>

            <Card className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">
                <CardContent className="p-0">
                    {reconciliations.data.length === 0 ? (
                        <div className="py-16 text-center">
                            <p className="font-medium text-foreground mb-1">No reconciliations yet</p>
                            <p className="text-sm text-muted-foreground">Run the first reconciliation against the paper bank statement.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table className="min-w-[920px]">
                                <TableHeader>
                                    <TableHeaderRow>
                                        <TableHead>As At</TableHead>
                                        <TableHead>Run On</TableHead>
                                        <TableHead>By</TableHead>
                                        <TableHead className="text-right">Paper Statement</TableHead>
                                        <TableHead className="text-right">Cash Sheet</TableHead>
                                        <TableHead className="text-right">Client Ledgers</TableHead>
                                        <TableHead className="text-right">Discrepancy</TableHead>
                                        <TableHead>Status</TableHead>
                                    </TableHeaderRow>
                                </TableHeader>
                                <TableBody>
                                    {reconciliations.data.map((rec) => (
                                        <TableRow key={rec.id} className={cn(rec.status === 'discrepancy_found' && 'bg-red-50/40')}>
                                            <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(rec.as_at_date)}</TableCell>
                                            <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(rec.reconciliation_date)}</TableCell>
                                            <TableCell className="whitespace-nowrap text-sm">{rec.performer?.full_name ?? '—'}</TableCell>
                                            <TableCell className="text-right tabular-nums">{gbp(rec.paper_statement_balance)}</TableCell>
                                            <TableCell className="text-right tabular-nums">{gbp(rec.system_cash_sheet_balance)}</TableCell>
                                            <TableCell className="text-right tabular-nums">{gbp(rec.aggregate_client_ledger_balance)}</TableCell>
                                            <TableCell className={cn('text-right tabular-nums font-semibold', rec.status === 'discrepancy_found' ? 'text-red-700' : 'text-muted-foreground')}>
                                                {gbp(rec.discrepancy)}
                                            </TableCell>
                                            <TableCell>
                                                {rec.status === 'balanced' ? (
                                                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                                                        <CircleCheck className="h-3 w-3" />Balanced
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
                                                        <TriangleAlert className="h-3 w-3" />Breach
                                                    </span>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                    {reconciliations.last_page > 1 && (
                        <div className="flex items-center justify-between border-t px-4 py-3">
                            <p className="text-sm text-muted-foreground">Showing {reconciliations.from}–{reconciliations.to} of {reconciliations.total}</p>
                            <div className="flex gap-1">
                                {reconciliations.links.map((link, i) => (
                                    <Button key={i} variant={link.active ? 'default' : 'outline'} size="sm" disabled={!link.url} onClick={() => link.url && router.visit(link.url)}
                                        dangerouslySetInnerHTML={{ __html: link.label }}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Run Reconciliation</DialogTitle>
                        <DialogDescription>
                            Enter the paper bank statement balance. The system computes both internal figures and stores any discrepancy.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label htmlFor="rec_as_at">Statement as at</Label>
                                <Input id="rec_as_at" type="date" max={new Date().toISOString().slice(0, 10)} value={form.as_at_date} onChange={(e) => setForm((p) => ({ ...p, as_at_date: e.target.value }))} />
                                {formErrors.as_at_date && <p className="text-xs text-destructive">{formErrors.as_at_date}</p>}
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="rec_paper">Paper balance (£)</Label>
                                <Input id="rec_paper" inputMode="decimal" placeholder="0.00" value={form.paper_statement_balance} onChange={(e) => setForm((p) => ({ ...p, paper_statement_balance: e.target.value }))} />
                                {formErrors.paper_statement_balance && <p className="text-xs text-destructive">{formErrors.paper_statement_balance}</p>}
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="rec_notes">Notes (optional)</Label>
                            <Textarea id="rec_notes" rows={2} value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
                        </div>
                    </div>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
                        <Button onClick={submit} disabled={saving || !form.paper_statement_balance}>
                            {saving ? 'Running…' : 'Run & Store'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
