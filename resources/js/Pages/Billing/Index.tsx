import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Plus, Search, FileText, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import type { Invoice, PaginatedData } from '@/types';

interface Props {
    invoices: PaginatedData<Invoice>;
    stats: {
        total_outstanding: number;
        overdue_amount: number;
        paid_this_month: number;
    };
    filters: { status?: string; search?: string };
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

export default function BillingIndex({ invoices, stats, filters }: Props) {
    const [search, setSearch] = useState(filters.search ?? '');
    const [status, setStatus] = useState(filters.status ?? 'all');

    const handleSearch = () => {
        router.get('/billing', { search, status: status === 'all' ? undefined : status }, { preserveState: true });
    };

    return (
        <AppLayout title="Billing">
            <Head title="Billing" />

            {/* Stats */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-8">
                <Card className="surface-card">
                    <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-[0.05em]">Outstanding</p>
                                <p className="mt-1 text-2xl font-bold text-warning">{formatCurrency(stats.total_outstanding)}</p>
                            </div>
                            <div className="bg-warning/15 p-2 rounded-md">
                                <Clock className="h-5 w-5 text-warning" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="surface-card">
                    <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-[0.05em]">Overdue</p>
                                <p className="mt-1 text-2xl font-bold text-destructive">{formatCurrency(stats.overdue_amount)}</p>
                            </div>
                            <div className="bg-destructive/15 p-2 rounded-md">
                                <AlertCircle className="h-5 w-5 text-destructive" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="surface-card">
                    <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-[0.05em]">Paid This Month</p>
                                <p className="mt-1 text-2xl font-bold text-success">{formatCurrency(stats.paid_this_month)}</p>
                            </div>
                            <div className="bg-success/15 p-2 rounded-md">
                                <CheckCircle className="h-5 w-5 text-success" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
                <div className="flex gap-2 flex-1 max-w-md">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            className="pl-9"
                            placeholder="Search invoices..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        />
                    </div>
                    <Select value={status} onValueChange={(v) => { setStatus(v); router.get('/billing', { search, status: v === 'all' ? undefined : v }, { preserveState: true }); }}>
                        <SelectTrigger className="w-32">
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All</SelectItem>
                            <SelectItem value="draft">Draft</SelectItem>
                            <SelectItem value="sent">Sent</SelectItem>
                            <SelectItem value="paid">Paid</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <Button asChild>
                    <Link href="/billing/create">
                        <Plus className="h-4 w-4 mr-2" />
                        New Invoice
                    </Link>
                </Button>
            </div>

            {/* Invoices Table */}
            <Card className="surface-card">
                <CardContent className="p-0">
                    {invoices.data.length === 0 ? (
                        <div className="py-16 text-center">
                            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                            <p className="text-muted-foreground text-sm mb-4">No invoices found.</p>
                            <Button asChild size="sm">
                                <Link href="/billing/create">Create your first invoice</Link>
                            </Button>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b bg-muted/30">
                                        <th className="text-left px-4 py-3 font-medium text-muted-foreground tracking-tight">Invoice #</th>
                                        <th className="text-left px-4 py-3 font-medium text-muted-foreground tracking-tight">Matter</th>
                                        <th className="text-left px-4 py-3 font-medium text-muted-foreground tracking-tight hidden md:table-cell">Date</th>
                                        <th className="text-left px-4 py-3 font-medium text-muted-foreground tracking-tight hidden lg:table-cell">Due Date</th>
                                        <th className="text-right px-4 py-3 font-medium text-muted-foreground tracking-tight">Amount</th>
                                        <th className="text-left px-4 py-3 font-medium text-muted-foreground tracking-tight">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/60">
                                    {invoices.data.map((invoice) => (
                                        <tr
                                            key={invoice.id}
                                            className="hover:bg-muted/40 cursor-pointer transition-colors"
                                            onClick={() => router.visit(`/billing/${invoice.id}`)}
                                        >
                                            <td className="px-4 py-3">
                                                <p className="font-medium">{invoice.invoice_number}</p>
                                            </td>
                                            <td className="px-4 py-3">
                                                <p className="font-medium">{invoice.matter?.name}</p>
                                                <p className="text-xs text-muted-foreground">{invoice.matter?.responsible_user?.full_name}</p>
                                            </td>
                                            <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">
                                                {formatDate(invoice.created_at)}
                                            </td>
                                            <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">
                                                {formatDate(invoice.due_date)}
                                            </td>
                                            <td className="px-4 py-3 text-right font-medium">
                                                {formatCurrency(invoice.total)}
                                            </td>
                                            <td className="px-4 py-3">
                                                <Badge variant={statusVariant[invoice.status]}>
                                                    {statusLabel[invoice.status]}
                                                </Badge>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Pagination */}
                    {invoices.last_page > 1 && (
                        <div className="flex items-center justify-between px-4 py-4 border-t">
                            <p className="text-sm text-muted-foreground">
                                Showing {invoices.from} to {invoices.to} of {invoices.total}
                            </p>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={!invoices.prev_page_url}
                                    onClick={() => invoices.prev_page_url && router.visit(invoices.prev_page_url)}
                                >
                                    Previous
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={!invoices.next_page_url}
                                    onClick={() => invoices.next_page_url && router.visit(invoices.next_page_url)}
                                >
                                    Next
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </AppLayout>
    );
}
