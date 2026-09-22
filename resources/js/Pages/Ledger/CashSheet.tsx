import { useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import {
    Table, TableHeader, TableHeaderRow, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Combobox } from '@/components/ui/combobox';
import { cn, formatCurrency, formatDate, matterComboboxOptions } from '@/lib/utils';
import { ArrowLeft } from 'lucide-react';
import type { LedgerPosting, PaginatedData } from '@/types';

interface Props {
    postings: PaginatedData<LedgerPosting>;
    balance: string;
    matters: { id: string; name: string; matter_number: string }[];
    filters: { account?: string; date_from?: string; date_to?: string; matter_id?: string };
}

function gbp(value: string | number): string {
    return formatCurrency(typeof value === 'string' ? parseFloat(value) : value);
}

export default function CashSheet({ postings, balance, matters, filters }: Props) {
    const [account, setAccount] = useState(filters.account ?? 'client');
    const [dateFrom, setDateFrom] = useState(filters.date_from ?? '');
    const [dateTo, setDateTo] = useState(filters.date_to ?? '');
    const [matterId, setMatterId] = useState(filters.matter_id ?? '_all');

    function apply() {
        router.get('/ledger/cash-sheet', {
            account,
            date_from: dateFrom || undefined,
            date_to: dateTo || undefined,
            matter_id: matterId === '_all' ? undefined : matterId,
        }, { preserveState: true, replace: true });
    }

    const isClient = account !== 'business';

    return (
        <AppLayout title={isClient ? 'Client Cash Sheet' : 'Business Cash Sheet'}>
            <Head title={isClient ? 'Client Cash Sheet' : 'Business Cash Sheet'} />

            <div className="mb-6 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground hover:text-foreground">
                            <Link href="/accounts" className="inline-flex items-center gap-1.5">
                                <ArrowLeft className="h-4 w-4" />
                                Accounts
                            </Link>
                        </Button>
                        <h1 className="text-2xl font-extrabold tracking-tight">
                            {isClient ? 'Client Cash Sheet' : 'Business Cash Sheet'}
                        </h1>
                    </div>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold tabular-nums">
                        Balance {gbp(balance)}
                    </span>
                </div>
                <div className="flex flex-wrap items-end gap-2">
                    <div className="space-y-1.5">
                        <Label>Account</Label>
                        <Select value={account} onValueChange={setAccount}>
                            <SelectTrigger className="h-9 w-44 text-sm"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="client">Client account</SelectItem>
                                <SelectItem value="business">Business account</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1.5">
                        <Label>Matter</Label>
                        <Combobox
                            options={[{ value: '_all', label: 'All matters', description: 'Show all' }, ...matterComboboxOptions(matters)]}
                            value={matterId}
                            onChange={setMatterId}
                            placeholder="All matters"
                            searchPlaceholder="Type matter name or ref…"
                            emptyText="No matters found."
                            className="h-9 w-56"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label>From</Label>
                        <Input type="date" className="h-9 text-sm" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                        <Label>To</Label>
                        <Input type="date" className="h-9 text-sm" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                    </div>
                    <Button size="sm" className="h-9" onClick={apply}>Apply</Button>
                </div>
            </div>

            <Card className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">
                <CardContent className="p-0">
                    {postings.data.length === 0 ? (
                        <div className="py-16 text-center">
                            <p className="font-medium text-foreground mb-1">No entries in range</p>
                            <p className="text-sm text-muted-foreground">Adjust the filters or post the first entry from a matter ledger.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table className="min-w-[860px]">
                                <TableHeader>
                                    <TableHeaderRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Matter</TableHead>
                                        <TableHead className="min-w-[200px]">Narrative</TableHead>
                                        <TableHead>Ref</TableHead>
                                        <TableHead className="text-right">DR (In)</TableHead>
                                        <TableHead className="text-right">CR (Out)</TableHead>
                                        <TableHead className="text-right">Balance</TableHead>
                                    </TableHeaderRow>
                                </TableHeader>
                                <TableBody>
                                    {postings.data.map((posting) => (
                                        <TableRow key={posting.id}>
                                            <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(posting.value_date)}</TableCell>
                                            <TableCell className="max-w-[220px]">
                                                {posting.matter ? (
                                                    <span className="block min-w-0">
                                                        <Link href={`/ledger/matters/${posting.matter.id}`} className="block truncate text-sm font-medium text-foreground hover:text-primary" title={posting.matter.name}>
                                                            {posting.matter.name}
                                                        </Link>
                                                        <span className="block truncate font-mono text-xs tabular-nums text-muted-foreground">{posting.matter.matter_number}</span>
                                                    </span>
                                                ) : (
                                                    <span className="text-sm text-muted-foreground">—</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="max-w-[260px]">
                                                <p className="truncate text-sm text-foreground" title={posting.transaction?.narrative}>{posting.transaction?.narrative ?? '—'}</p>
                                            </TableCell>
                                            <TableCell className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">{posting.transaction?.reference ?? '—'}</TableCell>
                                            <TableCell className={cn('text-right tabular-nums', posting.entry_type === 'debit' ? 'text-emerald-700 font-medium' : 'text-muted-foreground/40')}>
                                                {posting.entry_type === 'debit' ? gbp(posting.amount) : '—'}
                                            </TableCell>
                                            <TableCell className={cn('text-right tabular-nums', posting.entry_type === 'credit' ? 'text-foreground font-medium' : 'text-muted-foreground/40')}>
                                                {posting.entry_type === 'credit' ? gbp(posting.amount) : '—'}
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums font-medium">
                                                {posting.balance_after !== null ? gbp(posting.balance_after) : '—'}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                    {postings.last_page > 1 && (
                        <div className="flex items-center justify-between border-t px-4 py-3">
                            <p className="text-sm text-muted-foreground">Showing {postings.from}–{postings.to} of {postings.total}</p>
                            <div className="flex gap-1">
                                {postings.links.map((link, i) => (
                                    <Button key={i} variant={link.active ? 'default' : 'outline'} size="sm" disabled={!link.url} onClick={() => link.url && router.visit(link.url)}
                                        dangerouslySetInnerHTML={{ __html: link.label }}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </AppLayout>
    );
}
