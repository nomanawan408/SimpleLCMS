import { Head, Link, useForm } from '@inertiajs/react';
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
import { ArrowLeft, Download, Mail, CreditCard, CheckCircle, AlertCircle, Printer } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Invoice } from '@/types';

interface Props {
    invoice: Invoice & {
        matter: any;
        lineItems: any[];
        payments: any[];
    };
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

export default function ShowInvoice({ invoice }: Props) {
    const [paymentOpen, setPaymentOpen] = useState(false);

    const { data, setData, post, processing, errors, reset } = useForm({
        amount: invoice.amount_outstanding,
        method: 'bank_transfer',
        paid_at: new Date().toISOString().split('T')[0],
        notes: '',
    });

    const handleRecordPayment = (e: React.FormEvent) => {
        e.preventDefault();
        post(`/billing/${invoice.id}/payments`, {
            onSuccess: () => {
                setPaymentOpen(false);
                reset();
            },
        });
    };

    const handleStatusChange = (status: string) => {
        if (confirm(`Change invoice status to ${statusLabel[status]}?`)) {
            post(`/billing/${invoice.id}`, { status });
        }
    };

    return (
        <AppLayout title={`Invoice ${invoice.invoice_number}`}>
            <Head title={`Invoice ${invoice.invoice_number}`} />

            <div className="max-w-4xl mx-auto">
                <div className="mb-8 flex items-center justify-between">
                    <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                        <Link href="/billing">
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back to Billing
                        </Link>
                    </Button>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm">
                            <Printer className="h-4 w-4 mr-2" />
                            Print
                        </Button>
                        <Button variant="outline" size="sm">
                            <Download className="h-4 w-4 mr-2" />
                            PDF
                        </Button>
                    </div>
                </div>

                {/* Invoice Card */}
                <Card className="surface-card mb-6">
                    <CardHeader className="flex flex-row items-center justify-between pb-4">
                        <div>
                            <p className="text-sm text-muted-foreground mb-1">Invoice</p>
                            <h1 className="text-2xl font-bold tracking-tight">{invoice.invoice_number}</h1>
                        </div>
                        <Badge variant={statusVariant[invoice.status]} className="text-base px-3 py-1">
                            {statusLabel[invoice.status]}
                        </Badge>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <p className="text-sm text-muted-foreground mb-1">Billed To</p>
                                <p className="font-medium">{invoice.matter?.name}</p>
                                <p className="text-sm text-muted-foreground">Matter #{invoice.matter?.matter_number}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-sm text-muted-foreground mb-1">Invoice Date</p>
                                <p className="font-medium">{formatDate(invoice.created_at)}</p>
                                <p className="text-sm text-muted-foreground mt-2">Due Date</p>
                                <p className={`font-medium ${invoice.status === 'sent' && new Date(invoice.due_date) < new Date() ? 'text-destructive' : ''}`}>
                                    {formatDate(invoice.due_date)}
                                </p>
                            </div>
                        </div>

                        <Separator />

                        {/* Line Items */}
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b">
                                    <th className="text-left py-2 font-medium text-muted-foreground">Description</th>
                                    <th className="text-right py-2 font-medium text-muted-foreground">Qty</th>
                                    <th className="text-right py-2 font-medium text-muted-foreground">Rate</th>
                                    <th className="text-right py-2 font-medium text-muted-foreground">Amount</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {invoice.lineItems.map((item) => (
                                    <tr key={item.id}>
                                        <td className="py-3">{item.description}</td>
                                        <td className="py-3 text-right">{item.quantity}</td>
                                        <td className="py-3 text-right">{formatCurrency(item.unit_rate)}</td>
                                        <td className="py-3 text-right font-medium">{formatCurrency(item.amount)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        <Separator />

                        {/* Totals */}
                        <div className="flex justify-end">
                            <div className="w-64 space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Subtotal</span>
                                    <span>{formatCurrency(invoice.subtotal)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">VAT ({invoice.vat_rate}%)</span>
                                    <span>{formatCurrency(invoice.vat_amount)}</span>
                                </div>
                                <Separator />
                                <div className="flex justify-between text-lg font-bold">
                                    <span>Total</span>
                                    <span className="text-primary">{formatCurrency(invoice.total)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Payments */}
                        {invoice.payments.length > 0 && (
                            <>
                                <Separator />
                                <div>
                                    <p className="font-medium mb-3">Payments</p>
                                    <div className="space-y-2">
                                        {invoice.payments.map((payment) => (
                                            <div key={payment.id} className="flex justify-between items-center p-3 bg-muted/40 rounded-md">
                                                <div>
                                                    <p className="font-medium">{formatCurrency(payment.amount)}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {formatDate(payment.paid_at)} · {payment.method.replace('_', ' ')}
                                                    </p>
                                                </div>
                                                <CheckCircle className="h-5 w-5 text-success" />
                                            </div>
                                        ))}
                                    </div>
                                    <div className="flex justify-end mt-4 pt-2">
                                        <div className="w-64 flex justify-between font-bold">
                                            <span>Amount Outstanding</span>
                                            <span className={invoice.amount_outstanding > 0 ? 'text-warning' : 'text-success'}>
                                                {formatCurrency(invoice.amount_outstanding)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Notes */}
                        {invoice.notes && (
                            <>
                                <Separator />
                                <div>
                                    <p className="text-sm text-muted-foreground mb-1">Notes</p>
                                    <p className="text-sm">{invoice.notes}</p>
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>

                {/* Actions */}
                <div className="flex flex-wrap gap-3">
                    {invoice.status === 'draft' && (
                        <Button onClick={() => handleStatusChange('sent')}>
                            <Mail className="h-4 w-4 mr-2" />
                            Mark as Sent
                        </Button>
                    )}

                    {invoice.status === 'sent' && invoice.amount_outstanding > 0 && (
                        <div className="w-full">
                            <Button onClick={() => setPaymentOpen(!paymentOpen)}>
                                <CreditCard className="h-4 w-4 mr-2" />
                                {paymentOpen ? 'Cancel Payment' : 'Record Payment'}
                            </Button>
                            {paymentOpen && (
                                <Card className="surface-card mt-4 p-4">
                                    <form onSubmit={handleRecordPayment} className="space-y-4">
                                        <div className="space-y-2">
                                            <Label>Amount *</Label>
                                            <Input
                                                type="number"
                                                step="0.01"
                                                max={invoice.amount_outstanding}
                                                value={data.amount}
                                                onChange={(e) => setData('amount', parseFloat(e.target.value))}
                                            />
                                            {errors.amount && <p className="text-xs text-destructive">{errors.amount}</p>}
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Payment Method *</Label>
                                            <Select value={data.method} onValueChange={(v) => setData('method', v)}>
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="cash">Cash</SelectItem>
                                                    <SelectItem value="cheque">Cheque</SelectItem>
                                                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                                                    <SelectItem value="credit_card">Credit Card</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Payment Date *</Label>
                                            <Input
                                                type="date"
                                                value={data.paid_at}
                                                onChange={(e) => setData('paid_at', e.target.value)}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Notes</Label>
                                            <Textarea
                                                value={data.notes}
                                                onChange={(e) => setData('notes', e.target.value)}
                                                rows={2}
                                            />
                                        </div>
                                        <div className="flex gap-3 justify-end">
                                            <Button type="button" variant="outline" onClick={() => setPaymentOpen(false)}>
                                                Cancel
                                            </Button>
                                            <Button type="submit" disabled={processing}>
                                                Record Payment
                                            </Button>
                                        </div>
                                    </form>
                                </Card>
                            )}
                        </div>
                    )}

                    {invoice.status !== 'cancelled' && invoice.status !== 'paid' && (
                        <Button variant="outline" onClick={() => handleStatusChange('cancelled')}>
                            Cancel Invoice
                        </Button>
                    )}
                </div>
            </div>
        </AppLayout>
    );
}
