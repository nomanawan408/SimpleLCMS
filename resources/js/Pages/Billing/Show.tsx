import { Head, Link, router, useForm } from '@inertiajs/react';
import { useState } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Mail, CreditCard, CheckCircle, Printer, XCircle } from 'lucide-react';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import type { Invoice } from '@/types';

interface InvoiceContact {
    id: string;
    name: string;
    pivot?: { role: string };
}

type LineItemRow = { id: string; description: string; quantity: number; unit_rate: number; amount: number; vat_amount: number; type: string };
type PaymentRow  = { id: string; amount: number; method: string; paid_at: string; notes?: string };

interface InvoiceProps extends Omit<Invoice, 'matter' | 'lineItems' | 'payments'> {
    discount_reason?: string | null;
    matter: {
        id: string;
        name: string;
        matter_number: string;
        responsible_user?: { full_name: string };
        contacts?: InvoiceContact[];
    };
    lineItems?: LineItemRow[];
    line_items?: LineItemRow[];
    payments?: PaymentRow[];
}

interface Props {
    invoice: InvoiceProps;
}

const statusVariant: Record<string, 'default' | 'success' | 'warning' | 'destructive' | 'secondary'> = {
    draft: 'secondary',
    sent: 'warning',
    paid: 'success',
    cancelled: 'destructive',
};

const statusLabel: Record<string, string> = {
    draft: 'Draft',
    sent: 'Sent',
    paid: 'Paid',
    cancelled: 'Cancelled',
};

const METHOD_LABELS: Record<string, string> = {
    cash:         'Cash',
    cheque:       'Cheque',
    bank_transfer:'Bank Transfer',
    stripe_card:  'Card Payment',
    stripe_sepa:  'Bank Debit (SEPA)',
};

export default function ShowInvoice({ invoice }: Props) {
    const [paymentOpen, setPaymentOpen] = useState(false);
    const { data, setData, post, processing, errors, reset } = useForm({
        amount:  String(invoice.amount_outstanding ?? invoice.total ?? 0),
        method:  'bank_transfer',
        paid_at: new Date().toISOString().split('T')[0],
        notes:   '',
    });

    const lineItems  = invoice.lineItems ?? invoice.line_items ?? [];
    const payments   = invoice.payments  ?? [];
    const contacts   = invoice.matter?.contacts ?? [];

    const totalPaid     = payments.reduce((s, p) => s + Number(p.amount), 0);
    const outstanding   = Math.max(0, Number(invoice.total) - totalPaid);
    const isOverdue     = invoice.status === 'sent' && !!invoice.due_date && new Date(invoice.due_date) < new Date();
    const canPayment    = !['paid', 'cancelled', 'written_off'].includes(invoice.status) && outstanding > 0;
    const hasDiscount   = Number(invoice.discount_amount) > 0;
    const hasVat        = Number(invoice.vat_rate) > 0;

    const clientContacts  = contacts.filter(c => ['client','claimant','applicant'].includes(c.pivot?.role ?? ''));
    const displayContacts = clientContacts.length ? clientContacts : contacts;
    const clientName      = displayContacts.map(c => c.name).join(', ') || null;

    const handleRecordPayment = (e: React.FormEvent) => {
        e.preventDefault();
        post(`/billing/${invoice.id}/payments`, { onSuccess: () => { setPaymentOpen(false); reset(); } });
    };

    const handleStatusChange = (status: string) => {
        if (confirm(`Change invoice status to "${statusLabel[status]}"?`)) {
            router.post(`/billing/${invoice.id}`, { status });
        }
    };

    return (
        <AppLayout title={`Invoice ${invoice.invoice_number}`}>
            <Head title={`Invoice ${invoice.invoice_number}`} />

            <div className="max-w-4xl mx-auto">
                {/* Topbar */}
                <div className="mb-6 flex items-center justify-between">
                    <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                        <Link href="/billing">
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back to Billing
                        </Link>
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => window.print()}>
                        <Printer className="h-4 w-4 mr-2" />
                        Print
                    </Button>
                </div>

                {/* Overdue warning */}
                {isOverdue && (
                    <div className="mb-4 flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm border border-destructive/20">
                        <XCircle className="h-4 w-4 shrink-0" />
                        This invoice is overdue (due {formatDate(invoice.due_date)}).
                    </div>
                )}

                {/* Invoice Card */}
                <Card className="surface-card mb-6">
                    <CardHeader className="flex flex-row items-start justify-between pb-4">
                        <div>
                            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Invoice</p>
                            <h1 className="text-2xl font-bold tracking-tight">{invoice.invoice_number}</h1>
                            <p className="text-sm text-muted-foreground mt-1">
                                Issued {formatDate(invoice.created_at)}
                            </p>
                        </div>
                        <Badge variant={statusVariant[invoice.status]} className="text-sm px-3 py-1 mt-1">
                            {statusLabel[invoice.status]}
                        </Badge>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Billed To */}
                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Billed To</p>
                                {clientName ? (
                                    <p className="font-semibold text-base">{clientName}</p>
                                ) : null}
                                <p className={cn('font-medium', !clientName && 'text-base')}>{invoice.matter?.name}</p>
                                <p className="text-sm text-muted-foreground">Matter {invoice.matter?.matter_number}</p>
                                {invoice.matter?.responsible_user && (
                                    <p className="text-xs text-muted-foreground mt-1">Handled by: {invoice.matter.responsible_user.full_name}</p>
                                )}
                            </div>
                            <div className="text-right">
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Due Date</p>
                                <p className={cn('font-semibold text-base', isOverdue && 'text-destructive')}>
                                    {formatDate(invoice.due_date)}
                                </p>
                            </div>
                        </div>

                        <Separator />

                        {/* Line Items Table */}
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b bg-muted/20">
                                        <th className="text-left py-2.5 px-3 font-medium text-muted-foreground">Description</th>
                                        <th className="text-right py-2.5 px-3 font-medium text-muted-foreground">Qty</th>
                                        <th className="text-right py-2.5 px-3 font-medium text-muted-foreground">Rate</th>
                                        <th className="text-right py-2.5 px-3 font-medium text-muted-foreground">Net</th>
                                        {hasVat && <th className="text-right py-2.5 px-3 font-medium text-muted-foreground">VAT</th>}
                                        <th className="text-right py-2.5 px-3 font-medium text-muted-foreground">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {lineItems.map(item => (
                                        <tr key={item.id} className="hover:bg-muted/20">
                                            <td className="py-3 px-3">{item.description}</td>
                                            <td className="py-3 px-3 text-right text-muted-foreground tabular-nums">{Number(item.quantity).toFixed(2)}</td>
                                            <td className="py-3 px-3 text-right text-muted-foreground tabular-nums">{formatCurrency(item.unit_rate)}</td>
                                            <td className="py-3 px-3 text-right tabular-nums">{formatCurrency(item.amount)}</td>
                                            {hasVat && <td className="py-3 px-3 text-right text-muted-foreground tabular-nums">{formatCurrency(item.vat_amount)}</td>}
                                            <td className="py-3 px-3 text-right font-semibold tabular-nums">{formatCurrency(Number(item.amount) + Number(item.vat_amount))}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Totals */}
                        <div className="flex justify-end">
                            <div className="w-72 space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Subtotal</span>
                                    <span className="tabular-nums">{formatCurrency(invoice.subtotal)}</span>
                                </div>
                                {hasVat && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">VAT ({invoice.vat_rate}%)</span>
                                        <span className="tabular-nums">{formatCurrency(invoice.vat_amount)}</span>
                                    </div>
                                )}
                                {hasDiscount && (
                                    <div className="flex justify-between text-sm text-success">
                                        <span>Discount{invoice.discount_reason ? ` (${invoice.discount_reason})` : ''}</span>
                                        <span className="tabular-nums">-{formatCurrency(invoice.discount_amount ?? 0)}</span>
                                    </div>
                                )}
                                <Separator />
                                <div className="flex justify-between text-lg font-bold">
                                    <span>Total</span>
                                    <span className="text-primary tabular-nums">{formatCurrency(invoice.total)}</span>
                                </div>

                                {totalPaid > 0 && (
                                    <>
                                        <div className="flex justify-between text-sm text-success">
                                            <span>Total Paid</span>
                                            <span className="tabular-nums">-{formatCurrency(totalPaid)}</span>
                                        </div>
                                        <Separator />
                                        <div className="flex justify-between font-bold">
                                            <span>Outstanding</span>
                                            <span className={cn('tabular-nums', outstanding > 0 ? 'text-warning' : 'text-success')}>
                                                {formatCurrency(outstanding)}
                                            </span>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Payments */}
                        {payments.length > 0 && (
                            <>
                                <Separator />
                                <div>
                                    <p className="text-sm font-semibold mb-3">Payment History</p>
                                    <div className="space-y-2">
                                        {payments.map(payment => (
                                            <div key={payment.id} className="flex justify-between items-center p-3 bg-success/5 border border-success/20 rounded-md">
                                                <div>
                                                    <p className="text-sm font-medium">{formatDate(payment.paid_at)} · {METHOD_LABELS[payment.method] ?? payment.method.replace(/_/g, ' ')}</p>
                                                    {payment.notes && <p className="text-xs text-muted-foreground">{payment.notes}</p>}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-success tabular-nums">{formatCurrency(Number(payment.amount))}</span>
                                                    <CheckCircle className="h-4 w-4 text-success" />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Notes */}
                        {invoice.notes && (
                            <>
                                <Separator />
                                <div>
                                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Notes</p>
                                    <p className="text-sm whitespace-pre-wrap">{invoice.notes}</p>
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>

                {/* Action buttons */}
                <div className="flex flex-wrap gap-3 mb-6">
                    {invoice.status === 'draft' && (
                        <Button onClick={() => handleStatusChange('sent')} className="gap-2">
                            <Mail className="h-4 w-4" />
                            Mark as Sent
                        </Button>
                    )}

                    {canPayment && (
                        <Button variant={paymentOpen ? 'secondary' : 'default'} onClick={() => setPaymentOpen(!paymentOpen)} className="gap-2">
                            <CreditCard className="h-4 w-4" />
                            {paymentOpen ? 'Cancel' : 'Record Payment'}
                        </Button>
                    )}

                    {!['cancelled', 'paid', 'written_off'].includes(invoice.status) && (
                        <Button variant="outline" className="text-destructive hover:text-destructive gap-2" onClick={() => handleStatusChange('cancelled')}>
                            <XCircle className="h-4 w-4" />
                            Cancel Invoice
                        </Button>
                    )}
                </div>

                {/* Record Payment Form */}
                {paymentOpen && (
                    <Card className="surface-card mb-6">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Record Payment</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleRecordPayment} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label>Amount (£) *</Label>
                                    <Input
                                        type="number" step="0.01" min="0.01"
                                        value={data.amount}
                                        onChange={e => setData('amount', e.target.value)}
                                    />
                                    {errors.amount && <p className="text-xs text-destructive">{errors.amount}</p>}
                                    <p className="text-xs text-muted-foreground">Outstanding: {formatCurrency(outstanding)}</p>
                                </div>

                                <div className="space-y-2">
                                    <Label>Payment Method *</Label>
                                    <Select value={data.method} onValueChange={v => setData('method', v)}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="cash">Cash</SelectItem>
                                            <SelectItem value="cheque">Cheque</SelectItem>
                                            <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                                            <SelectItem value="stripe_card">Card Payment</SelectItem>
                                            <SelectItem value="stripe_sepa">Bank Debit (SEPA)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label>Date Received *</Label>
                                    <Input type="date" value={data.paid_at} onChange={e => setData('paid_at', e.target.value)} />
                                </div>

                                <div className="space-y-2">
                                    <Label>Reference / Notes</Label>
                                    <Input value={data.notes} onChange={e => setData('notes', e.target.value)} placeholder="Cheque no., transfer ref…" />
                                </div>

                                <div className="col-span-full flex gap-3 justify-end">
                                    <Button type="button" variant="outline" onClick={() => setPaymentOpen(false)}>Cancel</Button>
                                    <Button type="submit" disabled={processing} className="gap-2">
                                        <CheckCircle className="h-4 w-4" />
                                        {processing ? 'Saving…' : 'Record Payment'}
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                )}
            </div>
        </AppLayout>
    );
}
