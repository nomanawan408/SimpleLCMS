import { Head, Link, router } from '@inertiajs/react';
import { useState, useEffect, useMemo, useRef } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { DynamicTable, type DynamicColumn } from '@/components/table/DynamicTable';
import type { TablePreferences } from '@/lib/tablePreferences';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatDate, initials, CONTACT_TYPE_LABELS, LEAD_STATUS_LABELS } from '@/lib/utils';
import { Plus, Search, X, Users, Mail, Phone } from 'lucide-react';
import type { Contact, PaginatedData } from '@/types';

function useDebounce(value: string, delay: number) {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(t);
    }, [value, delay]);
    return debounced;
}

interface Props {
    contacts: PaginatedData<Contact>;
    filters: { search?: string; type?: string; lead_status?: string };
    tablePreferences?: TablePreferences | null;
}

const typeBadgeStyles: Record<string, string> = {
    individual: 'bg-zinc-50 text-zinc-700 border-zinc-200',
    company: 'bg-sky-50 text-sky-700 border-sky-200',
    other_party: 'bg-violet-50 text-violet-700 border-violet-200',
};

const leadBadgeStyles: Record<string, string> = {
    enquiry: 'bg-zinc-50 text-zinc-600 border-zinc-200',
    consultation_booked: 'bg-sky-50 text-sky-700 border-sky-200',
    engaged: 'bg-amber-50 text-amber-800 border-amber-200',
    matter_opened: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    declined: 'bg-red-50 text-red-700 border-red-200',
};

export default function ContactsIndex({ contacts, filters, tablePreferences }: Props) {
    const [search, setSearch] = useState(filters.search ?? '');
    const [type, setType] = useState(filters.type ?? '_all');
    const debounced = useDebounce(search, 300);
    const isFirstRun = useRef(true);

    const columns: DynamicColumn<Contact>[] = useMemo(() => [
        {
            id: 'contact',
            header: 'Contact',
            defaultWidth: 260,
            minWidth: 200,
            maxWidth: 380,
            hideable: false,
            cell: (contact) => {
                const displayName = contact.full_name || contact.name;
                return (
                    <span className="flex items-center gap-3 min-w-0">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary" aria-hidden>
                            {initials(displayName)}
                        </span>
                        <span className="min-w-0">
                            <p className="truncate text-sm font-semibold leading-snug text-foreground group-hover:text-primary" title={displayName}>
                                {displayName}
                            </p>
                            {contact.type === 'company' && contact.company_number ? (
                                <p className="truncate text-xs tabular-nums tracking-wide text-muted-foreground">#{contact.company_number}</p>
                            ) : contact.email ? (
                                <p className="truncate text-xs text-muted-foreground" title={contact.email}>{contact.email}</p>
                            ) : null}
                        </span>
                    </span>
                );
            },
        },
        {
            id: 'email',
            header: 'Email',
            defaultWidth: 220,
            minWidth: 160,
            maxWidth: 320,
            cell: (contact) => contact.email ? (
                <span className="inline-flex max-w-full items-center gap-1.5 truncate text-sm text-muted-foreground" title={contact.email}>
                    <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
                    <span className="truncate">{contact.email}</span>
                </span>
            ) : (
                <span className="text-sm text-muted-foreground/40">—</span>
            ),
        },
        {
            id: 'phone',
            header: 'Phone',
            defaultWidth: 150,
            minWidth: 120,
            maxWidth: 200,
            cell: (contact) => contact.phone ? (
                <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm tabular-nums text-muted-foreground" title={contact.phone}>
                    <Phone className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
                    {contact.phone}
                </span>
            ) : (
                <span className="text-sm text-muted-foreground/40">—</span>
            ),
        },
        {
            id: 'type',
            header: 'Type',
            defaultWidth: 130,
            minWidth: 110,
            maxWidth: 180,
            cell: (contact) => (
                <span className={`inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium leading-none ${typeBadgeStyles[contact.type] ?? 'bg-muted text-muted-foreground border-border'}`}>
                    {CONTACT_TYPE_LABELS[contact.type] || contact.type.replace(/_/g, ' ')}
                </span>
            ),
        },
        {
            id: 'lead_status',
            header: 'Lead Status',
            defaultWidth: 150,
            minWidth: 120,
            maxWidth: 200,
            cell: (contact) => contact.lead_status ? (
                <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium leading-none ${leadBadgeStyles[contact.lead_status] ?? 'bg-muted text-muted-foreground border-border'}`}>
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" aria-hidden />
                    {LEAD_STATUS_LABELS[contact.lead_status] || contact.lead_status.replace(/_/g, ' ')}
                </span>
            ) : (
                <span className="text-sm text-muted-foreground/40">—</span>
            ),
        },
        {
            id: 'added',
            header: 'Added',
            defaultWidth: 130,
            minWidth: 110,
            maxWidth: 180,
            cell: (contact) => (
                <span className="whitespace-nowrap text-sm tabular-nums text-muted-foreground">{formatDate(contact.created_at)}</span>
            ),
        },
        {
            id: 'phone_secondary',
            header: 'Alt Phone',
            defaultWidth: 140,
            minWidth: 120,
            maxWidth: 200,
            defaultVisible: false,
            cell: (contact) => contact.phone_secondary ? (
                <span className="whitespace-nowrap text-sm tabular-nums text-muted-foreground">{contact.phone_secondary}</span>
            ) : (
                <span className="text-sm text-muted-foreground/40">—</span>
            ),
        },
        {
            id: 'address',
            header: 'Address',
            defaultWidth: 220,
            minWidth: 160,
            maxWidth: 340,
            defaultVisible: false,
            cell: (contact) => {
                const addr = contact.address;
                const line = addr ? [addr.line1, addr.city, addr.postcode].filter(Boolean).join(', ') : null;
                return line ? (
                    <p className="truncate text-sm text-muted-foreground" title={line}>{line}</p>
                ) : (
                    <span className="text-sm text-muted-foreground/40">—</span>
                );
            },
        },
        {
            id: 'source',
            header: 'Source',
            defaultWidth: 140,
            minWidth: 110,
            maxWidth: 200,
            defaultVisible: false,
            cell: (contact) => contact.source ? (
                <span className="whitespace-nowrap text-sm capitalize text-muted-foreground">{contact.source.replace(/_/g, ' ')}</span>
            ) : (
                <span className="text-sm text-muted-foreground/40">—</span>
            ),
        },
        {
            id: 'tags',
            header: 'Tags',
            defaultWidth: 160,
            minWidth: 120,
            maxWidth: 260,
            defaultVisible: false,
            cell: (contact) => contact.tags && contact.tags.length > 0 ? (
                <span className="flex flex-wrap gap-1">
                    {contact.tags.slice(0, 3).map((tag) => (
                        <Badge key={tag} variant="secondary" className="rounded-full px-2 py-0 text-xs font-medium">{tag}</Badge>
                    ))}
                    {contact.tags.length > 3 && (
                        <span className="text-xs text-muted-foreground">+{contact.tags.length - 3}</span>
                    )}
                </span>
            ) : (
                <span className="text-sm text-muted-foreground/40">—</span>
            ),
        },
    ], []);

    useEffect(() => {
        if (isFirstRun.current) { isFirstRun.current = false; return; }
        router.get('/contacts', {
            search: debounced || undefined,
            type: type === '_all' ? undefined : type,
        }, { preserveState: true, replace: true });
    }, [debounced, type]);

    const hasFilters = search || type !== '_all';

    return (
        <AppLayout title="Contacts">
            <Head title="Contacts" />

            <div className="flex flex-col gap-3 mb-6">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-extrabold tracking-tight">Contacts</h1>
                    <Button asChild className="gap-2">
                        <Link href="/contacts/create"><Plus className="h-4 w-4" />New Contact</Link>
                    </Button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
                        <Input
                            className="pl-8 h-9 text-sm"
                            placeholder="Search by name, email, phone…"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                        {search && (
                            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                                <X className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>
                    <Select value={type} onValueChange={setType}>
                        <SelectTrigger className="h-9 w-38 text-sm"><SelectValue placeholder="Type" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="_all">All types</SelectItem>
                            <SelectItem value="individual">{CONTACT_TYPE_LABELS.individual}</SelectItem>
                            <SelectItem value="company">{CONTACT_TYPE_LABELS.company}</SelectItem>
                            <SelectItem value="other_party">{CONTACT_TYPE_LABELS.other_party}</SelectItem>
                        </SelectContent>
                    </Select>
                    {hasFilters && (
                        <button onClick={() => { setSearch(''); setType('_all'); }} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors">
                            <X className="h-3 w-3" />Clear
                        </button>
                    )}
                </div>
            </div>

            <Card className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">
                <CardContent className="p-0">
                    {contacts.data.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                                <Users className="h-7 w-7 text-primary" />
                            </div>
                            <p className="text-foreground font-medium mb-1">No contacts found</p>
                            <p className="text-muted-foreground text-sm mb-4">
                                {hasFilters ? 'Try adjusting your search or filters' : 'Add your first contact to get started'}
                            </p>
                            <Button asChild>
                                <Link href="/contacts/create"><Plus className="h-4 w-4 mr-2" />New Contact</Link>
                            </Button>
                        </div>
                    ) : (
                        <DynamicTable
                            tableKey="contacts.index"
                            columns={columns}
                            data={contacts.data}
                            initialPreferences={tablePreferences}
                            getRowId={(contact) => contact.id}
                            onRowClick={(contact) => router.visit(`/contacts/${contact.id}`)}
                        />
                    )}

                    {contacts.last_page > 1 && (
                        <div className="flex items-center justify-between px-4 py-3 border-t">
                            <p className="text-sm text-muted-foreground">
                                Showing {contacts.from}–{contacts.to} of {contacts.total}
                            </p>
                            <div className="flex gap-1">
                                {contacts.links.map((link, i) => (
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
