import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = 'GBP'): string {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amount);
}

export function formatDate(date: string | null | undefined, opts?: Intl.DateTimeFormatOptions): string {
    if (!date) return '—';
    return new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        // The whole app runs on UK time (APP_TIMEZONE=Europe/London), so pin
        // formatting here too — otherwise a device in another zone would show
        // a different day/time for the same stored instant.
        timeZone: 'Europe/London',
        ...opts,
    }).format(new Date(date));
}

/** "14:30" UK time — for hearing times and anywhere a clock time accompanies a date. */
export function formatTime(date: string | null | undefined): string {
    if (!date) return '—';
    return new Intl.DateTimeFormat('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'Europe/London',
    }).format(new Date(date));
}

/**
 * Whole calendar days from today (UK) to the given date: 0 = today, 1 =
 * tomorrow, negative = overdue. Compares calendar days in Europe/London,
 * not 24h blocks — Math.ceil on a raw millisecond diff calls 09:31
 * "tomorrow" when it is 08:00 the same morning.
 */
export function daysUntilDate(date: string | null | undefined): number | null {
    if (!date) return null;
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return null;
    const key = (x: Date) =>
        new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Europe/London',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        }).format(x); // YYYY-MM-DD
    return Math.round((Date.parse(key(d)) - Date.parse(key(new Date()))) / 86400000);
}

/**
 * True when a due date/deadline has passed: a past calendar day, or today
 * with a real clock time already behind us. Date-only values (midnight)
 * are only overdue once their day is over — "due today" stays "today"
 * all day.
 */
export function isOverdueDate(date: string | null | undefined): boolean {
    const days = daysUntilDate(date);
    if (days === null) return false;
    if (days !== 0) return days < 0;
    const [, time] = splitDateTime(date);
    if (!time) return false;
    return new Date(date as string).getTime() < Date.now();
}

/** Split "Y-m-d H:i:s" (or date-only) into [date, time] for date/time inputs. */
export function splitDateTime(value: string | null | undefined): [string, string] {
    if (!value) return ['', ''];
    const date = value.slice(0, 10);
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return [date, ''];
    // A bare "Y-m-d" parses to midnight, and legacy date-only rows stored
    // midnight too — neither is a real set time, so no time is shown until
    // one is explicitly saved.
    if (value.length <= 10) return [date, ''];
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    if (hh === '00' && mm === '00') return [date, ''];
    return [date, `${hh}:${mm}`];
}

/** "3 hours ago", "2 days ago" -- for notifications and activity feeds, where the exact timestamp matters less than roughly how stale it is. */
export function formatRelativeTime(date: string | null | undefined): string {
    if (!date) return '—';

    const seconds = Math.max(0, (Date.now() - new Date(date).getTime()) / 1000);

    const steps: [number, string][] = [
        [60, 'second'],
        [60, 'minute'],
        [24, 'hour'],
        [7, 'day'],
        [4.345, 'week'],
        [12, 'month'],
        [Infinity, 'year'],
    ];

    let value = seconds;
    let unit = 'second';
    for (const [divisor, label] of steps) {
        if (value < divisor) {
            unit = label;
            break;
        }
        value /= divisor;
        unit = label;
    }

    const rounded = Math.floor(value);
    if (unit === 'second' && rounded < 10) return 'just now';

    return `${rounded} ${unit}${rounded === 1 ? '' : 's'} ago`;
}

export function formatDuration(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h ${m.toString().padStart(2, '0')}m`;
}

export function initials(name: string): string {
    return name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
}

export const MATTER_STATUS_LABELS: Record<string, string> = {
    open: 'Open',
    in_progress: 'In Progress',
    in_review: 'In Review',
    actively_progressing: 'In Progress',
    reviewing: 'In Review',
    being_worked: 'Working',
    pending_court_date: 'Pending',
    awaiting_client: 'Awaiting Client',
    awaiting_opponent: 'Opponent',
    awaiting_response: 'Awaiting Response',
    awaiting_third_party: 'Awaiting Third Party',
    awaiting_respondent_solicitors: 'Awaiting Respondent Solicitors',
    awaiting_claimant_solicitors: 'Awaiting Claimant Solicitors',
    on_hold: 'On Hold',
    closed: 'Closed',
    archived: 'Archived',
};

export const MATTER_PRIORITY_LABELS: Record<string, string> = {
    low: 'Low',
    medium: 'Medium',
    high: 'High',
};

export const MATTER_PRIORITY_STYLES: Record<string, string> = {
    low: 'bg-zinc-100 text-zinc-600 border-zinc-200',
    medium: 'bg-sky-50 text-sky-700 border-sky-200',
    high: 'bg-red-50 text-red-700 border-red-200',
};

export const PRACTICE_AREA_LABELS: Record<string, string> = {
    conveyancing: 'Conveyancing',
    family_law: 'Family Law',
    litigation: 'Litigation',
    employment: 'Employment',
    wills_probate: 'Wills & Probate',
    corporate: 'Corporate',
    immigration: 'Immigration',
    criminal: 'Criminal',
    personal_injury: 'Personal Injury',
    custom: 'Custom',
};

export const ROLE_LABELS: Record<string, string> = {
    super_admin: 'Super Admin',
    firm_admin: 'Firm Admin',
    admin: 'Firm Admin',
    administrator: 'Firm Admin',
    solicitor: 'Solicitor',
    paralegal: 'Paralegal',
    secretary: 'Secretary',
    lawyer: 'Lawyer',
    barrister: 'Barrister',
    clerk: 'Clerk',
    consultant: 'Consultant',
    manager: 'Manager',
    accounts: 'Accounts',
};

export function hasPermission(permissions: string[] | undefined, required: string): boolean {
    if (!permissions) return false;
    return permissions.includes(required);
}

export function hasRole(roles: string[] | undefined, role: string): boolean {
    if (!roles) return false;
    return roles.includes(role);
}

export const CONTACT_TYPE_LABELS: Record<string, string> = {
    individual: 'Individual',
    company: 'Company',
    other_party: 'Other Party',
};

export const PREFIX_OPTIONS: string[] = [
    'Mr', 'Mrs', 'Ms', 'Miss', 'Dr', 'Prof', 'Sir', 'Dame', 'Rev', 'Hon',
];

export const LEAD_STATUS_LABELS: Record<string, string> = {
    enquiry: 'Enquiry',
    consultation_booked: 'Consultation Booked',
    engaged: 'Engaged',
    matter_opened: 'Matter Opened',
    declined: 'Declined',
};
