import { useEffect, useRef, useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import { Clock, LogIn, LogOut, Plus, Pencil, Trash2, Receipt, TrendingUp, AlertCircle, CheckCircle2, Timer, PoundSterling, X, CalendarDays, FileText, Search, SlidersHorizontal } from 'lucide-react';
import type { PaginatedData, TimeEntry } from '@/types';

interface ActiveSession {
    matter_id: string;
    matter_name: string;
    matter_number: string;
    started_at: string;
    activity_type: string;
    description: string;
    rate?: number;
}

interface Props {
    entries: PaginatedData<TimeEntry & { matter?: { id: string; name: string; matter_number: string }; user?: { id: string; full_name: string } }>;
    stats: { hours_today: number; hours_week: number; unbilled_hours: number; unbilled_amount: number; today_minutes: number; week_minutes: number; unbilled_minutes: number; entries_today: number };
    users: { id: string; full_name: string; rate_per_hour: number | null }[];
    matters: { id: string; name: string; matter_number: string; fee_arrangement?: string; custom_fields?: Record<string, string> }[];
    filters: { matter_id?: string; user_id?: string; billable?: string; billed?: string; date_from?: string; date_to?: string; activity_type?: string; search?: string };
    activeTimer: ActiveSession | null;
    defaultRate: number;
    firmVatRate: number;
    isAdmin: boolean;
}

const ACTIVITY_LABELS: Record<string, string> = {
    advising: 'Advising', drafting: 'Drafting', research: 'Research',
    court_attendance: 'Court Attendance', travel: 'Travel', telephone: 'Telephone',
    correspondence: 'Correspondence', meeting: 'Meeting', other: 'Other',
};

const ACTIVITY_COLORS: Record<string, string> = {
    advising:        'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    drafting:        'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    research:        'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    court_attendance:'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    travel:          'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    telephone:       'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
    correspondence:  'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
    meeting:         'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    other:           'bg-muted text-muted-foreground',
};

const ACTIVITY_SHORT_LABELS: Record<string, string> = {
    advising: 'Advising', drafting: 'Drafting', research: 'Research',
    court_attendance: 'Court', travel: 'Travel', telephone: 'Phone',
    correspondence: 'Corr.', meeting: 'Meeting', other: 'Other',
};

const FEE_ARRANGEMENT_LABELS: Record<string, string> = {
    hourly_rate: 'Hourly Rate',
    fixed_fee:   'Fixed Fee',
    contingency: 'Contingency',
    retainer:    'Retainer',
};

const QUICK_DURATIONS = [
    { label: '15m', h: 0, m: 15 },
    { label: '30m', h: 0, m: 30 },
    { label: '45m', h: 0, m: 45 },
    { label: '1h',  h: 1, m: 0  },
    { label: '1½h', h: 1, m: 30 },
    { label: '2h',  h: 2, m: 0  },
    { label: '3h',  h: 3, m: 0  },
    { label: '4h',  h: 4, m: 0  },
];

function formatElapsed(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatDuration(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h ${String(m).padStart(2, '0')}m`;
}

function todayDate() { return new Date().toISOString().slice(0, 10); }
const emptyForm = {
    matter_id: '', date: todayDate(),
    hours: '1', minutes: '00', rate: '', billable: true,
    activity_type: 'other', description: '',
};

function getCsrfToken(): string {
    return (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement | null)?.content ?? '';
}

async function jsonFetch(url: string, method: string, body: Record<string, unknown>) {
    const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-CSRF-TOKEN': getCsrfToken() },
        body: JSON.stringify(body),
    });
    const payload = await res.json().catch(() => null);
    return { ok: res.ok, payload };
}

function getMatterRate(matters: Props['matters'], matterId: string, fallback: number): number {
    const m = matters.find((x) => x.id === matterId);
    const r = m?.custom_fields?.hourly_rate;
    return r && r !== '' ? parseFloat(r) : fallback;
}

export default function TimeIndex({ entries, stats, users, matters, filters, activeTimer: serverSession, defaultRate, firmVatRate, isAdmin }: Props) {
    const [session, setSession] = useState<ActiveSession | null>(serverSession);
    const [elapsed, setElapsed] = useState(0);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Check-in form
    const [checkInForm, setCheckInForm] = useState({ matter_id: '', activity_type: 'other', description: '', rate: String(defaultRate) });
    const [checkInExpanded, setCheckInExpanded] = useState(false);
    const [checkInLoading, setCheckInLoading] = useState(false);
    const [checkInError, setCheckInError] = useState<string | null>(null);

    // Live session fields (editable while checked in)
    const [sessionNotes, setSessionNotes] = useState(serverSession?.description ?? '');
    const [sessionActivity, setSessionActivity] = useState(serverSession?.activity_type ?? 'other');

    // Checkout confirmation dialog — resolve rate from matter's custom_fields first
    const resolvedSessionRate = (() => {
        if (!serverSession) return defaultRate;
        return getMatterRate(matters, serverSession.matter_id, serverSession.rate ?? defaultRate);
    })();
    const [checkOutOpen, setCheckOutOpen] = useState(false);
    const [checkOutBillable, setCheckOutBillable] = useState(true);
    const [checkOutRate, setCheckOutRate] = useState(String(resolvedSessionRate));
    const [discardLoading, setDiscardLoading] = useState(false);
    const [discardConfirm, setDiscardConfirm] = useState(false);
    const [checkOutLoading, setCheckOutLoading] = useState(false);

    // Manual log modal
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<TimeEntry | null>(null);
    const [form, setForm] = useState({ ...emptyForm, rate: String(defaultRate) });
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
    const [invoiceForm, setInvoiceForm] = useState({ due_date: '', notes: '' });
    const [invoiceSaving, setInvoiceSaving] = useState(false);

    const [deleting, setDeleting] = useState<string | null>(null);

    // Elapsed counter
    useEffect(() => {
        if (session) {
            const start = new Date(session.started_at).getTime();
            const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
            tick();
            intervalRef.current = setInterval(tick, 1000);
        } else {
            setElapsed(0);
            if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
        }
        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }, [session]);

    // Live running amount while checked in
    const liveAmount = (() => {
        const rate = parseFloat(checkOutRate || '0');
        return isNaN(rate) ? 0 : Math.round(rate * (elapsed / 3600) * 100) / 100;
    })();

    // Manual form computed amount
    const computedAmount = (() => {
        const h = parseInt(form.hours || '0', 10);
        const m = parseInt(form.minutes || '0', 10);
        const dur = h * 60 + m;
        const rate = parseFloat(form.rate || '0');
        return isNaN(rate) || isNaN(dur) ? 0 : round2(rate * (dur / 60));
    })();

    function round2(n: number) { return Math.round(n * 100) / 100; }

    function openCreate(prefill?: { matter_id?: string; duration_minutes?: number }) {
        setEditing(null);
        setFormError(null);
        const h = prefill?.duration_minutes ? String(Math.floor(prefill.duration_minutes / 60)) : '1';
        const m = prefill?.duration_minutes ? String(prefill.duration_minutes % 60).padStart(2, '0') : '00';
        const mId = prefill?.matter_id ?? '';
        const rate = mId ? getMatterRate(matters, mId, defaultRate) : defaultRate;
        setForm({ ...emptyForm, date: todayDate(), rate: String(rate), matter_id: mId, hours: h, minutes: m });
        setModalOpen(true);
    }

    function openEdit(entry: TimeEntry) {
        setEditing(entry);
        setFormError(null);
        setForm({
            matter_id:     entry.matter_id,
            date:          entry.date,
            hours:         String(Math.floor(entry.duration_minutes / 60)),
            minutes:       String(entry.duration_minutes % 60).padStart(2, '0'),
            rate:          String(entry.rate ?? defaultRate),
            billable:      entry.billable,
            activity_type: entry.activity_type ?? 'other',
            description:   entry.description ?? '',
        });
        setModalOpen(true);
    }

    async function saveEntry() {
        const h   = parseInt(form.hours || '0', 10);
        const m   = parseInt(form.minutes || '0', 10);
        const dur = h * 60 + m;
        if (!form.matter_id) { setFormError('Please select a matter.'); return; }
        if (dur < 1) { setFormError('Duration must be at least 1 minute.'); return; }

        setSaving(true);
        setFormError(null);

        const body: Record<string, unknown> = {
            matter_id: form.matter_id, date: form.date,
            duration_minutes: dur, rate: parseFloat(form.rate || '0'),
            billable: form.billable, activity_type: form.activity_type,
            description: form.description || null,
        };

        const { ok, payload } = editing
            ? await jsonFetch(`/time/${editing.id}`, 'PUT', body)
            : await jsonFetch('/time', 'POST', body);

        setSaving(false);

        if (!ok) {
            const msg = payload?.errors ? Object.values(payload.errors as Record<string, string[]>)?.[0]?.[0] : null;
            setFormError(msg || payload?.message || 'Failed to save.');
            return;
        }

        setModalOpen(false);
        router.reload({ only: ['entries', 'stats'] });
    }

    async function toggleBillable(entry: TimeEntry) {
        if (entry.billed || entry.is_locked) return;
        await jsonFetch(`/time/${entry.id}`, 'PUT', {
            matter_id: entry.matter_id,
            date: entry.date,
            duration_minutes: entry.duration_minutes,
            rate: entry.rate,
            billable: !entry.billable,
            activity_type: entry.activity_type,
            description: entry.description ?? null,
        });
        router.reload({ only: ['entries', 'stats'] });
    }

    async function deleteEntry(id: string) {
        if (!confirm('Delete this time entry?')) return;
        setDeleting(id);
        const { ok, payload } = await jsonFetch(`/time/${id}`, 'DELETE', {});
        setDeleting(null);
        if (!ok) { alert(payload?.error || 'Cannot delete this entry.'); return; }
        router.reload({ only: ['entries', 'stats'] });
    }

    async function handleCheckIn() {
        if (!checkInForm.matter_id) { setCheckInError('Please select a matter.'); return; }
        setCheckInLoading(true);
        setCheckInError(null);
        const { ok, payload } = await jsonFetch('/time/checkin', 'POST', {
            matter_id:     checkInForm.matter_id,
            activity_type: checkInForm.activity_type,
            description:   checkInForm.description || null,
            rate:          parseFloat(checkInForm.rate || '0') || undefined,
        });
        setCheckInLoading(false);
        if (!ok) { setCheckInError(payload?.error || 'Check-in failed.'); return; }
        setSession(payload.session);
        setSessionNotes(payload.session.description ?? '');
        setSessionActivity(payload.session.activity_type ?? 'other');
        setCheckOutRate(String(payload.session.rate ?? defaultRate));
    }

    async function handleDiscard() {
        setDiscardLoading(true);
        const { ok } = await jsonFetch('/time/discard', 'POST', {});
        setDiscardLoading(false);
        if (!ok) return;
        setSession(null);
        setDiscardConfirm(false);
        setCheckInForm({ matter_id: '', activity_type: 'other', description: '' });
    }

    async function handleCheckOut() {
        setCheckOutLoading(true);
        const { ok, payload } = await jsonFetch('/time/checkout', 'POST', {
            description:   sessionNotes || null,
            activity_type: sessionActivity,
            billable:      checkOutBillable,
            rate:          parseFloat(checkOutRate || '0'),
        });
        setCheckOutLoading(false);
        if (!ok) { alert(payload?.error || 'Checkout failed.'); return; }
        setSession(null);
        setCheckOutOpen(false);
        setCheckInForm({ matter_id: '', activity_type: 'other', description: '' });
        router.reload({ only: ['entries', 'stats'] });
    }

    function setFilter(key: string, value: string) {
        const actual = value === '_all' ? '' : value;
        router.get('/time', { ...filters, [key]: actual || undefined }, { preserveState: true, replace: true });
    }

    function clearFilters() {
        router.get('/time', {}, { preserveState: false, replace: true });
    }

    const hasActiveFilters = Object.values(filters).some(Boolean);

    function fmtMinutes(mins: number): string {
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        if (h === 0) return `${m}m`;
        return m === 0 ? `${h}h` : `${h}h ${m}m`;
    }

    function toggleSelect(id: string) {
        setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
    }

    function toggleSelectAll() {
        const unbilledIds = entries.data.filter((e) => !e.billed && !e.is_locked).map((e) => e.id);
        if (selectedIds.length === unbilledIds.length) setSelectedIds([]);
        else setSelectedIds(unbilledIds);
    }

    const selectedEntries = entries.data.filter((e) => selectedIds.includes(e.id));
    const selectedTotal   = selectedEntries.reduce((s, e) => s + Number(e.amount), 0);
    const selectedMatterIds = [...new Set(selectedEntries.map((e) => e.matter_id))];

    function openInvoiceModal() {
        if (selectedIds.length === 0) return;
        if (selectedMatterIds.length > 1) { alert('All selected entries must be from the same matter.'); return; }
        setInvoiceForm({ due_date: '', notes: '' });
        setInvoiceModalOpen(true);
    }

    function submitInvoice() {
        if (!invoiceForm.due_date) return;
        setInvoiceSaving(true);
        router.post('/time/invoice', {
            entry_ids: selectedIds,
            due_date:  invoiceForm.due_date,
            notes:     invoiceForm.notes || undefined,
        }, {
            onFinish: () => { setInvoiceSaving(false); setInvoiceModalOpen(false); setSelectedIds([]); },
        });
    }

    const stats_cards = [
        { label: 'Today',          value: fmtMinutes(stats.today_minutes),       sub: `${stats.entries_today} entr${stats.entries_today === 1 ? 'y' : 'ies'}`, icon: Clock,         color: 'text-primary',  bg: 'bg-primary/10' },
        { label: 'This Week',      value: fmtMinutes(stats.week_minutes),        sub: '',                                                                          icon: TrendingUp,    color: 'text-accent',   bg: 'bg-accent/10' },
        { label: 'Unbilled Hours', value: fmtMinutes(stats.unbilled_minutes),    sub: 'pending billing',                                                           icon: AlertCircle,   color: 'text-warning',  bg: 'bg-warning/10' },
        { label: 'Unbilled Value', value: formatCurrency(stats.unbilled_amount), sub: '',                                                                          icon: PoundSterling, color: 'text-success',  bg: 'bg-success/10' },
    ];

    return (
        <AppLayout title="Time Tracking">
            <Head title="Time Tracking" />

            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Time Tracking</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">Log, review and bill your time entries</p>
                </div>
                <Button onClick={() => openCreate()} className="gap-2 shadow-sm">
                    <Plus className="h-4 w-4" />
                    Manual Entry
                </Button>
            </div>

            {/* Check-in / Active Session Panel */}
            {session ? (
                <div className="mb-6 rounded-xl border border-emerald-200 dark:border-emerald-800/40 bg-gradient-to-br from-emerald-50 to-green-50/60 dark:from-emerald-950/30 dark:to-green-950/20 shadow-sm overflow-hidden">
                    {/* Top accent bar */}
                    <div className="h-1 w-full bg-gradient-to-r from-emerald-400 to-green-500" />
                    <div className="p-5">
                        <div className="flex flex-col gap-5 md:flex-row md:items-start">
                            {/* Left: timer + meta */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2.5 mb-3">
                                    <span className="relative flex h-2.5 w-2.5">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                                    </span>
                                    <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Live Session</span>
                                </div>
                                <p className="text-xl font-bold truncate text-foreground mb-0.5">{session.matter_name}</p>
                                <div className="flex items-center gap-3 text-xs text-muted-foreground mb-4">
                                    <span className="font-mono">{session.matter_number}</span>
                                    <span>&bull;</span>
                                    <span>Started {new Date(session.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    <span>&bull;</span>
                                    <span>Rate: <strong className="text-foreground">{formatCurrency(Number(checkOutRate) || 0)}/hr</strong></span>
                                </div>
                                {/* Big clock */}
                                <div className="flex items-baseline gap-3 mb-3">
                                    <span className="font-mono text-5xl font-black text-foreground tabular-nums tracking-tight">{formatElapsed(elapsed)}</span>
                                </div>
                                {/* Running total pill */}
                                <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 bg-emerald-100 dark:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-800/60">
                                    <PoundSterling className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                                    <span className="text-sm font-bold text-emerald-700 dark:text-emerald-300">{formatCurrency(liveAmount)}</span>
                                    {firmVatRate > 0 && (
                                        <span className="text-xs text-emerald-600/70 dark:text-emerald-400/60">
                                            +{firmVatRate}% VAT = {formatCurrency(liveAmount * (1 + firmVatRate / 100))}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Divider */}
                            <div className="hidden md:block w-px bg-emerald-200 dark:bg-emerald-800/50 self-stretch" />

                            {/* Right: editable fields + actions */}
                            <div className="flex flex-col gap-3 md:w-64">
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Activity</Label>
                                    <Select value={sessionActivity} onValueChange={setSessionActivity}>
                                        <SelectTrigger className="h-9 bg-white/70 dark:bg-black/20 border-emerald-200 dark:border-emerald-800/60">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {Object.entries(ACTIVITY_LABELS).map(([k, v]) => (
                                                <SelectItem key={k} value={k}>{v}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Work Notes</Label>
                                    <Textarea
                                        rows={3} className="resize-none text-sm bg-white/70 dark:bg-black/20 border-emerald-200 dark:border-emerald-800/60"
                                        placeholder="What are you working on?"
                                        value={sessionNotes}
                                        onChange={(e) => setSessionNotes(e.target.value)}
                                    />
                                </div>
                                <Button
                                    className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                                    onClick={() => setCheckOutOpen(true)}
                                >
                                    <LogOut className="h-4 w-4" />
                                    Check-out &amp; Save
                                </Button>
                                <button
                                    className="text-xs text-muted-foreground/60 hover:text-destructive transition-colors text-center underline underline-offset-2"
                                    onClick={() => setDiscardConfirm(true)}
                                >
                                    Discard session
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <Card className="mb-6 border-border/60 surface-card">
                    <CardHeader className="pb-2 pt-4 px-5">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
                            <div className="p-1.5 rounded-md bg-primary/10">
                                <Timer className="h-3.5 w-3.5 text-primary" />
                            </div>
                            Start a Timer
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="px-5 pb-4">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 sm:items-end">
                            <div className="space-y-1.5 sm:col-span-1 lg:col-span-1">
                                <Label className="text-xs font-medium text-muted-foreground">Matter *</Label>
                                <Select value={checkInForm.matter_id || '_none'} onValueChange={(v) => {
                                    const id = v === '_none' ? '' : v;
                                    const rate = id ? getMatterRate(matters, id, defaultRate) : defaultRate;
                                    setCheckInForm((p) => ({ ...p, matter_id: id, rate: String(rate) }));
                                }}>
                                    <SelectTrigger className="h-9"><SelectValue placeholder="Select matter…" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="_none">Select matter…</SelectItem>
                                        {matters.map((m) => (
                                            <SelectItem key={m.id} value={m.id}>
                                                {m.matter_number} — {m.name}
                                                {m.custom_fields?.hourly_rate && ` · £${m.custom_fields.hourly_rate}/h`}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {checkInForm.matter_id && (() => {
                                    const m = matters.find((x) => x.id === checkInForm.matter_id);
                                    return m?.fee_arrangement ? (
                                        <p className="text-xs text-muted-foreground">
                                            {FEE_ARRANGEMENT_LABELS[m.fee_arrangement] ?? m.fee_arrangement}
                                            {m.custom_fields?.hourly_rate ? <span className="ml-1 font-semibold text-primary">£{m.custom_fields.hourly_rate}/hr</span> : ''}
                                        </p>
                                    ) : null;
                                })()}
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-medium text-muted-foreground">Activity</Label>
                                <Select value={checkInForm.activity_type} onValueChange={(v) => setCheckInForm((p) => ({ ...p, activity_type: v }))}>
                                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {Object.entries(ACTIVITY_LABELS).map(([k, v]) => (
                                            <SelectItem key={k} value={k}>{v}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-medium text-muted-foreground">Description</Label>
                                <Input
                                    className="h-9"
                                    placeholder="What are you working on?"
                                    value={checkInForm.description}
                                    onChange={(e) => setCheckInForm((p) => ({ ...p, description: e.target.value }))}
                                />
                                {checkInForm.matter_id && (
                                    <p className="text-xs text-muted-foreground">
                                        Rate: <span className="font-semibold text-foreground">£{checkInForm.rate || '0'}/hr</span>
                                    </p>
                                )}
                            </div>
                            <Button
                                className="h-9 gap-2 shadow-sm"
                                disabled={checkInLoading || !checkInForm.matter_id}
                                onClick={handleCheckIn}
                            >
                                <LogIn className="h-4 w-4" />
                                {checkInLoading ? 'Starting…' : 'Start Timer'}
                            </Button>
                        </div>
                        {checkInError && (
                            <p className="mt-2 text-xs text-destructive flex items-center gap-1">
                                <AlertCircle className="h-3.5 w-3.5" />{checkInError}
                            </p>
                        )}
                        <p className="mt-3 text-xs text-muted-foreground/70">
                            Or <button className="underline underline-offset-2 hover:text-foreground transition-colors" onClick={() => openCreate()}>log a manual entry</button>
                        </p>
                    </CardContent>
                </Card>
            )}

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 mb-6">
                {stats_cards.map((s) => (
                    <div key={s.label} className="rounded-xl border border-border/60 bg-card p-4 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
                        <div className={cn('p-2.5 rounded-xl flex-shrink-0', s.bg)}>
                            <s.icon className={cn('h-5 w-5', s.color)} />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">{s.label}</p>
                            <p className={cn('text-2xl font-black tabular-nums leading-none', s.color)}>{s.value}</p>
                            {s.sub && <p className="text-xs text-muted-foreground mt-0.5">{s.sub}</p>}
                        </div>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="rounded-xl border border-border/60 bg-card shadow-sm mb-4 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/40 bg-muted/30">
                    <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Filters</span>
                    {hasActiveFilters && (
                        <button onClick={clearFilters} className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors">
                            <X className="h-3 w-3" /> Clear all
                        </button>
                    )}
                </div>
                <div className="p-3">
                    <div className="flex flex-wrap items-end gap-2.5">
                        <div className="flex-1 min-w-[180px] space-y-1">
                            <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Search</Label>
                            <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
                                <Input
                                    className="h-8 pl-8 text-sm"
                                    placeholder="Description or matter…"
                                    value={filters.search ?? ''}
                                    onChange={(e) => setFilter('search', e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="min-w-[165px] space-y-1">
                            <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Matter</Label>
                            <Select value={filters.matter_id || '_all'} onValueChange={(v) => setFilter('matter_id', v)}>
                                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="All matters" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="_all">All matters</SelectItem>
                                    {matters.map((m) => <SelectItem key={m.id} value={m.id}>{m.matter_number} — {m.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="min-w-[145px] space-y-1">
                            <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Activity</Label>
                            <Select value={filters.activity_type || '_all'} onValueChange={(v) => setFilter('activity_type', v)}>
                                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="All activities" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="_all">All activities</SelectItem>
                                    {Object.entries(ACTIVITY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        {isAdmin && (
                            <div className="min-w-[140px] space-y-1">
                                <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">User</Label>
                                <Select value={filters.user_id || '_all'} onValueChange={(v) => setFilter('user_id', v)}>
                                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="All users" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="_all">All users</SelectItem>
                                        {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                        <div className="min-w-[115px] space-y-1">
                            <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Billable</Label>
                            <Select value={filters.billable || '_all'} onValueChange={(v) => setFilter('billable', v)}>
                                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="_all">All</SelectItem>
                                    <SelectItem value="1">Billable</SelectItem>
                                    <SelectItem value="0">Non-billable</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="min-w-[110px] space-y-1">
                            <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Status</Label>
                            <Select value={filters.billed || '_all'} onValueChange={(v) => setFilter('billed', v)}>
                                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="_all">All</SelectItem>
                                    <SelectItem value="0">Unbilled</SelectItem>
                                    <SelectItem value="1">Billed</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">From</Label>
                            <Input type="date" className="h-8 w-34 text-sm" value={filters.date_from ?? ''} onChange={(e) => setFilter('date_from', e.target.value)} />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">To</Label>
                            <Input type="date" className="h-8 w-34 text-sm" value={filters.date_to ?? ''} onChange={(e) => setFilter('date_to', e.target.value)} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Bulk action bar */}
            {selectedIds.length > 0 && (
                <div className="flex items-center gap-3 mb-3 px-4 py-2.5 bg-primary/8 border border-primary/25 rounded-xl">
                    <div className="flex items-center gap-2">
                        <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                            <span className="text-[10px] font-bold text-primary-foreground">{selectedIds.length}</span>
                        </div>
                        <span className="text-sm font-semibold">{selectedIds.length} entr{selectedIds.length === 1 ? 'y' : 'ies'} selected</span>
                    </div>
                    <Separator orientation="vertical" className="h-4" />
                    <span className="text-sm font-bold text-primary">{formatCurrency(selectedTotal)}</span>
                    <div className="flex-1" />
                    {selectedMatterIds.length === 1 && (
                        <Button size="sm" onClick={openInvoiceModal} className="gap-2 h-8">
                            <Receipt className="h-3.5 w-3.5" />
                            Invoice Selected
                        </Button>
                    )}
                    {selectedMatterIds.length > 1 && (
                        <span className="text-xs text-muted-foreground">Select entries from a single matter to invoice</span>
                    )}
                    <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setSelectedIds([])}>
                        <X className="h-3.5 w-3.5 mr-1" />Clear
                    </Button>
                </div>
            )}

            {/* Table */}
            <div className="rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">
                {entries.data.length === 0 ? (
                    <div className="py-20 text-center">
                        <div className="inline-flex items-center justify-center h-14 w-14 rounded-full bg-muted/60 mb-4">
                            <Clock className="h-7 w-7 text-muted-foreground/40" />
                        </div>
                        <p className="text-sm font-medium text-muted-foreground mb-1">No time entries found</p>
                        <p className="text-xs text-muted-foreground/60 mb-4">Start a timer or log a manual entry</p>
                        <Button size="sm" onClick={() => openCreate()} className="gap-2">
                            <Plus className="h-3.5 w-3.5" />Log Entry
                        </Button>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-border/60 bg-muted/40">
                                    <th className="px-4 py-3 w-10">
                                        <input
                                            type="checkbox"
                                            className="rounded accent-primary"
                                            checked={selectedIds.length > 0 && selectedIds.length === entries.data.filter(e => !e.billed && !e.is_locked).length}
                                            onChange={toggleSelectAll}
                                        />
                                    </th>
                                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Date</th>
                                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Matter</th>
                                    {isAdmin && <th className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">User</th>}
                                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Activity</th>
                                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Description</th>
                                    <th className="text-right px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Duration</th>
                                    <th className="text-right px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Rate/hr</th>
                                    <th className="text-right px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Amount</th>
                                    <th className="text-center px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Billable</th>
                                    <th className="text-center px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                                    <th className="px-4 py-3 w-16" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/40">
                                {entries.data.map((entry) => (
                                    <tr key={entry.id} className={cn(
                                        'hover:bg-muted/25 transition-colors group',
                                        selectedIds.includes(entry.id) && 'bg-primary/5 hover:bg-primary/8'
                                    )}>
                                        <td className="px-4 py-3.5">
                                            <input
                                                type="checkbox"
                                                className="rounded accent-primary"
                                                disabled={entry.billed || entry.is_locked}
                                                checked={selectedIds.includes(entry.id)}
                                                onChange={() => toggleSelect(entry.id)}
                                            />
                                        </td>
                                        <td className="px-4 py-3.5 whitespace-nowrap">
                                            <div className="flex items-center gap-1.5">
                                                <CalendarDays className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                                                <span className="text-sm text-muted-foreground">{formatDate(entry.date)}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3.5 max-w-[160px]">
                                            {entry.matter ? (
                                                <Link href={`/matters/${entry.matter.id}`} className="font-semibold text-foreground hover:text-primary transition-colors truncate block">
                                                    {entry.matter.name}
                                                </Link>
                                            ) : <span className="text-muted-foreground">—</span>}
                                            {entry.matter && <p className="text-[11px] text-muted-foreground font-mono mt-0.5">{entry.matter.matter_number}</p>}
                                        </td>
                                        {isAdmin && (
                                            <td className="px-4 py-3.5 hidden lg:table-cell">
                                                <span className="text-sm text-muted-foreground">{entry.user?.full_name ?? '—'}</span>
                                            </td>
                                        )}
                                        <td className="px-4 py-3.5 hidden md:table-cell">
                                            <span
                                                title={ACTIVITY_LABELS[entry.activity_type] ?? entry.activity_type}
                                                className={cn('inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap', ACTIVITY_COLORS[entry.activity_type] ?? ACTIVITY_COLORS.other)}
                                            >
                                                {ACTIVITY_SHORT_LABELS[entry.activity_type] ?? entry.activity_type}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3.5 max-w-[200px]">
                                            {entry.description ? (
                                                <p className="truncate text-sm text-foreground">{entry.description}</p>
                                            ) : (
                                                <span className="text-muted-foreground/40 text-sm italic">—</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3.5 text-right">
                                            <span className="font-mono text-sm tabular-nums font-medium">{formatDuration(entry.duration_minutes)}</span>
                                        </td>
                                        <td className="px-4 py-3.5 text-right hidden md:table-cell">
                                            <span className="text-sm text-muted-foreground tabular-nums">{formatCurrency(Number(entry.rate))}</span>
                                        </td>
                                        <td className="px-4 py-3.5 text-right">
                                            <span className="text-sm font-bold tabular-nums text-foreground">{formatCurrency(Number(entry.amount))}</span>
                                        </td>
                                        <td className="px-4 py-3.5 text-center">
                                            <button
                                                title={entry.billed || entry.is_locked ? undefined : 'Click to toggle billable'}
                                                disabled={entry.billed || entry.is_locked}
                                                onClick={() => toggleBillable(entry)}
                                                className={cn(
                                                    'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all',
                                                    !entry.billed && !entry.is_locked && 'cursor-pointer hover:ring-2 hover:ring-offset-1',
                                                    entry.billable
                                                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 hover:ring-emerald-300'
                                                        : 'bg-muted text-muted-foreground hover:ring-border',
                                                )}
                                            >
                                                <span className={cn('h-1.5 w-1.5 rounded-full', entry.billable ? 'bg-emerald-500' : 'bg-muted-foreground/40')} />
                                                {entry.billable ? 'Billable' : 'Non-bill'}
                                            </button>
                                        </td>
                                        <td className="px-4 py-3.5 text-center">
                                            {entry.billed ? (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                                    <CheckCircle2 className="h-3 w-3" />Billed
                                                </span>
                                            ) : entry.is_locked ? (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-muted text-muted-foreground">
                                                    Locked
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                                    <AlertCircle className="h-3 w-3" />Unbilled
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3.5">
                                            {!entry.billed && !entry.is_locked && (
                                                <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => openEdit(entry)}
                                                        className="h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                                                    >
                                                        <Pencil className="h-3.5 w-3.5" />
                                                    </button>
                                                    <button
                                                        className="h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                                        disabled={deleting === entry.id}
                                                        onClick={() => deleteEntry(entry.id)}
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            {entries.data.length > 0 && (
                                <tfoot>
                                    <tr className="border-t border-border/60 bg-muted/30">
                                        <td colSpan={isAdmin ? 8 : 7} className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                            Page Total
                                        </td>
                                        <td className="px-4 py-3 text-right text-sm font-bold text-foreground tabular-nums">
                                            {formatCurrency(entries.data.reduce((s, e) => s + Number(e.amount), 0))}
                                        </td>
                                        <td colSpan={3} />
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                )}

                {entries.last_page > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-border/50 bg-muted/20">
                        <p className="text-xs text-muted-foreground">
                            Showing <span className="font-medium text-foreground">{entries.from}–{entries.to}</span> of <span className="font-medium text-foreground">{entries.total}</span> entries
                        </p>
                        <div className="flex gap-1">
                            {entries.links.map((link, i) => (
                                link.url ? (
                                    <Link key={i} href={link.url}
                                        className={cn('px-3 py-1.5 text-xs rounded-lg border transition-colors font-medium', link.active ? 'bg-primary text-primary-foreground border-primary shadow-sm' : 'hover:bg-muted border-border text-muted-foreground hover:text-foreground')}
                                        dangerouslySetInnerHTML={{ __html: link.label }}
                                    />
                                ) : (
                                    <span key={i} className="px-3 py-1.5 text-xs rounded-lg border border-border text-muted-foreground/40"
                                        dangerouslySetInnerHTML={{ __html: link.label }} />
                                )
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Create / Edit Modal */}
            <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{editing ? 'Edit Time Entry' : 'Log Time'}</DialogTitle>
                        <DialogDescription>
                            {editing ? 'Update this time entry.' : 'Record time spent on a matter.'}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2 space-y-2">
                                <Label>Matter *</Label>
                                <Select value={form.matter_id} onValueChange={(v) => {
                                    const rate = v ? getMatterRate(matters, v, defaultRate) : defaultRate;
                                    setForm((p) => ({ ...p, matter_id: v, rate: String(rate) }));
                                }}>
                                    <SelectTrigger className="h-10"><SelectValue placeholder="Select matter" /></SelectTrigger>
                                    <SelectContent>
                                        {matters.map((m) => (
                                            <SelectItem key={m.id} value={m.id}>
                                                {m.matter_number} — {m.name}
                                                {m.custom_fields?.hourly_rate && ` · £${m.custom_fields.hourly_rate}/h`}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {form.matter_id && (() => {
                                    const m = matters.find((x) => x.id === form.matter_id);
                                    return m?.fee_arrangement ? (
                                        <p className="text-xs text-muted-foreground">
                                            Fee type: <span className="font-medium text-foreground">{FEE_ARRANGEMENT_LABELS[m.fee_arrangement] ?? m.fee_arrangement}</span>
                                            {m.custom_fields?.hourly_rate ? <span className="ml-2 text-primary font-semibold">£{m.custom_fields.hourly_rate}/hr</span> : ''}
                                        </p>
                                    ) : null;
                                })()}
                            </div>

                            <div className="space-y-2">
                                <Label>Date *</Label>
                                <Input type="date" className="h-10" value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} />
                            </div>

                            <div className="space-y-2">
                                <Label>Activity</Label>
                                <Select value={form.activity_type} onValueChange={(v) => setForm((p) => ({ ...p, activity_type: v }))}>
                                    <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {Object.entries(ACTIVITY_LABELS).map(([k, v]) => (
                                            <SelectItem key={k} value={k}>{v}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Duration *</Label>
                            <div className="flex flex-wrap gap-1.5 mb-2">
                                {QUICK_DURATIONS.map((q) => (
                                    <button
                                        key={q.label}
                                        type="button"
                                        onClick={() => setForm((p) => ({ ...p, hours: String(q.h), minutes: String(q.m).padStart(2, '0') }))}
                                        className={cn(
                                            'px-2.5 py-1 text-xs rounded border font-medium transition-colors',
                                            parseInt(form.hours || '0') === q.h && parseInt(form.minutes || '0') === q.m
                                                ? 'bg-primary text-primary-foreground border-primary'
                                                : 'border-border hover:bg-muted text-muted-foreground hover:text-foreground',
                                        )}
                                    >
                                        {q.label}
                                    </button>
                                ))}
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="relative flex-1">
                                    <Input
                                        type="number" min="0" className="h-10 pr-8"
                                        value={form.hours}
                                        onChange={(e) => setForm((p) => ({ ...p, hours: e.target.value }))}
                                        placeholder="0"
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">h</span>
                                </div>
                                <span className="text-muted-foreground font-bold">:</span>
                                <div className="relative flex-1">
                                    <Input
                                        type="number" min="0" max="59" className="h-10 pr-8"
                                        value={form.minutes}
                                        onChange={(e) => setForm((p) => ({ ...p, minutes: e.target.value }))}
                                        placeholder="00"
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">m</span>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Rate (per hour)</Label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">£</span>
                                    <Input
                                        type="number" step="0.01" min="0" className="h-10 pl-7"
                                        value={form.rate}
                                        onChange={(e) => setForm((p) => ({ ...p, rate: e.target.value }))}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Calculated Amount</Label>
                                <div className="h-10 rounded-md border border-border/50 bg-muted/30 px-3 flex items-center font-semibold text-success">
                                    {formatCurrency(computedAmount)}
                                    {firmVatRate > 0 && (
                                        <span className="ml-2 text-xs text-muted-foreground font-normal">
                                            +{firmVatRate}% VAT = {formatCurrency(computedAmount * (1 + firmVatRate / 100))}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Description</Label>
                            <Textarea
                                rows={3} className="resize-none"
                                value={form.description}
                                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                                placeholder="Describe the work performed…"
                            />
                        </div>

                        <div className="flex items-center gap-3">
                            <input
                                type="checkbox" id="billable-chk" className="h-4 w-4 rounded"
                                checked={form.billable}
                                onChange={(e) => setForm((p) => ({ ...p, billable: e.target.checked }))}
                            />
                            <label htmlFor="billable-chk" className="text-sm font-medium cursor-pointer">
                                Billable to client
                            </label>
                        </div>

                        {formError && <p className="text-sm text-destructive">{formError}</p>}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</Button>
                        <Button onClick={saveEntry} disabled={saving || !form.matter_id}>
                            {saving ? 'Saving…' : editing ? 'Update' : 'Log Time'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Invoice Creation Modal */}
            <Dialog open={invoiceModalOpen} onOpenChange={setInvoiceModalOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Create Invoice</DialogTitle>
                        <DialogDescription>
                            Generate an invoice for {selectedIds.length} time {selectedIds.length === 1 ? 'entry' : 'entries'} totalling {formatCurrency(selectedTotal)}.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="rounded-lg border border-border/60 divide-y divide-border/60 max-h-48 overflow-y-auto">
                            {selectedEntries.map((e) => (
                                <div key={e.id} className="px-3 py-2 flex items-center justify-between text-sm">
                                    <div>
                                        <p className="font-medium">{e.description || 'Legal services'}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {formatDate(e.date)} · {formatDuration(e.duration_minutes)} · {formatCurrency(Number(e.rate))}/h
                                        </p>
                                    </div>
                                    <span className="font-semibold text-right ml-3">{formatCurrency(Number(e.amount))}</span>
                                </div>
                            ))}
                        </div>

                        <Separator />

                        <div className="flex items-center justify-between text-sm font-semibold">
                            <span>Subtotal</span>
                            <span>{formatCurrency(selectedTotal)}</span>
                        </div>
                        {firmVatRate > 0 && (
                            <div className="flex items-center justify-between text-sm text-muted-foreground">
                                <span>VAT ({firmVatRate}%)</span>
                                <span>{formatCurrency(selectedTotal * firmVatRate / 100)}</span>
                            </div>
                        )}
                        <div className="flex items-center justify-between font-bold">
                            <span>Total</span>
                            <span className="text-success">{formatCurrency(selectedTotal * (1 + firmVatRate / 100))}</span>
                        </div>

                        <Separator />

                        <div className="space-y-2">
                            <Label>Due Date *</Label>
                            <Input
                                type="date" className="h-10"
                                value={invoiceForm.due_date}
                                onChange={(e) => setInvoiceForm((p) => ({ ...p, due_date: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Invoice Notes</Label>
                            <Textarea
                                rows={2} className="resize-none"
                                value={invoiceForm.notes}
                                onChange={(e) => setInvoiceForm((p) => ({ ...p, notes: e.target.value }))}
                                placeholder="Optional notes on the invoice…"
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setInvoiceModalOpen(false)} disabled={invoiceSaving}>Cancel</Button>
                        <Button onClick={submitInvoice} disabled={invoiceSaving || !invoiceForm.due_date} className="gap-2">
                            <Receipt className="h-4 w-4" />
                            {invoiceSaving ? 'Creating…' : 'Create Invoice'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Discard Session Confirm */}
            <Dialog open={discardConfirm} onOpenChange={setDiscardConfirm}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <X className="h-5 w-5 text-destructive" />
                            Discard Session?
                        </DialogTitle>
                        <DialogDescription>
                            Your current check-in to <strong>{session?.matter_name}</strong> will be cancelled.
                            No time entry will be saved. This cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setDiscardConfirm(false)} disabled={discardLoading}>Keep Session</Button>
                        <Button variant="destructive" onClick={handleDiscard} disabled={discardLoading}>
                            {discardLoading ? 'Discarding…' : 'Yes, Discard'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Checkout Confirmation Dialog */}
            <Dialog open={checkOutOpen} onOpenChange={setCheckOutOpen}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <CheckCircle2 className="h-5 w-5 text-success" />
                            Confirm Check-out
                        </DialogTitle>
                        <DialogDescription>
                            Review and confirm your session before saving.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="rounded-lg bg-muted/40 p-4 space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Matter</span>
                                <span className="font-medium truncate max-w-[180px] text-right">{session?.matter_name}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Started</span>
                                <span className="text-muted-foreground">{session ? new Date(session.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Duration</span>
                                <span className="font-mono font-bold text-base">{formatElapsed(elapsed)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Activity</span>
                                <span>{ACTIVITY_LABELS[sessionActivity] ?? sessionActivity}</span>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs">Rate (£/hr)</Label>
                            <Input
                                type="number" min="0" step="0.01" className="h-9"
                                value={checkOutRate}
                                onChange={(e) => setCheckOutRate(e.target.value)}
                            />
                        </div>

                        <div className="rounded-lg border border-success/30 bg-success/5 p-3 flex items-center justify-between">
                            <span className="text-sm font-medium">Estimated amount</span>
                            <span className="text-lg font-bold text-success">{formatCurrency(liveAmount)}</span>
                        </div>

                        <div className="flex items-center gap-2">
                            <input
                                id="billable-chk"
                                type="checkbox"
                                className="rounded"
                                checked={checkOutBillable}
                                onChange={(e) => setCheckOutBillable(e.target.checked)}
                            />
                            <Label htmlFor="billable-chk" className="text-sm cursor-pointer">Mark as billable</Label>
                        </div>
                    </div>

                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setCheckOutOpen(false)} disabled={checkOutLoading}>
                            Back
                        </Button>
                        <Button
                            className="bg-success hover:bg-success/90 text-success-foreground gap-2"
                            onClick={handleCheckOut}
                            disabled={checkOutLoading}
                        >
                            <LogOut className="h-4 w-4" />
                            {checkOutLoading ? 'Saving…' : 'Check-out & Save'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
