import { Head, Link, router } from '@inertiajs/react';
import { useState, useEffect, useRef } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatDate, MATTER_STATUS_LABELS, PRACTICE_AREA_LABELS } from '@/lib/utils';
import { Plus, Search, X } from 'lucide-react';
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

export default function MattersIndex({ matters, filters }: Props) {
    const [search, setSearch]   = useState(filters.search ?? '');
    const [status, setStatus]   = useState(filters.status ?? '_all');
    const [area, setArea]       = useState(filters.practice_area ?? '_all');
    const debouncedSearch       = useDebounce(search, 300);
    const isFirstRun            = useRef(true);

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
                    <h1 className="text-2xl font-bold tracking-tight">Matters</h1>
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

            <Card className="surface-card">
                <CardContent className="p-0">
                    {matters.data.length === 0 ? (
                        <div className="py-16 text-center">
                            <p className="text-muted-foreground text-sm mb-4">No matters found.</p>
                            <Button asChild size="sm">
                                <Link href="/matters/create">Open your first matter</Link>
                            </Button>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b bg-muted/30">
                                        <th className="text-left px-4 py-3 font-medium text-muted-foreground tracking-tight">Matter</th>
                                        <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell tracking-tight">Practice Area</th>
                                        <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell tracking-tight">Clients / Contact</th>
                                        <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell tracking-tight">Responsible</th>
                                        <th className="text-left px-4 py-3 font-medium text-muted-foreground tracking-tight">Status</th>
                                        <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden xl:table-cell tracking-tight">Next Step</th>
                                        <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden xl:table-cell tracking-tight">Deadline</th>
                                        <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden xl:table-cell tracking-tight">Hearing Date</th>
                                        <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden xl:table-cell tracking-tight">Opened</th>
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
                                                <p className="font-medium group-hover:text-primary transition-colors">{matter.name}</p>
                                                <p className="text-xs text-muted-foreground">{matter.matter_number}</p>
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
                                                <Badge variant={statusVariant[matter.status]}>
                                                    {MATTER_STATUS_LABELS[matter.status]}
                                                </Badge>
                                            </td>
                                            <td className="px-4 py-3 hidden xl:table-cell text-muted-foreground">
                                                {matter.next_step ?? '—'}
                                            </td>
                                            <td className="px-4 py-3 hidden xl:table-cell text-muted-foreground">
                                                {matter.next_deadline ? formatDate(matter.next_deadline) : '—'}
                                            </td>
                                            <td className="px-4 py-3 hidden xl:table-cell text-muted-foreground">
                                                {matter.hearing_date ? formatDate(matter.hearing_date) : '—'}
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
        </AppLayout>
    );
}
