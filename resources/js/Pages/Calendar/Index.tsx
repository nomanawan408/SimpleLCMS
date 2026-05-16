import { useState } from 'react';
import { Head, router } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';

interface CalendarEvent {
    id: string;
    firm_id: string;
    matter_id: string | null;
    title: string;
    type: 'appointment' | 'court_date' | 'deadline' | 'consultation' | 'other';
    start_at: string;
    end_at: string | null;
    location: string | null;
    is_court_date: boolean;
    matter?: { id: string; name: string; matter_number: string };
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

export default function CalendarIndex({ events, matters, year, month }: Props) {
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<CalendarEvent | null>(null);
    const [form, setForm] = useState({ ...emptyForm });
    const [saving, setSaving] = useState(false);
    const [selectedDay, setSelectedDay] = useState<number | null>(null);

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
                                                        'text-[11px] px-1.5 py-0.5 rounded truncate cursor-pointer font-medium',
                                                        ev.is_court_date || ev.type === 'court_date'
                                                            ? 'bg-destructive/15 text-destructive'
                                                            : ev.type === 'deadline'
                                                                ? 'bg-warning/15 text-warning'
                                                                : 'bg-primary/15 text-primary',
                                                    )}
                                                    onClick={(e) => { e.stopPropagation(); openEdit(ev); }}
                                                >
                                                    {ev.title}
                                                </div>
                                            ))}
                                            {dayEvents.length > 3 && (
                                                <p className="text-[10px] text-muted-foreground pl-1">+{dayEvents.length - 3} more</p>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

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
