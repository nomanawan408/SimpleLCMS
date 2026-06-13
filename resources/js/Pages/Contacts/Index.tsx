import { Head, Link, router } from '@inertiajs/react';
import { useState, useEffect, useRef } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatDate, CONTACT_TYPE_LABELS, LEAD_STATUS_LABELS } from '@/lib/utils';
import { Plus, Search, X } from 'lucide-react';
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

const leadColors: Record<string, any> = {
    enquiry: 'secondary', consultation_booked: 'info', engaged: 'warning',
    matter_opened: 'success', declined: 'destructive',
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
                    <h1 className="text-2xl font-bold tracking-tight">Contacts</h1>
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

            <Card className="surface-card">
                <CardContent className="p-0">
                    {contacts.data.length === 0 ? (
                        <div className="py-16 text-center">
                            <p className="text-muted-foreground text-sm mb-4">No contacts found.</p>
                            <Button asChild size="sm">
                                <Link href="/contacts/create">Add your first contact</Link>
                            </Button>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b bg-muted/30">
                                        <th className="text-left px-4 py-3 font-medium text-muted-foreground tracking-tight">Name</th>
                                        <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell tracking-tight">Email</th>
                                        <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell tracking-tight">Phone</th>
                                        <th className="text-left px-4 py-3 font-medium text-muted-foreground tracking-tight">Type</th>
                                        <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell tracking-tight">Lead Status</th>
                                        <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden xl:table-cell tracking-tight">Added</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/60">
                                    {contacts.data.map((contact) => (
                                        <tr
                                            key={contact.id}
                                            className="hover:bg-muted/40 cursor-pointer transition-colors"
                                            onClick={() => router.visit(`/contacts/${contact.id}`)}
                                        >
                                            <td className="px-4 py-3">
                                                <p className="font-medium">{contact.name}</p>
                                                {contact.type === 'company' && contact.company_number && (
                                                    <p className="text-xs text-muted-foreground">#{contact.company_number}</p>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">
                                                {contact.email ?? '—'}
                                            </td>
                                            <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">
                                                {contact.phone ?? '—'}
                                            </td>
                                            <td className="px-4 py-3">
                                                <Badge variant={typeVariant[contact.type]} className="capitalize text-xs">
                                                    {CONTACT_TYPE_LABELS[contact.type] || contact.type}
                                                </Badge>
                                            </td>
                                            <td className="px-4 py-3 hidden sm:table-cell">
                                                {contact.lead_status ? (
                                                    <Badge variant={leadColors[contact.lead_status] ?? 'secondary'} className="capitalize text-xs">
                                                        {LEAD_STATUS_LABELS[contact.lead_status] || contact.lead_status.replace('_', ' ')}
                                                    </Badge>
                                                ) : (
                                                    <span className="text-muted-foreground">—</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 hidden xl:table-cell text-muted-foreground">
                                                {formatDate(contact.created_at)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
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
