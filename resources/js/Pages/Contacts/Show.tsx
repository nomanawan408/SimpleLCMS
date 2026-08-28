import { Head, Link } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn, formatDate, formatCurrency, CONTACT_TYPE_LABELS, LEAD_STATUS_LABELS } from '@/lib/utils';
import {
    ArrowLeft, ChevronRight, Mail, Phone, MapPin, Edit, Briefcase, User, Building2,
    Receipt, CreditCard, Calendar, MessageSquare, Plus, Trash2, PhoneCall, Mails,
    Users as UsersIcon, FileText, Wallet, TrendingUp, Paperclip, Download,
} from 'lucide-react';
import type { Contact, Matter, Invoice } from '@/types';

interface ContactNote {
    id: string;
    body: string;
    type: 'note' | 'call_log' | 'email_log' | 'meeting_log';
    logged_at: string;
    user?: { id: string; full_name: string } | null;
}

interface ContactDocument {
    id: string;
    name: string;
    original_name?: string | null;
    mime_type?: string | null;
    size_bytes?: number | null;
    created_at: string;
    matter?: { id: string; name: string; matter_number: string } | null;
    uploaded_by?: { id: string; full_name: string } | null;
}

interface Props {
    contact: Contact & { matters: Matter[]; notes?: ContactNote[] };
    invoices: (Invoice & { matter?: { id: string; name: string; matter_number: string }; payments?: { id: string; amount: number; method: string; paid_at: string }[] })[];
    documents?: ContactDocument[];
    canEditContact?: boolean;
    canViewDocuments?: boolean;
}

const formatBytes = (bytes?: number | null) => {
    if (!bytes) return '—';
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let i = 0;
    while (size >= 1024 && i < units.length - 1) { size /= 1024; i += 1; }
    return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
};

const NOTE_TYPES = [
    { value: 'note', label: 'Note', icon: MessageSquare },
    { value: 'call_log', label: 'Call', icon: PhoneCall },
    { value: 'email_log', label: 'Email', icon: Mails },
    { value: 'meeting_log', label: 'Meeting', icon: UsersIcon },
] as const;

const noteMeta = (type: string) => NOTE_TYPES.find((t) => t.value === type) ?? NOTE_TYPES[0];

const typeVariant: Record<string, any> = {
    individual: 'default', company: 'secondary', other_party: 'warning',
};

const leadVariant: Record<string, any> = {
    enquiry: 'secondary', consultation_booked: 'info', engaged: 'warning',
    matter_opened: 'success', declined: 'destructive',
};

const leadAccent: Record<string, string> = {
    enquiry: 'bg-muted-foreground/40', consultation_booked: 'bg-info', engaged: 'bg-warning',
    matter_opened: 'bg-success', declined: 'bg-destructive',
};

const typeAccent: Record<string, string> = {
    individual: 'bg-foreground/70', company: 'bg-primary/40', other_party: 'bg-warning',
};

export default function ShowContact({ contact, invoices = [], documents = [], canEditContact = false, canViewDocuments = false }: Props) {
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

    // ── Notes ──────────────────────────────────────────────────────────────
    const [notes, setNotes] = useState<ContactNote[]>(contact.notes ?? []);
    const [noteModalOpen, setNoteModalOpen] = useState(false);
    const [noteSaving, setNoteSaving] = useState(false);
    const [noteError, setNoteError] = useState<string | null>(null);
    const [editingNote, setEditingNote] = useState<ContactNote | null>(null);
    const [noteForm, setNoteForm] = useState<{ body: string; type: string }>({ body: '', type: 'note' });

    const sendJson = async (method: string, url: string, body?: Record<string, unknown>) => {
        const token = (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement | null)?.content;
        const res = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                ...(token ? { 'X-CSRF-TOKEN': token } : {}),
            },
            ...(body ? { body: JSON.stringify(body) } : {}),
        });
        const payload = await res.json().catch(() => null);
        return { ok: res.ok, payload };
    };

    const openNoteModal = (note: ContactNote | null = null) => {
        setNoteError(null);
        setEditingNote(note);
        setNoteForm({ body: note?.body ?? '', type: note?.type ?? 'note' });
        setNoteModalOpen(true);
    };

    const saveNote = async () => {
        if (!noteForm.body.trim()) return;

        setNoteSaving(true);
        setNoteError(null);
        try {
            const body = { body: noteForm.body.trim(), type: noteForm.type };
            const { ok, payload } = editingNote
                ? await sendJson('PUT', `/contacts/${contact.id}/notes/${editingNote.id}`, body)
                : await sendJson('POST', `/contacts/${contact.id}/notes`, body);

            if (!ok) {
                const validation = payload?.errors
                    ? Object.values(payload.errors as Record<string, string[]>)?.[0]?.[0]
                    : null;
                setNoteError(validation || payload?.message || 'Unable to save the note.');
                return;
            }

            setNotes((prev) =>
                editingNote
                    ? prev.map((n) => (n.id === editingNote.id ? payload.note : n))
                    : [payload.note, ...prev],
            );
            setNoteModalOpen(false);
            setEditingNote(null);
        } catch {
            setNoteError('Unable to save the note.');
        } finally {
            setNoteSaving(false);
        }
    };

    const deleteNote = async (note: ContactNote) => {
        if (!window.confirm('Delete this note? This cannot be undone.')) return;

        const { ok, payload } = await sendJson('DELETE', `/contacts/${contact.id}/notes/${note.id}`);
        if (!ok) {
            window.alert(payload?.message || 'Unable to delete the note.');
            return;
        }
        setNotes((prev) => prev.filter((n) => n.id !== note.id));
    };

    const allMatters = contact.matters || [];
    const primaryMatters = allMatters.filter((m: any) => (m.pivot?.role || 'client') === 'client');
    const relatedMatters = allMatters.filter((m: any) => (m.pivot?.role || 'client') !== 'client');
    const openMatters = allMatters.filter((m: any) => m.status === 'open');

    // Mirrors the matter page: cancelled invoices never carry money, and
    // written-off ones count as invoiced but not outstanding.
    const activeInvoices = invoices.filter((i: any) => i.status !== 'cancelled');
    const paidFor = (invoice: any) => (invoice.payments ?? []).reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
    const totalInvoiced = activeInvoices.reduce((s: number, i: any) => s + Number(i.total || 0), 0);
    const totalPaid = activeInvoices.reduce((s: number, i: any) => s + paidFor(i), 0);
    const totalOutstanding = activeInvoices
        .filter((i: any) => !['paid', 'written_off'].includes(i.status))
        .reduce((s: number, i: any) => s + Math.max(0, Number(i.total || 0) - paidFor(i)), 0);

    const payments = invoices
        .flatMap((inv: any) => (inv.payments ?? []).map((p: any) => ({
            ...p,
            invoice_number: inv.invoice_number,
            matter_name: inv.matter?.name,
        })))
        .sort((a: any, b: any) => new Date(b.paid_at).getTime() - new Date(a.paid_at).getTime());

    const initials = (contact.full_name || contact.name || '?')
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();

    const addr = (contact.address as any) ?? {};
    const addressLines = [addr.city, addr.county, addr.postcode].filter(Boolean).join(', ');

    return (
        <AppLayout title={contact.full_name || contact.name}>
            <Head title={contact.full_name || contact.name} />

            {/* Navigation — Enterprise */}
            <div className="mb-5 flex items-center justify-between gap-3">
                <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground -ml-2 rounded-xl">
                    <Link href="/contacts" className="inline-flex items-center gap-1.5">
                        <ArrowLeft className="h-4 w-4" />
                        Contacts
                        <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
                        <span className="font-medium text-foreground truncate max-w-[180px]">{contact.full_name || contact.name}</span>
                    </Link>
                </Button>
                <div className="flex items-center gap-2">
                    {canEditContact && (
                        <Button size="sm" variant="outline" type="button" onClick={() => openNoteModal()} className="rounded-xl border-border/60">
                            <MessageSquare className="h-4 w-4 mr-1" />
                            Add Note
                        </Button>
                    )}
                    <Button asChild size="sm" variant="outline" className="rounded-xl border-border/60">
                        <Link href={`/matters/create?contact_id=${contact.id}`}>
                            <Briefcase className="h-4 w-4 mr-1" />
                            New Matter
                        </Link>
                    </Button>
                    <Button asChild size="sm" className="rounded-xl bg-primary shadow-sm">
                        <Link href={`/contacts/${contact.id}/edit`}>
                            <Edit className="h-4 w-4 mr-1" />
                            Edit Contact
                        </Link>
                    </Button>
                </div>
            </div>

            {/* Contact Header Card — Compact Enterprise */}
            <Card className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden mb-4">
                <div className={cn('h-[3px] w-full', contact.lead_status ? leadAccent[contact.lead_status] : typeAccent[contact.type])} />
                <CardContent className="p-0">
                    <div className="flex flex-wrap items-center gap-2 px-5 pt-3.5 text-xs text-muted-foreground">
                        <span className={cn('h-1.5 w-1.5 rounded-full', contact.lead_status ? leadAccent[contact.lead_status] : typeAccent[contact.type])} />
                        <Badge variant={typeVariant[contact.type]} className="text-[11px] font-semibold uppercase tracking-widest px-2 py-0 rounded-full">
                            {CONTACT_TYPE_LABELS[contact.type] || contact.type}
                        </Badge>
                        {contact.lead_status && (
                            <>
                                <span className="text-border">·</span>
                                <Badge variant={leadVariant[contact.lead_status] ?? 'secondary'} className="text-[11px] font-semibold uppercase tracking-widest px-2 py-0 rounded-full">
                                    {LEAD_STATUS_LABELS[contact.lead_status] || contact.lead_status.replace('_', ' ')}
                                </Badge>
                            </>
                        )}
                        {contact.company_number && (
                            <>
                                <span className="text-border">·</span>
                                <span className="font-mono tabular-nums text-[11px]">{contact.company_number}</span>
                            </>
                        )}
                    </div>

                    <div className="px-5 pt-2.5 pb-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-foreground text-background text-sm font-bold">
                                    {initials}
                                </span>
                                <div className="min-w-0">
                                    <h1 className="text-[20px] font-bold tracking-tight leading-tight text-foreground truncate">
                                        {contact.full_name || contact.name}
                                    </h1>
                                    {contact.email ? (
                                        <a href={`mailto:${contact.email}`} className="mt-0.5 block text-sm text-muted-foreground hover:text-primary transition-colors truncate">
                                            {contact.email}
                                        </a>
                                    ) : (
                                        <p className="mt-0.5 text-sm text-muted-foreground/50 italic">No email on file</p>
                                    )}
                                </div>
                            </div>

                            {allMatters.length > 0 && (
                                <div className="shrink-0 flex items-center gap-2 rounded-full border border-border/60 bg-muted/30 px-3 py-1.5">
                                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-foreground text-background"><Briefcase className="h-3 w-3" /></span>
                                    <span className="text-sm font-semibold text-foreground">
                                        {allMatters.length} {allMatters.length === 1 ? 'matter' : 'matters'}
                                    </span>
                                    {openMatters.length > 0 && (
                                        <span className="text-xs font-medium text-muted-foreground">· {openMatters.length} open</span>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
                            {contact.phone && (
                                <div className="rounded-xl border border-border/60 bg-muted/[0.18] px-3.5 py-2.5 flex items-center gap-2.5">
                                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-50 shrink-0"><Phone className="h-3.5 w-3.5 text-sky-600" /></span>
                                    <div className="min-w-0">
                                        <p className="text-[11px] font-medium text-muted-foreground leading-none">Phone</p>
                                        <a href={`tel:${contact.phone}`} className="text-sm font-semibold text-foreground truncate block hover:text-primary transition-colors">
                                            {contact.phone}
                                        </a>
                                    </div>
                                </div>
                            )}
                            {addr.line1 && (
                                <div className="rounded-xl border border-border/60 bg-muted/[0.18] px-3.5 py-2.5 flex items-center gap-2.5">
                                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-rose-50 shrink-0"><MapPin className="h-3.5 w-3.5 text-rose-600" /></span>
                                    <div className="min-w-0">
                                        <p className="text-[11px] font-medium text-muted-foreground leading-none">Address</p>
                                        <p className="text-sm font-semibold text-foreground truncate">{addr.line1}</p>
                                        {addressLines && <p className="text-[11px] text-muted-foreground truncate">{addressLines}</p>}
                                    </div>
                                </div>
                            )}
                            <div className="rounded-xl border border-border/60 bg-muted/[0.18] px-3.5 py-2.5 flex items-center gap-2.5">
                                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50 shrink-0"><Calendar className="h-3.5 w-3.5 text-emerald-600" /></span>
                                <div className="min-w-0">
                                    <p className="text-[11px] font-medium text-muted-foreground leading-none">Added</p>
                                    <p className="text-sm font-semibold text-foreground">{formatDate(contact.created_at)}</p>
                                </div>
                            </div>
                            {(contact as any).dob && (
                                <div className="rounded-xl border border-border/60 bg-muted/[0.18] px-3.5 py-2.5 flex items-center gap-2.5">
                                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-50 shrink-0"><Calendar className="h-3.5 w-3.5 text-violet-600" /></span>
                                    <div className="min-w-0">
                                        <p className="text-[11px] font-medium text-muted-foreground leading-none">Date of Birth</p>
                                        <p className="text-sm font-semibold text-foreground">{formatDate((contact as any).dob)}</p>
                                    </div>
                                </div>
                            )}
                            {contact.type === 'company' && contact.company_number && (
                                <div className="rounded-xl border border-border/60 bg-muted/[0.18] px-3.5 py-2.5 flex items-center gap-2.5">
                                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 shrink-0"><Building2 className="h-3.5 w-3.5 text-slate-600" /></span>
                                    <div className="min-w-0">
                                        <p className="text-[11px] font-medium text-muted-foreground leading-none">Company Number</p>
                                        <p className="font-mono text-sm font-bold text-foreground tabular-nums truncate">{contact.company_number}</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {(contact as any).source && (
                            <div className="mt-3 flex items-center gap-3 rounded-full border border-border/60 bg-muted/20 w-fit px-3.5 py-1.5 text-sm">
                                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-50 shrink-0"><TrendingUp className="h-3 w-3 text-teal-600" /></span>
                                <span className="font-medium text-foreground capitalize">{String((contact as any).source).replace(/_/g, ' ')}</span>
                                {(contact as any).source_detail && (
                                    <span className="text-muted-foreground text-xs">{(contact as any).source_detail}</span>
                                )}
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Financial Summary Strip — Colored Icons */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-6">
                {[
                    { label: 'Matters', value: String(allMatters.length), icon: Briefcase, bg: 'bg-blue-50', color: 'text-blue-600' },
                    { label: 'Total Invoiced', value: formatCurrency(totalInvoiced), icon: Receipt, bg: 'bg-amber-50', color: 'text-amber-600' },
                    { label: 'Total Paid', value: formatCurrency(totalPaid), icon: Wallet, bg: 'bg-emerald-50', color: 'text-emerald-600' },
                    { label: 'Outstanding', value: formatCurrency(totalOutstanding), icon: TrendingUp, bg: 'bg-orange-50', color: 'text-orange-600' },
                ].map((s) => (
                    <div key={s.label} className="rounded-xl border border-border/60 bg-card p-5 flex items-center justify-between shadow-sm">
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">{s.label}</p>
                            <p className="text-[22px] font-extrabold tracking-tight tabular-nums text-foreground mt-1.5 leading-none">{s.value}</p>
                        </div>
                        <div className={`flex h-10 w-10 items-center justify-center rounded-full shrink-0 ${s.bg}`}>
                            <s.icon className={`h-5 w-5 ${s.color}`} />
                        </div>
                    </div>
                ))}
            </div>

            {/* Tabs — Enterprise segmented */}
            <div className="mb-6">
                <div className="flex items-center gap-1 p-1 rounded-2xl bg-muted/40 border border-border/40 w-fit max-w-full overflow-x-auto">
                    {[
                        { key: 'dashboard', label: 'Overview', icon: FileText, count: null },
                        { key: 'matters', label: 'Matters', icon: Briefcase, count: allMatters.length || null },
                        ...(canViewDocuments ? [{ key: 'documents', label: 'Documents', icon: Paperclip, count: documents.length || null }] : []),
                        { key: 'billing', label: 'Billing', icon: Receipt, count: invoices.length || null },
                        { key: 'transactions', label: 'Transactions', icon: CreditCard, count: payments.length || null },
                        { key: 'notes', label: 'Notes', icon: MessageSquare, count: notes.length || null },
                    ].map((t) => (
                        <button
                            key={t.key}
                            type="button"
                            onClick={() => setTab(t.key)}
                            className={cn(
                                'flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-semibold whitespace-nowrap transition-all',
                                tab === t.key
                                    ? 'bg-card text-foreground shadow-sm border border-border/60'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-card/60',
                            )}
                        >
                            <t.icon className="h-3.5 w-3.5" />
                            {t.label}
                            {t.count !== null && t.count > 0 && (
                                <span className={cn(
                                    'inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-bold',
                                    tab === t.key ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                                )}>{t.count}</span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {(tab === 'dashboard' || tab === 'matters') && (
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                    <div className="lg:col-span-2 space-y-6">
                        <Card className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">
                            <CardHeader className="flex flex-row items-center justify-between py-4 px-6 border-b border-border/60 bg-muted/[0.12]">
                                <CardTitle className="text-[14px] font-bold tracking-tight flex items-center gap-2">
                                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-foreground text-background"><Briefcase className="h-3.5 w-3.5" /></span>
                                    Primary Matters
                                </CardTitle>
                                <span className="text-xs text-muted-foreground">{primaryMatters.length} total</span>
                            </CardHeader>
                            <CardContent className="p-0">
                                {primaryMatters.length === 0 ? (
                                    <div className="px-6 py-12 text-center">
                                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-3"><Briefcase className="h-6 w-6 text-muted-foreground/50" /></div>
                                        <p className="text-sm font-medium text-foreground">No primary matters yet</p>
                                        <p className="text-xs text-muted-foreground mt-1">Open a matter to start work for this contact</p>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-border/40">
                                        {primaryMatters.map((matter: Matter & any) => (
                                            <Link
                                                key={matter.id}
                                                href={`/matters/${matter.id}`}
                                                className="group flex items-center justify-between px-6 py-4 hover:bg-muted/10 transition-colors"
                                            >
                                                <div className="min-w-0">
                                                    <p className="text-[14px] font-semibold text-foreground group-hover:text-primary transition-colors truncate">{matter.name}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        <span className="font-mono tabular-nums">{matter.matter_number}</span> · Opened {formatDate(matter.opened_at)}
                                                    </p>
                                                </div>
                                                <Badge variant={matter.status === 'open' ? 'success' : 'secondary'} className="capitalize shrink-0 rounded-full text-[11px] font-medium">
                                                    {matter.status.replace(/_/g, ' ')}
                                                </Badge>
                                            </Link>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {relatedMatters.length > 0 && (
                            <Card className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">
                                <CardHeader className="flex flex-row items-center justify-between py-4 px-6 border-b border-border/60 bg-muted/[0.12]">
                                    <CardTitle className="text-[14px] font-bold tracking-tight flex items-center gap-2">
                                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-foreground text-background"><Briefcase className="h-3.5 w-3.5" /></span>
                                        Related Matters
                                    </CardTitle>
                                    <span className="text-xs text-muted-foreground">{relatedMatters.length} total</span>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <div className="divide-y divide-border/40">
                                        {relatedMatters.map((matter: Matter & any) => (
                                            <Link
                                                key={matter.id}
                                                href={`/matters/${matter.id}`}
                                                className="group flex items-center justify-between px-6 py-4 hover:bg-muted/10 transition-colors"
                                            >
                                                <div className="min-w-0">
                                                    <p className="text-[14px] font-semibold text-foreground group-hover:text-primary transition-colors truncate">{matter.name}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        <span className="font-mono tabular-nums">{matter.matter_number}</span>
                                                        {matter.pivot?.role ? ` · Role: ${matter.pivot.role.replace(/_/g, ' ')}` : ''}
                                                    </p>
                                                </div>
                                                <Badge variant={matter.status === 'open' ? 'success' : 'secondary'} className="capitalize shrink-0 rounded-full text-[11px] font-medium">
                                                    {matter.status.replace(/_/g, ' ')}
                                                </Badge>
                                            </Link>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </div>

                    <div className="space-y-6">
                        {contact.type === 'company' && ((contact as any).contact_person_name || (contact as any).contact_person_email || (contact as any).contact_person_phone) && (
                            <Card className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">
                                <CardHeader className="py-4 px-6 border-b border-border/60 bg-muted/[0.12]">
                                    <CardTitle className="text-[14px] font-bold tracking-tight flex items-center gap-2">
                                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-foreground text-background"><User className="h-3.5 w-3.5" /></span>
                                        Contact Person
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-6 space-y-3">
                                    {(contact as any).contact_person_name && (
                                        <p className="text-[14px] font-semibold text-foreground">{(contact as any).contact_person_name}</p>
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

                        <Card className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">
                            <CardHeader className="flex flex-row items-center justify-between py-4 px-6 border-b border-border/60 bg-muted/[0.12]">
                                <CardTitle className="text-[14px] font-bold tracking-tight flex items-center gap-2">
                                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-foreground text-background"><MessageSquare className="h-3.5 w-3.5" /></span>
                                    Recent Notes
                                </CardTitle>
                                {notes.length > 0 && (
                                    <button className="text-xs text-primary hover:underline" onClick={() => setTab('notes')}>
                                        View all
                                    </button>
                                )}
                            </CardHeader>
                            <CardContent className="p-0">
                                {notes.length === 0 ? (
                                    <div className="px-6 py-12 text-center">
                                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-3"><MessageSquare className="h-6 w-6 text-muted-foreground/50" /></div>
                                        <p className="text-sm font-medium text-foreground">No notes yet</p>
                                        <p className="text-xs text-muted-foreground mt-1">Record a call or meeting to start the timeline</p>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-border/40">
                                        {notes.slice(0, 3).map((note) => (
                                            <div key={note.id} className="px-6 py-4">
                                                <div className="flex items-center gap-2.5 mb-2">
                                                    <span className="h-7 w-7 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shrink-0">
                                                        {(note.user?.full_name || 'S')[0].toUpperCase()}
                                                    </span>
                                                    <span className="text-[13px] font-semibold text-foreground truncate">{note.user?.full_name || 'System'}</span>
                                                    <Badge variant="secondary" className="text-[11px] capitalize ml-auto rounded-full font-medium">
                                                        {noteMeta(note.type).label}
                                                    </Badge>
                                                </div>
                                                <p className="text-[13px] leading-relaxed text-foreground/80 ml-[38px] line-clamp-3 whitespace-pre-wrap">{note.body}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            )}

            {tab === 'documents' && canViewDocuments && (
                <Card className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">
                    <CardHeader className="flex flex-row items-center justify-between py-4 px-6 border-b border-border/60 bg-muted/[0.12]">
                        <CardTitle className="text-[14px] font-bold tracking-tight flex items-center gap-2">
                            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-foreground text-background"><Paperclip className="h-3.5 w-3.5" /></span>
                            Documents
                        </CardTitle>
                        <span className="text-xs text-muted-foreground">Across this contact's matters</span>
                    </CardHeader>
                    <CardContent className="p-0">
                        {documents.length === 0 ? (
                            <div className="px-6 py-12 text-center">
                                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-3"><Paperclip className="h-6 w-6 text-muted-foreground/50" /></div>
                                <p className="text-sm font-medium text-foreground">No documents yet</p>
                                <p className="text-xs text-muted-foreground mt-1">Files uploaded to this contact's matters appear here</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-border/40">
                                {documents.map((doc) => (
                                    <div key={doc.id} className="group flex items-center justify-between px-6 py-4 hover:bg-muted/10 transition-colors">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                                                <FileText className="h-4 w-4 text-muted-foreground" />
                                            </span>
                                            <div className="min-w-0">
                                                <p className="text-[14px] font-semibold text-foreground truncate">{doc.original_name || doc.name}</p>
                                                <p className="text-xs text-muted-foreground truncate">
                                                    {doc.matter?.name ?? 'Matter'} · {formatBytes(doc.size_bytes)} · {formatDate(doc.created_at)}
                                                </p>
                                            </div>
                                        </div>
                                        <Button asChild size="sm" variant="ghost" className="rounded-lg shrink-0 ml-4 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                                            <a href={`/documents/${doc.id}/download`}>
                                                <Download className="h-3.5 w-3.5 mr-1" />
                                                Download
                                            </a>
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {tab === 'billing' && (
                <Card className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">
                    <CardHeader className="flex flex-row items-center justify-between py-4 px-6 border-b border-border/60 bg-muted/[0.12]">
                        <CardTitle className="text-[14px] font-bold tracking-tight flex items-center gap-2">
                            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-foreground text-background"><Receipt className="h-3.5 w-3.5" /></span>
                            Invoices
                        </CardTitle>
                        <span className="text-xs text-muted-foreground">
                            {invoices.length} total · {formatCurrency(totalOutstanding)} outstanding
                        </span>
                    </CardHeader>
                    <CardContent className="p-0">
                        {invoices.length === 0 ? (
                            <div className="px-6 py-12 text-center">
                                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-3"><Receipt className="h-6 w-6 text-muted-foreground/50" /></div>
                                <p className="text-sm font-medium text-foreground">No invoices yet</p>
                                <p className="text-xs text-muted-foreground mt-1">Invoices raised against this contact's matters appear here</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-border/40">
                                {invoices.map((invoice) => {
                                    const paid = (invoice.payments ?? []).reduce((s, p) => s + Number(p.amount), 0);
                                    const outstanding = Math.max(0, Number(invoice.total) - paid);
                                    return (
                                        <Link
                                            key={invoice.id}
                                            href={`/billing/${invoice.id}`}
                                            className="group flex items-center justify-between px-6 py-4 hover:bg-muted/10 transition-colors"
                                        >
                                            <div className="min-w-0">
                                                <p className="text-[14px] font-semibold text-foreground group-hover:text-primary transition-colors font-mono tabular-nums">
                                                    {invoice.invoice_number}
                                                </p>
                                                <p className="text-xs text-muted-foreground truncate">
                                                    {invoice.matter?.name ?? 'Matter'} · Issued {formatDate(invoice.created_at)}
                                                </p>
                                            </div>
                                            <div className="text-right shrink-0 ml-4">
                                                <p className="text-[14px] font-bold tabular-nums text-foreground">{formatCurrency(Number(invoice.total))}</p>
                                                <Badge
                                                    variant={
                                                        invoice.status === 'paid' ? 'success'
                                                        : invoice.status === 'sent' && outstanding > 0 ? 'warning'
                                                        : 'secondary'
                                                    }
                                                    className="text-[11px] capitalize rounded-full font-medium mt-0.5"
                                                >
                                                    {invoice.status}
                                                </Badge>
                                            </div>
                                        </Link>
                                    );
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {tab === 'transactions' && (
                <Card className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">
                    <CardHeader className="flex flex-row items-center justify-between py-4 px-6 border-b border-border/60 bg-muted/[0.12]">
                        <CardTitle className="text-[14px] font-bold tracking-tight flex items-center gap-2">
                            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-foreground text-background"><CreditCard className="h-3.5 w-3.5" /></span>
                            Transactions
                        </CardTitle>
                        <span className="text-xs text-muted-foreground">{formatCurrency(totalPaid)} received</span>
                    </CardHeader>
                    <CardContent className="p-0">
                        {payments.length === 0 ? (
                            <div className="px-6 py-12 text-center">
                                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-3"><CreditCard className="h-6 w-6 text-muted-foreground/50" /></div>
                                <p className="text-sm font-medium text-foreground">No transactions yet</p>
                                <p className="text-xs text-muted-foreground mt-1">Payments recorded against this contact's invoices appear here</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-border/40">
                                {payments.map((payment: any) => (
                                    <div key={payment.id} className="flex items-center justify-between px-6 py-4">
                                        <div className="min-w-0">
                                            <p className="text-[14px] font-semibold text-foreground capitalize">
                                                {formatDate(payment.paid_at)} · {payment.method.replace(/_/g, ' ')}
                                            </p>
                                            <p className="text-xs text-muted-foreground truncate">
                                                <span className="font-mono tabular-nums">{payment.invoice_number}</span>
                                                {payment.matter_name ? ` · ${payment.matter_name}` : ''}
                                            </p>
                                        </div>
                                        <span className="text-[14px] font-bold tabular-nums text-success shrink-0 ml-4">
                                            {formatCurrency(Number(payment.amount))}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {tab === 'notes' && (
                <Card className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">
                    <CardHeader className="flex flex-row items-center justify-between py-4 px-6 border-b border-border/60 bg-muted/[0.12]">
                        <CardTitle className="text-[14px] font-bold tracking-tight flex items-center gap-2">
                            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-foreground text-background"><MessageSquare className="h-3.5 w-3.5" /></span>
                            Notes &amp; Activity
                        </CardTitle>
                        {canEditContact && (
                            <Button size="sm" type="button" onClick={() => openNoteModal()} className="rounded-xl h-8 px-3 bg-foreground text-background hover:bg-foreground/90">
                                <Plus className="h-3.5 w-3.5 mr-1" />
                                Add Note
                            </Button>
                        )}
                    </CardHeader>
                    <CardContent className="p-0">
                        {notes.length === 0 ? (
                            <div className="px-6 py-12 text-center">
                                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-3"><MessageSquare className="h-6 w-6 text-muted-foreground/50" /></div>
                                <p className="text-sm font-medium text-foreground">No notes yet</p>
                                <p className="text-xs text-muted-foreground mt-1">Record a call, an email or a meeting to start the timeline</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-border/40">
                                {notes.map((note) => {
                                    const Icon = noteMeta(note.type).icon;

                                    return (
                                        <div key={note.id} className="group px-6 py-4 hover:bg-muted/10 transition-colors">
                                            <div className="flex items-center gap-2.5 mb-2">
                                                <span className="h-7 w-7 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shrink-0">
                                                    {(note.user?.full_name || 'S')[0].toUpperCase()}
                                                </span>
                                                <span className="text-[14px] font-semibold text-foreground">{note.user?.full_name || 'System'}</span>
                                                <span className="text-xs text-muted-foreground">· {formatDate(note.logged_at)}</span>

                                                <div className="ml-auto flex items-center gap-1.5">
                                                    <Badge variant="secondary" className="text-[11px] rounded-full font-medium inline-flex items-center gap-1">
                                                        <Icon className="h-3 w-3" />
                                                        {noteMeta(note.type).label}
                                                    </Badge>
                                                    {canEditContact && (
                                                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                                                            <Button
                                                                size="icon"
                                                                variant="ghost"
                                                                className="h-7 w-7 rounded-lg"
                                                                type="button"
                                                                aria-label="Edit note"
                                                                onClick={() => openNoteModal(note)}
                                                            >
                                                                <Edit className="h-3.5 w-3.5" />
                                                            </Button>
                                                            <Button
                                                                size="icon"
                                                                variant="ghost"
                                                                className="h-7 w-7 rounded-lg text-destructive hover:text-destructive"
                                                                type="button"
                                                                aria-label="Delete note"
                                                                onClick={() => deleteNote(note)}
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <p className="text-[14px] leading-relaxed text-foreground/80 ml-[38px] whitespace-pre-wrap break-words">{note.body}</p>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            <Dialog open={noteModalOpen} onOpenChange={setNoteModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingNote ? 'Edit note' : 'Add note'}</DialogTitle>
                        <DialogDescription>
                            {editingNote
                                ? 'Update this note.'
                                : `Record a call, email or meeting against ${contact.full_name || contact.name}.`}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="note-type">Type</Label>
                            <Select
                                value={noteForm.type}
                                onValueChange={(v) => setNoteForm((p) => ({ ...p, type: v }))}
                            >
                                <SelectTrigger id="note-type" className="h-11"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {NOTE_TYPES.map((t) => (
                                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="note-body">Note</Label>
                            <Textarea
                                id="note-body"
                                rows={6}
                                value={noteForm.body}
                                onChange={(e) => setNoteForm((p) => ({ ...p, body: e.target.value }))}
                                placeholder="What was discussed?"
                            />
                        </div>

                        {noteError && <p className="text-sm text-destructive">{noteError}</p>}
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setNoteModalOpen(false)} disabled={noteSaving} className="rounded-xl">
                            Cancel
                        </Button>
                        <Button type="button" onClick={saveNote} disabled={noteSaving || !noteForm.body.trim()} className="rounded-xl">
                            {noteSaving ? 'Saving…' : 'Save'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
