import { Head, Link } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { cn, formatCurrency, formatDate, MATTER_STATUS_LABELS, PRACTICE_AREA_LABELS } from '@/lib/utils';
import {
    ArrowLeft, Clock, Receipt, Wallet, FileText, CheckSquare, Users, Edit, Plus, Download,
    Gavel, Calendar, TrendingUp, AlertTriangle, ChevronRight, MessageSquare, Timer,
    Paperclip, ExternalLink, DollarSign, PoundSterling, Eye, X, Pencil, Trash2,
} from 'lucide-react';
import type { Matter, Expense, Document, TrustEntry, User } from '@/types';

interface Props {
    matter: Matter & {
        contacts: any[];
        time_entries: any[];
        expenses?: Expense[];
        documents?: Document[];
        trust_entries?: TrustEntry[];
        invoices: any[];
        notes: any[];
        tasks: any[];
        responsible_user?: User;
        unbilled_time_value?: number;
    };
    users: { id: string; full_name: string }[];
    activeTimer: {
        matter_id: string;
        matter_name: string;
        matter_number: string;
        started_at: string;
        activity_type: string;
        description: string;
        rate?: number;
        paused_at?: string | null;
        total_paused_seconds?: number;
    } | null;
}

export default function ShowMatter({ matter, users, activeTimer: serverTimer }: Props) {
    const [notes, setNotes] = useState<any[]>(matter.notes ?? []);
    const [timeEntries, setTimeEntries] = useState<any[]>(matter.time_entries ?? []);
    const [expenses, setExpenses] = useState<any[]>(matter.expenses ?? []);
    const [tasks, setTasks] = useState<any[]>(matter.tasks ?? []);
    const [documents, setDocuments] = useState<any[]>(matter.documents ?? []);

    // ── Live Timer State ──
    const [timerSession, setTimerSession] = useState(serverTimer && serverTimer.matter_id === matter.id ? serverTimer : null);
    const [timerElapsed, setTimerElapsed] = useState(0);
    const [timerPaused, setTimerPaused] = useState(!!(serverTimer && serverTimer.matter_id === matter.id && serverTimer.paused_at));
    const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Timer form fields
    const matterHourlyRate = (matter as any).custom_fields?.hourly_rate ?? '';
    const [timerForm, setTimerForm] = useState({
        activity_type: 'other',
        description: '',
        rate: matterHourlyRate ? String(matterHourlyRate) : '',
        billable: true,
    });
    const [timerExpanded, setTimerExpanded] = useState(false);
    const [timerCheckOutOpen, setTimerCheckOutOpen] = useState(false);
    const [timerLoading, setTimerLoading] = useState(false);

    // Live editable fields while timer is running
    const [liveActivity, setLiveActivity] = useState(serverTimer?.activity_type ?? 'other');
    const [liveDescription, setLiveDescription] = useState(serverTimer?.description ?? '');

    useEffect(() => {
        if (timerSession) {
            const start = new Date(timerSession.started_at).getTime();
            const tick = () => {
                const rawElapsed = Math.floor((Date.now() - start) / 1000);
                const pausedSecs = timerSession.paused_at
                    ? (timerSession.total_paused_seconds ?? 0) + Math.floor((Date.now() - new Date(timerSession.paused_at).getTime()) / 1000)
                    : (timerSession.total_paused_seconds ?? 0);
                setTimerElapsed(Math.max(0, rawElapsed - pausedSecs));
            };
            tick();
            timerIntervalRef.current = setInterval(tick, 1000);
        } else {
            setTimerElapsed(0);
            setTimerPaused(false);
            if (timerIntervalRef.current) { clearInterval(timerIntervalRef.current); timerIntervalRef.current = null; }
        }
        return () => { if (timerIntervalRef.current) clearInterval(timerIntervalRef.current); };
    }, [timerSession]);

    function formatTimerElapsed(seconds: number): string {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }

    function getTimerToken(): string {
        return (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement | null)?.content ?? '';
    }

    async function timerCheckIn() {
        setTimerLoading(true);
        const token = getTimerToken();
        const res = await fetch('/time/checkin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(token ? { 'X-CSRF-TOKEN': token } : {}) },
            body: JSON.stringify({
                matter_id: matter.id,
                activity_type: timerForm.activity_type,
                description: timerForm.description || null,
                rate: timerForm.rate ? parseFloat(timerForm.rate) : undefined,
            }),
        });
        if (res.ok) {
            const payload = await res.json();
            setTimerSession(payload.session);
            setTimerPaused(false);
            setLiveActivity(payload.session.activity_type ?? 'other');
            setLiveDescription(payload.session.description ?? '');
            setTimerExpanded(false);
        }
        setTimerLoading(false);
    }

    async function timerPause() {
        const token = getTimerToken();
        const res = await fetch('/time/pause', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(token ? { 'X-CSRF-TOKEN': token } : {}) },
        });
        if (res.ok) {
            setTimerPaused(true);
            setTimerSession((prev) => prev ? { ...prev, paused_at: new Date().toISOString() } : prev);
        }
    }

    async function timerResume() {
        const token = getTimerToken();
        const res = await fetch('/time/resume', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(token ? { 'X-CSRF-TOKEN': token } : {}) },
        });
        if (res.ok) {
            const payload = await res.json();
            setTimerPaused(false);
            setTimerSession(payload.session);
        }
    }

    async function timerCheckOut() {
        setTimerLoading(true);
        const token = getTimerToken();
        const res = await fetch('/time/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(token ? { 'X-CSRF-TOKEN': token } : {}) },
            body: JSON.stringify({
                billable: timerForm.billable,
                rate: timerForm.rate ? parseFloat(timerForm.rate) : undefined,
                activity_type: liveActivity,
                description: liveDescription || null,
            }),
        });
        if (res.ok) {
            setTimerSession(null);
            setTimerPaused(false);
            setTimerCheckOutOpen(false);
            setTimerForm({ activity_type: 'other', description: '', rate: matterHourlyRate ? String(matterHourlyRate) : '', billable: true });
            try {
                const payload = await res.json();
                if (payload.entry) {
                    setTimeEntries((prev) => [payload.entry, ...prev]);
                }
            } catch {}
        }
        setTimerLoading(false);
    }

    async function timerDiscard() {
        if (!confirm('Discard this timer session? No time entry will be saved.')) return;
        const token = getTimerToken();
        const res = await fetch('/time/discard', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(token ? { 'X-CSRF-TOKEN': token } : {}) },
        });
        if (res.ok) {
            setTimerSession(null);
            setTimerPaused(false);
            setTimerForm({ activity_type: 'other', description: '', rate: matterHourlyRate ? String(matterHourlyRate) : '', billable: true });
        }
    }

    const [noteModalOpen, setNoteModalOpen] = useState(false);
    const [noteSaving, setNoteSaving] = useState(false);
    const [noteError, setNoteError] = useState<string | null>(null);
    const [noteBody, setNoteBody] = useState('');

    const [timeModalOpen, setTimeModalOpen] = useState(false);
    const [timeSaving, setTimeSaving] = useState(false);
    const [timeError, setTimeError] = useState<string | null>(null);
    const [timeForm, setTimeForm] = useState({
        date: new Date().toISOString().slice(0, 10),
        duration_minutes: '60',
        rate: '',
        billable: true,
        description: '',
    });

    const [expenseModalOpen, setExpenseModalOpen] = useState(false);
    const [expenseSaving, setExpenseSaving] = useState(false);
    const [expenseError, setExpenseError] = useState<string | null>(null);
    const [expenseForm, setExpenseForm] = useState({
        date: new Date().toISOString().slice(0, 10),
        amount: '',
        billable: true,
        vendor: '',
        category: '',
        description: '',
    });

    const [taskModalOpen, setTaskModalOpen] = useState(false);
    const [taskSaving, setTaskSaving] = useState(false);
    const [taskError, setTaskError] = useState<string | null>(null);
    const [editingTask, setEditingTask] = useState<any>(null);
    const [taskForm, setTaskForm] = useState({
        title: '',
        description: '',
        due_date: '',
        priority: 'medium',
        assignee_id: '',
    });

    const [docModalOpen, setDocModalOpen] = useState(false);
    const [docSaving, setDocSaving] = useState(false);
    const [docError, setDocError] = useState<string | null>(null);
    const [docFile, setDocFile] = useState<File | null>(null);
    const [docFolder, setDocFolder] = useState('');
    const [docClientVisible, setDocClientVisible] = useState(false);
    const docFileRef = useRef<HTMLInputElement>(null);

    const [viewerDoc, setViewerDoc] = useState<{ id: string; name: string; mime_type?: string } | null>(null);

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

    const postJson = async (url: string, body: Record<string, unknown>) => {
        const token = (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement | null)?.content;
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                ...(token ? { 'X-CSRF-TOKEN': token } : {}),
            },
            body: JSON.stringify(body),
        });

        const payload = await res.json().catch(() => null);
        return { ok: res.ok, payload };
    };

    const openNoteModal = () => {
        setNoteError(null);
        setNoteBody('');
        setNoteModalOpen(true);
    };

    const saveNote = async () => {
        setNoteSaving(true);
        setNoteError(null);
        try {
            const { ok, payload } = await postJson(`/matters/${matter.id}/notes`, {
                body: noteBody,
                type: 'note',
            });
            if (!ok) {
                const validationMsg = payload?.errors
                    ? Object.values(payload.errors as Record<string, string[]>)?.[0]?.[0]
                    : null;
                setNoteError(validationMsg || payload?.message || 'Unable to add note.');
                return;
            }
            setNotes((prev) => [payload.note, ...prev]);
            setNoteModalOpen(false);
        } catch {
            setNoteError('Unable to add note.');
        } finally {
            setNoteSaving(false);
        }
    };

    const openTimeModal = () => {
        setTimeError(null);
        setTimeForm({
            date: new Date().toISOString().slice(0, 10),
            duration_minutes: '60',
            rate: '',
            billable: true,
            description: '',
        });
        setTimeModalOpen(true);
    };

    const saveTime = async () => {
        setTimeSaving(true);
        setTimeError(null);
        try {
            const { ok, payload } = await postJson(`/matters/${matter.id}/time-entries`, {
                date: timeForm.date,
                duration_minutes: Number(timeForm.duration_minutes),
                rate: timeForm.rate ? Number(timeForm.rate) : null,
                billable: Boolean(timeForm.billable),
                description: timeForm.description || null,
            });
            if (!ok) {
                const validationMsg = payload?.errors
                    ? Object.values(payload.errors as Record<string, string[]>)?.[0]?.[0]
                    : null;
                setTimeError(validationMsg || payload?.message || 'Unable to log time.');
                return;
            }
            setTimeEntries((prev) => [payload.time_entry, ...prev]);
            setTimeModalOpen(false);
        } catch {
            setTimeError('Unable to log time.');
        } finally {
            setTimeSaving(false);
        }
    };

    const openExpenseModal = () => {
        setExpenseError(null);
        setExpenseForm({
            date: new Date().toISOString().slice(0, 10),
            amount: '',
            billable: true,
            vendor: '',
            category: '',
            description: '',
        });
        setExpenseModalOpen(true);
    };

    const saveExpense = async () => {
        setExpenseSaving(true);
        setExpenseError(null);
        try {
            const { ok, payload } = await postJson(`/matters/${matter.id}/expenses`, {
                date: expenseForm.date,
                amount: Number(expenseForm.amount),
                billable: Boolean(expenseForm.billable),
                vendor: expenseForm.vendor || null,
                category: expenseForm.category || null,
                description: expenseForm.description,
            });
            if (!ok) {
                const validationMsg = payload?.errors
                    ? Object.values(payload.errors as Record<string, string[]>)?.[0]?.[0]
                    : null;
                setExpenseError(validationMsg || payload?.message || 'Unable to add expense.');
                return;
            }
            setExpenses((prev) => [payload.expense, ...prev]);
            setExpenseModalOpen(false);
        } catch {
            setExpenseError('Unable to add expense.');
        } finally {
            setExpenseSaving(false);
        }
    };

    const openTaskModal = () => {
        setEditingTask(null);
        setTaskError(null);
        setTaskForm({ title: '', description: '', due_date: '', priority: 'medium', assignee_id: '' });
        setTaskModalOpen(true);
    };

    const openEditTask = (task: any) => {
        setEditingTask(task);
        setTaskError(null);
        setTaskForm({
            title: task.title,
            description: task.description ?? '',
            due_date: task.due_date ?? '',
            priority: task.priority,
            assignee_id: task.assignee_id ?? '',
        });
        setTaskModalOpen(true);
    };

    const deleteTask = async (task: any) => {
        if (!confirm(`Delete task "${task.title}"?`)) return;
        try {
            const token = (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement | null)?.content;
            const res = await fetch(`/tasks/${task.id}`, {
                method: 'DELETE',
                headers: { Accept: 'application/json', ...(token ? { 'X-CSRF-TOKEN': token } : {}) },
            });
            if (res.ok) {
                setTasks((prev) => prev.filter((t: any) => t.id !== task.id));
            }
        } catch {}
    };

    const saveTask = async () => {
        setTaskSaving(true);
        setTaskError(null);
        try {
            const isEdit = !!editingTask;
            const url = isEdit ? `/tasks/${editingTask.id}` : '/tasks';
            const method = isEdit ? 'PUT' : 'POST';

            const body: Record<string, unknown> = {
                title: taskForm.title,
                priority: taskForm.priority,
            };
            if (!isEdit) {
                body.matter_id = matter.id;
                body.status = 'todo';
            } else if (editingTask) {
                body.status = editingTask.status;
            }
            if (taskForm.description) body.description = taskForm.description;
            if (taskForm.due_date) body.due_date = taskForm.due_date;
            if (taskForm.assignee_id) body.assignee_id = taskForm.assignee_id;

            const token = (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement | null)?.content;
            const res = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    ...(token ? { 'X-CSRF-TOKEN': token } : {}),
                },
                body: JSON.stringify(body),
            });

            const payload = await res.json().catch(() => null);
            if (!res.ok) {
                const msg = payload?.errors
                    ? Object.values(payload.errors as Record<string, string[]>)?.[0]?.[0]
                    : null;
                setTaskError(msg || payload?.message || 'Unable to save task.');
                return;
            }

            if (isEdit) {
                setTasks((prev) => prev.map((t: any) => t.id === editingTask.id ? payload.task : t));
            } else {
                setTasks((prev) => [payload.task, ...prev]);
            }
            setTaskModalOpen(false);
        } catch {
            setTaskError('Unable to save task.');
        } finally {
            setTaskSaving(false);
        }
    };

    const cycleTaskStatus = async (task: any) => {
        const cycle: Record<string, string> = { todo: 'in_progress', in_progress: 'review', review: 'done', done: 'todo' };
        const next = task._overrideStatus ?? cycle[task.status] ?? 'todo';
        try {
            const token = (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement | null)?.content;
            const res = await fetch(`/tasks/${task.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    ...(token ? { 'X-CSRF-TOKEN': token } : {}),
                },
                body: JSON.stringify({ status: next }),
            });
            if (res.ok) {
                const data = await res.json();
                setTasks((prev) => prev.map((t) => t.id === task.id ? data.task : t));
            }
        } catch {}
    };

    const openDocModal = () => {
        setDocError(null);
        setDocFile(null);
        setDocFolder('');
        setDocClientVisible(false);
        if (docFileRef.current) docFileRef.current.value = '';
        setDocModalOpen(true);
    };

    const saveDoc = async () => {
        if (!docFile) { setDocError('Please select a file.'); return; }
        setDocSaving(true);
        setDocError(null);
        try {
            const token = (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement | null)?.content;
            const fd = new FormData();
            fd.append('file', docFile);
            fd.append('matter_id', matter.id);
            if (docFolder) fd.append('folder', docFolder);
            fd.append('is_client_visible', docClientVisible ? '1' : '0');

            const res = await fetch('/documents', {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    ...(token ? { 'X-CSRF-TOKEN': token } : {}),
                },
                body: fd,
            });
            const payload = await res.json().catch(() => null);
            if (!res.ok) {
                const msg = payload?.errors
                    ? Object.values(payload.errors as Record<string, string[]>)?.[0]?.[0]
                    : null;
                setDocError(msg || payload?.message || 'Unable to upload document.');
                return;
            }
            setDocuments((prev) => [payload.document, ...prev]);
            setDocModalOpen(false);
        } catch {
            setDocError('Unable to upload document.');
        } finally {
            setDocSaving(false);
        }
    };

    const statusVariant: Record<string, 'default' | 'success' | 'warning' | 'destructive' | 'secondary'> = {
        open:                'success',
        pending_court_date:  'warning',
        awaiting_client:     'warning',
        awaiting_opponent:   'secondary',
        on_hold:             'secondary',
        closed:              'default',
        archived:            'secondary',
    };

    const totalInvoiced  = (matter.invoices ?? []).reduce((s: number, i: any) => s + Number(i.total || 0), 0);
    const totalPaid      = (matter.invoices ?? []).reduce((s: number, i: any) => s + Number(i.amount_paid || 0), 0);
    const totalOutstanding = Math.max(0, totalInvoiced - totalPaid);
    const trustBalance   = (matter as any).trust_balance || 0;

    const PRIORITY_COLOURS: Record<string, string> = {
        high:   'bg-destructive/10 text-destructive border-destructive/20',
        medium: 'bg-warning/10 text-warning border-warning/20',
        low:    'bg-muted text-muted-foreground border-border',
    };

    const ACTIVITY_LABELS: Record<string, string> = {
        advising: 'Advising', drafting: 'Drafting', research: 'Research',
        court_attendance: 'Court Attendance', travel: 'Travel', telephone: 'Telephone',
        correspondence: 'Correspondence', meeting: 'Meeting', other: 'Other',
    };

    return (
        <AppLayout title={matter.name}>
            <Head title={matter.name} />

            {/* Navigation */}
            <div className="mb-5 flex items-center justify-between">
                <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground -ml-2">
                    <Link href="/matters">
                        <ArrowLeft className="h-4 w-4 mr-1.5" />
                        Matters
                    </Link>
                </Button>
                <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" type="button" onClick={openTimeModal}>
                        <Timer className="h-4 w-4 mr-1.5" />
                        Log Time
                    </Button>
                    <Button asChild size="sm" variant="outline">
                        <Link href={`/billing/create?matter_id=${matter.id}`}>
                            <Receipt className="h-4 w-4 mr-1.5" />
                            New Invoice
                        </Link>
                    </Button>
                    <Button asChild size="sm">
                        <Link href={`/matters/${matter.id}/edit`}>
                            <Edit className="h-4 w-4 mr-1.5" />
                            Edit
                        </Link>
                    </Button>
                </div>
            </div>

            {/* Matter Header Card */}
            <Card className="surface-card mb-5">
                <CardContent className="p-5">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                                <Badge variant={statusVariant[matter.status] ?? 'default'} className="text-xs font-semibold">
                                    {MATTER_STATUS_LABELS[matter.status]}
                                </Badge>
                                <span className="text-xs text-muted-foreground font-mono">{matter.matter_number}</span>
                            </div>
                            <h1 className="text-xl font-bold tracking-tight mb-1">{matter.name}</h1>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                                {matter.practice_area && (
                                    <span className="flex items-center gap-1">
                                        <Gavel className="h-3.5 w-3.5" />
                                        {PRACTICE_AREA_LABELS[matter.practice_area]}
                                    </span>
                                )}
                                {matter.fee_arrangement && (
                                    <span className="flex items-center gap-1">
                                        <PoundSterling className="h-3.5 w-3.5" />
                                        {matter.fee_arrangement.replace(/_/g, ' ')}
                                        {matter.fee_arrangement === 'hourly_rate' && (matter as any).custom_fields?.hourly_rate && (
                                            <span className="ml-1 font-semibold text-primary">
                                                £{(matter as any).custom_fields.hourly_rate}/hr
                                            </span>
                                        )}
                                        {matter.fee_arrangement === 'fixed_fee' && (matter as any).custom_fields?.fixed_fee_amount && (
                                            <span className="ml-1 font-semibold text-primary">
                                                £{(matter as any).custom_fields.fixed_fee_amount}
                                            </span>
                                        )}
                                        {matter.fee_arrangement === 'contingency' && (matter as any).custom_fields?.contingency_percentage && (
                                            <span className="ml-1 font-semibold text-primary">
                                                {(matter as any).custom_fields.contingency_percentage}%
                                            </span>
                                        )}
                                        {matter.fee_arrangement === 'retainer' && (matter as any).custom_fields?.retainer_amount && (
                                            <span className="ml-1 font-semibold text-primary">
                                                £{(matter as any).custom_fields.retainer_amount}
                                            </span>
                                        )}
                                    </span>
                                )}
                                {matter.opened_at && (
                                    <span className="flex items-center gap-1">
                                        <Calendar className="h-3.5 w-3.5" />
                                        Opened {formatDate(matter.opened_at)}
                                    </span>
                                )}
                                {matter.responsible_user && (
                                    <span>{matter.responsible_user.full_name}</span>
                                )}
                            </div>
                            {matter.description && (
                                <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{matter.description}</p>
                            )}
                        </div>

                        {/* Court info */}
                        {(matter.court || matter.court_reference) && (
                            <div className="shrink-0 text-right hidden md:block">
                                {matter.court && <p className="text-sm font-medium">{matter.court}</p>}
                                {matter.court_reference && <p className="text-xs text-muted-foreground">Ref: {matter.court_reference}</p>}
                                {(matter as any).hearing_date && (
                                    <p className="text-xs text-warning font-medium mt-1">
                                        Hearing {formatDate((matter as any).hearing_date)}
                                    </p>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Deadline alert */}
                    {matter.next_deadline && new Date(matter.next_deadline) <= new Date(Date.now() + 7 * 86400000) && (
                        <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-md bg-warning/10 text-warning text-sm border border-warning/20">
                            <AlertTriangle className="h-4 w-4 shrink-0" />
                            <span>Deadline coming up: <strong>{formatDate(matter.next_deadline)}</strong></span>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Financial Summary Strip */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
                {[
                    { label: 'Unbilled Time', value: formatCurrency(matter.unbilled_time_value || 0), colour: 'text-primary',     bg: 'bg-primary/8' },
                    { label: 'Total Invoiced', value: formatCurrency(totalInvoiced),                  colour: 'text-foreground',  bg: 'bg-muted/60' },
                    { label: 'Total Paid',     value: formatCurrency(totalPaid),                      colour: 'text-success',     bg: 'bg-success/8' },
                    { label: 'Outstanding',    value: formatCurrency(totalOutstanding),               colour: totalOutstanding > 0 ? 'text-warning' : 'text-muted-foreground', bg: totalOutstanding > 0 ? 'bg-warning/8' : 'bg-muted/60' },
                    { label: 'Trust Balance',  value: formatCurrency(trustBalance),                  colour: 'text-accent',      bg: 'bg-accent/8' },
                ].map((s) => (
                    <div key={s.label} className={cn('rounded-lg border border-border/60 p-3', s.bg)}>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">{s.label}</p>
                        <p className={cn('text-base font-bold tabular-nums', s.colour)}>{s.value}</p>
                    </div>
                ))}
            </div>

            {/* Tabs */}
            <div className="mb-5 border-b border-border/60 overflow-x-auto">
                <div className="flex items-center gap-0 min-w-max">
                    {[
                        { key: 'dashboard', label: 'Overview',     count: null },
                        { key: 'time',      label: 'Time',          count: timeEntries.length || null },
                        { key: 'expenses',  label: 'Expenses',      count: expenses.length || null },
                        { key: 'documents', label: 'Documents',     count: documents.length || null },
                        { key: 'tasks',     label: 'Tasks',         count: tasks.filter((t: any) => t.status !== 'done').length || null },
                        { key: 'billing',   label: 'Billing',       count: matter.invoices?.length || null },
                        { key: 'trust',     label: 'Trust Account', count: null },
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

            {tab === 'dashboard' && (
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                    {/* Left: Notes + Activity */}
                    <div className="lg:col-span-2 space-y-5">
                        <Card className="surface-card">
                            <CardHeader className="flex flex-row items-center justify-between pb-3">
                                <CardTitle className="text-base tracking-tight flex items-center gap-2">
                                    <MessageSquare className="h-4 w-4" />
                                    Notes & Activity
                                </CardTitle>
                                <Button size="sm" variant="outline" type="button" onClick={openNoteModal}>
                                    <Plus className="h-3.5 w-3.5 mr-1" />
                                    Add Note
                                </Button>
                            </CardHeader>
                            <CardContent className="p-0">
                                {notes?.length === 0 ? (
                                    <div className="px-6 py-8 text-center text-sm text-muted-foreground">
                                        <MessageSquare className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                                        No notes yet.
                                    </div>
                                ) : (
                                    <div className="divide-y divide-border/60">
                                        {notes.map((note: any) => (
                                            <div key={note.id} className="px-5 py-4 hover:bg-muted/20 transition-colors">
                                                <div className="flex items-center gap-2 mb-1.5">
                                                    <span className="h-6 w-6 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center shrink-0">
                                                        {(note.user?.full_name || 'S')[0]}
                                                    </span>
                                                    <span className="text-sm font-medium">{note.user?.full_name || 'System'}</span>
                                                    <span className="text-xs text-muted-foreground">{formatDate(note.logged_at ?? note.created_at)}</span>
                                                    <Badge variant="secondary" className="text-xs capitalize ml-auto">
                                                        {note.type?.replace(/_/g, ' ') || 'Note'}
                                                    </Badge>
                                                </div>
                                                <p className="text-sm whitespace-pre-wrap text-muted-foreground ml-8">{note.body}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Upcoming tasks on overview */}
                        {tasks.filter((t: any) => t.status !== 'done').length > 0 && (
                            <Card className="surface-card">
                                <CardHeader className="flex flex-row items-center justify-between pb-3">
                                    <CardTitle className="text-base tracking-tight flex items-center gap-2">
                                        <CheckSquare className="h-4 w-4" />
                                        Open Tasks
                                    </CardTitle>
                                    <button className="text-xs text-primary hover:underline" onClick={() => setTab('tasks')}>
                                        View all
                                    </button>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <div className="divide-y divide-border/60">
                                        {tasks.filter((t: any) => t.status !== 'done').slice(0, 4).map((task: any) => (
                                            <div key={task.id} className="px-5 py-3 flex items-center gap-3">
                                                <span className={cn('h-2 w-2 rounded-full shrink-0', {
                                                    'bg-destructive': task.priority === 'high',
                                                    'bg-warning': task.priority === 'medium',
                                                    'bg-muted-foreground/40': task.priority === 'low',
                                                })} />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium truncate">{task.title}</p>
                                                    {task.due_date && (
                                                        <p className={cn('text-xs', new Date(task.due_date) < new Date() ? 'text-destructive font-medium' : 'text-muted-foreground')}>
                                                            Due {formatDate(task.due_date)}
                                                        </p>
                                                    )}
                                                </div>
                                                <button onClick={() => cycleTaskStatus(task)}>
                                                    <Badge variant={task.status === 'in_progress' ? 'warning' : 'secondary'} className="text-xs cursor-pointer hover:opacity-80">
                                                        {task.status.replace(/_/g, ' ')}
                                                    </Badge>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </div>

                    {/* Right Sidebar */}
                    <div className="space-y-5">
                        {/* People */}
                        <Card className="surface-card">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base tracking-tight flex items-center gap-2">
                                    <Users className="h-4 w-4" />
                                    People
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4 pt-0">
                                {matter.responsible_user && (
                                    <div>
                                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Handling Solicitor</p>
                                        <div className="flex items-center gap-2">
                                            <span className="h-7 w-7 rounded-full bg-brand-500/15 text-brand-600 text-xs font-bold flex items-center justify-center shrink-0">
                                                {matter.responsible_user.full_name[0]}
                                            </span>
                                            <div>
                                                <p className="text-sm font-medium">{matter.responsible_user.full_name}</p>
                                                <p className="text-xs text-muted-foreground">{matter.responsible_user.email}</p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                {matter.contacts && matter.contacts.length > 0 && (
                                    <>
                                        {matter.responsible_user && <Separator />}
                                        <div>
                                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Clients &amp; Parties</p>
                                            <div className="space-y-2.5">
                                                {matter.contacts.map((contact: any) => (
                                                    <Link key={contact.id} href={`/contacts/${contact.id}`}
                                                        className="flex items-center gap-2 group">
                                                        <span className="h-7 w-7 rounded-full bg-muted text-muted-foreground text-xs font-bold flex items-center justify-center shrink-0 group-hover:bg-primary/15 group-hover:text-primary transition-colors">
                                                            {contact.name[0]}
                                                        </span>
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-sm font-medium group-hover:text-primary transition-colors truncate">{contact.name}</p>
                                                            <p className="text-xs text-muted-foreground capitalize">
                                                                {(contact.pivot?.role || 'client').replace(/_/g, ' ')}
                                                            </p>
                                                        </div>
                                                        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/0 group-hover:text-muted-foreground transition-colors shrink-0" />
                                                    </Link>
                                                ))}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </CardContent>
                        </Card>

                        {/* Recent Invoices */}
                        <Card className="surface-card">
                            <CardHeader className="flex flex-row items-center justify-between pb-3">
                                <CardTitle className="text-base tracking-tight flex items-center gap-2">
                                    <Receipt className="h-4 w-4" />
                                    Recent Invoices
                                </CardTitle>
                                <Link href={`/billing/create?matter_id=${matter.id}`} className="text-xs text-primary hover:underline">
                                    + New
                                </Link>
                            </CardHeader>
                            <CardContent className="p-0">
                                {!matter.invoices?.length ? (
                                    <p className="px-4 py-3 text-xs text-muted-foreground">No invoices yet.</p>
                                ) : (
                                    <div className="divide-y divide-border/60">
                                        {matter.invoices.slice(0, 5).map((inv: any) => (
                                            <Link key={inv.id} href={`/billing/${inv.id}`}
                                                className="px-4 py-3 flex items-center justify-between hover:bg-muted/30 transition-colors block">
                                                <div>
                                                    <p className="text-sm font-medium">{inv.invoice_number}</p>
                                                    <p className="text-xs text-muted-foreground">{formatDate(inv.created_at)}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-sm font-semibold tabular-nums">{formatCurrency(Number(inv.total))}</p>
                                                    <Badge variant={inv.status === 'paid' ? 'success' : inv.status === 'sent' ? 'warning' : 'secondary'}
                                                        className="text-xs capitalize">{inv.status}</Badge>
                                                </div>
                                            </Link>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            )}

            {tab === 'time' && (
                <>
                    {/* ─── Live Timer Module ─── */}
                    <div className={cn(
                        "mb-4 rounded-2xl border shadow-lg overflow-hidden transition-all duration-300",
                        timerSession
                            ? "border-emerald-200/60 dark:border-emerald-800/30 bg-gradient-to-br from-emerald-50/90 via-white to-green-50/40 dark:from-emerald-950/40 dark:via-card dark:to-green-950/20 shadow-emerald-100/50 dark:shadow-emerald-900/20"
                            : "border-border/50 bg-gradient-to-br from-card via-card to-primary/[0.02] shadow-muted/20",
                    )}>
                        {timerSession ? (
                            <div className="relative h-1.5 w-full overflow-hidden">
                                <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 via-teal-400 to-green-500" />
                                <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.3)_50%,transparent_100%)] animate-shimmer" />
                            </div>
                        ) : (
                            <div className="h-0.5 w-full bg-gradient-to-r from-primary/60 via-primary/30 to-transparent" />
                        )}
                        <div className="p-5 sm:p-6">
                            {timerSession ? (
                                /* ── Running / Paused State ── */
                                <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
                                    {/* Left: Timer display */}
                                    <div className="flex-1 min-w-0">
                                        {/* Status badge */}
                                        <div className="flex items-center gap-3 mb-5">
                                            <div className={cn(
                                                "flex items-center gap-2.5 px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest transition-colors",
                                                timerPaused
                                                    ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
                                                    : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
                                            )}>
                                                <span className="relative flex h-2 w-2">
                                                    <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-75", timerPaused ? "bg-amber-400" : "bg-emerald-400")} />
                                                    <span className={cn("relative inline-flex rounded-full h-2 w-2", timerPaused ? "bg-amber-500" : "bg-emerald-500")} />
                                                </span>
                                                {timerPaused ? 'Paused' : 'Recording'}
                                            </div>
                                            <span className="text-xs text-muted-foreground">
                                                Started {new Date(timerSession.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>

                                        {/* Matter info */}
                                        <div className="mb-5">
                                            <p className="text-lg font-bold truncate text-foreground">{matter.name}</p>
                                            <p className="text-xs text-muted-foreground font-mono mt-0.5">{matter.matter_number}</p>
                                        </div>

                                        {/* Clock display card */}
                                        <div className={cn(
                                            "rounded-xl p-6 mb-5 transition-colors duration-300",
                                            timerPaused
                                                ? "bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-800/30"
                                                : "bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-800/30",
                                        )}>
                                            <p className="font-mono text-6xl font-black tabular-nums tracking-tight text-foreground leading-none">
                                                {formatTimerElapsed(timerElapsed)}
                                            </p>
                                        </div>

                                        {/* Running cost + rate */}
                                        <div className="flex flex-wrap items-center gap-3">
                                            {timerForm.rate && (
                                                <div className="inline-flex items-center gap-2 rounded-full px-4 py-2 bg-white dark:bg-black/20 border border-border/50 shadow-sm">
                                                    <div className="p-1 rounded-full bg-emerald-100 dark:bg-emerald-900/50">
                                                        <PoundSterling className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                                                    </div>
                                                    <span className="text-sm font-bold text-foreground">
                                                        {formatCurrency((parseFloat(timerForm.rate) || 0) * (timerElapsed / 3600))}
                                                    </span>
                                                </div>
                                            )}
                                            {timerForm.rate && (
                                                <span className="text-xs text-muted-foreground">
                                                    @ £{parseFloat(timerForm.rate).toFixed(2)}/hr
                                                </span>
                                            )}
                                            <span className="text-xs text-muted-foreground">
                                                {timerForm.billable ? 'Billable' : 'Non-billable'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Right: Fields + actions */}
                                    <div className="flex flex-col gap-3 lg:w-72 w-full">
                                        <div className="space-y-1.5">
                                            <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Activity</Label>
                                            <Select value={liveActivity} onValueChange={setLiveActivity}>
                                                <SelectTrigger className="h-10 bg-background/60 backdrop-blur-sm border-border/60 rounded-lg">
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
                                            <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Notes</Label>
                                            <Textarea
                                                rows={2}
                                                className="resize-none text-sm bg-background/60 backdrop-blur-sm border-border/60 rounded-lg"
                                                placeholder="What are you working on?"
                                                value={liveDescription}
                                                onChange={(e) => setLiveDescription(e.target.value)}
                                            />
                                        </div>
                                        <div className="pt-1 space-y-2">
                                            <Button
                                                className="w-full gap-2 h-11 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white shadow-md shadow-emerald-200 dark:shadow-emerald-900/30 rounded-lg font-semibold transition-all"
                                                onClick={() => setTimerCheckOutOpen(true)}
                                            >
                                                <Clock className="h-4 w-4" />
                                                Stop & Save
                                            </Button>
                                            <div className="flex gap-2">
                                                {timerPaused ? (
                                                    <Button variant="outline" size="sm" className="flex-1 gap-1.5 h-9 border-amber-300 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 rounded-lg font-medium transition-all" onClick={timerResume}>
                                                        <Timer className="h-3.5 w-3.5" /> Resume
                                                    </Button>
                                                ) : (
                                                    <Button variant="outline" size="sm" className="flex-1 gap-1.5 h-9 rounded-lg font-medium transition-all" onClick={timerPause}>
                                                        <Clock className="h-3.5 w-3.5" /> Pause
                                                    </Button>
                                                )}
                                                <Button variant="ghost" size="sm" className="flex-1 gap-1.5 h-9 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 font-medium transition-all" onClick={timerDiscard}>
                                                    <X className="h-3.5 w-3.5" /> Discard
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                /* ── Idle State: Start Form ── */
                                <div>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="relative">
                                                <div className="p-3 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 dark:from-primary/20 dark:to-primary/5 ring-1 ring-primary/10">
                                                    <Timer className="h-5 w-5 text-primary" />
                                                </div>
                                            </div>
                                            <div>
                                                <p className="text-base font-bold text-foreground">Time Tracker</p>
                                                <p className="text-xs text-muted-foreground mt-0.5">Track billable time for <span className="font-mono font-medium">{matter.matter_number}</span></p>
                                            </div>
                                        </div>
                                        {!timerExpanded && (
                                            <Button size="sm" className="gap-2 h-9 px-5 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-primary-foreground shadow-md shadow-primary/20 rounded-lg font-semibold transition-all" onClick={() => setTimerExpanded(true)}>
                                                <Timer className="h-4 w-4" /> Start Timer
                                            </Button>
                                        )}
                                    </div>

                                    {timerExpanded && (
                                        <div className="space-y-5 mt-5 pt-5 border-t border-border/40">
                                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                                <div className="space-y-2">
                                                    <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Activity</Label>
                                                    <Select value={timerForm.activity_type} onValueChange={(v) => setTimerForm((p) => ({ ...p, activity_type: v }))}>
                                                        <SelectTrigger className="h-11 rounded-lg border-border/60"><SelectValue /></SelectTrigger>
                                                        <SelectContent>
                                                            {Object.entries(ACTIVITY_LABELS).map(([k, v]) => (
                                                                <SelectItem key={k} value={k}>{v}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Rate (£/hr)</Label>
                                                    <div className="relative">
                                                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">£</span>
                                                        <Input
                                                            type="number" step="0.01" min="0" className="h-11 pl-7 rounded-lg border-border/60"
                                                            value={timerForm.rate}
                                                            onChange={(e) => setTimerForm((p) => ({ ...p, rate: e.target.value }))}
                                                            placeholder="Default rate"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Description</Label>
                                                <Textarea
                                                    rows={2}
                                                    className="resize-none rounded-lg border-border/60"
                                                    placeholder="What will you be working on?"
                                                    value={timerForm.description}
                                                    onChange={(e) => setTimerForm((p) => ({ ...p, description: e.target.value }))}
                                                />
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setTimerForm((p) => ({ ...p, billable: !p.billable }))}
                                                className={cn(
                                                    'w-full flex items-center justify-between px-4 py-3.5 rounded-xl border-2 transition-all duration-200',
                                                    timerForm.billable
                                                        ? 'border-emerald-400/70 bg-gradient-to-r from-emerald-50 to-green-50/50 dark:from-emerald-950/30 dark:to-green-950/20 shadow-sm shadow-emerald-100 dark:shadow-none'
                                                        : 'border-border/60 bg-muted/20 hover:bg-muted/30',
                                                )}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={cn(
                                                        'h-9 w-9 rounded-lg flex items-center justify-center transition-all duration-200',
                                                        timerForm.billable ? 'bg-emerald-500 shadow-sm shadow-emerald-200 dark:shadow-emerald-900/30' : 'bg-muted',
                                                    )}>
                                                        <PoundSterling className={cn('h-4 w-4 transition-colors', timerForm.billable ? 'text-white' : 'text-muted-foreground')} />
                                                    </div>
                                                    <div className="text-left">
                                                        <p className="text-sm font-semibold">{timerForm.billable ? 'Billable to client' : 'Non-billable'}</p>
                                                        <p className="text-xs text-muted-foreground">{timerForm.billable ? 'Will appear on invoice' : 'Internal time only'}</p>
                                                    </div>
                                                </div>
                                                <span className={cn(
                                                    'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent transition-colors duration-200',
                                                    timerForm.billable ? 'bg-emerald-500' : 'bg-muted-foreground/25',
                                                )}>
                                                    <span className={cn(
                                                        'inline-block h-5 w-5 rounded-full bg-white shadow-md ring-1 ring-black/5 transition-transform duration-200',
                                                        timerForm.billable ? 'translate-x-5' : 'translate-x-0',
                                                    )} />
                                                </span>
                                            </button>
                                            <div className="flex gap-2 justify-end pt-1">
                                                <Button variant="outline" size="sm" className="rounded-lg" onClick={() => setTimerExpanded(false)}>Cancel</Button>
                                                <Button className="gap-2 h-9 px-5 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-primary-foreground shadow-md shadow-primary/20 rounded-lg font-semibold transition-all" onClick={timerCheckIn} disabled={timerLoading}>
                                                    <Timer className="h-4 w-4" />
                                                    {timerLoading ? 'Starting...' : 'Start Tracking'}
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ─── Timer Checkout Dialog ─── */}
                    <Dialog open={timerCheckOutOpen} onOpenChange={setTimerCheckOutOpen}>
                        <DialogContent className="max-w-sm">
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2.5 text-lg">
                                    <div className="p-1.5 rounded-lg bg-success/10">
                                        <CheckSquare className="h-4.5 w-4.5 text-success" />
                                    </div>
                                    Confirm Check-out
                                </DialogTitle>
                                <DialogDescription>Review your time entry details before saving.</DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 pt-1">
                                {/* Summary card */}
                                <div className="rounded-xl bg-muted/30 border border-border/40 p-4 space-y-3">
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Matter</span>
                                        <span className="font-semibold text-sm truncate max-w-[180px] text-right">{matter.name}</span>
                                    </div>
                                    <div className="h-px bg-border/40" />
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Activity</span>
                                        <span className="text-sm">{ACTIVITY_LABELS[liveActivity] ?? liveActivity}</span>
                                    </div>
                                    <div className="h-px bg-border/40" />
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Duration</span>
                                        <span className="font-mono font-black text-xl tabular-nums">{formatTimerElapsed(timerElapsed)}</span>
                                    </div>
                                </div>
                                {/* Amount highlight */}
                                {timerForm.rate && (
                                    <div className="rounded-xl border-2 border-success/20 bg-gradient-to-r from-success/5 to-success/[0.02] p-4 flex items-center justify-between">
                                        <div>
                                            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Amount</span>
                                            <p className="text-xs text-muted-foreground mt-0.5">@ £{parseFloat(timerForm.rate).toFixed(2)}/hr</p>
                                        </div>
                                        <span className="text-2xl font-black text-success tabular-nums">
                                            {formatCurrency((parseFloat(timerForm.rate) || 0) * (timerElapsed / 3600))}
                                        </span>
                                    </div>
                                )}
                                {/* Rate input */}
                                <div className="space-y-2">
                                    <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Rate (£/hr)</Label>
                                    <Input
                                        type="number" min="0" step="0.01" className="h-10 rounded-lg border-border/60"
                                        value={timerForm.rate}
                                        onChange={(e) => setTimerForm((p) => ({ ...p, rate: e.target.value }))}
                                    />
                                </div>
                                {/* Billable toggle */}
                                <button
                                    type="button"
                                    onClick={() => setTimerForm((p) => ({ ...p, billable: !p.billable }))}
                                    className={cn(
                                        'w-full flex items-center justify-between px-4 py-3.5 rounded-xl border-2 transition-all duration-200',
                                        timerForm.billable
                                            ? 'border-emerald-400/70 bg-gradient-to-r from-emerald-50 to-green-50/50 dark:from-emerald-950/30 dark:to-green-950/20'
                                            : 'border-border/60 bg-muted/20 hover:bg-muted/30',
                                    )}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={cn(
                                            'h-9 w-9 rounded-lg flex items-center justify-center transition-all duration-200',
                                            timerForm.billable ? 'bg-emerald-500 shadow-sm' : 'bg-muted',
                                        )}>
                                            <PoundSterling className={cn('h-4 w-4 transition-colors', timerForm.billable ? 'text-white' : 'text-muted-foreground')} />
                                        </div>
                                        <div className="text-left">
                                            <p className="text-sm font-semibold">{timerForm.billable ? 'Billable to client' : 'Non-billable'}</p>
                                            <p className="text-xs text-muted-foreground">{timerForm.billable ? 'Will appear on invoice' : 'Internal time only'}</p>
                                        </div>
                                    </div>
                                    <span className={cn(
                                        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent transition-colors duration-200',
                                        timerForm.billable ? 'bg-emerald-500' : 'bg-muted-foreground/25',
                                    )}>
                                        <span className={cn(
                                            'inline-block h-5 w-5 rounded-full bg-white shadow-md ring-1 ring-black/5 transition-transform duration-200',
                                            timerForm.billable ? 'translate-x-5' : 'translate-x-0',
                                        )} />
                                    </span>
                                </button>
                            </div>
                            <DialogFooter className="gap-2 pt-2">
                                <Button variant="outline" className="rounded-lg" onClick={() => setTimerCheckOutOpen(false)} disabled={timerLoading}>Back</Button>
                                <Button
                                    className="gap-2 h-10 px-6 bg-gradient-to-r from-success to-success/90 hover:from-success/90 hover:to-success text-success-foreground shadow-md shadow-success/20 rounded-lg font-semibold transition-all"
                                    onClick={timerCheckOut}
                                    disabled={timerLoading}
                                >
                                    <Clock className="h-4 w-4" />
                                    {timerLoading ? 'Saving...' : 'Check-out & Save'}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    <Card className="surface-card">
                    <CardHeader className="flex flex-row items-center justify-between pb-3">
                        <div>
                            <CardTitle className="text-base tracking-tight flex items-center gap-2">
                                <Clock className="h-4 w-4" /> Time Entries
                            </CardTitle>
                            {timeEntries.length > 0 && (
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    {timeEntries.length} entries ·&nbsp;
                                    {Math.floor(timeEntries.reduce((s: number, e: any) => s + e.duration_minutes, 0) / 60)}h {timeEntries.reduce((s: number, e: any) => s + e.duration_minutes, 0) % 60}m ·&nbsp;
                                    {formatCurrency(timeEntries.reduce((s: number, e: any) => s + Number(e.amount || 0), 0))}
                                </p>
                            )}
                        </div>
                        <Button size="sm" variant="outline" type="button" onClick={openTimeModal}>
                            <Plus className="h-3.5 w-3.5 mr-1" />
                            Log Time
                        </Button>
                    </CardHeader>
                    <CardContent className="p-0">
                        {timeEntries?.length ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b bg-muted/30 text-muted-foreground">
                                            <th className="text-left px-4 py-2.5 font-medium">Date</th>
                                            <th className="text-left px-4 py-2.5 font-medium">Description</th>
                                            <th className="text-left px-4 py-2.5 font-medium hidden md:table-cell">Activity</th>
                                            <th className="text-left px-4 py-2.5 font-medium hidden lg:table-cell">User</th>
                                            <th className="text-center px-4 py-2.5 font-medium">Billable</th>
                                            <th className="text-right px-4 py-2.5 font-medium">Duration</th>
                                            <th className="text-right px-4 py-2.5 font-medium">Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/60">
                                        {timeEntries.map((entry: any) => (
                                            <tr key={entry.id} className="hover:bg-muted/30 transition-colors">
                                                <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">{formatDate(entry.date)}</td>
                                                <td className="px-4 py-2.5 max-w-xs">
                                                    <p className="truncate">{entry.description || 'Legal services'}</p>
                                                </td>
                                                <td className="px-4 py-2.5 text-muted-foreground hidden md:table-cell">
                                                    {ACTIVITY_LABELS[entry.activity_type] ?? entry.activity_type ?? '—'}
                                                </td>
                                                <td className="px-4 py-2.5 text-muted-foreground hidden lg:table-cell">{entry.user?.full_name ?? '—'}</td>
                                                <td className="px-4 py-2.5 text-center">
                                                    <Badge variant={entry.billable ? 'success' : 'secondary'} className="text-xs">
                                                        {entry.billable ? 'Yes' : 'No'}
                                                    </Badge>
                                                </td>
                                                <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                                                    {Math.floor(entry.duration_minutes / 60)}h {String(entry.duration_minutes % 60).padStart(2, '0')}m
                                                </td>
                                                <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
                                                    {formatCurrency(Number(entry.amount || 0))}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="border-t bg-muted/20 font-semibold">
                                            <td colSpan={6} className="px-4 py-2 text-right text-xs text-muted-foreground uppercase tracking-wide">Total</td>
                                            <td className="px-4 py-2 text-right text-success tabular-nums">
                                                {formatCurrency(timeEntries.reduce((s: number, e: any) => s + Number(e.amount || 0), 0))}
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        ) : (
                            <div className="px-6 py-10 text-center text-sm text-muted-foreground">
                                <Clock className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                                No time entries yet.
                            </div>
                        )}
                    </CardContent>
                </Card>
                </>
            )}

            {tab === 'expenses' && (
                <Card className="surface-card">
                    <CardHeader className="flex flex-row items-center justify-between pb-3">
                        <div>
                            <CardTitle className="text-base tracking-tight">Expenses</CardTitle>
                            {expenses.length > 0 && (
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    {expenses.length} items · {formatCurrency(expenses.reduce((s: number, e: any) => s + Number(e.amount || 0), 0))}
                                </p>
                            )}
                        </div>
                        <Button size="sm" variant="outline" type="button" onClick={openExpenseModal}>
                            <Plus className="h-3.5 w-3.5 mr-1" />
                            Add Expense
                        </Button>
                    </CardHeader>
                    <CardContent className="p-0">
                        {expenses?.length ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b bg-muted/30 text-muted-foreground">
                                            <th className="text-left px-4 py-2.5 font-medium">Date</th>
                                            <th className="text-left px-4 py-2.5 font-medium">Description</th>
                                            <th className="text-left px-4 py-2.5 font-medium hidden md:table-cell">Vendor</th>
                                            <th className="text-left px-4 py-2.5 font-medium hidden lg:table-cell">Category</th>
                                            <th className="text-center px-4 py-2.5 font-medium">Billable</th>
                                            <th className="text-right px-4 py-2.5 font-medium">Amount</th>
                                            <th className="text-center px-4 py-2.5 font-medium">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/60">
                                        {expenses.map((exp: any) => (
                                            <tr key={exp.id} className="hover:bg-muted/30 transition-colors">
                                                <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">{formatDate(exp.date)}</td>
                                                <td className="px-4 py-2.5 max-w-xs"><p className="truncate">{exp.description}</p></td>
                                                <td className="px-4 py-2.5 text-muted-foreground hidden md:table-cell">{exp.vendor || '—'}</td>
                                                <td className="px-4 py-2.5 text-muted-foreground hidden lg:table-cell capitalize">{exp.category || '—'}</td>
                                                <td className="px-4 py-2.5 text-center">
                                                    <Badge variant={exp.billable ? 'success' : 'secondary'} className="text-xs">{exp.billable ? 'Yes' : 'No'}</Badge>
                                                </td>
                                                <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{formatCurrency(Number(exp.amount || 0))}</td>
                                                <td className="px-4 py-2.5 text-center">
                                                    <Badge variant={exp.billed ? 'default' : 'warning'} className="text-xs">{exp.billed ? 'Billed' : 'Unbilled'}</Badge>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="border-t bg-muted/20 font-semibold">
                                            <td colSpan={5} className="px-4 py-2 text-right text-xs text-muted-foreground uppercase tracking-wide">Total</td>
                                            <td className="px-4 py-2 text-right text-success tabular-nums">
                                                {formatCurrency(expenses.reduce((s: number, e: any) => s + Number(e.amount || 0), 0))}
                                            </td>
                                            <td />
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        ) : (
                            <div className="px-6 py-10 text-center text-sm text-muted-foreground">
                                <Receipt className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                                No expenses yet.
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {tab === 'documents' && (
                <Card className="surface-card">
                    <CardHeader className="flex flex-row items-center justify-between pb-3">
                        <CardTitle className="text-base tracking-tight flex items-center gap-2">
                            <FileText className="h-4 w-4" /> Documents
                        </CardTitle>
                        <Button size="sm" variant="outline" type="button" onClick={openDocModal}>
                            <Plus className="h-3.5 w-3.5 mr-1" />
                            Upload
                        </Button>
                    </CardHeader>
                    <CardContent className="p-0">
                        {documents.length ? (
                            <>
                                {Object.entries(
                                    documents.reduce((acc: Record<string, any[]>, doc: any) => {
                                        const folder = doc.folder || 'General';
                                        (acc[folder] = acc[folder] || []).push(doc);
                                        return acc;
                                    }, {})
                                ).map(([folder, docs]) => (
                                    <div key={folder}>
                                        <div className="px-5 py-2 bg-muted/30 border-b border-t border-border/60 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                            {folder}
                                        </div>
                                        {(docs as any[]).map((doc: any) => (
                                            <div key={doc.id} className="px-5 py-3.5 flex items-center gap-3 hover:bg-muted/20 transition-colors border-b border-border/40 last:border-0">
                                                <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium truncate">{doc.name}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {doc.uploadedBy?.full_name ? `${doc.uploadedBy.full_name} · ` : ''}
                                                        {doc.created_at ? formatDate(doc.created_at) : ''}
                                                        {doc.size ? ` · ${Math.round(doc.size / 1024)} KB` : ''}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <Badge variant={doc.is_client_visible ? 'success' : 'secondary'} className="text-xs hidden sm:inline-flex">
                                                        {doc.is_client_visible ? 'Client' : 'Internal'}
                                                    </Badge>
                                                    <Button variant="ghost" size="icon" className="h-7 w-7" title="View document" onClick={() => setViewerDoc(doc)}>
                                                        <Eye className="h-3.5 w-3.5" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-7 w-7" title="Download document" asChild>
                                                        <a href={`/documents/${doc.id}/download`} download>
                                                            <Download className="h-3.5 w-3.5" />
                                                        </a>
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ))}
                            </>
                        ) : (
                            <div className="px-6 py-10 text-center text-sm text-muted-foreground">
                                <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                                No documents yet.
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {tab === 'tasks' && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">{tasks.length} total · {tasks.filter((t: any) => t.status !== 'done').length} open</p>
                        <Button size="sm" variant="outline" type="button" onClick={openTaskModal}>
                            <Plus className="h-3.5 w-3.5 mr-1" />
                            Add Task
                        </Button>
                    </div>
                    {tasks.length === 0 ? (
                        <Card className="surface-card">
                            <CardContent className="py-10 text-center text-sm text-muted-foreground">
                                <CheckSquare className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                                No tasks yet.
                            </CardContent>
                        </Card>
                    ) : (
                        ['todo', 'in_progress', 'review', 'done'].map((status) => {
                            const group = tasks.filter((t: any) => t.status === status);
                            if (!group.length) return null;
                            const STATUS_LABELS: Record<string, string> = { todo: 'To Do', in_progress: 'In Progress', review: 'In Review', done: 'Done' };
                            return (
                                <Card key={status} className="surface-card">
                                    <CardHeader className="pb-2 pt-4 px-5">
                                        <div className="flex items-center gap-2">
                                            <span className={cn('h-2 w-2 rounded-full', {
                                                'bg-muted-foreground/40': status === 'todo',
                                                'bg-primary': status === 'in_progress',
                                                'bg-warning': status === 'review',
                                                'bg-success': status === 'done',
                                            })} />
                                            <span className="text-sm font-semibold">{STATUS_LABELS[status]}</span>
                                            <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">{group.length}</span>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="p-0">
                                        <div className="divide-y divide-border/50">
                                            {group.map((task: any) => (
                                                <div key={task.id} className="px-5 py-3 flex items-center gap-3 hover:bg-muted/20 transition-colors">
                                                    <span className={cn('h-2 w-2 rounded-full shrink-0', {
                                                        'bg-destructive': task.priority === 'high',
                                                        'bg-warning': task.priority === 'medium',
                                                        'bg-muted-foreground/30': task.priority === 'low',
                                                    })} title={`${task.priority} priority`} />
                                                    <div className="flex-1 min-w-0">
                                                        <p className={cn('text-sm font-medium truncate', status === 'done' && 'line-through text-muted-foreground')}>
                                                            {task.title}
                                                        </p>
                                                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                                            {task.due_date && (
                                                                <span className={cn(new Date(task.due_date) < new Date() && status !== 'done' ? 'text-destructive font-medium' : '')}>
                                                                    Due {formatDate(task.due_date)}
                                                                </span>
                                                            )}
                                                            {task.assignee?.full_name && (
                                                                <span>· {task.assignee.full_name}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <Select
                                                        value={task.status}
                                                        onValueChange={(v) => cycleTaskStatus({ ...task, _overrideStatus: v })}
                                                    >
                                                        <SelectTrigger className={cn(
                                                            'h-7 w-32 text-xs font-medium border-0 shadow-none shrink-0 focus:ring-1',
                                                            task.status === 'todo'        && 'bg-muted text-muted-foreground',
                                                            task.status === 'in_progress' && 'bg-warning/10 text-warning-foreground',
                                                            task.status === 'review'      && 'bg-primary/10 text-primary',
                                                            task.status === 'done'        && 'bg-success/10 text-success-foreground',
                                                        )}>
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="todo">To Do</SelectItem>
                                                            <SelectItem value="in_progress">In Progress</SelectItem>
                                                            <SelectItem value="review">Review</SelectItem>
                                                            <SelectItem value="done">Done</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    <div className="flex items-center gap-1 shrink-0">
                                                        <button
                                                            type="button"
                                                            className="flex items-center justify-center h-7 w-7 rounded-md border border-border hover:bg-muted transition-colors"
                                                            title="Edit task"
                                                            onClick={() => openEditTask(task)}
                                                        >
                                                            <Pencil className="h-3.5 w-3.5" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="flex items-center justify-center h-7 w-7 rounded-md border border-border hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors"
                                                            title="Delete task"
                                                            onClick={() => deleteTask(task)}
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })
                    )}
                </div>
            )}

            {tab === 'billing' && (
                <Card className="surface-card">
                    <CardHeader className="flex flex-row items-center justify-between pb-3">
                        <div>
                            <CardTitle className="text-base tracking-tight flex items-center gap-2">
                                <Receipt className="h-4 w-4" /> Invoices
                            </CardTitle>
                            {(matter.invoices?.length ?? 0) > 0 && (
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    {matter.invoices.length} invoices · {formatCurrency(totalInvoiced)} total · {formatCurrency(totalOutstanding)} outstanding
                                </p>
                            )}
                        </div>
                        <Button size="sm" asChild>
                            <Link href={`/billing/create?matter_id=${matter.id}`}>
                                <Plus className="h-3.5 w-3.5 mr-1" />
                                New Invoice
                            </Link>
                        </Button>
                    </CardHeader>
                    <CardContent className="p-0">
                        {matter.invoices?.length ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b bg-muted/30 text-muted-foreground">
                                            <th className="text-left px-4 py-2.5 font-medium">Invoice #</th>
                                            <th className="text-left px-4 py-2.5 font-medium hidden md:table-cell">Date</th>
                                            <th className="text-left px-4 py-2.5 font-medium hidden lg:table-cell">Due</th>
                                            <th className="text-right px-4 py-2.5 font-medium">Total</th>
                                            <th className="text-right px-4 py-2.5 font-medium hidden md:table-cell">Paid</th>
                                            <th className="text-left px-4 py-2.5 font-medium">Status</th>
                                            <th className="px-4 py-2.5 w-8" />
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/60">
                                        {matter.invoices.map((inv: any) => (
                                            <tr key={inv.id} className="hover:bg-muted/30 transition-colors">
                                                <td className="px-4 py-2.5 font-medium">{inv.invoice_number}</td>
                                                <td className="px-4 py-2.5 text-muted-foreground hidden md:table-cell">{formatDate(inv.created_at)}</td>
                                                <td className={cn('px-4 py-2.5 hidden lg:table-cell', inv.status === 'sent' && inv.due_date && new Date(inv.due_date) < new Date() ? 'text-destructive font-medium' : 'text-muted-foreground')}>
                                                    {formatDate(inv.due_date)}
                                                </td>
                                                <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{formatCurrency(Number(inv.total))}</td>
                                                <td className="px-4 py-2.5 text-right text-success tabular-nums hidden md:table-cell">
                                                    {formatCurrency(Number(inv.amount_paid || 0))}
                                                </td>
                                                <td className="px-4 py-2.5">
                                                    <Badge variant={inv.status === 'paid' ? 'success' : inv.status === 'sent' ? 'warning' : inv.status === 'partial' ? 'warning' : 'secondary'} className="text-xs capitalize">
                                                        {inv.status}
                                                    </Badge>
                                                </td>
                                                <td className="px-4 py-2.5">
                                                    <Link href={`/billing/${inv.id}`} className="text-muted-foreground hover:text-primary transition-colors">
                                                        <ExternalLink className="h-3.5 w-3.5" />
                                                    </Link>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="px-6 py-10 text-center text-sm text-muted-foreground">
                                <Receipt className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                                No invoices yet.
                                <div className="mt-3">
                                    <Button size="sm" asChild>
                                        <Link href={`/billing/create?matter_id=${matter.id}`}>Create first invoice</Link>
                                    </Button>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {tab === 'trust' && (
                <Card className="surface-card">
                    <CardHeader className="flex flex-row items-center justify-between pb-3">
                        <div>
                            <CardTitle className="text-base tracking-tight flex items-center gap-2">
                                <Wallet className="h-4 w-4" /> Client Trust Account
                            </CardTitle>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                Current balance: <span className={cn('font-semibold', trustBalance >= 0 ? 'text-success' : 'text-destructive')}>
                                    {formatCurrency(trustBalance)}
                                </span>
                            </p>
                        </div>
                        <Link href="/accounts" className="text-xs text-primary hover:underline">All accounts</Link>
                    </CardHeader>
                    <CardContent className="p-0">
                        {matter.trust_entries?.length ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b bg-muted/30 text-muted-foreground">
                                            <th className="text-left px-4 py-2.5 font-medium">Date</th>
                                            <th className="text-left px-4 py-2.5 font-medium">Type</th>
                                            <th className="text-left px-4 py-2.5 font-medium">Description</th>
                                            <th className="text-right px-4 py-2.5 font-medium">Amount</th>
                                            <th className="text-right px-4 py-2.5 font-medium">Balance</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/60">
                                        {matter.trust_entries.map((te: any) => (
                                            <tr key={te.id} className="hover:bg-muted/30 transition-colors">
                                                <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">{formatDate(te.date)}</td>
                                                <td className="px-4 py-2.5">
                                                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium',
                                                        te.type === 'receipt' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning')}>
                                                        {te.type.replace(/_/g, ' ')}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2.5 text-muted-foreground">{te.description || '—'}</td>
                                                <td className={cn('px-4 py-2.5 text-right font-semibold tabular-nums', te.type === 'receipt' ? 'text-success' : 'text-warning')}>
                                                    {te.type === 'receipt' ? '+' : '-'}{formatCurrency(Math.abs(te.amount || 0))}
                                                </td>
                                                <td className="px-4 py-2.5 text-right tabular-nums">{formatCurrency(te.balance_after || 0)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="px-6 py-10 text-center text-sm text-muted-foreground">
                                <Wallet className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                                No trust transactions yet.
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Modals */}
            <Dialog open={noteModalOpen} onOpenChange={setNoteModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add note</DialogTitle>
                        <DialogDescription>Record a note for this matter.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                        <Label className="text-sm font-medium">Note *</Label>
                        <Textarea value={noteBody} onChange={(e) => setNoteBody(e.target.value)} rows={4} className="resize-none" />
                        {noteError && <p className="text-sm text-destructive">{noteError}</p>}
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setNoteModalOpen(false)} disabled={noteSaving}>Cancel</Button>
                        <Button type="button" onClick={saveNote} disabled={noteSaving || !noteBody.trim()}>
                            {noteSaving ? 'Saving…' : 'Save'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={timeModalOpen} onOpenChange={setTimeModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Log time</DialogTitle>
                        <DialogDescription>Add a time entry to this matter.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label className="text-sm font-medium">Date *</Label>
                                <Input type="date" className="h-11" value={timeForm.date} onChange={(e) => setTimeForm((p) => ({ ...p, date: e.target.value }))} />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-sm font-medium">Minutes *</Label>
                                <Input type="number" className="h-11" value={timeForm.duration_minutes} onChange={(e) => setTimeForm((p) => ({ ...p, duration_minutes: e.target.value }))} />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label className="text-sm font-medium">Rate (per hour)</Label>
                                <Input type="number" className="h-11" value={timeForm.rate} onChange={(e) => setTimeForm((p) => ({ ...p, rate: e.target.value }))} placeholder="Leave empty to use your default" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-sm font-medium">Billable</Label>
                                <Select value={timeForm.billable ? '1' : '0'} onValueChange={(v) => setTimeForm((p) => ({ ...p, billable: v === '1' }))}>
                                    <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="1">Yes</SelectItem>
                                        <SelectItem value="0">No</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-sm font-medium">Description</Label>
                            <Textarea value={timeForm.description} onChange={(e) => setTimeForm((p) => ({ ...p, description: e.target.value }))} rows={3} className="resize-none" />
                        </div>
                        {timeError && <p className="text-sm text-destructive">{timeError}</p>}
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setTimeModalOpen(false)} disabled={timeSaving}>Cancel</Button>
                        <Button type="button" onClick={saveTime} disabled={timeSaving}> {timeSaving ? 'Saving…' : 'Save'} </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={expenseModalOpen} onOpenChange={setExpenseModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add expense</DialogTitle>
                        <DialogDescription>Add an expense to this matter.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label className="text-sm font-medium">Date *</Label>
                                <Input type="date" className="h-11" value={expenseForm.date} onChange={(e) => setExpenseForm((p) => ({ ...p, date: e.target.value }))} />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-sm font-medium">Amount *</Label>
                                <Input type="number" className="h-11" value={expenseForm.amount} onChange={(e) => setExpenseForm((p) => ({ ...p, amount: e.target.value }))} />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label className="text-sm font-medium">Vendor</Label>
                                <Input className="h-11" value={expenseForm.vendor} onChange={(e) => setExpenseForm((p) => ({ ...p, vendor: e.target.value }))} />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-sm font-medium">Category</Label>
                                <Input className="h-11" value={expenseForm.category} onChange={(e) => setExpenseForm((p) => ({ ...p, category: e.target.value }))} />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label className="text-sm font-medium">Billable</Label>
                                <Select value={expenseForm.billable ? '1' : '0'} onValueChange={(v) => setExpenseForm((p) => ({ ...p, billable: v === '1' }))}>
                                    <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="1">Yes</SelectItem>
                                        <SelectItem value="0">No</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-sm font-medium">Description *</Label>
                                <Input className="h-11" value={expenseForm.description} onChange={(e) => setExpenseForm((p) => ({ ...p, description: e.target.value }))} />
                            </div>
                        </div>
                        {expenseError && <p className="text-sm text-destructive">{expenseError}</p>}
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setExpenseModalOpen(false)} disabled={expenseSaving}>Cancel</Button>
                        <Button type="button" onClick={saveExpense} disabled={expenseSaving || !expenseForm.description.trim() || !expenseForm.amount}> {expenseSaving ? 'Saving…' : 'Save'} </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={taskModalOpen} onOpenChange={setTaskModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingTask ? 'Edit Task' : 'Add Task'}</DialogTitle>
                        <DialogDescription>{editingTask ? 'Update the task details.' : 'Create a task for this matter.'}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label className="text-sm font-medium">Title *</Label>
                            <Input className="h-11" value={taskForm.title} onChange={(e) => setTaskForm((p) => ({ ...p, title: e.target.value }))} />
                        </div>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label className="text-sm font-medium">Due Date</Label>
                                <Input type="date" className="h-11" value={taskForm.due_date} onChange={(e) => setTaskForm((p) => ({ ...p, due_date: e.target.value }))} />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-sm font-medium">Priority</Label>
                                <Select value={taskForm.priority} onValueChange={(v) => setTaskForm((p) => ({ ...p, priority: v }))}>
                                    <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="high">High</SelectItem>
                                        <SelectItem value="medium">Medium</SelectItem>
                                        <SelectItem value="low">Low</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        {editingTask && (
                            <div className="space-y-2">
                                <Label className="text-sm font-medium">Status</Label>
                                <Select value={editingTask.status} onValueChange={(v) => setEditingTask((p: any) => ({ ...p, status: v }))}>
                                    <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="todo">To Do</SelectItem>
                                        <SelectItem value="in_progress">In Progress</SelectItem>
                                        <SelectItem value="review">Review</SelectItem>
                                        <SelectItem value="done">Done</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                        {users.length > 0 && (
                            <div className="space-y-2">
                                <Label className="text-sm font-medium">Assignee</Label>
                                <Select value={taskForm.assignee_id || '_none'} onValueChange={(v) => setTaskForm((p) => ({ ...p, assignee_id: v === '_none' ? '' : v }))}>
                                    <SelectTrigger className="h-11"><SelectValue placeholder="Unassigned" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="_none">Unassigned</SelectItem>
                                        {users.map((u) => (
                                            <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                        <div className="space-y-2">
                            <Label className="text-sm font-medium">Description</Label>
                            <Textarea rows={3} className="resize-none" value={taskForm.description} onChange={(e) => setTaskForm((p) => ({ ...p, description: e.target.value }))} />
                        </div>
                        {taskError && <p className="text-sm text-destructive">{taskError}</p>}
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setTaskModalOpen(false)} disabled={taskSaving}>Cancel</Button>
                        <Button type="button" onClick={saveTask} disabled={taskSaving || !taskForm.title.trim()}>
                            {taskSaving ? 'Saving…' : (editingTask ? 'Update Task' : 'Add Task')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={docModalOpen} onOpenChange={setDocModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Upload document</DialogTitle>
                        <DialogDescription>Upload a file to this matter.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label className="text-sm font-medium">File * <span className="text-muted-foreground font-normal">(max 20 MB)</span></Label>
                            <Input ref={docFileRef} type="file" onChange={(e) => setDocFile(e.target.files?.[0] ?? null)} />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-sm font-medium">Folder</Label>
                            <Input className="h-11" placeholder="e.g. Correspondence" value={docFolder} onChange={(e) => setDocFolder(e.target.value)} />
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-border accent-primary"
                                checked={docClientVisible}
                                onChange={(e) => setDocClientVisible(e.target.checked)}
                            />
                            <span className="text-sm font-medium">Visible to client</span>
                        </label>
                        {docError && <p className="text-sm text-destructive">{docError}</p>}
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setDocModalOpen(false)} disabled={docSaving}>Cancel</Button>
                        <Button type="button" onClick={saveDoc} disabled={docSaving || !docFile}>
                            {docSaving ? 'Uploading…' : 'Upload'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Document Viewer Modal ── */}
            {viewerDoc && (
                <Dialog open={!!viewerDoc} onOpenChange={() => setViewerDoc(null)}>
                    <DialogContent className="max-w-5xl w-full h-[90vh] flex flex-col p-0 gap-0">
                        <div className="flex items-center justify-between px-5 py-3 border-b shrink-0">
                            <div className="flex items-center gap-2 min-w-0">
                                <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
                                <span className="text-sm font-medium truncate">{viewerDoc.name}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 ml-4">
                                <Button variant="outline" size="sm" asChild>
                                    <a href={`/documents/${viewerDoc.id}/download`} download>
                                        <Download className="h-3.5 w-3.5 mr-1" />
                                        Download
                                    </a>
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewerDoc(null)}>
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-hidden bg-muted/20">
                            {viewerDoc.mime_type?.startsWith('image/') ? (
                                <div className="h-full flex items-center justify-center p-6">
                                    <img
                                        src={`/documents/${viewerDoc.id}/view`}
                                        alt={viewerDoc.name}
                                        className="max-h-full max-w-full object-contain rounded shadow"
                                    />
                                </div>
                            ) : viewerDoc.mime_type === 'application/pdf' || !viewerDoc.mime_type ? (
                                <iframe
                                    src={`/documents/${viewerDoc.id}/view`}
                                    title={viewerDoc.name}
                                    className="w-full h-full border-0"
                                />
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center gap-4 text-muted-foreground">
                                    <FileText className="h-16 w-16 text-muted-foreground/30" />
                                    <p className="text-sm">Preview not available for this file type.</p>
                                    <Button variant="outline" size="sm" asChild>
                                        <a href={`/documents/${viewerDoc.id}/download`} download>
                                            <Download className="h-3.5 w-3.5 mr-1" />
                                            Download to view
                                        </a>
                                    </Button>
                                </div>
                            )}
                        </div>
                    </DialogContent>
                </Dialog>
            )}
        </AppLayout>
    );
}
