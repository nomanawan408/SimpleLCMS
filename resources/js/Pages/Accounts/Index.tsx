import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import {
    ArrowDownCircle, ArrowUpCircle, Wallet, Landmark, Users, BookOpen,
    Building2, CreditCard, Hash, Globe, FileText, Mail, Phone, UserCircle,
    Copy, Check, ExternalLink,
} from 'lucide-react';
import type { TrustEntry, PaginatedData } from '@/types';

interface FirmAccount {
    bank_name: string | null;
    bank_sort_code: string | null;
    bank_account_number: string | null;
    bank_account_name: string | null;
    bank_iban: string | null;
    bank_swift_code: string | null;
    payment_instructions: string | null;
}

interface ClientAccount {
    id: string;
    name: string;
    type: string;
    email: string | null;
    phone: string | null;
    contact_person_name: string | null;
    contact_person_email: string | null;
    matters: { id: string; name: string; matter_number: string; status: string }[];
}

interface Props {
    entries: PaginatedData<TrustEntry & { matter: { name: string } }>;
    summary: { total_receipts: number; total_disbursements: number; balance: number };
    firmAccount: FirmAccount;
    clientAccounts: ClientAccount[];
    matters: { id: string; name: string }[];
    filters: { matter_id?: string };
}

const TYPE_COLORS: Record<string, 'success' | 'destructive' | 'default'> = {
    receipt: 'success',
    disbursement: 'destructive',
    transfer: 'default',
};

const TABS = [
    { id: 'firm', label: 'Firm Account', icon: Landmark },
    { id: 'clients', label: 'Client Accounts', icon: Users },
    { id: 'trust', label: 'Trust Ledger', icon: BookOpen },
] as const;

type TabId = (typeof TABS)[number]['id'];

export default function AccountsIndex({ entries, summary, firmAccount, clientAccounts, matters, filters }: Props) {
    const [tab, setTab] = useState<TabId>('firm');
    const [copied, setCopied] = useState<string | null>(null);

    const setFilter = (key: string, value: string) => {
        const actual = value === '_all' ? '' : value;
        router.get('/accounts', { ...filters, [key]: actual || undefined }, { preserveState: true, replace: true });
    };

    const copyToClipboard = (text: string, field: string) => {
        navigator.clipboard.writeText(text);
        setCopied(field);
        setTimeout(() => setCopied(null), 2000);
    };

    const hasBankDetails = firmAccount.bank_name || firmAccount.bank_account_number || firmAccount.bank_iban;

    return (
        <AppLayout title="Accounts">
            <Head title="Accounts" />

            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Accounts</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">Manage firm bank accounts, client accounts, and trust ledger</p>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex items-center gap-1 mb-6 p-1 rounded-xl bg-muted/50 border border-border/40 w-fit">
                {TABS.map((t) => (
                    <button
                        key={t.id}
                        onClick={() => setTab(t.id)}
                        className={cn(
                            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                            tab === t.id
                                ? 'bg-background text-foreground shadow-sm border border-border/50'
                                : 'text-muted-foreground hover:text-foreground hover:bg-background/50',
                        )}
                    >
                        <t.icon className="h-4 w-4" />
                        {t.label}
                    </button>
                ))}
            </div>

            {/* ─── Firm Account Tab ─── */}
            {tab === 'firm' && (
                <div className="space-y-6">
                    {/* Firm Bank Details Card */}
                    <Card className="border-border/50 shadow-md">
                        <CardHeader className="flex flex-row items-center justify-between pb-3">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 ring-1 ring-primary/10">
                                    <Building2 className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                    <CardTitle className="text-lg">Firm Bank Account</CardTitle>
                                    <p className="text-xs text-muted-foreground mt-0.5">Payment details shown on client invoices</p>
                                </div>
                            </div>
                            {hasBankDetails ? (
                                <Badge variant="success" className="text-xs">Configured</Badge>
                            ) : (
                                <Badge variant="warning" className="text-xs">Not configured</Badge>
                            )}
                        </CardHeader>
                        <CardContent>
                            {hasBankDetails ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Bank Details */}
                                    <div className="space-y-4">
                                        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                                            <Landmark className="h-4 w-4 text-primary" />
                                            Bank Details
                                        </h3>
                                        <div className="space-y-3">
                                            {firmAccount.bank_name && (
                                                <DetailRow icon={Building2} label="Bank" value={firmAccount.bank_name} onCopy={() => copyToClipboard(firmAccount.bank_name!, 'bank_name')} copied={copied === 'bank_name'} />
                                            )}
                                            {firmAccount.bank_account_name && (
                                                <DetailRow icon={UserCircle} label="Account Name" value={firmAccount.bank_account_name} onCopy={() => copyToClipboard(firmAccount.bank_account_name!, 'account_name')} copied={copied === 'account_name'} />
                                            )}
                                            {firmAccount.bank_sort_code && (
                                                <DetailRow icon={Hash} label="Sort Code" value={firmAccount.bank_sort_code} onCopy={() => copyToClipboard(firmAccount.bank_sort_code!, 'sort_code')} copied={copied === 'sort_code'} />
                                            )}
                                            {firmAccount.bank_account_number && (
                                                <DetailRow icon={CreditCard} label="Account No." value={firmAccount.bank_account_number} onCopy={() => copyToClipboard(firmAccount.bank_account_number!, 'account_number')} copied={copied === 'account_number'} />
                                            )}
                                        </div>
                                    </div>

                                    {/* International + Instructions */}
                                    <div className="space-y-4">
                                        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                                            <Globe className="h-4 w-4 text-primary" />
                                            International / Additional
                                        </h3>
                                        <div className="space-y-3">
                                            {firmAccount.bank_iban && (
                                                <DetailRow icon={Globe} label="IBAN" value={firmAccount.bank_iban} onCopy={() => copyToClipboard(firmAccount.bank_iban!, 'iban')} copied={copied === 'iban'} />
                                            )}
                                            {firmAccount.bank_swift_code && (
                                                <DetailRow icon={Hash} label="SWIFT/BIC" value={firmAccount.bank_swift_code} onCopy={() => copyToClipboard(firmAccount.bank_swift_code!, 'swift')} copied={copied === 'swift'} />
                                            )}
                                            {firmAccount.payment_instructions && (
                                                <div className="pt-2">
                                                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">Payment Instructions</p>
                                                    <p className="text-sm text-foreground/90 bg-muted/30 rounded-lg p-3 border border-border/30 whitespace-pre-wrap">{firmAccount.payment_instructions}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-8">
                                    <div className="inline-flex items-center justify-center h-14 w-14 rounded-full bg-muted/60 mb-4">
                                        <Landmark className="h-7 w-7 text-muted-foreground/40" />
                                    </div>
                                    <p className="text-sm font-medium text-muted-foreground mb-1">No bank account configured</p>
                                    <p className="text-xs text-muted-foreground/60 mb-4">Set up your firm bank details in Admin &rarr; Firm Setup</p>
                                    <Button asChild size="sm" variant="outline" className="gap-2">
                                        <Link href="/admin/firm/setup">
                                            <Building2 className="h-4 w-4" /> Go to Firm Setup
                                        </Link>
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* ─── Client Accounts Tab ─── */}
            {tab === 'clients' && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">{clientAccounts.length} client{clientAccounts.length !== 1 ? 's' : ''} with active matters</p>
                    </div>
                    {clientAccounts.length === 0 ? (
                        <Card>
                            <CardContent className="py-12 text-center">
                                <div className="inline-flex items-center justify-center h-14 w-14 rounded-full bg-muted/60 mb-4">
                                    <Users className="h-7 w-7 text-muted-foreground/40" />
                                </div>
                                <p className="text-sm font-medium text-muted-foreground mb-1">No client accounts yet</p>
                                <p className="text-xs text-muted-foreground/60">Clients will appear here once contacts are linked to matters</p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                            {clientAccounts.map((client) => (
                                <Card key={client.id} className="border-border/50 hover:border-border/80 hover:shadow-md transition-all">
                                    <CardContent className="p-4">
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex items-center gap-3">
                                                <div className={cn(
                                                    'h-10 w-10 rounded-xl flex items-center justify-center text-sm font-bold',
                                                    client.type === 'company'
                                                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
                                                )}>
                                                    {client.name.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-sm">{client.name}</p>
                                                    <Badge variant="secondary" className="text-[10px] mt-0.5 capitalize">{client.type}</Badge>
                                                </div>
                                            </div>
                                            <Button asChild variant="ghost" size="sm" className="h-7 px-2 gap-1 text-xs">
                                                <Link href={`/contacts/${client.id}`}>
                                                    <ExternalLink className="h-3 w-3" />
                                                    View
                                                </Link>
                                            </Button>
                                        </div>

                                        {/* Contact info */}
                                        <div className="flex flex-wrap gap-3 mb-3 text-xs text-muted-foreground">
                                            {(client.contact_person_email || client.email) && (
                                                <span className="flex items-center gap-1">
                                                    <Mail className="h-3 w-3" />
                                                    {client.contact_person_email || client.email}
                                                </span>
                                            )}
                                            {client.phone && (
                                                <span className="flex items-center gap-1">
                                                    <Phone className="h-3 w-3" />
                                                    {client.phone}
                                                </span>
                                            )}
                                            {client.contact_person_name && (
                                                <span className="flex items-center gap-1">
                                                    <UserCircle className="h-3 w-3" />
                                                    {client.contact_person_name}
                                                </span>
                                            )}
                                        </div>

                                        {/* Linked matters */}
                                        {client.matters.length > 0 && (
                                            <div className="border-t border-border/40 pt-2.5">
                                                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">Active Matters</p>
                                                <div className="space-y-1">
                                                    {client.matters.map((m) => (
                                                        <Link
                                                            key={m.id}
                                                            href={`/matters/${m.id}`}
                                                            className="flex items-center gap-2 text-xs hover:bg-muted/40 rounded-md px-2 py-1.5 transition-colors"
                                                        >
                                                            <FileText className="h-3 w-3 text-muted-foreground/60 shrink-0" />
                                                            <span className="font-mono text-muted-foreground">{m.matter_number}</span>
                                                            <span className="font-medium truncate">{m.name}</span>
                                                        </Link>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ─── Trust Ledger Tab ─── */}
            {tab === 'trust' && (
                <div className="space-y-6">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <Card className="border-border/50">
                            <CardContent className="p-5 flex items-center gap-4">
                                <div className="bg-success/15 p-2.5 rounded-xl ring-1 ring-success/20">
                                    <ArrowDownCircle className="h-5 w-5 text-success" />
                                </div>
                                <div>
                                    <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Total Receipts</p>
                                    <p className="text-xl font-black text-success tabular-nums">{formatCurrency(summary.total_receipts)}</p>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="border-border/50">
                            <CardContent className="p-5 flex items-center gap-4">
                                <div className="bg-destructive/15 p-2.5 rounded-xl ring-1 ring-destructive/20">
                                    <ArrowUpCircle className="h-5 w-5 text-destructive" />
                                </div>
                                <div>
                                    <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Total Disbursements</p>
                                    <p className="text-xl font-black text-destructive tabular-nums">{formatCurrency(summary.total_disbursements)}</p>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="border-border/50">
                            <CardContent className="p-5 flex items-center gap-4">
                                <div className="bg-primary/15 p-2.5 rounded-xl ring-1 ring-primary/20">
                                    <Wallet className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                    <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Current Balance</p>
                                    <p className={cn('text-xl font-black tabular-nums', summary.balance < 0 && 'text-destructive')}>
                                        {formatCurrency(summary.balance)}
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Filter */}
                    <div className="flex items-center gap-3">
                        <Select value={filters.matter_id || '_all'} onValueChange={(v) => setFilter('matter_id', v)}>
                            <SelectTrigger className="w-52 h-9">
                                <SelectValue placeholder="All matters" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="_all">All matters</SelectItem>
                                {matters.map((m) => (
                                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <Card>
                        <CardContent className="p-0">
                            {entries.data.length === 0 ? (
                                <div className="py-12 text-center">
                                    <div className="inline-flex items-center justify-center h-14 w-14 rounded-full bg-muted/60 mb-4">
                                        <BookOpen className="h-7 w-7 text-muted-foreground/40" />
                                    </div>
                                    <p className="text-sm font-medium text-muted-foreground mb-1">No trust entries found</p>
                                    <p className="text-xs text-muted-foreground/60">Trust entries will appear here when recorded</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b bg-muted/30 text-muted-foreground">
                                                <th className="text-left px-4 py-3 font-medium text-[11px] uppercase tracking-wider">Date</th>
                                                <th className="text-left px-4 py-3 font-medium text-[11px] uppercase tracking-wider">Matter</th>
                                                <th className="text-left px-4 py-3 font-medium text-[11px] uppercase tracking-wider">Type</th>
                                                <th className="text-left px-4 py-3 font-medium text-[11px] uppercase tracking-wider">Description</th>
                                                <th className="text-right px-4 py-3 font-medium text-[11px] uppercase tracking-wider">Amount</th>
                                                <th className="text-right px-4 py-3 font-medium text-[11px] uppercase tracking-wider">Balance After</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border/40">
                                            {entries.data.map((entry) => (
                                                <tr key={entry.id} className="hover:bg-muted/20 transition-colors">
                                                    <td className="px-4 py-3 text-muted-foreground">{formatDate(entry.date)}</td>
                                                    <td className="px-4 py-3">
                                                        {entry.matter?.name ?? '--'}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <Badge variant={TYPE_COLORS[entry.type] ?? 'default'} className="text-xs capitalize">
                                                            {entry.type}
                                                        </Badge>
                                                    </td>
                                                    <td className="px-4 py-3 text-muted-foreground">{entry.description || '--'}</td>
                                                    <td className="px-4 py-3 text-right font-medium tabular-nums">
                                                        <span className={entry.type === 'receipt' ? 'text-success' : entry.type === 'disbursement' ? 'text-destructive' : ''}>
                                                            {entry.type === 'disbursement' ? '-' : ''}{formatCurrency(Number(entry.amount))}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-right text-muted-foreground tabular-nums">
                                                        {formatCurrency(Number(entry.balance_after))}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {entries.last_page > 1 && (
                                <div className="flex items-center justify-between px-4 py-3 border-t">
                                    <p className="text-sm text-muted-foreground">
                                        {entries.from}-{entries.to} of {entries.total}
                                    </p>
                                    <div className="flex gap-2">
                                        {entries.links.map((link, i) => (
                                            link.url ? (
                                                <Link
                                                    key={i}
                                                    href={link.url}
                                                    className={cn(
                                                        'px-3 py-1.5 text-xs rounded border transition-colors',
                                                        link.active
                                                            ? 'bg-primary text-primary-foreground border-primary'
                                                            : 'hover:bg-muted border-border',
                                                    )}
                                                    dangerouslySetInnerHTML={{ __html: link.label }}
                                                />
                                            ) : (
                                                <span
                                                    key={i}
                                                    className="px-3 py-1.5 text-xs rounded border border-border text-muted-foreground opacity-50"
                                                    dangerouslySetInnerHTML={{ __html: link.label }}
                                                />
                                            )
                                        ))}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}
        </AppLayout>
    );
}

function DetailRow({ icon: Icon, label, value, onCopy, copied }: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    value: string;
    onCopy: () => void;
    copied: boolean;
}) {
    return (
        <div className="flex items-center gap-3 group">
            <div className="h-8 w-8 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">{label}</p>
                <p className="text-sm font-medium text-foreground truncate">{value}</p>
            </div>
            <button
                onClick={onCopy}
                className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-muted transition-all"
                title="Copy to clipboard"
            >
                {copied ? (
                    <Check className="h-3.5 w-3.5 text-success" />
                ) : (
                    <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                )}
            </button>
        </div>
    );
}
