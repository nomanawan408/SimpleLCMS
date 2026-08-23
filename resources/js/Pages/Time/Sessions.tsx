import { Head } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from '@inertiajs/react';
import { ArrowLeft, Clock, PauseCircle, PlayCircle, Radio } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';

interface SessionRow {
    id: string;
    status: 'active' | 'paused';
    started_at: string;
    paused_at?: string | null;
    total_paused_seconds: number;
    elapsed_minutes: number;
    activity_type: string;
    description?: string | null;
    rate: number;
    live_amount: number;
    user?: { id: string; full_name: string } | null;
    matter?: { id: string; name: string; matter_number: string; status: string } | null;
}

interface Props {
    sessions: SessionRow[];
    stats: {
        active_count: number;
        paused_count: number;
        live_minutes: number;
        live_amount: number;
        tracked_employees: number;
    };
}

const ACTIVITY_LABELS: Record<string, string> = {
    advising: 'Advising', drafting: 'Drafting', research: 'Research',
    court_attendance: 'Court', travel: 'Travel', telephone: 'Phone',
    correspondence: 'Correspondence', meeting: 'Meeting', other: 'Other',
};

function fmtElapsed(totalSeconds: number): string {
    const s = Math.max(0, Math.floor(totalSeconds));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export default function ActiveSessions({ sessions, stats }: Props) {
    // Ticking clock so elapsed times update every second without a reload.
    const [nowTs, setNowTs] = useState(() => Date.now());
    useEffect(() => {
        const t = setInterval(() => setNowTs(Date.now()), 1000);
        return () => clearInterval(t);
    }, []);

    const rows = useMemo(() => sessions.map(s => {
        const startedMs = new Date(s.started_at).getTime();
        // While paused, the clock freezes at the pause moment; otherwise it runs live.
        const endMs = s.status === 'paused' && s.paused_at ? new Date(s.paused_at).getTime() : nowTs;
        const runningSec = Math.max(0, (endMs - startedMs) / 1000 - (s.total_paused_seconds ?? 0));
        return {
            ...s,
            elapsed_display: fmtElapsed(runningSec),
            live_amount_display: formatCurrency(Math.round(s.rate * (runningSec / 3600) * 100) / 100),
        };
    }), [sessions, nowTs]);

    return (
        <AppLayout title="Active Sessions">
            <Head title="Active Sessions" />

            <div className="max-w-6xl mx-auto">
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <Button asChild variant="ghost" size="sm" className="mb-1 text-muted-foreground hover:text-foreground -ml-2">
                            <Link href="/time"><ArrowLeft className="h-4 w-4 mr-2" />Back to Time</Link>
                        </Button>
                        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
                            Who's Working
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-success/15 border border-success/25 px-3 py-1 text-xs font-bold uppercase tracking-wider text-success">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
                                </span>
                                Live
                            </span>
                        </h1>
                    </div>
                    <p className="text-sm text-muted-foreground hidden sm:block">Updates in real time · refreshes on reload</p>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-8">
                    {[
                        { label: 'Working Now',   value: String(stats.active_count),              icon: PlayCircle,  cls: 'text-success' },
                        { label: 'On Break',      value: String(stats.paused_count),              icon: PauseCircle, cls: 'text-warning' },
                        { label: 'Live Hours',    value: `${Math.floor(stats.live_minutes / 60)}h ${stats.live_minutes % 60}m`, icon: Clock, cls: 'text-primary' },
                        { label: 'Unbilled Value',value: formatCurrency(stats.live_amount),       icon: Radio,       cls: 'text-foreground' },
                    ].map(({ label, value, icon: Icon, cls }) => (
                        <Card key={label} className="surface-card">
                            <CardContent className="p-4">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-[0.05em]">{label}</p>
                                        <p className={cn('mt-1 text-2xl font-bold tabular-nums', cls)}>{value}</p>
                                    </div>
                                    <Icon className={cn('h-5 w-5', cls)} />
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* Sessions */}
                {rows.length === 0 ? (
                    <Card className="surface-card">
                        <CardContent className="py-16 text-center">
                            <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                            <p className="text-muted-foreground text-sm">No one is checked in right now.</p>
                        </CardContent>
                    </Card>
                ) : (
                    <Card className="surface-card">
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b bg-muted/30">
                                            <th className="text-left px-5 py-3 font-semibold text-muted-foreground">Employee</th>
                                            <th className="text-left px-5 py-3 font-semibold text-muted-foreground">Matter</th>
                                            <th className="text-left px-5 py-3 font-semibold text-muted-foreground">Activity</th>
                                            <th className="text-left px-5 py-3 font-semibold text-muted-foreground">State</th>
                                            <th className="text-right px-5 py-3 font-semibold text-muted-foreground">Elapsed</th>
                                            <th className="text-right px-5 py-3 font-semibold text-muted-foreground">Running Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/60">
                                        {rows.map(s => (
                                            <tr key={s.id} className="hover:bg-muted/20 transition-colors">
                                                <td className="px-5 py-3.5">
                                                    <span className="font-medium">{s.user?.full_name ?? 'Unknown'}</span>
                                                </td>
                                                <td className="px-5 py-3.5">
                                                    {s.matter ? (
                                                        <>
                                                            <p className="font-medium truncate max-w-[240px]">{s.matter.name}</p>
                                                            <p className="text-xs text-muted-foreground font-mono">{s.matter.matter_number}</p>
                                                        </>
                                                    ) : '—'}
                                                </td>
                                                <td className="px-5 py-3.5 text-muted-foreground">
                                                    {ACTIVITY_LABELS[s.activity_type] ?? s.activity_type}
                                                    {s.description && (
                                                        <p className="text-xs truncate max-w-[200px]" title={s.description}>{s.description}</p>
                                                    )}
                                                </td>
                                                <td className="px-5 py-3.5">
                                                    {s.status === 'active' ? (
                                                        <Badge className="bg-success/15 text-success border-success/25 gap-1.5">
                                                            <PlayCircle className="h-3 w-3" /> Working
                                                        </Badge>
                                                    ) : (
                                                        <Badge className="bg-warning/15 text-warning border-warning/25 gap-1.5">
                                                            <PauseCircle className="h-3 w-3" /> On Break
                                                        </Badge>
                                                    )}
                                                </td>
                                                <td className="px-5 py-3.5 text-right">
                                                    <span className={cn('font-mono font-bold tabular-nums text-base', s.status === 'active' ? 'text-foreground' : 'text-muted-foreground')}>
                                                        {s.elapsed_display}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-3.5 text-right font-semibold tabular-nums text-primary">
                                                    {s.live_amount_display}
                                                    <p className="text-xs text-muted-foreground font-normal">{formatCurrency(s.rate)}/hr</p>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        </AppLayout>
    );
}
