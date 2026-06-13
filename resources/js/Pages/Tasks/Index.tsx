import { useState, useEffect, useRef } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { formatDate, cn } from '@/lib/utils';
import { Plus, Pencil, Trash2, Search, X } from 'lucide-react';
import type { Task, PaginatedData } from '@/types';

function useDebounce(value: string, delay: number) {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(t);
    }, [value, delay]);
    return debounced;
}

interface Props {
    tasks: PaginatedData<Task & { matter?: { id: string; name: string; matter_number: string } }>;
    users: { id: string; full_name: string }[];
    matters: { id: string; name: string; matter_number: string }[];
    filters: { status?: string; priority?: string; assignee_id?: string; matter_id?: string; search?: string };
}

const PRIORITY_COLORS: Record<string, 'destructive' | 'warning' | 'secondary'> = {
    high: 'destructive',
    medium: 'warning',
    low: 'secondary',
};

const STATUS_COLORS: Record<string, 'secondary' | 'default' | 'warning' | 'success'> = {
    todo: 'secondary',
    in_progress: 'warning',
    review: 'default',
    done: 'success',
};

const STATUS_LABELS: Record<string, string> = {
    todo: 'To Do',
    in_progress: 'In Progress',
    review: 'Review',
    done: 'Done',
};

const emptyForm = {
    title: '',
    description: '',
    matter_id: '',
    assignee_id: '',
    due_date: '',
    priority: 'medium',
    status: 'todo',
};

export default function TasksIndex({ tasks, users, matters, filters }: Props) {
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<Task | null>(null);
    const [form, setForm] = useState({ ...emptyForm });
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState<string | null>(null);
    const [search, setSearch] = useState(filters.search ?? '');
    const debouncedSearch     = useDebounce(search, 300);
    const isFirstRun          = useRef(true);

    useEffect(() => {
        if (isFirstRun.current) { isFirstRun.current = false; return; }
        router.get('/tasks', { ...filters, search: debouncedSearch || undefined }, { preserveState: true, replace: true });
    }, [debouncedSearch]);

    const openCreate = () => {
        setEditing(null);
        setForm({ ...emptyForm });
        setModalOpen(true);
    };

    const openEdit = (task: Task & { matter?: any }) => {
        setEditing(task);
        setForm({
            title: task.title,
            description: task.description ?? '',
            matter_id: task.matter_id ?? '',
            assignee_id: task.assignee_id ?? '',
            due_date: task.due_date ?? '',
            priority: task.priority,
            status: task.status,
        });
        setModalOpen(true);
    };

    const handleSave = () => {
        setSaving(true);
        const data: Record<string, string> = {
            title: form.title,
            description: form.description,
            priority: form.priority,
            status: form.status,
        };
        if (form.matter_id) data.matter_id = form.matter_id;
        if (form.assignee_id) data.assignee_id = form.assignee_id;
        if (form.due_date) data.due_date = form.due_date;

        if (editing) {
            router.put(`/tasks/${editing.id}`, data, {
                onFinish: () => setSaving(false),
                onSuccess: () => setModalOpen(false),
            });
        } else {
            router.post('/tasks', data, {
                onFinish: () => setSaving(false),
                onSuccess: () => setModalOpen(false),
            });
        }
    };

    const handleDelete = (id: string) => {
        if (!confirm('Delete this task?')) return;
        setDeleting(id);
        router.delete(`/tasks/${id}`, {
            onFinish: () => setDeleting(null),
        });
    };

    const setFilter = (key: string, value: string) => {
        const actual = value === '_all' ? '' : value;
        router.get('/tasks', { ...filters, search: search || undefined, [key]: actual || undefined }, { preserveState: true, replace: true });
    };

    const handleStatusChange = (taskId: string, newStatus: string) => {
        router.put(`/tasks/${taskId}`, { status: newStatus }, { preserveScroll: true });
    };

    const statusTabs = [
        { key: '', label: 'All' },
        { key: 'todo', label: 'To Do' },
        { key: 'in_progress', label: 'In Progress' },
        { key: 'review', label: 'Review' },
        { key: 'done', label: 'Done' },
    ];

    return (
        <AppLayout title="Tasks">
            <Head title="Tasks" />

            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold tracking-tight">Tasks</h1>
                <Button onClick={openCreate} className="gap-2">
                    <Plus className="h-4 w-4" />
                    New Task
                </Button>
            </div>

            {/* Filters */}
            <div className="flex flex-col gap-2 mb-5">
            <div className="relative w-full max-w-sm">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
                <Input
                    className="pl-8 h-9 text-sm"
                    placeholder="Search tasks or matters…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
                {search && (
                    <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        <X className="h-3.5 w-3.5" />
                    </button>
                )}
            </div>
            <div className="flex flex-wrap items-center gap-3">
                <div className="flex gap-1 border rounded-md p-1 bg-muted/30">
                    {statusTabs.map((t) => (
                        <button
                            key={t.key}
                            onClick={() => setFilter('status', t.key)}
                            className={cn(
                                'px-3 py-1.5 text-sm rounded font-medium transition-colors',
                                (filters.status ?? '') === t.key
                                    ? 'bg-background shadow text-foreground'
                                    : 'text-muted-foreground hover:text-foreground',
                            )}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                <Select value={filters.priority || '_all'} onValueChange={(v) => setFilter('priority', v)}>
                    <SelectTrigger className="w-36 h-9">
                        <SelectValue placeholder="Priority" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="_all">All priorities</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                </Select>

                <Select value={filters.assignee_id || '_all'} onValueChange={(v) => setFilter('assignee_id', v)}>
                    <SelectTrigger className="w-44 h-9">
                        <SelectValue placeholder="Assignee" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="_all">All assignees</SelectItem>
                        {users.map((u) => (
                            <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            </div>

            <Card>
                <CardContent className="p-0">
                    {tasks.data.length === 0 ? (
                        <p className="px-6 py-10 text-center text-sm text-muted-foreground">No tasks found.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b bg-muted/30 text-muted-foreground">
                                        <th className="text-left px-4 py-3 font-medium">Title</th>
                                        <th className="text-left px-4 py-3 font-medium">Assignee</th>
                                        <th className="text-left px-4 py-3 font-medium">Due</th>
                                        <th className="text-left px-4 py-3 font-medium">Priority</th>
                                        <th className="text-left px-4 py-3 font-medium">Status</th>
                                        <th className="px-4 py-3" />
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/60">
                                    {tasks.data.map((task) => (
                                        <tr key={task.id} className="hover:bg-muted/30">
                                            <td className="px-4 py-3">
                                                <p className="font-medium">{task.title}</p>
                                                {task.matter && (
                                                    <Link
                                                        href={`/matters/${task.matter.id}`}
                                                        className="text-xs text-muted-foreground hover:text-primary transition-colors"
                                                    >
                                                        {task.matter.matter_number} — {task.matter.name}
                                                    </Link>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-muted-foreground">
                                                {(task as any).assignee?.full_name ?? '—'}
                                            </td>
                                            <td className="px-4 py-3 text-muted-foreground">
                                                {formatDate(task.due_date)}
                                            </td>
                                            <td className="px-4 py-3">
                                                <Badge variant={PRIORITY_COLORS[task.priority] ?? 'secondary'} className="capitalize text-xs">
                                                    {task.priority}
                                                </Badge>
                                            </td>
                                            <td className="px-4 py-3">
                                                <Select
                                                    value={task.status}
                                                    onValueChange={(v) => handleStatusChange(task.id, v)}
                                                >
                                                    <SelectTrigger className={cn(
                                                        'h-7 w-36 text-xs font-medium border-0 shadow-none focus:ring-1',
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
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2 justify-end">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8"
                                                        onClick={() => openEdit(task)}
                                                    >
                                                        <Pencil className="h-3.5 w-3.5" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-destructive hover:text-destructive"
                                                        disabled={deleting === task.id}
                                                        onClick={() => handleDelete(task.id)}
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {tasks.last_page > 1 && (
                        <div className="flex items-center justify-between px-4 py-3 border-t">
                            <p className="text-sm text-muted-foreground">
                                {tasks.from}–{tasks.to} of {tasks.total}
                            </p>
                            <div className="flex gap-2">
                                {tasks.links.map((link, i) => (
                                    link.url ? (
                                        <Link
                                            key={i}
                                            href={link.url}
                                            className={cn(
                                                'px-3 py-1.5 text-xs rounded border transition-colors',
                                                link.active
                                                    ? 'bg-primary text-primary-foreground border-primary'
                                                    : 'hover:bg-muted border-border',
                                            )}
                                            dangerouslySetInnerHTML={{ __html: link.label }}
                                        />
                                    ) : (
                                        <span
                                            key={i}
                                            className="px-3 py-1.5 text-xs rounded border border-border text-muted-foreground opacity-50"
                                            dangerouslySetInnerHTML={{ __html: link.label }}
                                        />
                                    )
                                ))}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Create / Edit Modal */}
            <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{editing ? 'Edit Task' : 'New Task'}</DialogTitle>
                        <DialogDescription>{editing ? 'Update the task details.' : 'Create a new task.'}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Title *</Label>
                            <Input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
                        </div>
                        <div className="space-y-2">
                            <Label>Description</Label>
                            <Textarea rows={3} className="resize-none" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Matter</Label>
                                <Select value={form.matter_id || '_none'} onValueChange={(v) => setForm((p) => ({ ...p, matter_id: v === '_none' ? '' : v }))}>
                                    <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="_none">None</SelectItem>
                                        {matters.map((m) => (
                                            <SelectItem key={m.id} value={m.id}>{m.matter_number} — {m.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Assignee</Label>
                                <Select value={form.assignee_id || '_none'} onValueChange={(v) => setForm((p) => ({ ...p, assignee_id: v === '_none' ? '' : v }))}>
                                    <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="_none">Unassigned</SelectItem>
                                        {users.map((u) => (
                                            <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label>Due Date</Label>
                                <Input type="date" value={form.due_date} onChange={(e) => setForm((p) => ({ ...p, due_date: e.target.value }))} />
                            </div>
                            <div className="space-y-2">
                                <Label>Priority</Label>
                                <Select value={form.priority} onValueChange={(v) => setForm((p) => ({ ...p, priority: v }))}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="high">High</SelectItem>
                                        <SelectItem value="medium">Medium</SelectItem>
                                        <SelectItem value="low">Low</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Status</Label>
                                <Select value={form.status} onValueChange={(v) => setForm((p) => ({ ...p, status: v }))}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="todo">To Do</SelectItem>
                                        <SelectItem value="in_progress">In Progress</SelectItem>
                                        <SelectItem value="review">Review</SelectItem>
                                        <SelectItem value="done">Done</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</Button>
                        <Button onClick={handleSave} disabled={saving || !form.title.trim()}>
                            {saving ? 'Saving…' : 'Save'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
