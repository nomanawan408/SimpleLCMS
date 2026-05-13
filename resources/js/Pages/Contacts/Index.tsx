import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { formatDate, initials } from '@/lib/utils';
import { Plus, Search } from 'lucide-react';
import type { Contact, PaginatedData } from '@/types';

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

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        router.get('/contacts', { search }, { preserveState: true });
    };

    return (
        <AppLayout title="Contacts">
            <Head title="Contacts" />

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
                <form onSubmit={handleSearch} className="flex gap-2 flex-1 max-w-md">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            className="pl-9"
                            placeholder="Search contacts…"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <Button type="submit" variant="outline" size="sm">Search</Button>
                </form>
                <Button asChild>
                    <Link href="/contacts/create">
                        <Plus className="h-4 w-4 mr-2" />
                        New Contact
                    </Link>
                </Button>
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
                                                {contact.type.replace('_', ' ')}
                                            </Badge>
                                            {contact.lead_status && (
                                                <Badge variant={leadColors[contact.lead_status] ?? 'secondary'} className="capitalize text-xs hidden sm:inline-flex">
                                                    {contact.lead_status.replace('_', ' ')}
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
