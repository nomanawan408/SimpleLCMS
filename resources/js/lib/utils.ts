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
        ...opts,
    }).format(new Date(date));
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
    pending_court_date: 'Pending Court Date',
    awaiting_client: 'Awaiting Client',
    awaiting_opponent: 'Awaiting Opponent',
    on_hold: 'On Hold',
    closed: 'Closed',
    archived: 'Archived',
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
    admin: 'Admin',
    solicitor: 'Solicitor',
    paralegal: 'Paralegal',
    secretary: 'Secretary',
    lawyer: 'Lawyer',
    barrister: 'Barrister',
    clerk: 'Clerk',
    consultant: 'Consultant',
    administrator: 'Administrator',
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

export const LEAD_STATUS_LABELS: Record<string, string> = {
    enquiry: 'Enquiry',
    consultation_booked: 'Consultation Booked',
    engaged: 'Engaged',
    matter_opened: 'Matter Opened',
    declined: 'Declined',
};
