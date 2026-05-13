import { Head, Link } from '@inertiajs/react';
import { useEffect, useState } from 'react';
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
import { formatCurrency, formatDate, MATTER_STATUS_LABELS, PRACTICE_AREA_LABELS } from '@/lib/utils';
import { ArrowLeft, Clock, Receipt, Wallet, FileText, CheckSquare, Users, Edit, Plus } from 'lucide-react';
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
}

export default function ShowMatter({ matter }: Props) {
    const [notes, setNotes] = useState<any[]>(matter.notes ?? []);
    const [timeEntries, setTimeEntries] = useState<any[]>(matter.time_entries ?? []);
    const [expenses, setExpenses] = useState<any[]>(matter.expenses ?? []);

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

    const statusColors: Record<string, 'default' | 'success' | 'warning' | 'destructive' | 'secondary'> = {
        open: 'success',
        pending_court_date: 'warning',
        awaiting_client: 'info' as any,
        awaiting_opponent: 'info' as any,
        on_hold: 'secondary',
        closed: 'default',
        archived: 'secondary',
    };

    return (
        <AppLayout title={matter.name}>
            <Head title={matter.name} />

            <div className="mb-8 flex items-center justify-between">
                <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                    <Link href="/matters">
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Matters
                    </Link>
                </Button>
                <Button asChild size="sm">
                    <Link href={`/matters/${matter.id}/edit`}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                    </Link>
                </Button>
            </div>

            {/* Header */}
            <div className="mb-8">
                <div className="flex items-start gap-4">
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                            <h1 className="text-2xl font-bold tracking-tight">{matter.name}</h1>
                            <Badge variant={statusColors[matter.status] || 'default'}>{MATTER_STATUS_LABELS[matter.status]}</Badge>
                        </div>
                        <p className="text-muted-foreground text-sm">
                            {matter.matter_number} · {PRACTICE_AREA_LABELS[matter.practice_area]} · Opened {formatDate(matter.opened_at)}
                            {matter.next_deadline && ` · Deadline ${formatDate(matter.next_deadline)}`}
                        </p>
                        {matter.description && (
                            <p className="mt-2 text-sm">{matter.description}</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="mb-6 flex flex-wrap gap-2 border-b border-border/60">
                {[
                    { key: 'dashboard', label: 'Dashboard' },
                    { key: 'time', label: 'Time' },
                    { key: 'expenses', label: 'Expenses' },
                    { key: 'documents', label: 'Documents' },
                    { key: 'tasks', label: 'Tasks' },
                    { key: 'billing', label: 'Billing' },
                    { key: 'transactions', label: 'Transactions' },
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

            {tab === 'dashboard' && (
                <>
                    {/* KPI Strip */}
                    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 mb-6">
                        {[
                            { label: 'Unbilled Time', value: formatCurrency(matter.unbilled_time_value || 0), icon: Clock, color: 'text-primary' },
                            { label: 'Trust Balance', value: formatCurrency((matter as any).trust_balance || 0), icon: Wallet, color: 'text-success' },
                            { label: 'Open Tasks', value: matter.tasks?.filter((t: any) => t.status !== 'done').length || 0, icon: CheckSquare, color: 'text-warning' },
                            { label: 'Documents', value: matter.documents?.length || 0, icon: FileText, color: 'text-info' },
                        ].map((kpi) => (
                            <Card key={kpi.label} className="surface-card">
                                <CardContent className="p-4 flex items-center gap-3">
                                    <div className={`${kpi.color.replace('text-', 'bg-').replace('primary', 'primary/15').replace('success', 'success/15').replace('warning', 'warning/15').replace('info', 'info/15')} p-2 rounded-md`}>
                                        <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground uppercase tracking-[0.05em]">{kpi.label}</p>
                                        <p className="text-lg font-bold">{kpi.value}</p>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                        {/* Main */}
                        <div className="lg:col-span-2 space-y-6">
                            {/* Notes */}
                            <Card className="surface-card">
                                <CardHeader className="flex flex-row items-center justify-between pb-3">
                                    <CardTitle className="text-base tracking-tight">Notes & Activity</CardTitle>
                                    <Button size="sm" variant="outline" type="button" onClick={openNoteModal}>
                                        <Plus className="h-4 w-4 mr-2" />
                                        Add note
                                    </Button>
                                </CardHeader>
                                <CardContent className="p-0">
                                    {notes?.length === 0 ? (
                                        <p className="px-6 py-4 text-sm text-muted-foreground">No notes yet.</p>
                                    ) : (
                                        <div className="divide-y divide-border/60">
                                            {notes.map((note: any) => (
                                                <div key={note.id} className="px-6 py-4">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-xs font-medium">{note.user?.full_name || 'System'}</span>
                                                        <span className="text-xs text-muted-foreground">{formatDate(note.logged_at)}</span>
                                                        <Badge variant="secondary" className="text-xs capitalize">{note.type?.replace('_', ' ') || 'Note'}</Badge>
                                                    </div>
                                                    <p className="text-sm whitespace-pre-wrap">{note.body}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>

                        {/* Sidebar */}
                        <div className="space-y-6">
                            {/* People */}
                            <Card className="surface-card">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-base tracking-tight flex items-center gap-2">
                                        <Users className="h-4 w-4" /> People
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    {matter.responsible_user && (
                                        <div>
                                            <p className="text-xs text-muted-foreground mb-1 uppercase tracking-[0.05em]">Responsible Solicitor</p>
                                            <p className="text-sm font-medium">{matter.responsible_user.full_name}</p>
                                            <p className="text-xs text-muted-foreground">{matter.responsible_user.email}</p>
                                        </div>
                                    )}
                                    {matter.contacts && matter.contacts.length > 0 && (
                                        <>
                                            <Separator />
                                            <div>
                                                <p className="text-xs text-muted-foreground mb-2 uppercase tracking-[0.05em]">Clients & Parties</p>
                                                <div className="space-y-2">
                                                    {matter.contacts.map((contact: any) => (
                                                        <Link
                                                            key={contact.id}
                                                            href={`/contacts/${contact.id}`}
                                                            className="block text-sm font-medium hover:text-primary transition-colors"
                                                        >
                                                            {contact.name}
                                                            <span className="text-xs text-muted-foreground ml-1 font-normal capitalize">
                                                                ({(contact.pivot?.role || 'client').replace('_', ' ')})
                                                            </span>
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
                                        <Receipt className="h-4 w-4" /> Invoices
                                    </CardTitle>
                                    <Button size="sm" variant="outline" asChild>
                                        <Link href={`/billing/create?matter_id=${matter.id}`}>New</Link>
                                    </Button>
                                </CardHeader>
                                <CardContent className="p-0">
                                    {matter.invoices?.length === 0 ? (
                                        <p className="px-4 py-3 text-xs text-muted-foreground">No invoices yet.</p>
                                    ) : (
                                        <div className="divide-y divide-border/60">
                                            {matter.invoices.map((inv: any) => (
                                                <div key={inv.id} className="px-4 py-3 flex items-center justify-between">
                                                    <div>
                                                        <p className="text-sm font-medium">{inv.invoice_number}</p>
                                                        <p className="text-xs text-muted-foreground">{formatDate(inv.created_at)}</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-sm font-medium">{formatCurrency(inv.total)}</p>
                                                        <Badge variant={inv.status === 'paid' ? 'success' : inv.status === 'sent' ? 'warning' : 'secondary'} className="text-xs capitalize">{inv.status}</Badge>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </>
            )}

            {tab === 'time' && (
                <Card className="surface-card">
                    <CardHeader className="flex flex-row items-center justify-between pb-3">
                        <CardTitle className="text-base tracking-tight">Time</CardTitle>
                        <Button size="sm" variant="outline" type="button" onClick={openTimeModal}>
                            <Clock className="h-4 w-4 mr-2" />
                            Add time
                        </Button>
                    </CardHeader>
                    <CardContent className="p-0">
                        {timeEntries?.length ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b bg-muted/30 text-muted-foreground">
                                            <th className="text-left px-4 py-2 font-medium tracking-tight">Description</th>
                                            <th className="text-left px-4 py-2 font-medium tracking-tight">User</th>
                                            <th className="text-right px-4 py-2 font-medium tracking-tight">Duration</th>
                                            <th className="text-right px-4 py-2 font-medium tracking-tight">Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/60">
                                        {timeEntries.map((entry: any) => (
                                            <tr key={entry.id} className="hover:bg-muted/40">
                                                <td className="px-4 py-2">{entry.description || 'Legal services'}</td>
                                                <td className="px-4 py-2 text-muted-foreground">{entry.user?.full_name}</td>
                                                <td className="px-4 py-2 text-right">{Math.floor(entry.duration_minutes / 60)}h {(entry.duration_minutes % 60).toString().padStart(2, '0')}m</td>
                                                <td className="px-4 py-2 text-right">{formatCurrency(entry.amount || 0)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <p className="px-6 py-6 text-sm text-muted-foreground">No time entries yet.</p>
                        )}
                    </CardContent>
                </Card>
            )}

            {tab === 'expenses' && (
                <Card className="surface-card">
                    <CardHeader className="flex flex-row items-center justify-between pb-3">
                        <CardTitle className="text-base tracking-tight">Expenses</CardTitle>
                        <Button size="sm" variant="outline" type="button" onClick={openExpenseModal}>
                            Add expense
                        </Button>
                    </CardHeader>
                    <CardContent className="p-0">
                        {expenses?.length ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b bg-muted/30 text-muted-foreground">
                                            <th className="text-left px-4 py-2 font-medium tracking-tight">Description</th>
                                            <th className="text-right px-4 py-2 font-medium tracking-tight">Amount</th>
                                            <th className="text-right px-4 py-2 font-medium tracking-tight">Billed</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/60">
                                        {expenses.map((exp: any) => (
                                            <tr key={exp.id} className="hover:bg-muted/40">
                                                <td className="px-4 py-2">{exp.description}</td>
                                                <td className="px-4 py-2 text-right">{formatCurrency(exp.amount || 0)}</td>
                                                <td className="px-4 py-2 text-right">
                                                    <Badge variant={exp.billed ? 'success' : 'secondary'} className="text-xs">
                                                        {exp.billed ? 'Yes' : 'No'}
                                                    </Badge>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <p className="px-6 py-6 text-sm text-muted-foreground">No expenses yet.</p>
                        )}
                    </CardContent>
                </Card>
            )}

            {tab === 'documents' && (
                <Card className="surface-card">
                    <CardHeader className="flex flex-row items-center justify-between pb-3">
                        <CardTitle className="text-base tracking-tight">Documents</CardTitle>
                        <Button size="sm" variant="outline">
                            Upload
                        </Button>
                    </CardHeader>
                    <CardContent className="p-0">
                        {matter.documents?.length ? (
                            <div className="divide-y divide-border/60">
                                {matter.documents.map((doc: any) => (
                                    <div key={doc.id} className="px-6 py-4 flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-medium">{doc.name}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {(doc.folder || 'General')}
                                                {doc.uploadedBy?.full_name ? ` · Uploaded by ${doc.uploadedBy.full_name}` : ''}
                                            </p>
                                        </div>
                                        <Badge variant={doc.is_client_visible ? 'success' : 'secondary'} className="text-xs">
                                            {doc.is_client_visible ? 'Client visible' : 'Internal'}
                                        </Badge>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="px-6 py-6 text-sm text-muted-foreground">No documents yet.</p>
                        )}
                    </CardContent>
                </Card>
            )}

            {tab === 'tasks' && (
                <Card className="surface-card">
                    <CardHeader className="flex flex-row items-center justify-between pb-3">
                        <CardTitle className="text-base tracking-tight">Tasks</CardTitle>
                        <Button size="sm" variant="outline">
                            Add task
                        </Button>
                    </CardHeader>
                    <CardContent className="p-0">
                        {matter.tasks?.length ? (
                            <div className="divide-y divide-border/60">
                                {matter.tasks.map((task: any) => (
                                    <div key={task.id} className="px-6 py-4 flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-medium">{task.title}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {task.due_date ? `Due ${formatDate(task.due_date)}` : 'No due date'}
                                            </p>
                                        </div>
                                        <Badge variant={task.status === 'done' ? 'success' : 'secondary'} className="text-xs capitalize">
                                            {task.status.replace('_', ' ')}
                                        </Badge>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="px-6 py-6 text-sm text-muted-foreground">No tasks yet.</p>
                        )}
                    </CardContent>
                </Card>
            )}

            {tab === 'billing' && (
                <Card className="surface-card">
                    <CardHeader className="flex flex-row items-center justify-between pb-3">
                        <CardTitle className="text-base tracking-tight">Billing</CardTitle>
                        <Button size="sm" variant="outline" asChild>
                            <Link href={`/billing/create?matter_id=${matter.id}`}>New invoice</Link>
                        </Button>
                    </CardHeader>
                    <CardContent className="p-0">
                        {matter.invoices?.length ? (
                            <div className="divide-y divide-border/60">
                                {matter.invoices.map((inv: any) => (
                                    <div key={inv.id} className="px-6 py-4 flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-medium">{inv.invoice_number}</p>
                                            <p className="text-xs text-muted-foreground">{formatDate(inv.created_at)}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-medium">{formatCurrency(inv.total)}</p>
                                            <Badge variant={inv.status === 'paid' ? 'success' : inv.status === 'sent' ? 'warning' : 'secondary'} className="text-xs capitalize">{inv.status}</Badge>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="px-6 py-6 text-sm text-muted-foreground">No invoices yet.</p>
                        )}
                    </CardContent>
                </Card>
            )}

            {tab === 'transactions' && (
                <Card className="surface-card">
                    <CardHeader className="flex flex-row items-center justify-between pb-3">
                        <CardTitle className="text-base tracking-tight">Client Funds (Trust)</CardTitle>
                        <div className="text-sm font-medium">Balance: {formatCurrency((matter as any).trust_balance || 0)}</div>
                    </CardHeader>
                    <CardContent className="p-0">
                        {matter.trust_entries?.length ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b bg-muted/30 text-muted-foreground">
                                            <th className="text-left px-4 py-2 font-medium tracking-tight">Date</th>
                                            <th className="text-left px-4 py-2 font-medium tracking-tight">Type</th>
                                            <th className="text-left px-4 py-2 font-medium tracking-tight">Description</th>
                                            <th className="text-right px-4 py-2 font-medium tracking-tight">Amount</th>
                                            <th className="text-right px-4 py-2 font-medium tracking-tight">Balance</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/60">
                                        {matter.trust_entries.map((te: any) => (
                                            <tr key={te.id} className="hover:bg-muted/40">
                                                <td className="px-4 py-2">{formatDate(te.date)}</td>
                                                <td className="px-4 py-2 capitalize">{te.type.replace('_', ' ')}</td>
                                                <td className="px-4 py-2">{te.description || '—'}</td>
                                                <td className="px-4 py-2 text-right">{formatCurrency(te.amount || 0)}</td>
                                                <td className="px-4 py-2 text-right">{formatCurrency(te.balance_after || 0)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <p className="px-6 py-6 text-sm text-muted-foreground">No trust transactions yet.</p>
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
        </AppLayout>
    );
}
