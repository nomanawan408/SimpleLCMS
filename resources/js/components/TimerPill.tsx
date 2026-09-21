import { Link, router, usePage } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import { ChevronDown, LogOut, Pause, Play, Timer, Trash2, FileText } from 'lucide-react';
import { cn, hasPermission } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import type { PageProps } from '@/types';

type ActiveTimer = NonNullable<PageProps['activeTimer']>;

function formatElapsed(totalSeconds: number): string {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    const pad = (n: number) => String(n).padStart(2, '0');
    return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

function csrfToken(): string {
    return (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement | null)?.content ?? '';
}

/**
 * Persistent running-timer pill for the app header. The timer keeps going
 * server-side when the user navigates away from the matter, so this reads
 * the shared `activeTimer` prop (present on every page) and keeps ticking
 * locally. Opens a dropdown with quick actions: pause/resume, check out,
 * discard, and a link back to the matter. Renders nothing when no timer
 * is running.
 */
export function TimerPill() {
    const { activeTimer: sharedTimer, auth } = usePage<PageProps>().props;
    const canAct = hasPermission(auth.user?.permissions, 'create_time_entries');

    const [timer, setTimer] = useState<ActiveTimer | null>(sharedTimer);
    const [elapsed, setElapsed] = useState(0);
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [confirmDiscard, setConfirmDiscard] = useState(false);

    // Follow navigations: the shared prop is the source of truth.
    useEffect(() => {
        setTimer(sharedTimer);
    }, [sharedTimer?.matter_id, sharedTimer?.started_at, sharedTimer?.paused_at, sharedTimer?.total_paused_seconds]);

    useEffect(() => {
        if (!timer) return;
        const tick = () => {
            const start = new Date(timer.started_at).getTime();
            const pausedSecs = timer.paused_at
                ? (timer.total_paused_seconds ?? 0) + Math.floor((Date.now() - new Date(timer.paused_at).getTime()) / 1000)
                : (timer.total_paused_seconds ?? 0);
            setElapsed(Math.max(0, Math.floor((Date.now() - start) / 1000) - pausedSecs));
        };
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, [timer?.matter_id, timer?.started_at, timer?.paused_at, timer?.total_paused_seconds]);

    if (!timer) return null;

    const paused = !!timer.paused_at;

    async function runAction(name: string, url: string): Promise<void> {
        setBusy(name);
        setError(null);
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { Accept: 'application/json', 'X-CSRF-TOKEN': csrfToken() },
            });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
                setError(payload?.error || 'Action failed.');
                return;
            }
            if (payload?.session) {
                setTimer(payload.session);
            } else {
                // Checkout / discard end the session.
                setTimer(null);
                setOpen(false);
            }
            setConfirmDiscard(false);
            // Resync the page (shared prop + any timer panels) with the server.
            router.reload();
        } catch {
            setError('Network error. Try again.');
        } finally {
            setBusy(null);
        }
    }

    const pillClass = cn(
        'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors',
        paused
            ? 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
            : 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100',
    );

    const dot = (
        <span className="relative flex h-2 w-2 shrink-0">
            {!paused && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            )}
            <span className={cn('relative inline-flex h-2 w-2 rounded-full', paused ? 'bg-amber-500' : 'bg-emerald-500')} />
        </span>
    );

    // Read-only users can see a running timer but get no actions (the
    // endpoints 403 without create_time_entries anyway).
    if (!canAct) {
        return (
            <Link
                href={`/matters/${timer.matter_id}`}
                title={`Timer running — back to ${timer.matter_name}`}
                className={pillClass}
            >
                {dot}
                <Timer className="h-3.5 w-3.5 shrink-0" />
                <span className="font-mono font-semibold tabular-nums">{formatElapsed(elapsed)}</span>
            </Link>
        );
    }

    return (
        <Popover open={open} onOpenChange={(v) => { setOpen(v); setError(null); setConfirmDiscard(false); }}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    aria-label={paused ? 'Timer paused — timer actions' : 'Timer running — timer actions'}
                    title={timer.matter_name}
                    className={pillClass}
                >
                    {dot}
                    <Timer className="h-3.5 w-3.5 shrink-0" />
                    <span className="font-mono font-semibold tabular-nums">{formatElapsed(elapsed)}</span>
                    <span className="hidden max-w-40 truncate text-xs font-medium opacity-80 md:inline">
                        {timer.matter_number}
                    </span>
                    <ChevronDown className={cn('h-3.5 w-3.5 opacity-70 transition-transform duration-200', open && 'rotate-180')} />
                </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 p-0">
                <div className="border-b border-border/60 px-4 py-3">
                    <p className="truncate text-sm font-semibold text-foreground" title={timer.matter_name}>
                        {timer.matter_name}
                    </p>
                    <p className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="tabular-nums">{timer.matter_number}</span>
                        <span aria-hidden>·</span>
                        <span className={cn('font-semibold', paused ? 'text-amber-700' : 'text-emerald-700')}>
                            {paused ? 'Paused' : 'Running'}
                        </span>
                    </p>
                    <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-foreground">
                        {formatElapsed(elapsed)}
                    </p>
                </div>

                <div className="space-y-1 p-2">
                    <Button
                        variant="outline"
                        size="sm"
                        className="w-full justify-start gap-2"
                        disabled={busy !== null}
                        onClick={() => runAction(paused ? 'resume' : 'pause', paused ? '/time/resume' : '/time/pause')}
                    >
                        {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                        {busy === 'pause' || busy === 'resume' ? 'Working…' : paused ? 'Resume timer' : 'Pause timer'}
                    </Button>
                    <Button
                        size="sm"
                        className="w-full justify-start gap-2"
                        disabled={busy !== null}
                        onClick={() => runAction('checkout', '/time/checkout')}
                    >
                        <LogOut className="h-4 w-4" />
                        {busy === 'checkout' ? 'Saving…' : 'Check out & save'}
                    </Button>
                    <Link
                        href={`/matters/${timer.matter_id}`}
                        onClick={() => setOpen(false)}
                        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted"
                    >
                        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                        Open matter
                    </Link>
                    {confirmDiscard ? (
                        <div className="flex items-center gap-2 rounded-md bg-destructive/5 px-3 py-2">
                            <p className="flex-1 text-xs font-medium text-destructive">Discard without saving?</p>
                            <Button
                                variant="destructive"
                                size="sm"
                                className="h-7"
                                disabled={busy !== null}
                                onClick={() => runAction('discard', '/time/discard')}
                            >
                                {busy === 'discard' ? '…' : 'Confirm'}
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-7"
                                onClick={() => setConfirmDiscard(false)}
                            >
                                Keep
                            </Button>
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={() => setConfirmDiscard(true)}
                            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
                        >
                            <Trash2 className="h-4 w-4 shrink-0" />
                            Discard session
                        </button>
                    )}
                    {error && (
                        <p className="px-3 py-1 text-xs font-medium text-destructive">{error}</p>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}

export default TimerPill;
