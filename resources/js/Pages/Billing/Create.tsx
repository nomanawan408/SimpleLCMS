import { Head, Link, useForm } from '@inertiajs/react';
import { useState, useMemo } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Plus, Trash2, Clock, Receipt } from 'lucide-react';
import { formatCurrency, formatDuration } from '@/lib/utils';
import type { Matter, TimeEntry, Expense } from '@/types';

interface Props {
    matters: Matter[];
    unbilledTime: TimeEntry[];
    unbilledExpenses: Expense[];
    nextInvoiceNumber: string;
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

export default function CreateInvoice({ matters, unbilledTime, unbilledExpenses, nextInvoiceNumber }: Props) {
    const { data, setData, post, processing, errors } = useForm({
        matter_id: '',
        invoice_number: nextInvoiceNumber,
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        vat_rate: 23,
        line_items: [] as LineItem[],
        notes: '',
        bill_time_entry_ids: [] as string[],
        bill_expense_ids: [] as string[],
    });

    const [selectedMatter, setSelectedMatter] = useState<Matter | null>(null);

    const subtotal = useMemo(() => data.line_items.reduce((sum, item) => sum + item.amount, 0), [data.line_items]);
    const vatAmount = useMemo(() => data.line_items.reduce((sum, item) => sum + item.vat_amount, 0), [data.line_items]);
    const total = subtotal + vatAmount;

    const matterUnbilledTime = useMemo(() => 
        selectedMatter ? unbilledTime.filter(t => t.matter_id === selectedMatter.id) : [],
        [selectedMatter, unbilledTime]
    );

    const matterUnbilledExpenses = useMemo(() => 
        selectedMatter ? unbilledExpenses.filter(e => e.matter_id === selectedMatter.id) : [],
        [selectedMatter, unbilledExpenses]
    );

    const handleMatterChange = (matterId: string) => {
        setData('matter_id', matterId);
        setSelectedMatter(matters.find(m => m.id === matterId) || null);
        // Clear line items when matter changes
        setData('line_items', []);
        setData('bill_time_entry_ids', []);
        setData('bill_expense_ids', []);
    };

    const addTimeEntry = (entry: TimeEntry) => {
        const rate = entry.user?.billing_rate || selectedMatter?.billing_rate || 0;
        const hours = entry.duration_minutes / 60;
        const amount = hours * rate;
        const vat = amount * (data.vat_rate / 100);

        const newItem: LineItem = {
            id: Math.random().toString(36).substr(2, 9),
            description: entry.description || 'Legal services',
            quantity: hours,
            unit_rate: rate,
            amount: amount,
            vat_amount: vat,
            type: 'time',
            source_id: entry.id,
        };

        setData('line_items', [...data.line_items, newItem]);
        setData('bill_time_entry_ids', [...data.bill_time_entry_ids, entry.id]);
    };

    const addExpense = (expense: Expense) => {
        const amount = expense.amount;
        const vat = amount * (data.vat_rate / 100);

        const newItem: LineItem = {
            id: Math.random().toString(36).substr(2, 9),
            description: expense.description,
            quantity: 1,
            unit_rate: amount,
            amount: amount,
            vat_amount: vat,
            type: 'expense',
            source_id: expense.id,
        };

        setData('line_items', [...data.line_items, newItem]);
        setData('bill_expense_ids', [...data.bill_expense_ids, expense.id]);
    };

    const addFixedFee = () => {
        const newItem: LineItem = {
            id: Math.random().toString(36).substr(2, 9),
            description: '',
            quantity: 1,
            unit_rate: 0,
            amount: 0,
            vat_amount: 0,
            type: 'fixed',
        };
        setData('line_items', [...data.line_items, newItem]);
    };

    const updateLineItem = (id: string, updates: Partial<LineItem>) => {
        setData('line_items', data.line_items.map(item => {
            if (item.id !== id) return item;
            const updated = { ...item, ...updates };
            if (updates.quantity !== undefined || updates.unit_rate !== undefined) {
                updated.amount = updated.quantity * updated.unit_rate;
                updated.vat_amount = updated.amount * (data.vat_rate / 100);
            }
            return updated;
        }));
    };

    const removeLineItem = (id: string) => {
        const item = data.line_items.find(i => i.id === id);
        if (item?.source_id) {
            if (item.type === 'time') {
                setData('bill_time_entry_ids', data.bill_time_entry_ids.filter(i => i !== item.source_id));
            } else if (item.type === 'expense') {
                setData('bill_expense_ids', data.bill_expense_ids.filter(i => i !== item.source_id));
            }
        }
        setData('line_items', data.line_items.filter(i => i.id !== id));
    };

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        post('/billing');
    };

    return (
        <AppLayout title="New Invoice">
            <Head title="New Invoice" />

            <div className="max-w-4xl mx-auto">
                <div className="mb-8">
                    <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                        <Link href="/billing">
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back to Billing
                        </Link>
                    </Button>
                </div>

                <form onSubmit={submit} className="space-y-6">
                    {/* Header Info */}
                    <Card className="surface-card">
                        <CardHeader className="pb-6">
                            <CardTitle className="text-xl tracking-tight">Invoice Details</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                                <div className="space-y-3">
                                    <Label className="text-sm font-medium">Matter *</Label>
                                    <Select value={data.matter_id} onValueChange={handleMatterChange}>
                                        <SelectTrigger className="h-11">
                                            <SelectValue placeholder="Select matter..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {matters.map((matter) => (
                                                <SelectItem key={matter.id} value={matter.id}>
                                                    {matter.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {errors.matter_id && <p className="text-xs text-destructive mt-1">{errors.matter_id}</p>}
                                </div>

                                <div className="space-y-3">
                                    <Label className="text-sm font-medium">Invoice Number *</Label>
                                    <Input
                                        value={data.invoice_number}
                                        onChange={(e) => setData('invoice_number', e.target.value)}
                                        className="h-11"
                                    />
                                    {errors.invoice_number && <p className="text-xs text-destructive mt-1">{errors.invoice_number}</p>}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                                <div className="space-y-3">
                                    <Label className="text-sm font-medium">Due Date *</Label>
                                    <Input
                                        type="date"
                                        value={data.due_date}
                                        onChange={(e) => setData('due_date', e.target.value)}
                                        className="h-11"
                                    />
                                    {errors.due_date && <p className="text-xs text-destructive mt-1">{errors.due_date}</p>}
                                </div>

                                <div className="space-y-3">
                                    <Label className="text-sm font-medium">VAT Rate (%)</Label>
                                    <Input
                                        type="number"
                                        value={data.vat_rate}
                                        onChange={(e) => setData('vat_rate', parseFloat(e.target.value))}
                                        className="h-11"
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Unbilled Items */}
                    {selectedMatter && (
                        <Card className="surface-card">
                            <CardHeader className="pb-4">
                                <CardTitle className="text-base tracking-tight">Unbilled Items</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {matterUnbilledTime.length > 0 && (
                                    <div>
                                        <p className="text-sm font-medium mb-2">Time Entries</p>
                                        <div className="space-y-2">
                                            {matterUnbilledTime.map((entry) => (
                                                <div key={entry.id} className="flex items-center justify-between p-3 bg-muted/40 rounded-md">
                                                    <div className="flex items-center gap-3">
                                                        <Clock className="h-4 w-4 text-muted-foreground" />
                                                        <div>
                                                            <p className="text-sm font-medium">{entry.description || 'Legal services'}</p>
                                                            <p className="text-xs text-muted-foreground">
                                                                {formatDuration(entry.duration_minutes)} · {entry.user?.full_name}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => addTimeEntry(entry)}
                                                        disabled={data.bill_time_entry_ids.includes(entry.id)}
                                                    >
                                                        {data.bill_time_entry_ids.includes(entry.id) ? 'Added' : 'Add'}
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {matterUnbilledExpenses.length > 0 && (
                                    <div>
                                        <p className="text-sm font-medium mb-2">Expenses</p>
                                        <div className="space-y-2">
                                            {matterUnbilledExpenses.map((expense) => (
                                                <div key={expense.id} className="flex items-center justify-between p-3 bg-muted/40 rounded-md">
                                                    <div className="flex items-center gap-3">
                                                        <Receipt className="h-4 w-4 text-muted-foreground" />
                                                        <div>
                                                            <p className="text-sm font-medium">{expense.description}</p>
                                                            <p className="text-xs text-muted-foreground">{formatCurrency(expense.amount)}</p>
                                                        </div>
                                                    </div>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => addExpense(expense)}
                                                        disabled={data.bill_expense_ids.includes(expense.id)}
                                                    >
                                                        {data.bill_expense_ids.includes(expense.id) ? 'Added' : 'Add'}
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {matterUnbilledTime.length === 0 && matterUnbilledExpenses.length === 0 && (
                                    <p className="text-sm text-muted-foreground">No unbilled items for this matter.</p>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {/* Line Items */}
                    <Card className="surface-card">
                        <CardHeader className="pb-4 flex flex-row items-center justify-between">
                            <CardTitle className="text-base tracking-tight">Line Items</CardTitle>
                            <Button type="button" variant="outline" size="sm" onClick={addFixedFee}>
                                <Plus className="h-4 w-4 mr-1" />
                                Add Item
                            </Button>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {data.line_items.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-4">No line items yet. Add from unbilled items above or create a fixed fee item.</p>
                            ) : (
                                <div className="space-y-3">
                                    {data.line_items.map((item) => (
                                        <div key={item.id} className="grid grid-cols-12 gap-3 items-start p-3 bg-muted/40 rounded-md">
                                            <div className="col-span-5">
                                                <Input
                                                    placeholder="Description"
                                                    value={item.description}
                                                    onChange={(e) => updateLineItem(item.id, { description: e.target.value })}
                                                />
                                            </div>
                                            <div className="col-span-2">
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    placeholder="Qty"
                                                    value={item.quantity}
                                                    onChange={(e) => updateLineItem(item.id, { quantity: parseFloat(e.target.value) || 0 })}
                                                />
                                            </div>
                                            <div className="col-span-2">
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    placeholder="Rate"
                                                    value={item.unit_rate}
                                                    onChange={(e) => updateLineItem(item.id, { unit_rate: parseFloat(e.target.value) || 0 })}
                                                />
                                            </div>
                                            <div className="col-span-2">
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    readOnly
                                                    value={item.amount.toFixed(2)}
                                                    className="bg-muted"
                                                />
                                            </div>
                                            <div className="col-span-1">
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-9 w-9 text-muted-foreground hover:text-destructive"
                                                    onClick={() => removeLineItem(item.id)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Totals */}
                    <Card className="surface-card">
                        <CardContent className="p-6">
                            <div className="flex justify-between text-sm mb-2">
                                <span className="text-muted-foreground">Subtotal</span>
                                <span className="font-medium">{formatCurrency(subtotal)}</span>
                            </div>
                            <div className="flex justify-between text-sm mb-4">
                                <span className="text-muted-foreground">VAT ({data.vat_rate}%)</span>
                                <span className="font-medium">{formatCurrency(vatAmount)}</span>
                            </div>
                            <Separator className="my-4" />
                            <div className="flex justify-between">
                                <span className="text-lg font-semibold">Total</span>
                                <span className="text-lg font-bold text-primary">{formatCurrency(total)}</span>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Notes */}
                    <Card className="surface-card">
                        <CardHeader className="pb-4">
                            <CardTitle className="text-base tracking-tight">Notes</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Textarea
                                value={data.notes}
                                onChange={(e) => setData('notes', e.target.value)}
                                placeholder="Additional notes for the invoice..."
                                rows={3}
                                className="resize-none"
                            />
                        </CardContent>
                    </Card>

                    {/* Actions */}
                    <div className="flex gap-3 justify-end">
                        <Button type="button" variant="outline" asChild>
                            <Link href="/billing">Cancel</Link>
                        </Button>
                        <Button type="submit" disabled={processing || data.line_items.length === 0}>
                            {processing ? 'Creating...' : 'Create Invoice'}
                        </Button>
                    </div>
                </form>
            </div>
        </AppLayout>
    );
}
