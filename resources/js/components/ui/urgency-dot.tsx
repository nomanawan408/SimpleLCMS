import { cn } from '@/lib/utils';

export type DateUrgency = 'urgent' | 'soon' | 'ok';

/**
 * Classifies how close a date is, for the traffic-light dot next to a
 * deadline. Kept separate from the dot itself so any other view (a list, a
 * card, a table) can reuse the same thresholds without duplicating them.
 *
 *   overdue or due within 2 days  -> urgent (red)
 *   due within 3-7 days           -> soon (amber)
 *   more than a week away         -> ok (green)
 *   no date                       -> null (nothing to show)
 */
export function getDateUrgency(dateString?: string | null): DateUrgency | null {
    if (!dateString) return null;

    const days = Math.ceil((new Date(dateString).getTime() - Date.now()) / 86400000);

    if (days <= 2) return 'urgent';
    if (days <= 7) return 'soon';
    return 'ok';
}

const URGENCY_DOT_STYLES: Record<DateUrgency, string> = {
    urgent: 'bg-destructive',
    soon: 'bg-warning',
    ok: 'bg-success',
};

const URGENCY_LABELS: Record<DateUrgency, string> = {
    urgent: 'Overdue or due very soon',
    soon: 'Due within a week',
    ok: 'Not due soon',
};

interface DateUrgencyDotProps {
    /** ISO date string, or null/undefined if nothing is set -- renders nothing in that case. */
    date?: string | null;
    className?: string;
}

/**
 * A small traffic-light dot for a deadline-style date: red when it is
 * overdue or very close, amber when it is approaching, green when there is
 * still plenty of time. Renders nothing when no date is set -- there is
 * nothing to be urgent about.
 */
export function DateUrgencyDot({ date, className }: DateUrgencyDotProps) {
    const urgency = getDateUrgency(date);
    if (!urgency) return null;

    return (
        <span
            role="img"
            aria-label={URGENCY_LABELS[urgency]}
            title={URGENCY_LABELS[urgency]}
            className={cn('inline-block h-2 w-2 shrink-0 rounded-full', URGENCY_DOT_STYLES[urgency], className)}
        />
    );
}
