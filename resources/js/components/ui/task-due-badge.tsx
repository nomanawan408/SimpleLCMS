import { AlertTriangle, Calendar, Clock } from 'lucide-react';
import { cn, daysUntilDate, formatDate } from '@/lib/utils';
import { getDateUrgency } from '@/components/ui/urgency-dot';

interface TaskDueBadgeProps {
    dueDate: string | null | undefined;
    /** Done tasks never highlight, however overdue they are. */
    done?: boolean;
    className?: string;
}

/**
 * Deadline-style badge for task due dates, matching the matter
 * deadline/hearing treatment: red when overdue or due within 2 days,
 * amber when due within 3–7 days, neutral otherwise. Done tasks and
 * missing dates render quietly so finished work never shouts.
 */
export function TaskDueBadge({ dueDate, done = false, className }: TaskDueBadgeProps) {
    if (!dueDate) {
        return <span className={cn('text-xs text-muted-foreground/60', className)}>—</span>;
    }

    const days = daysUntilDate(dueDate);

    if (done) {
        return (
            <span className={cn('inline-flex items-center gap-1 text-xs text-muted-foreground', className)}>
                <Calendar className="h-3 w-3 shrink-0" />
                {formatDate(dueDate)}
            </span>
        );
    }

    const urgency = getDateUrgency(dueDate);
    const isDanger = urgency === 'urgent';
    const isSoon = urgency === 'soon';

    let meta = '';
    if (days !== null) {
        if (days < 0) meta = `Overdue ${Math.abs(days)}d`;
        else if (days === 0) meta = 'Due today';
        else if (days <= 2) meta = `Due in ${days}d`;
        else if (days <= 7) meta = `In ${days}d`;
    }

    const badgeClass = isDanger
        ? 'bg-red-50 text-red-700 border-red-200'
        : isSoon
            ? 'bg-amber-50 text-amber-800 border-amber-200'
            : 'bg-white text-zinc-600 border-zinc-200';
    const Icon = isDanger ? AlertTriangle : isSoon ? Clock : Calendar;
    const iconClass = isDanger ? 'text-red-500' : isSoon ? 'text-amber-500' : 'text-muted-foreground';

    return (
        <span
            title={meta ? `${formatDate(dueDate)} · ${meta}` : formatDate(dueDate)}
            className={cn(
                'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold leading-none whitespace-nowrap',
                badgeClass,
                className,
            )}
        >
            <Icon className={cn('h-3 w-3 shrink-0', iconClass)} />
            <span>{formatDate(dueDate)}</span>
            {meta && (
                <>
                    <span className="opacity-40">·</span>
                    <span className="font-bold">{meta}</span>
                </>
            )}
        </span>
    );
}
