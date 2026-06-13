import { Head, Link, router } from '@inertiajs/react';
import { useState, useEffect, useRef } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { formatDate, initials, CONTACT_TYPE_LABELS, LEAD_STATUS_LABELS } from '@/lib/utils';
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
                        <>
                            <div className="divide-y divide-border/60">
                                {contacts.data.map((contact) => (
                                    <Link
                                        key={contact.id}
                                        href={`/contacts/${contact.id}`}
                                        className="group flex items-center gap-4 px-4 py-3 hover:bg-muted/40 transition-colors"
                                    >
                                        <Avatar className="h-9 w-9 shrink-0">
                                            <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                                                {initials(contact.name)}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{contact.name}</p>
                                            <p className="text-xs text-muted-foreground truncate">
                                                {contact.email ?? contact.phone ?? '—'}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <Badge variant={typeVariant[contact.type]} className="capitalize text-xs">
                                                {CONTACT_TYPE_LABELS[contact.type] || contact.type}
                                            </Badge>
                                            {contact.lead_status && (
                                                <Badge variant={leadColors[contact.lead_status] ?? 'secondary'} className="capitalize text-xs hidden sm:inline-flex">
                                                    {LEAD_STATUS_LABELS[contact.lead_status] || contact.lead_status.replace('_', ' ')}
                                                </Badge>
                                            )}
                                            <span className="text-xs text-muted-foreground hidden md:block">
                                                {formatDate(contact.created_at)}
                                            </span>
                                        </div>
                                    </Link>
                                ))}
                            </div>

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
                        </>
                    )}
                </CardContent>
            </Card>
        </AppLayout>
    );
}
