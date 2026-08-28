import { Head, Link, router } from '@inertiajs/react';
import { useState, useEffect, useRef } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import {
    Table, TableHeader, TableHeaderRow, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatDate, CONTACT_TYPE_LABELS, LEAD_STATUS_LABELS } from '@/lib/utils';
import { Plus, Search, X, Users } from 'lucide-react';
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
    filters: { search?: string; type?: string };
}

const typeVariant: Record<string, any> = {
    individual: 'default', company: 'info', other_party: 'secondary',
};

const typeBadgeStyles: Record<string, string> = {
    individual: 'bg-muted text-muted-foreground border-border',
    company: 'bg-info/15 text-info border-info/25',
    other_party: 'bg-secondary/15 text-secondary-foreground border-secondary/25',
};

const leadColors: Record<string, any> = {
    enquiry: 'secondary', consultation_booked: 'info', engaged: 'warning',
    matter_opened: 'success', declined: 'destructive',
};

const leadBadgeStyles: Record<string, string> = {
    enquiry: 'bg-muted text-muted-foreground border-border',
    consultation_booked: 'bg-info/15 text-info border-info/25',
    engaged: 'bg-warning/15 text-warning border-warning/25',
    matter_opened: 'bg-success/15 text-success border-success/25',
    declined: 'bg-destructive/15 text-destructive border-destructive/25',
};

export default function ContactsIndex({ contacts, filters }: Props) {
    const [search, setSearch] = useState(filters.search ?? '');
    const [type, setType]     = useState(filters.type ?? '_all');
    const debounced           = useDebounce(search, 300);
    const isFirstRun          = useRef(true);

    useEffect(() => {
        if (isFirstRun.current) { isFirstRun.current = false; return; }
        router.get('/contacts', {
            search: debounced || undefined,
            type:   type === '_all' ? undefined : type,
        }, { preserveState: true, replace: true });
    }, [debounced, type]);

    const hasFilters = search || type !== '_all';

    return (
        <AppLayout title="Contacts">
            <Head title="Contacts" />

            <div className="flex flex-col gap-3 mb-6">
                <div className="flex items-center justify-between">
                    <h1 className="text-[26px] font-extrabold tracking-tight">Contacts</h1>
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
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableHeaderRow>
                                        <TableHead>Name</TableHead>
                                        <TableHead className="hidden md:table-cell">Email</TableHead>
                                        <TableHead className="hidden lg:table-cell">Phone</TableHead>
                                        <TableHead>Type</TableHead>
                                        <TableHead className="hidden sm:table-cell">Lead Status</TableHead>
                                        <TableHead className="hidden xl:table-cell">Added</TableHead>
                                    </TableHeaderRow>
                                </TableHeader>
                                <TableBody>
                                    {contacts.data.map((contact) => (
                                        <TableRow key={contact.id} className="cursor-pointer" onClick={() => router.visit(`/contacts/${contact.id}`)}
                                        >
                                            <TableCell>
                                                <p className="font-medium text-foreground">{contact.full_name || contact.name}</p>
                                                {contact.type === 'company' && contact.company_number && (
                                                    <p className="text-xs text-muted-foreground mt-0.5">#{contact.company_number}</p>
                                                )}
                                            </TableCell>
                                            <TableCell className="hidden md:table-cell text-muted-foreground">
                                                {contact.email ?? '—'}
                                            </TableCell>
                                            <TableCell className="hidden lg:table-cell text-muted-foreground">
                                                {contact.phone ?? '—'}
                                            </TableCell>
                                            <TableCell>
                                                <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${typeBadgeStyles[contact.type] ?? 'bg-muted text-muted-foreground border-border'}`}>
                                                    {CONTACT_TYPE_LABELS[contact.type] || contact.type}
                                                </span>
                                            </TableCell>
                                            <TableCell className="hidden sm:table-cell">
                                                {contact.lead_status ? (
                                                    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${leadBadgeStyles[contact.lead_status] ?? 'bg-muted text-muted-foreground border-border'}`}>
                                                        {LEAD_STATUS_LABELS[contact.lead_status] || contact.lead_status.replace('_', ' ')}
                                                    </span>
                                                ) : (
                                                    <span className="text-muted-foreground">—</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="hidden xl:table-cell text-muted-foreground">
                                                {formatDate(contact.created_at)}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}

                    {contacts.last_page > 1 && (
                        <div className="flex items-center justify-between px-4 py-3 border-t">
                            <p className="text-sm text-muted-foreground">
                                Showing {contacts.from}–{contacts.to} of {contacts.total}
                            </p>
                            <div className="flex gap-1">
                                {contacts.links.map((link, i) => (
                                    <Button
                                        key={i}
                                        variant={link.active ? 'default' : 'outline'}
                                        size="sm"
                                        disabled={!link.url}
                                        onClick={() => link.url && router.visit(link.url)}
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
