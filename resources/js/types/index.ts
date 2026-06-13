export interface Firm {
    id: string;
    name: string;
    slug: string;
    plan: 'starter' | 'professional' | 'enterprise';
    vat_number: string | null;
    sra_number: string | null;
    logo_path: string | null;
    subscription_status: 'trial' | 'active' | 'past_due' | 'cancelled';
    trial_ends_at: string | null;
    address_line1: string | null;
    address_line2: string | null;
    city: string | null;
    county: string | null;
    postcode: string | null;
    phone: string | null;
    email: string | null;
    website: string | null;
    timezone: string;
    default_hourly_rate: number;
    invoice_prefix: string;
    invoice_sequence: number;
    vat_rate: number;
    payment_terms_days: number;
}

export interface User {
    id: string;
    firm_id: string;
    full_name: string;
    email: string;
    role: 'solicitor' | 'lawyer' | 'barrister' | 'clerk' | 'consultant' | 'administrator' | 'manager' | 'accounts';
    roles?: string[];
    permissions?: string[];
    phone: string | null;
    rate_per_hour: number | null;
    totp_enabled: boolean;
    is_active: boolean;
    last_login_at: string | null;
    avatar_url: string | null;
    firm?: Pick<Firm, 'id' | 'name' | 'logo_path' | 'plan' | 'vat_rate' | 'invoice_prefix'>;
}

export interface Contact {
    id: string;
    firm_id: string;
    type: 'individual' | 'company' | 'other_party';
    name: string;
    email: string | null;
    phone: string | null;
    company_number: string | null;
    lead_status: 'enquiry' | 'consultation_booked' | 'engaged' | 'matter_opened' | 'declined' | null;
    gdpr_consent_at: string | null;
    created_at: string;
    address?: any;
    national_insurance_number?: string | null;
    dob?: string | null;
    source?: string | null;
    tags?: string[] | null;
    matters?: Matter[];
}

export interface Matter {
    id: string;
    firm_id: string;
    matter_number: string;
    name: string;
    description: string | null;
    status: 'open' | 'pending_court_date' | 'awaiting_client' | 'awaiting_opponent' | 'on_hold' | 'closed' | 'archived';
    practice_area: 'conveyancing' | 'family_law' | 'litigation' | 'employment' | 'wills_probate' | 'corporate' | 'immigration' | 'criminal' | 'personal_injury' | 'custom';
    fee_arrangement: 'hourly_rate' | 'fixed_fee' | 'contingency' | 'retainer';
    responsible_user_id: string | null;
    opened_at: string | null;
    closed_at: string | null;
    responsible_user?: User;
    contacts?: Contact[];
    tasks?: Task[];
    notes?: Note[];
    time_entries?: TimeEntry[];
    expenses?: Expense[];
    invoices?: Invoice[];
    documents?: Document[];
    trust_entries?: TrustEntry[];
    trust_balance?: number;
    unbilled_time_value?: number;
    pivot?: {
        role?: string;
    };
    next_step?: string | null;
    next_deadline?: string | null;
    client_names?: string | null;
    hearing_date?: string | null;
    created_at: string;
}

export interface Task {
    id: string;
    firm_id: string;
    matter_id: string | null;
    assignee_id: string | null;
    title: string;
    description: string | null;
    due_date: string | null;
    priority: 'high' | 'medium' | 'low';
    status: 'todo' | 'in_progress' | 'review' | 'done';
    completed_at: string | null;
    assignee?: User;
}

export interface Invoice {
    id: string;
    firm_id: string;
    matter_id: string;
    invoice_number: string;
    status: 'draft' | 'sent' | 'partial' | 'paid' | 'written_off' | 'cancelled';
    subtotal: number;
    vat_amount: number;
    vat_rate: number;
    total: number;
    discount_amount: number;
    discount_reason?: string | null;
    due_date: string | null;
    sent_at: string | null;
    paid_at: string | null;
    created_at: string;
    notes?: string;
    amount_paid?: number;
    amount_outstanding?: number;
    matter?: Matter;
    lineItems?: InvoiceLineItem[];
    payments?: Payment[];
}

export interface InvoiceLineItem {
    id: string;
    invoice_id: string;
    description: string;
    quantity: number;
    unit_rate: number;
    amount: number;
    vat_amount: number;
    type: 'time' | 'expense' | 'fixed';
}

export interface Payment {
    id: string;
    firm_id: string;
    invoice_id: string;
    amount: number;
    method: 'cash' | 'cheque' | 'bank_transfer' | 'stripe_card' | 'stripe_sepa';
    stripe_charge_id: string | null;
    paid_at: string;
    notes: string | null;
}

export interface TimeEntry {
    id: string;
    firm_id: string;
    matter_id: string;
    user_id: string;
    date: string;
    description: string | null;
    duration_minutes: number;
    duration_formatted?: string;
    rate: number;
    amount: number;
    billable: boolean;
    billed: boolean;
    is_locked: boolean;
    activity_type: 'advising' | 'drafting' | 'research' | 'court_attendance' | 'travel' | 'telephone' | 'correspondence' | 'meeting' | 'other';
    invoice_id: string | null;
    matter?: Matter;
    user?: User;
}

export interface Expense {
    id: string;
    firm_id: string;
    matter_id: string;
    user_id?: string;
    date: string;
    vendor?: string | null;
    description: string;
    amount: number;
    vat_amount?: number | null;
    category?: string | null;
    billable: boolean;
    billed: boolean;
    invoice_id: string | null;
    matter?: Matter;
    user?: User;
}

export interface Document {
    id: string;
    firm_id: string;
    matter_id: string;
    uploaded_by_id: string;
    parent_id: string | null;
    name: string;
    original_name: string | null;
    folder: string | null;
    version: number | null;
    mime_type: string | null;
    size_bytes: number | null;
    is_client_visible: boolean;
    is_signed: boolean;
    signed_at: string | null;
    created_at?: string;
    uploadedBy?: User;
}

export interface TrustEntry {
    id: string;
    firm_id: string;
    matter_id: string;
    type: 'receipt' | 'disbursement' | 'transfer';
    amount: number;
    description: string | null;
    date: string;
    reference: string | null;
    balance_after: number;
}

export interface Note {
    id: string;
    matter_id: string;
    user_id: string;
    body: string;
    type: 'note' | 'call_log' | 'email_log' | 'meeting_log';
    logged_at: string;
    user?: User;
}

export interface PaginatedData<T> {
    data: T[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number;
    to: number;
    prev_page_url: string | null;
    next_page_url: string | null;
    links: { url: string | null; label: string; active: boolean }[];
}

export interface PageProps {
    [key: string]: unknown;
    auth: {
        user: User | null;
    };
    flash: {
        success: string | null;
        error: string | null;
        warning: string | null;
    };
    ziggy: {
        location: string;
        url: string;
        port: number | null;
        defaults: Record<string, unknown>;
        routes: Record<string, unknown>;
    };
}
