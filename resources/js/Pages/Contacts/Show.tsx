import { Head, Link } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { formatDate, initials, CONTACT_TYPE_LABELS, LEAD_STATUS_LABELS } from '@/lib/utils';
import { ArrowLeft, Mail, Phone, MapPin, Edit, Briefcase } from 'lucide-react';
import type { Contact, Matter } from '@/types';

interface Props {
    contact: Contact & { matters: Matter[] };
}

const typeVariant: Record<string, any> = {
    individual: 'default', company: 'secondary', other_party: 'warning',
};

const leadVariant: Record<string, any> = {
    enquiry: 'secondary', consultation_booked: 'info', engaged: 'warning',
    matter_opened: 'success', declined: 'destructive',
};

export default function ShowContact({ contact }: Props) {
    const getTabFromLocation = () => {
        if (typeof window === 'undefined') return 'dashboard';
        return new URL(window.location.href).searchParams.get('tab') ?? 'dashboard';
    };

    const [tab, setTabState] = useState<string>(getTabFromLocation);

    useEffect(() => {
        const onPopState = () => setTabState(getTabFromLocation());
        window.addEventListener('popstate', onPopState);
        return () => window.removeEventListener('popstate', onPopState);
    }, []);

    const setTab = (next: string) => {
        setTabState(next);
        const url = new URL(window.location.href);
        url.searchParams.set('tab', next);
        window.history.pushState({}, '', url);
    };

    const allMatters = contact.matters || [];
    const primaryMatters = allMatters.filter((m: any) => (m.pivot?.role || 'client') === 'client');
    const relatedMatters = allMatters.filter((m: any) => (m.pivot?.role || 'client') !== 'client');

    return (
        <AppLayout title={contact.name}>
            <Head title={contact.name} />

            <div className="mb-8 flex items-center justify-between">
                <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                    <Link href="/contacts">
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Contacts
                    </Link>
                </Button>
                <Button asChild size="sm">
                    <Link href={`/contacts/${contact.id}/edit`}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                    </Link>
                </Button>
            </div>

            {/* Tabs */}
            <div className="mb-6 flex flex-wrap gap-2 border-b border-border/60">
                {[
                    { key: 'dashboard', label: 'Dashboard' },
                    { key: 'matters', label: 'Matters' },
                    { key: 'documents', label: 'Documents' },
                    { key: 'billing', label: 'Billing' },
                    { key: 'transactions', label: 'Transactions' },
                    { key: 'notes', label: 'Notes' },
                ].map((t) => (
                    <Button
                        key={t.key}
                        type="button"
                        variant={tab === t.key ? 'default' : 'ghost'}
                        size="sm"
                        className="rounded-none border-b-2 border-transparent data-[active=true]:border-primary"
                        data-active={tab === t.key}
                        onClick={() => setTab(t.key)}
                    >
                        {t.label}
                    </Button>
                ))}
            </div>

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
                {/* Contact Card */}
                <Card className="lg:col-span-1 surface-card">
                    <CardContent className="p-8">
                        <div className="flex flex-col items-center text-center mb-8">
                            <Avatar className="h-24 w-24 mb-5">
                                <AvatarFallback className="bg-primary/10 text-primary text-3xl font-semibold">
                                    {initials(contact.name)}
                                </AvatarFallback>
                            </Avatar>
                            <h2 className="text-2xl font-bold tracking-tight mb-2">{contact.name}</h2>
                            {contact.type === 'company' && contact.company_number && (
                                <p className="text-sm text-muted-foreground">Company #{contact.company_number}</p>
                            )}
                            <div className="flex gap-2 mt-5">
                                <Badge variant={typeVariant[contact.type]} className="capitalize">
                                    {CONTACT_TYPE_LABELS[contact.type] || contact.type}
                                </Badge>
                                {contact.lead_status && (
                                    <Badge variant={leadVariant[contact.lead_status] ?? 'secondary'} className="capitalize">
                                        {LEAD_STATUS_LABELS[contact.lead_status] || contact.lead_status.replace('_', ' ')}
                                    </Badge>
                                )}
                            </div>
                        </div>

                        <Separator className="mb-6" />

                        <div className="space-y-4">
                            {contact.email && (
                                <div className="flex items-center gap-3 text-sm">
                                    <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                                    <a href={`mailto:${contact.email}`} className="hover:text-primary truncate transition-colors">
                                        {contact.email}
                                    </a>
                                </div>
                            )}
                            {contact.phone && (
                                <div className="flex items-center gap-3 text-sm">
                                    <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                                    <a href={`tel:${contact.phone}`} className="hover:text-primary transition-colors">
                                        {contact.phone}
                                    </a>
                                </div>
                            )}
                            {(contact.address as any)?.line1 && (
                                <div className="flex items-start gap-3 text-sm">
                                    <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                                    <div className="text-muted-foreground">
                                        <p>{(contact.address as any).line1}</p>
                                        {(contact.address as any).line2 && <p>{(contact.address as any).line2}</p>}
                                        <p>
                                            {[(contact.address as any).city, (contact.address as any).county, (contact.address as any).postcode]
                                                .filter(Boolean).join(', ')}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {contact.type === 'company' && ((contact as any).contact_person_name || (contact as any).contact_person_email || (contact as any).contact_person_phone) && (
                            <>
                                <Separator className="my-6" />
                                <div className="space-y-3">
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Contact Person</p>
                                    {(contact as any).contact_person_name && (
                                        <p className="text-sm font-medium">{(contact as any).contact_person_name}</p>
                                    )}
                                    {(contact as any).contact_person_email && (
                                        <div className="flex items-center gap-3 text-sm">
                                            <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                                            <a href={`mailto:${(contact as any).contact_person_email}`} className="hover:text-primary truncate transition-colors">
                                                {(contact as any).contact_person_email}
                                            </a>
                                        </div>
                                    )}
                                    {(contact as any).contact_person_phone && (
                                        <div className="flex items-center gap-3 text-sm">
                                            <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                                            <a href={`tel:${(contact as any).contact_person_phone}`} className="hover:text-primary transition-colors">
                                                {(contact as any).contact_person_phone}
                                            </a>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}

                        <Separator className="my-6" />

                        <div className="text-xs text-muted-foreground space-y-2">
                            <p>Added {formatDate(contact.created_at)}</p>
                                                        {(contact as any).dob && <p>DOB: {formatDate((contact as any).dob)}</p>}
                        </div>
                    </CardContent>
                </Card>

                {/* Workspace */}
                <div className="lg:col-span-2 space-y-8">
                    {(tab === 'dashboard' || tab === 'matters') && (
                        <>
                            <Card className="surface-card">
                                <CardHeader className="flex flex-row items-center justify-between pb-4">
                                    <CardTitle className="text-base tracking-tight flex items-center gap-2">
                                        <Briefcase className="h-4 w-4" />
                                        Primary Matters ({primaryMatters.length})
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-0">
                                    {primaryMatters.length === 0 ? (
                                        <p className="px-6 py-8 text-sm text-muted-foreground text-center">
                                            No primary matters yet.
                                        </p>
                                    ) : (
                                        <div className="divide-y divide-border/60">
                                            {primaryMatters.map((matter: Matter & any) => (
                                                <Link
                                                    key={matter.id}
                                                    href={`/matters/${matter.id}`}
                                                    className="group flex items-center justify-between px-6 py-3 hover:bg-muted/40 transition-colors"
                                                >
                                                    <div>
                                                        <p className="text-sm font-medium group-hover:text-primary transition-colors">{matter.name}</p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {matter.matter_number} · Opened {formatDate(matter.opened_at)}
                                                        </p>
                                                    </div>
                                                    <Badge variant={matter.status === 'open' ? 'success' : 'secondary'} className="capitalize shrink-0">
                                                        {matter.status.replace('_', ' ')}
                                                    </Badge>
                                                </Link>
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            <Card className="surface-card">
                                <CardHeader className="flex flex-row items-center justify-between pb-4">
                                    <CardTitle className="text-base tracking-tight flex items-center gap-2">
                                        <Briefcase className="h-4 w-4" />
                                        Related Matters ({relatedMatters.length})
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-0">
                                    {relatedMatters.length === 0 ? (
                                        <p className="px-6 py-8 text-sm text-muted-foreground text-center">
                                            No related matters.
                                        </p>
                                    ) : (
                                        <div className="divide-y divide-border/60">
                                            {relatedMatters.map((matter: Matter & any) => (
                                                <Link
                                                    key={matter.id}
                                                    href={`/matters/${matter.id}`}
                                                    className="group flex items-center justify-between px-6 py-3 hover:bg-muted/40 transition-colors"
                                                >
                                                    <div>
                                                        <p className="text-sm font-medium group-hover:text-primary transition-colors">{matter.name}</p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {matter.matter_number}
                                                            {matter.pivot?.role ? ` · Role: ${matter.pivot.role.replace('_', ' ')}` : ''}
                                                        </p>
                                                    </div>
                                                    <Badge variant={matter.status === 'open' ? 'success' : 'secondary'} className="capitalize shrink-0">
                                                        {matter.status.replace('_', ' ')}
                                                    </Badge>
                                                </Link>
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </>
                    )}

                    {tab !== 'dashboard' && tab !== 'matters' && (
                        <Card className="surface-card">
                            <CardHeader className="pb-4">
                                <CardTitle className="text-base tracking-tight">{tab.charAt(0).toUpperCase() + tab.slice(1)}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-muted-foreground">Coming soon.</p>
                            </CardContent>
                        </Card>
                    )}

                </div>
            </div>
        </AppLayout>
    );
}
