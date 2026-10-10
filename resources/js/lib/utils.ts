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

/**
 * Transport-safe filename for multipart uploads. A raw straight quote in the
 * multipart filename trips some hosting WAF/SQLi rules, which answer with a
 * non-JSON block page -- the upload then fails with a generic "Upload
 * failed" and no server message. Folding straight quotes to their
 * typographic lookalikes (and stripping newlines/backslashes/controls)
 * keeps the name human-readable while the request passes through untouched.
 * Only the listed characters change, so normal filenames (and always the
 * extension) pass through byte-identical.
 */
export function sanitizeUploadFilename(name: string): string {
    if (!name) return 'upload';
    let safe = name.replace(/[\r\n]+/g, ' ');
    safe = safe.replace(/'/g, '’').replace(/"/g, '”');
    safe = safe.replace(/\\/g, '').replace(/[\x00-\x1F\x7F]/g, '');
    safe = safe.trim().replace(/[.\s]+$/, '');
    return safe || 'upload';
}

export function initials(name: string): string {
    return name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
}

/**
 * Platform display convention for staff names: first initial + surname
 * ("Tufail Hussain" -> "T Hussain"). Single-word names pass through.
 * Applies to staff attributions only -- contacts keep legal names, and
 * pickers/management screens keep full names for identification.
 */
export function shortName(name: string | null | undefined): string {
    if (!name) return '';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length < 2) return parts[0] ?? '';
    const first = parts[0][0]?.toUpperCase() ?? '';
    return `${first} ${parts[parts.length - 1]}`;
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
    lawyer: 'Lawyer',
};

export function hasPermission(permissions: string[] | undefined, required: string): boolean {
    if (!permissions) return false;
    return permissions.includes(required);
}

/** True when the user holds any of the listed permissions (role-carried or direct). */
export function hasAnyPermission(permissions: string[] | undefined, required: string[]): boolean {
    if (!permissions) return false;
    return required.some((p) => permissions.includes(p));
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

/**
 * Convert a matters array (from any controller) into ComboboxOption[] for the
 * searchable matter Combobox.  Display shows the matter title first, reference
 * second — so users see the human name before the file number.
 *
 * Usage: <Combobox options={matterComboboxOptions(matters)} ... />
 */
export function matterComboboxOptions(
    matters: { id: string; name: string; matter_number: string }[],
) {
    return matters.map((m) => ({
        value: m.id,
        label: m.name,
        description: m.matter_number,
    }));
}

/**
 * Weekdays (Mon–Fri) from start through end, inclusive. Courts sit only on
 * weekdays, so a multi-day hearing is measured in court days — weekends are
 * ignored. Returns 0 when the range is empty or invalid.
 */
export function countWeekdays(start: string | null | undefined, end: string | null | undefined): number {
    if (!start || !end) return 0;
    const s = new Date(`${start.slice(0, 10)}T12:00:00Z`);
    const e = new Date(`${end.slice(0, 10)}T12:00:00Z`);
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || e < s) return 0;
    let n = 0;
    for (let d = new Date(s); d <= e; d.setUTCDate(d.getUTCDate() + 1)) {
        const day = d.getUTCDay();
        if (day !== 0 && day !== 6) n++;
    }
    return n;
}

export interface HearingRange {
    multiDay: boolean;
    /** Short form for badges/table cells, e.g. "16–26 Oct 2026". */
    compact: string;
    /** Full sentence, e.g. "From 16 Oct 2026, 09:00 to 26 Oct 2026, 17:30". */
    full: string;
    /** Weekday count for multi-day hearings, else null. */
    courtDays: number | null;
}

/**
 * Human rendering of a hearing start/end pair. Same calendar day (or no
 * end) behaves exactly like a single date; a longer hearing states the
 * date range plus the weekday count, e.g. "16–26 Oct 2026 · 18 court days".
 */
export function formatHearingRange(
    startAt: string | null | undefined,
    endAt: string | null | undefined,
): HearingRange {
    const fallback: HearingRange = { multiDay: false, compact: formatDate(startAt), full: formatDate(startAt), courtDays: null };
    if (!startAt || !endAt) return fallback;
    const sDay = startAt.slice(0, 10);
    const eDay = endAt.slice(0, 10);
    if (!sDay || !eDay || eDay <= sDay) return fallback;

    const [, sTime] = splitDateTime(startAt);
    const [, eTime] = splitDateTime(endAt);
    const sDate = formatDate(startAt);
    const eDate = formatDate(endAt);

    // Same month and year: "16–26 Oct 2026". Otherwise the full pair.
    let compact: string;
    const sParts = sDate.split(' ');
    const eParts = eDate.split(' ');
    if (sParts.length === 3 && eParts.length === 3 && sParts[1] === eParts[1] && sParts[2] === eParts[2]) {
        compact = `${sParts[0]}–${eParts[0]} ${eParts[1]} ${eParts[2]}`;
    } else {
        compact = `${sDate} → ${eDate}`;
    }

    const full = `From ${sDate}${sTime ? `, ${sTime}` : ''} to ${eDate}${eTime ? `, ${eTime}` : ''}`;
    const courtDays = countWeekdays(startAt, endAt);

    return { multiDay: true, compact, full, courtDays };
}
