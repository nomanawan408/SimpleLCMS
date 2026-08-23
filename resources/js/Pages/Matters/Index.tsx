import { Head, Link, router } from '@inertiajs/react';
import { useState, useEffect, useRef } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { formatDate, MATTER_STATUS_LABELS, PRACTICE_AREA_LABELS } from '@/lib/utils';
import { Plus, Search, X, Calendar, Clock, ListTodo, Briefcase } from 'lucide-react';
import type { Matter, PaginatedData } from '@/types';

interface Props {
    matters: PaginatedData<Matter>;
    filters: { search?: string; status?: string; practice_area?: string };
}

function useDebounce(value: string, delay: number) {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(t);
    }, [value, delay]);
    return debounced;
}

const statusVariant: Record<string, any> = {
    open: 'success', pending_court_date: 'warning', awaiting_client: 'info',
    awaiting_opponent: 'info', on_hold: 'secondary', closed: 'default', archived: 'secondary',
};

const statusBadgeStyles: Record<string, string> = {
    open: 'bg-success/15 text-success border-success/25',
    pending_court_date: 'bg-warning/15 text-warning border-warning/25',
    awaiting_client: 'bg-info/15 text-info border-info/25',
    awaiting_opponent: 'bg-info/15 text-info border-info/25',
    on_hold: 'bg-muted text-muted-foreground border-border',
    closed: 'bg-muted text-muted-foreground border-border',
    archived: 'bg-muted text-muted-foreground border-border',
};

export default function MattersIndex({ matters, filters }: Props) {
    const [search, setSearch]   = useState(filters.search ?? '');
    const [status, setStatus]   = useState(filters.status ?? '_all');
    const [area, setArea]       = useState(filters.practice_area ?? '_all');
    const debouncedSearch       = useDebounce(search, 300);
    const isFirstRun            = useRef(true);
    const [editingHearing, setEditingHearing] = useState<Matter | null>(null);
    const [hearingDate, setHearingDate] = useState('');
    const [hearingSaving, setHearingSaving] = useState(false);
    const [editingDeadline, setEditingDeadline] = useState<Matter | null>(null);
    const [deadlineDate, setDeadlineDate] = useState('');
    const [deadlineSaving, setDeadlineSaving] = useState(false);
    const [viewingTasks, setViewingTasks] = useState<Matter | null>(null);

    useEffect(() => {
        if (isFirstRun.current) { isFirstRun.current = false; return; }
        router.get('/matters', {
            search:        debouncedSearch || undefined,
            status:        status === '_all' ? undefined : status,
            practice_area: area === '_all' ? undefined : area,
        }, { preserveState: true, replace: true });
    }, [debouncedSearch, status, area]);

    const hasFilters = search || status !== '_all' || area !== '_all';

    function clearAll() {
        setSearch(''); setStatus('_all'); setArea('_all');
    }

    return (
        <AppLayout title="Matters">
            <Head title="Matters" />

            <div className="flex flex-col gap-3 mb-6">
                <div className="flex items-center justify-between">
                    <h1 className="text-[26px] font-extrabold tracking-tight">Matters</h1>
                    <Button asChild className="gap-2">
                        <Link href="/matters/create"><Plus className="h-4 w-4" />New Matter</Link>
                    </Button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
                        <Input
                            className="pl-8 h-9 text-sm"
                            placeholder="Search by name, number, client…"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                        {search && (
                            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                                <X className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>
                    <Select value={status} onValueChange={setStatus}>
                        <SelectTrigger className="h-9 w-40 text-sm"><SelectValue placeholder="Status" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="_all">All statuses</SelectItem>
                            {Object.entries(MATTER_STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <Select value={area} onValueChange={setArea}>
                        <SelectTrigger className="h-9 w-44 text-sm"><SelectValue placeholder="Practice area" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="_all">All areas</SelectItem>
                            {Object.entries(PRACTICE_AREA_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    {hasFilters && (
                        <button onClick={clearAll} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors">
                            <X className="h-3 w-3" />Clear
                        </button>
                    )}
                </div>
            </div>

            <Card className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">
                <CardContent className="p-0">
                    {matters.data.length === 0 ? (
                        <div className="py-16 text-center">
                            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                                <Briefcase className="h-7 w-7 text-muted-foreground" />
                            </div>
                            <p className="text-foreground font-medium mb-1">No matters found</p>
                            <p className="text-muted-foreground text-sm mb-4">
                                {hasFilters ? 'Try adjusting your search or filters' : 'Get started by creating your first matter'}
                            </p>
                            <Button asChild>
                                <Link href="/matters/create"><Plus className="h-4 w-4 mr-2" />New Matter</Link>
                            </Button>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-border/60 bg-muted/20">
                                        <th className="text-left px-4 py-3 font-semibold text-foreground text-xs font-bold uppercase tracking-widest">Matter</th>
                                        <th className="text-left px-4 py-3 font-semibold text-foreground text-xs font-bold uppercase tracking-widest hidden md:table-cell">Practice Area</th>
                                        <th className="text-left px-4 py-3 font-semibold text-foreground text-xs font-bold uppercase tracking-widest hidden lg:table-cell">Clients / Contact</th>
                                        <th className="text-left px-4 py-3 font-semibold text-foreground text-xs font-bold uppercase tracking-widest hidden lg:table-cell">Responsible</th>
                                        <th className="text-left px-4 py-3 font-semibold text-foreground text-xs font-bold uppercase tracking-widest">Status</th>
                                        <th className="text-left px-4 py-3 font-semibold text-foreground text-xs font-bold uppercase tracking-widest hidden xl:table-cell">Next Step</th>
                                        <th className="text-left px-4 py-3 font-semibold text-foreground text-xs font-bold uppercase tracking-widest hidden xl:table-cell">Deadline</th>
                                        <th className="text-left px-4 py-3 font-semibold text-foreground text-xs font-bold uppercase tracking-widest hidden xl:table-cell">Hearing Date</th>
                                        <th className="text-left px-4 py-3 font-semibold text-foreground text-xs font-bold uppercase tracking-widest hidden xl:table-cell">Opened</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/60">
                                    {matters.data.map((matter) => (
                                        <tr
                                            key={matter.id}
                                            className="hover:bg-muted/40 cursor-pointer transition-colors"
                                            onClick={() => router.visit(`/matters/${matter.id}`)}
                                        >
                                            <td className="px-4 py-3">
                                                <p className="font-medium text-foreground group-hover:text-primary transition-colors">{matter.name}</p>
                                                <p className="text-xs text-muted-foreground mt-0.5">{matter.matter_number}</p>
                                            </td>
                                            <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">
                                                {PRACTICE_AREA_LABELS[matter.practice_area]}
                                            </td>
                                            <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">
                                                {matter.client_names ?? '—'}
                                            </td>
                                            <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">
                                                {matter.responsible_user?.full_name ?? '—'}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusBadgeStyles[matter.status] ?? 'bg-muted text-muted-foreground border-border'}`}>
                                                    {MATTER_STATUS_LABELS[matter.status]}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 hidden xl:table-cell">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-muted-foreground truncate max-w-[140px]">{matter.next_step ?? '—'}</span>
                                                    {matter.tasks && matter.tasks.length > 0 && (
                                                        <button
                                                            className="shrink-0 text-muted-foreground hover:text-primary transition-colors"
                                                            title={`View all ${matter.tasks.length} tasks`}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setViewingTasks(matter);
                                                            }}
                                                        >
                                                            <ListTodo className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 hidden xl:table-cell">
                                                <button
                                                    className="flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setEditingDeadline(matter);
                                                        setDeadlineDate(matter.next_deadline || '');
                                                    }}
                                                >
                                                    <Clock className="h-3.5 w-3.5" />
                                                    <span>{matter.next_deadline ? formatDate(matter.next_deadline) : 'Set deadline'}</span>
                                                </button>
                                            </td>
                                            <td className="px-4 py-3 hidden xl:table-cell">
                                                <button
                                                    className="flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setEditingHearing(matter);
                                                        setHearingDate(matter.hearing_date || '');
                                                    }}
                                                >
                                                    <Calendar className="h-3.5 w-3.5" />
                                                    <span>{matter.hearing_date ? formatDate(matter.hearing_date) : 'Set date'}</span>
                                                </button>
                                            </td>
                                            <td className="px-4 py-3 hidden xl:table-cell text-muted-foreground">
                                                {formatDate(matter.opened_at)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Pagination */}
                    {matters.last_page > 1 && (
                        <div className="flex items-center justify-between px-4 py-3 border-t">
                            <p className="text-sm text-muted-foreground">
                                Showing {matters.from}–{matters.to} of {matters.total}
                            </p>
                            <div className="flex gap-1">
                                {matters.links.map((link, i) => (
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
                </CardContent>
            </Card>
            {/* Deadline Dialog */}
            <Dialog open={!!editingDeadline} onOpenChange={(open) => { if (!open) setEditingDeadline(null); }}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Clock className="h-5 w-5 text-warning" />
                            Deadline
                        </DialogTitle>
                        <DialogDescription>
                            {editingDeadline?.name}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        <Label htmlFor="deadline_date">Next deadline</Label>
                        <Input
                            id="deadline_date"
                            type="date"
                            value={deadlineDate}
                            onChange={(e) => setDeadlineDate(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                            This updates the due date on the next open task for this matter.
                        </p>
                    </div>
                    <DialogFooter className="gap-2">
                        {editingDeadline?.next_deadline && (
                            <Button
                                variant="outline"
                                className="text-destructive hover:text-destructive"
                                disabled={deadlineSaving}
                                onClick={() => {
                                    setDeadlineSaving(true);
                                    router.put(`/matters/${editingDeadline.id}/deadline`, {
                                        deadline: null,
                                    }, {
                                        preserveScroll: true,
                                        preserveState: true,
                                        onFinish: () => { setDeadlineSaving(false); setEditingDeadline(null); },
                                    });
                                }}
                            >
                                Clear Deadline
                            </Button>
                        )}
                        <Button variant="outline" onClick={() => setEditingDeadline(null)} disabled={deadlineSaving}>
                            Cancel
                        </Button>
                        <Button
                            disabled={!deadlineDate || deadlineSaving}
                            onClick={() => {
                                if (!editingDeadline) return;
                                setDeadlineSaving(true);
                                router.put(`/matters/${editingDeadline.id}/deadline`, {
                                    deadline: deadlineDate,
                                }, {
                                    preserveScroll: true,
                                    preserveState: true,
                                    onFinish: () => { setDeadlineSaving(false); setEditingDeadline(null); },
                                });
                            }}
                        >
                            {deadlineSaving ? 'Saving…' : 'Save'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Hearing Date Dialog */}
            <Dialog open={!!editingHearing} onOpenChange={(open) => { if (!open) setEditingHearing(null); }}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Calendar className="h-5 w-5 text-primary" />
                            Hearing Date
                        </DialogTitle>
                        <DialogDescription>
                            {editingHearing?.name}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        <Label htmlFor="hearing_date">Court hearing date</Label>
                        <Input
                            id="hearing_date"
                            type="date"
                            value={hearingDate}
                            onChange={(e) => setHearingDate(e.target.value)}
                        />
                    </div>
                    <DialogFooter className="gap-2">
                        {editingHearing?.hearing_date && (
                            <Button
                                variant="outline"
                                className="text-destructive hover:text-destructive"
                                disabled={hearingSaving}
                                onClick={() => {
                                    setHearingSaving(true);
                                    router.put(`/matters/${editingHearing.id}/hearing-date`, {
                                        hearing_date: null,
                                    }, {
                                        preserveScroll: true,
                                        preserveState: true,
                                        onFinish: () => { setHearingSaving(false); setEditingHearing(null); },
                                    });
                                }}
                            >
                                Clear Date
                            </Button>
                        )}
                        <Button variant="outline" onClick={() => setEditingHearing(null)} disabled={hearingSaving}>
                            Cancel
                        </Button>
                        <Button
                            disabled={!hearingDate || hearingSaving}
                            onClick={() => {
                                if (!editingHearing) return;
                                setHearingSaving(true);
                                router.put(`/matters/${editingHearing.id}/hearing-date`, {
                                    hearing_date: hearingDate,
                                }, {
                                    preserveScroll: true,
                                    preserveState: true,
                                    onFinish: () => { setHearingSaving(false); setEditingHearing(null); },
                                });
                            }}
                        >
                            {hearingSaving ? 'Saving…' : 'Save'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Upcoming Tasks Dialog */}
            <Dialog open={!!viewingTasks} onOpenChange={(open) => { if (!open) setViewingTasks(null); }}>
                <DialogContent className="max-w-md max-h-[75vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <ListTodo className="h-5 w-5 text-primary" />
                            Upcoming Tasks
                        </DialogTitle>
                        <DialogDescription>{viewingTasks?.name}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2 py-2">
                        {viewingTasks?.tasks && viewingTasks.tasks.length > 0 ? (
                            viewingTasks.tasks.map((task) => (
                                <div key={task.id} className="flex items-start gap-3 rounded-lg border border-border/60 p-3">
                                    <div className="mt-0.5">
                                        {task.status === 'in_progress' ? (
                                            <div className="h-2.5 w-2.5 rounded-full bg-primary animate-pulse" />
                                        ) : (
                                            <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/40" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium leading-snug">{task.title}</p>
                                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1">
                                            {task.due_date && (
                                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                    <Clock className="h-3 w-3" />
                                                    {formatDate(task.due_date)}
                                                </span>
                                            )}
                                            <Badge
                                                variant={
                                                    task.priority === 'high' ? 'destructive' :
                                                    task.priority === 'low' ? 'secondary' : 'outline'
                                                }
                                                className="text-[10px] capitalize"
                                            >
                                                {task.priority}
                                            </Badge>
                                            {task.assignee && (
                                                <span className="text-xs text-muted-foreground">
                                                    → {task.assignee.full_name}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-sm text-muted-foreground text-center py-4">No upcoming tasks.</p>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
