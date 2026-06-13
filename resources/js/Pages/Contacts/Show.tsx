import { Head, Link } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn, formatDate, CONTACT_TYPE_LABELS, LEAD_STATUS_LABELS } from '@/lib/utils';
import { ArrowLeft, Mail, Phone, MapPin, Edit, Briefcase, User, Building2 } from 'lucide-react';
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

            <div className="mb-5 flex items-center justify-between">
                <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground -ml-2">
                    <Link href="/contacts">
                        <ArrowLeft className="h-4 w-4 mr-1.5" />
                        Contacts
                    </Link>
                </Button>
                <Button asChild size="sm">
                    <Link href={`/contacts/${contact.id}/edit`}>
                        <Edit className="h-4 w-4 mr-1.5" />
                        Edit
                    </Link>
                </Button>
            </div>

            <Card className="surface-card mb-5">
                <CardContent className="p-5">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                                <Badge variant={typeVariant[contact.type]} className="text-xs font-semibold capitalize">
                                    {CONTACT_TYPE_LABELS[contact.type] || contact.type}
                                </Badge>
                                {contact.lead_status && (
                                    <Badge variant={leadVariant[contact.lead_status] ?? 'secondary'} className="text-xs font-semibold capitalize">
                                        {LEAD_STATUS_LABELS[contact.lead_status] || contact.lead_status.replace('_', ' ')}
                                    </Badge>
                                )}
                            </div>
                            <h1 className="text-xl font-bold tracking-tight mb-1">{contact.name}</h1>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                                {contact.email && (
                                    <span className="flex items-center gap-1">
                                        <Mail className="h-3.5 w-3.5" />
                                        <a href={`mailto:${contact.email}`} className="hover:text-primary transition-colors">{contact.email}</a>
                                    </span>
                                )}
                                {contact.phone && (
                                    <span className="flex items-center gap-1">
                                        <Phone className="h-3.5 w-3.5" />
                                        <a href={`tel:${contact.phone}`} className="hover:text-primary transition-colors">{contact.phone}</a>
                                    </span>
                                )}
                                {(contact.address as any)?.line1 && (
                                    <span className="flex items-center gap-1">
                                        <MapPin className="h-3.5 w-3.5" />
                                        {[
                                            (contact.address as any).city,
                                            (contact.address as any).postcode,
                                        ].filter(Boolean).join(', ')}
                                    </span>
                                )}
                                <span className="flex items-center gap-1">
                                    Added {formatDate(contact.created_at)}
                                </span>
                            </div>
                        </div>

                        {contact.type === 'company' && contact.company_number && (
                            <div className="shrink-0 text-right hidden md:block">
                                <p className="text-sm font-medium flex items-center gap-1.5 justify-end">
                                    <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                                    Company #{contact.company_number}
                                </p>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            <div className="mb-5 border-b border-border/60 overflow-x-auto">
                <div className="flex items-center gap-0 min-w-max">
                    {[
                        { key: 'dashboard', label: 'Overview', count: null },
                        { key: 'matters', label: 'Matters', count: allMatters.length || null },
                        { key: 'documents', label: 'Documents', count: null },
                        { key: 'billing', label: 'Billing', count: null },
                        { key: 'transactions', label: 'Transactions', count: null },
                        { key: 'notes', label: 'Notes', count: null },
                    ].map((t) => (
                        <button
                            key={t.key}
                            type="button"
                            onClick={() => setTab(t.key)}
                            className={cn(
                                'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                                tab === t.key
                                    ? 'border-primary text-primary'
                                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border',
                            )}
                        >
                            {t.label}
                            {t.count !== null && t.count > 0 && (
                                <span className={cn(
                                    'inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold',
                                    tab === t.key ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                                )}>{t.count}</span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {(tab === 'dashboard' || tab === 'matters') && (
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                    <div className="lg:col-span-2 space-y-5">
                        <Card className="surface-card">
                            <CardHeader className="flex flex-row items-center justify-between pb-3">
                                <CardTitle className="text-base tracking-tight flex items-center gap-2">
                                    <Briefcase className="h-4 w-4" />
                                    Primary Matters
                                </CardTitle>
                                <span className="text-xs text-muted-foreground">{primaryMatters.length} total</span>
                            </CardHeader>
                            <CardContent className="p-0">
                                {primaryMatters.length === 0 ? (
                                    <div className="px-6 py-8 text-center text-sm text-muted-foreground">
                                        <Briefcase className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                                        No primary matters yet.
                                    </div>
                                ) : (
                                    <div className="divide-y divide-border/60">
                                        {primaryMatters.map((matter: Matter & any) => (
                                            <Link
                                                key={matter.id}
                                                href={`/matters/${matter.id}`}
                                                className="group flex items-center justify-between px-5 py-3 hover:bg-muted/30 transition-colors"
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
                            <CardHeader className="flex flex-row items-center justify-between pb-3">
                                <CardTitle className="text-base tracking-tight flex items-center gap-2">
                                    <Briefcase className="h-4 w-4" />
                                    Related Matters
                                </CardTitle>
                                <span className="text-xs text-muted-foreground">{relatedMatters.length} total</span>
                            </CardHeader>
                            <CardContent className="p-0">
                                {relatedMatters.length === 0 ? (
                                    <div className="px-6 py-8 text-center text-sm text-muted-foreground">
                                        <Briefcase className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                                        No related matters.
                                    </div>
                                ) : (
                                    <div className="divide-y divide-border/60">
                                        {relatedMatters.map((matter: Matter & any) => (
                                            <Link
                                                key={matter.id}
                                                href={`/matters/${matter.id}`}
                                                className="group flex items-center justify-between px-5 py-3 hover:bg-muted/30 transition-colors"
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
                    </div>

                    <div className="space-y-5">
                        <Card className="surface-card">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base tracking-tight flex items-center gap-2">
                                    <User className="h-4 w-4" />
                                    Contact Details
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4 pt-0">
                                {contact.email && (
                                    <div className="flex items-center gap-2.5 text-sm">
                                        <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                                        <a href={`mailto:${contact.email}`} className="hover:text-primary truncate transition-colors">
                                            {contact.email}
                                        </a>
                                    </div>
                                )}
                                {contact.phone && (
                                    <div className="flex items-center gap-2.5 text-sm">
                                        <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                                        <a href={`tel:${contact.phone}`} className="hover:text-primary transition-colors">
                                            {contact.phone}
                                        </a>
                                    </div>
                                )}
                                {(contact.address as any)?.line1 && (
                                    <>
                                        <Separator />
                                        <div>
                                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Address</p>
                                            <div className="text-sm text-muted-foreground space-y-0.5">
                                                <p>{(contact.address as any).line1}</p>
                                                {(contact.address as any).line2 && <p>{(contact.address as any).line2}</p>}
                                                <p>
                                                    {[
                                                        (contact.address as any).city,
                                                        (contact.address as any).county,
                                                        (contact.address as any).postcode,
                                                    ].filter(Boolean).join(', ')}
                                                </p>
                                            </div>
                                        </div>
                                    </>
                                )}
                                {(contact as any).dob && (
                                    <>
                                        <Separator />
                                        <div>
                                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Date of Birth</p>
                                            <p className="text-sm">{formatDate((contact as any).dob)}</p>
                                        </div>
                                    </>
                                )}
                            </CardContent>
                        </Card>

                        {contact.type === 'company' && ((contact as any).contact_person_name || (contact as any).contact_person_email || (contact as any).contact_person_phone) && (
                            <Card className="surface-card">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-base tracking-tight flex items-center gap-2">
                                        <User className="h-4 w-4" />
                                        Contact Person
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3 pt-0">
                                    {(contact as any).contact_person_name && (
                                        <p className="text-sm font-medium">{(contact as any).contact_person_name}</p>
                                    )}
                                    {(contact as any).contact_person_email && (
                                        <div className="flex items-center gap-2.5 text-sm">
                                            <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                                            <a href={`mailto:${(contact as any).contact_person_email}`} className="hover:text-primary truncate transition-colors">
                                                {(contact as any).contact_person_email}
                                            </a>
                                        </div>
                                    )}
                                    {(contact as any).contact_person_phone && (
                                        <div className="flex items-center gap-2.5 text-sm">
                                            <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                                            <a href={`tel:${(contact as any).contact_person_phone}`} className="hover:text-primary transition-colors">
                                                {(contact as any).contact_person_phone}
                                            </a>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </div>
            )}

            {tab !== 'dashboard' && tab !== 'matters' && (
                <Card className="surface-card">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base tracking-tight">{tab.charAt(0).toUpperCase() + tab.slice(1)}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground">Coming soon.</p>
                    </CardContent>
                </Card>
            )}
        </AppLayout>
    );
}
