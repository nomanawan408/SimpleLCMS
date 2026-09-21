import { useEffect, useRef, useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn, formatDate, splitDateTime } from '@/lib/utils';
import { CalendarClock, ChevronLeft, ChevronRight, ExternalLink, Gavel, MapPin, Pencil, Plus, Trash2 } from 'lucide-react';

interface CalendarEvent {
    id: string;
    firm_id: string;
    matter_id: string | null;
    title: string;
    type: 'appointment' | 'court_date' | 'deadline' | 'consultation' | 'other' | 'task_deadline';
    start_at: string;
    end_at: string | null;
    location: string | null;
    is_court_date: boolean;
    source: 'event' | 'task';
    matter?: { id: string; name: string; matter_number: string };
    status?: string | null;
}

interface Props {
    events: CalendarEvent[];
    matters: { id: string; name: string; matter_number: string }[];
    year: number;
    month: number;
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const emptyForm = {
    title: '',
    type: 'appointment',
    matter_id: '',
    start_at: '',
    end_at: '',
    location: '',
    is_court_date: false,
};

function getToken(): string {
    return (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement | null)?.content ?? '';
}

const TYPE_META: Record<string, { label: string; badge: string }> = {
    court_date: { label: 'Court Hearing', badge: 'bg-destructive/15 text-destructive border-destructive/25' },
    task_deadline: { label: 'Deadline', badge: 'bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-400 dark:border-violet-800' },
    deadline: { label: 'Deadline', badge: 'bg-warning/15 text-warning border-warning/25' },
    appointment: { label: 'Appointment', badge: 'bg-primary/15 text-primary border-primary/25' },
    consultation: { label: 'Consultation', badge: 'bg-primary/15 text-primary border-primary/25' },
    other: { label: 'Event', badge: 'bg-primary/15 text-primary border-primary/25' },
};

export default function CalendarIndex({ events, matters, year, month }: Props) {
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<CalendarEvent | null>(null);
    const [form, setForm] = useState({ ...emptyForm });
    const [saving, setSaving] = useState(false);
    const [selectedDay, setSelectedDay] = useState<number | null>(null);
    // Read-only detail popup — every chip (hearing or deadline) lands here
    // first, so nothing navigates away or jumps into edit by surprise.
    const [viewing, setViewing] = useState<CalendarEvent | null>(null);
    // Matter-name expand/collapse in the detail popup — long names clamp to
    // 2 lines with a toggle that only appears when text actually overflows.
    const [matterExpanded, setMatterExpanded] = useState(false);
    const [matterOverflows, setMatterOverflows] = useState(false);
    const matterNameRef = useRef<HTMLSpanElement>(null);

    useEffect(() => {
        setMatterExpanded(false);
        setMatterOverflows(false);
    }, [viewing?.id]);

    useEffect(() => {
        if (matterExpanded) return; // keep the toggle visible while expanded
        const el = matterNameRef.current;
        if (!el) return;
        const check = () => setMatterOverflows(el.scrollHeight > el.clientHeight + 1);
        check();
        const t = setTimeout(check, 150);
        window.addEventListener('resize', check);
        return () => { clearTimeout(t); window.removeEventListener('resize', check); };
    }, [viewing?.id, matterExpanded]);
    // Overflow day list — cells show 3 chips; the "+N more" button opens the
    // full day here instead of hiding events with no way to reach them.
    const [dayList, setDayList] = useState<number | null>(null);

    const navigate = (dir: 1 | -1) => {
        let y = year;
        let m = month + dir;
        if (m > 12) { m = 1; y++; }
        if (m < 1) { m = 12; y--; }
        router.get('/calendar', { year: y, month: m }, { preserveState: false });
    };

    const daysInMonth = new Date(year, month, 0).getDate();
    const firstDayOfMonth = new Date(year, month - 1, 1).getDay();
    const startOffset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

    const cells: (number | null)[] = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);

    const eventsForDay = (day: number): CalendarEvent[] => {
        return events.filter((e) => {
            const d = new Date(e.start_at);
            return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day;
        });
    };

    const openCreate = (day?: number) => {
        setEditing(null);
        const dateStr = day
            ? `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T09:00`
            : '';
        setForm({ ...emptyForm, start_at: dateStr });
        setSelectedDay(day ?? null);
        setModalOpen(true);
    };

    const openEdit = (event: CalendarEvent) => {
        setEditing(event);
        setForm({
            title: event.title,
            type: event.type,
            matter_id: event.matter_id ?? '',
            start_at: event.start_at.slice(0, 16),
            end_at: event.end_at ? event.end_at.slice(0, 16) : '',
            location: event.location ?? '',
            is_court_date: event.is_court_date,
        });
        setModalOpen(true);
    };

    const saveEvent = async () => {
        setSaving(true);
        const body: Record<string, unknown> = {
            title: form.title,
            type: form.type,
            start_at: form.start_at,
            is_court_date: form.is_court_date,
        };
        if (form.matter_id) body.matter_id = form.matter_id;
        if (form.end_at) body.end_at = form.end_at;
        if (form.location) body.location = form.location;

        const url = editing ? `/calendar/${editing.id}` : '/calendar';
        const method = editing ? 'PUT' : 'POST';

        try {
            const res = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'X-CSRF-TOKEN': getToken(),
                },
                body: JSON.stringify(body),
            });
            if (res.ok) {
                setModalOpen(false);
                router.reload();
            }
        } finally {
            setSaving(false);
        }
    };

    const deleteEvent = async (id: string) => {
        if (!confirm('Delete this event?')) return;
        await fetch(`/calendar/${id}`, {
            method: 'DELETE',
            headers: { 'X-CSRF-TOKEN': getToken(), Accept: 'application/json' },
        });
        router.reload();
    };

    const today = new Date();
    const isToday = (day: number) =>
        today.getFullYear() === year && today.getMonth() === month - 1 && today.getDate() === day;

    return (
        <AppLayout title="Calendar">
            <Head title="Calendar" />

            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <h1 className="text-xl font-bold tracking-tight min-w-[160px] text-center">
                        {MONTH_NAMES[month - 1]} {year}
                    </h1>
                    <Button variant="outline" size="icon" onClick={() => navigate(1)}>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
                <Button onClick={() => openCreate()} className="gap-2">
                    <Plus className="h-4 w-4" />
                    New Event
                </Button>
            </div>

            {/* Calendar grid */}
            <div className="border rounded-lg overflow-hidden bg-card">
                <div className="grid grid-cols-7 border-b">
                    {DAY_NAMES.map((d) => (
                        <div key={d} className="py-2 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            {d}
                        </div>
                    ))}
                </div>
                <div className="grid grid-cols-7">
                    {cells.map((day, i) => {
                        const dayEvents = day ? eventsForDay(day) : [];
                        return (
                            <div
                                key={i}
                                className={cn(
                                    'min-h-[100px] border-b border-r p-1.5 cursor-pointer transition-colors',
                                    day ? 'hover:bg-muted/30' : 'bg-muted/10',
                                    isToday(day!) && day ? 'bg-primary/5' : '',
                                )}
                                onClick={() => day && openCreate(day)}
                            >
                                {day && (
                                    <>
                                        <div className={cn(
                                            'w-7 h-7 flex items-center justify-center rounded-full text-sm font-medium mb-1',
                                            isToday(day) ? 'bg-primary text-primary-foreground' : 'text-foreground',
                                        )}>
                                            {day}
                                        </div>
                                        <div className="space-y-0.5">
                                            {dayEvents.slice(0, 3).map((ev) => (
                                                <div
                                                    key={ev.id}
                                                    className={cn(
                                                        'text-xs px-1.5 py-0.5 rounded truncate cursor-pointer font-medium',
                                                        ev.type === 'task_deadline'
                                                            ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400'
                                                            : ev.is_court_date || ev.type === 'court_date'
                                                                ? 'bg-destructive/15 text-destructive'
                                                                : ev.type === 'deadline'
                                                                    ? 'bg-warning/15 text-warning'
                                                                    : 'bg-primary/15 text-primary',
                                                    )}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setViewing(ev);
                                                    }}
                                                    title={ev.source === 'task' ? `Task: ${ev.title}${ev.status ? ` (${ev.status.replace(/_/g, ' ')})` : ''}` : ev.title}
                                                >
                                                    {ev.type === 'task_deadline' && <span className="mr-0.5">&#9744;</span>}
                                                    {ev.title}
                                                    {ev.source === 'task' && ev.status && ev.status !== 'done' && (
                                                        <span className="ml-1 opacity-70">({ev.status.replace(/_/g, ' ')})</span>
                                                    )}
                                                </div>
                                            ))}
                                            {dayEvents.length > 3 && (
                                                <button
                                                    type="button"
                                                    className="pl-1 text-left text-sm font-medium text-primary hover:underline"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setDayList(day);
                                                    }}
                                                >
                                                    +{dayEvents.length - 3} more
                                                </button>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Day overflow list — every event on the day, each opening the detail popup */}
            <Dialog open={dayList !== null} onOpenChange={(open) => { if (!open) setDayList(null); }}>
                <DialogContent className="max-w-md overflow-hidden p-0">
                    <div className="border-b px-6 pb-4 pt-5">
                        <DialogTitle className="pr-6 text-lg font-semibold leading-snug">
                            {dayList ? formatDate(`${year}-${String(month).padStart(2, '0')}-${String(dayList).padStart(2, '0')}`) : ''}
                        </DialogTitle>
                        <DialogDescription>
                            {dayList ? `${eventsForDay(dayList).length} event${eventsForDay(dayList).length === 1 ? '' : 's'}` : ''}
                        </DialogDescription>
                    </div>
                    <div className="max-h-[50vh] divide-y divide-border/50 overflow-y-auto px-3 py-2">
                        {(dayList ? eventsForDay(dayList) : []).map((ev) => {
                            const isHearing = ev.is_court_date || ev.type === 'court_date';
                            const meta = isHearing ? TYPE_META.court_date : (TYPE_META[ev.type] ?? TYPE_META.other);
                            const [, time] = splitDateTime(ev.start_at);
                            const Icon = isHearing ? Gavel : CalendarClock;
                            return (
                                <button
                                    key={ev.id}
                                    type="button"
                                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted/50"
                                    onClick={() => { setDayList(null); setViewing(ev); }}
                                >
                                    <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-card', meta.badge)}>
                                        <Icon className="h-4 w-4" />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-sm font-medium text-foreground" title={ev.title}>{ev.title}</span>
                                        <span className="block truncate text-xs tabular-nums text-muted-foreground">
                                            {time ? `${time} · ` : ''}{meta.label}
                                            {ev.matter ? ` · ${ev.matter.matter_number}` : ''}
                                        </span>
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Detail popup — information first, actions second; nothing navigates away unwarned */}
            <Dialog open={!!viewing} onOpenChange={(open) => { if (!open) setViewing(null); }}>
                <DialogContent className="max-w-md overflow-hidden p-0">
                    {viewing && (() => {
                        const isHearing = viewing.is_court_date || viewing.type === 'court_date';
                        const meta = isHearing ? TYPE_META.court_date : (TYPE_META[viewing.type] ?? TYPE_META.other);
                        const [, time] = splitDateTime(viewing.start_at);
                        const [, endTime] = viewing.end_at ? splitDateTime(viewing.end_at) : (['', ''] as [string, string]);
                        const Icon = isHearing ? Gavel : CalendarClock;
                        const editHref = viewing.source === 'event'
                            ? null
                            : (viewing.matter_id ? `/matters/${viewing.matter_id}?tab=tasks` : null);
                        return (
                            <>
                                <div className={cn('border-b px-6 pb-5 pt-6',
                                    isHearing ? 'bg-red-50/70 dark:bg-red-950/20' : 'bg-violet-50/70 dark:bg-violet-950/20')}>
                                    <div className="flex items-start gap-3.5 pr-6">
                                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-card shadow-sm ring-1 ring-border/60">
                                            <Icon className={cn('h-6 w-6', isHearing ? 'text-destructive' : 'text-violet-600 dark:text-violet-400')} />
                                        </span>
                                        <div className="min-w-0">
                                            <DialogTitle className="text-lg font-semibold leading-snug text-foreground" title={viewing.title}>
                                                <span className="[display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden break-words">
                                                    {viewing.title}
                                                </span>
                                            </DialogTitle>
                                            <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                                                <span className={cn('inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium leading-none', meta.badge)}>
                                                    {meta.label}
                                                </span>
                                                <span className="inline-flex items-center gap-1 tabular-nums text-muted-foreground">
                                                    <CalendarClock className="h-3.5 w-3.5" />
                                                    {formatDate(viewing.start_at)}{time ? ` · ${time}` : ''}
                                                    {viewing.end_at ? ` – ${endTime || formatDate(viewing.end_at)}` : ''}
                                                </span>
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <div className="divide-y divide-border/50 px-6">
                                    <div className="flex items-center gap-3 py-3">
                                        <span className="w-16 shrink-0 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Matter</span>
                                        {viewing.matter ? (
                                            <span className="min-w-0 flex-1 text-sm">
                                                <span
                                                    ref={matterNameRef}
                                                    title={viewing.matter.name}
                                                    className={cn(
                                                        'block font-medium text-foreground break-words',
                                                        !matterExpanded && '[display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden',
                                                    )}
                                                >
                                                    {viewing.matter.name}
                                                </span>
                                                <span className="block truncate font-mono text-xs tabular-nums text-muted-foreground">{viewing.matter.matter_number}</span>
                                                {(matterOverflows || matterExpanded) && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setMatterExpanded((v) => !v)}
                                                        className="mt-0.5 text-xs font-medium text-primary hover:underline"
                                                    >
                                                        {matterExpanded ? 'Show less' : 'Show more'}
                                                    </button>
                                                )}
                                            </span>
                                        ) : (
                                            <span className="text-sm text-muted-foreground">No linked matter</span>
                                        )}
                                    </div>
                                    {viewing.location && (
                                        <div className="flex items-center gap-3 py-3">
                                            <span className="w-16 shrink-0 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Where</span>
                                            <span className="flex min-w-0 items-center gap-1.5 text-sm text-foreground">
                                                <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                                <span className="truncate" title={viewing.location}>{viewing.location}</span>
                                            </span>
                                        </div>
                                    )}
                                    {viewing.source === 'task' && viewing.status && (
                                        <div className="flex items-center gap-3 py-3">
                                            <span className="w-16 shrink-0 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</span>
                                            <Badge variant="secondary" className="text-xs capitalize">{viewing.status.replace(/_/g, ' ')}</Badge>
                                        </div>
                                    )}
                                </div>
                                <DialogFooter className="gap-2 border-t bg-muted/40 px-6 py-4 sm:justify-end">
                                    {viewing.source === 'event' ? (
                                        <Button
                                            variant="outline"
                                            onClick={() => { const ev = viewing; setViewing(null); openEdit(ev); }}
                                        >
                                            <Pencil className="h-4 w-4 mr-1.5" />
                                            Edit
                                        </Button>
                                    ) : editHref ? (
                                        <Button variant="outline" asChild>
                                            <Link href={editHref}>
                                                <Pencil className="h-4 w-4 mr-1.5" />
                                                Edit task
                                            </Link>
                                        </Button>
                                    ) : null}
                                    {viewing.matter_id && (
                                        <Button asChild>
                                            <Link href={`/matters/${viewing.matter_id}`}>
                                                <ExternalLink className="h-4 w-4 mr-1.5" />
                                                Open matter
                                            </Link>
                                        </Button>
                                    )}
                                </DialogFooter>
                            </>
                        );
                    })()}
                </DialogContent>
            </Dialog>

            {/* Event Modal */}
            <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>{editing ? 'Edit Event' : 'New Event'}</DialogTitle>
                        <DialogDescription>{editing ? 'Update event details.' : 'Add an event to the calendar.'}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Title *</Label>
                            <Input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Type</Label>
                                <Select value={form.type} onValueChange={(v) => setForm((p) => ({ ...p, type: v }))}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="appointment">Appointment</SelectItem>
                                        <SelectItem value="court_date">Court Date</SelectItem>
                                        <SelectItem value="deadline">Deadline</SelectItem>
                                        <SelectItem value="consultation">Consultation</SelectItem>
                                        <SelectItem value="other">Other</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Matter</Label>
                                <Select value={form.matter_id || '_none'} onValueChange={(v) => setForm((p) => ({ ...p, matter_id: v === '_none' ? '' : v }))}>
                                    <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="_none">None</SelectItem>
                                        {matters.map((m) => (
                                            <SelectItem key={m.id} value={m.id}>{m.matter_number}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Start *</Label>
                                <Input type="datetime-local" value={form.start_at} onChange={(e) => setForm((p) => ({ ...p, start_at: e.target.value }))} />
                            </div>
                            <div className="space-y-2">
                                <Label>End</Label>
                                <Input type="datetime-local" value={form.end_at} onChange={(e) => setForm((p) => ({ ...p, end_at: e.target.value }))} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Location</Label>
                            <Input value={form.location} onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))} />
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-border accent-primary"
                                checked={form.is_court_date}
                                onChange={(e) => setForm((p) => ({ ...p, is_court_date: e.target.checked }))}
                            />
                            <span className="text-sm font-medium">Court date</span>
                        </label>
                    </div>
                    <DialogFooter className="flex items-center justify-between">
                        {editing && (
                            <Button variant="outline" className="text-destructive border-destructive/40 hover:bg-destructive/10" onClick={() => { deleteEvent(editing.id); setModalOpen(false); }}>
                                <Trash2 className="h-4 w-4 mr-1" />
                                Delete
                            </Button>
                        )}
                        <div className="flex gap-2 ml-auto">
                            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</Button>
                            <Button onClick={saveEvent} disabled={saving || !form.title.trim() || !form.start_at}>
                                {saving ? 'Saving…' : 'Save'}
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
