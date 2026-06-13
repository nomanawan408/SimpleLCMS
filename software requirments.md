SimpleLawyer System
Legal Case Management Web Application
Software Requirements Specification


Field	Detail
Document Version	2.0 — FINAL
Status	Approved — Ready for Development
Date	March 2026
Prepared for	Development Team
Jurisdiction	Ireland / EU (GDPR)
Target users	Solo solicitors to 50-person Irish law firms
Deployment	Self-hosted VPS (Hetzner / DigitalOcean)
Confirmed tech stack	Laravel 11 + Inertia.js v2 + React 18 + PostgreSQL 15


1. Introduction
1.1 Purpose of this document
This Software Requirements Specification (SRS) is the single authoritative reference for building SimpleLaw — a secure, GDPR-compliant, cloud-based legal case management web application for Irish law firms. It is written for the development team and covers all functional requirements, non-functional requirements, the confirmed technology stack, security architecture, data model, and implementation plan.
This is version 2.0, updated to reflect the final confirmed technology decision: Laravel 11 + Inertia.js v2 + React 18 + TypeScript + PostgreSQL 15, self-hosted on a European VPS.
1.2 Scope
SimpleLaw covers the full lifecycle of legal practice management:
    • Matter (case) management from client intake to matter closure
    • Client CRM, conflict-of-interest checking, and online intake forms
    • Time recording, expense capture, and legal billing with Irish VAT
    • Trust (client) account ledger compliant with Solicitors Accounts Regulations 2014
    • Legal document management, version control, templates, and e-signatures
    • Calendar, task management, and court diary
    • Secure client portal for document sharing, messaging, and invoice payment
    • Firm performance dashboards and financial reporting
    • Multi-tenant RBAC with complete firm-level data isolation
    • GDPR tooling: consent management, DSAR workflow, right to erasure
1.3 Key definitions

Term	Definition
Matter	A legal case or client engagement — the central entity of the system
Solicitor	Irish licensed legal professional, regulated by the Law Society of Ireland
Tenant	One law firm — completely isolated data environment within the multi-tenant system
Inertia.js	Framework that connects Laravel controllers directly to React components without a REST API
RLS	Row-Level Security — PostgreSQL feature enforcing data isolation at database engine level
RBAC	Role-Based Access Control — permissions granted by role, enforced in Laravel policies
GDPR	General Data Protection Regulation (EU) 2016/679
DSAR	Data Subject Access Request — client right to see all data held about them
SAR 2014	Solicitors Accounts Regulations 2014 — governs Irish client money handling
PPS	Personal Public Service Number — Irish national identifier (sensitive PII)
VAT	Value Added Tax — Irish standard rate 23%, applicable to legal fees
PWA	Progressive Web App — installable on mobile without app store
Octane	Laravel Octane — runs Laravel on FrankenPHP for high-performance responses
Spatie	Suite of Laravel packages used for permissions, audit logging, and media


2. Confirmed Technology Stack
This is the final, approved stack. No deviations without written sign-off from the project lead.

2.1 Core framework and language
Layer	Technology	Version	Reason chosen
Language	PHP	8.3+	Long-term stable, OPcache + Octane for performance, large hiring pool
Framework	Laravel	11.x LTS	Batteries-included security, mature ecosystem, 13-year track record
Frontend bridge	Inertia.js	v2.x	Eliminates public REST API — dramatically reduces attack surface
Frontend framework	React + TypeScript	18.x	Type-safe UI, best-in-class component ecosystem
CSS	Tailwind CSS	3.x	Utility-first, no bloat, rapid development
UI components	shadcn/ui + Radix UI	Latest	Accessible, unstyled, WCAG 2.1 AA compliant
Forms	React Hook Form + Zod	Latest	Client-side validation mirroring Laravel server rules

2.2 Database and storage
Layer	Technology	Version	Reason chosen
Primary database	PostgreSQL	15+	Native Row-Level Security for tenant isolation — non-negotiable for GDPR
ORM	Laravel Eloquent + query builder	Laravel 11	Parameterised queries by default; raw SQL requires explicit opt-in
Cache + queues	Redis	7.x	Sessions, queue backend for Horizon, response caching
Search index	Meilisearch via Laravel Scout	Latest	Full-text matter/document/contact search, self-hostable, EU data
Object storage	S3-compatible (Hetzner Object Storage)	—	EU-resident, S3 API compatible, low cost, private bucket with presigned URLs
Migrations	Laravel built-in migrations	—	Version-controlled, rollback-safe schema changes

2.3 Security packages (mandatory — do not substitute)
Package	Purpose	Install command
spatie/laravel-permission	RBAC roles and granular permissions, enforced in Laravel Policies	composer require spatie/laravel-permission
spatie/laravel-activitylog	Immutable append-only audit log — 7-year retention for GDPR compliance	composer require spatie/laravel-activitylog
spatie/laravel-multitenancy	Firm-level tenant isolation, automatic tenant scoping on all queries	composer require spatie/laravel-multitenancy
spatie/laravel-media-library	Document storage with S3 backend, presigned URL generation	composer require spatie/laravel-medialibrary
laravel/sanctum	JWT access tokens (15 min) + rotating refresh tokens (7 day)	composer require laravel/sanctum
laravel/socialite	Google Workspace + Microsoft 365 OAuth SSO	composer require laravel/socialite
pragmarx/google2fa-laravel	TOTP two-factor authentication (Google Authenticator compatible)	composer require pragmarx/google2fa-laravel
spatie/laravel-csp	Content Security Policy headers — prevents XSS	composer require spatie/laravel-csp
owen-it/laravel-auditing	Secondary field-level audit trail for PII access logging	composer require owen-it/laravel-auditing

2.4 Business logic packages
Package	Purpose
laravel/cashier-stripe	Stripe subscription billing, plan management, webhook handling
barryvdh/laravel-dompdf	Server-side PDF generation for invoices and reports
maatwebsite/laravel-excel	Excel and CSV export for all reports
laravel/horizon	Redis queue monitoring dashboard
laravel/reverb	Native WebSocket server for real-time features (timer sync, notifications)
laravel/octane	FrankenPHP/Swoole runtime — removes per-request PHP bootstrap overhead
laravel/scout + meilisearch/meilisearch-laravel	Full-text search across matters, contacts, and documents
tightenco/ziggy	Shares named Laravel routes with React/Inertia frontend
spatie/laravel-backup	Automated database + file backups to S3-compatible storage
spatie/laravel-health	Application health checks (DB, Redis, queue, storage) with dashboard

2.5 Infrastructure and DevOps
Component	Tool	Notes
Server provisioning	Laravel Forge or Ploi.io	Manages Nginx, PHP-FPM, SSL (Let's Encrypt), deployment pipelines
Web server	Nginx + PHP-FPM	Nginx handles SSL termination, static assets, reverse proxy to Octane
Process manager	Supervisor	Keeps Horizon queue workers and Reverb WebSocket server alive
CI/CD	GitHub Actions	Run tests, lint, security scan, zero-downtime deploy on merge to main
VPS hosting	Hetzner CX (Frankfurt) or DigitalOcean (AMS3)	EU data residency — mandatory for GDPR compliance
Container (optional)	Docker + Docker Compose	For local dev consistency; production can be bare metal via Forge
SSL	Let's Encrypt via Forge	Auto-renewing TLS 1.3 certificates
Backups	spatie/laravel-backup + S3	Daily encrypted DB + file backup, 30-day retention, tested monthly
Error tracking	Sentry (EU instance)	Real-time error monitoring, source maps for React frontend
Uptime monitoring	Better Uptime or UptimeRobot	Alert within 1 minute of downtime


3. Security Architecture
Security is a first-class requirement. Every item in this section is mandatory, not optional. Developers must implement and demonstrate each control before any module is marked complete.

3.1 Authentication
Control	Requirement	Implementation
Password hashing	bcrypt, cost factor 12 minimum	Laravel default — never reduce cost factor
Session tokens	JWT access token, 15-minute expiry	Laravel Sanctum — configure TOKEN_EXPIRY=900
Refresh tokens	Rotating refresh tokens, 7-day expiry, single-use	Sanctum refresh token rotation — old token invalidated on use
Two-factor auth	TOTP (RFC 6238) via Google Authenticator — optional per user, enforceable per firm	pragmarx/google2fa-laravel
SSO	Google Workspace and Microsoft 365 OAuth 2.0	Laravel Socialite
Account lockout	Lock after 10 failed attempts; unlock via email link only	Laravel rate limiter on login route + custom lockout model
Session management	View and terminate all active sessions from account settings	Sanctum token list + revocation
Password policy	Min 12 characters, breach check via HaveIBeenPwned API on registration	Custom validator using HIBP k-anonymity API

3.2 Authorisation — RBAC model
All authorisation is enforced at the policy layer in Laravel. Frontend visibility is secondary — the backend must never trust the frontend to enforce access control.

Role	Scope	Key permissions
Firm Admin	Own firm only	Full access; firm settings; user management; subscription; all reports
Senior Solicitor	Own firm only	All matters; all clients; billing; documents; reports; cannot manage users
Solicitor / Fee Earner	Own firm only	Own assigned matters; own time entries; own documents; limited billing view
Paralegal / Support Staff	Own firm only	Matter read/write; contacts; calendar; tasks; no billing configuration
Accounts (read-only)	Own firm only	Financial reports; invoices; trust ledger — read only, no mutations
Client (portal)	Own matters only	Portal: own documents (shared by solicitor); own invoices; messaging; booking

Rule: Every Laravel controller method must have a corresponding Policy class method. No route may be accessed without explicit authorisation check. Use $this->authorize() or Gate::authorize() — never rely on middleware alone.

3.3 Data isolation — multi-tenancy
    • Every database table containing firm data includes a firm_id column with a NOT NULL constraint and a foreign key to the firms table.
    • PostgreSQL Row-Level Security (RLS) policies are enabled on all tenant-scoped tables. Even if application code has a bug, the database engine will not return data belonging to another firm.
    • The Spatie multi-tenancy package automatically scopes all Eloquent queries to the current tenant. Developers must never bypass this scope without an explicit security review.
    • A dedicated automated test suite must verify cross-tenant isolation: User A in Firm A must receive a 403 or empty result when attempting to access any resource belonging to Firm B — across all 100+ API endpoints.
    • Tenant resolution is based on the authenticated user's firm_id claim in the JWT — never on a URL parameter or request header that can be manipulated.

3.4 Data encryption
Data type	Encryption method	Notes
Data in transit	TLS 1.3 only (TLS 1.0 and 1.1 disabled)	Enforced at Nginx level; HSTS header with 1-year max-age
Database at rest	PostgreSQL full-disk encryption (LUKS on VPS)	Configured at OS level on Hetzner/DigitalOcean
PII fields at application layer	Laravel Encrypted cast on Eloquent models	PPS numbers, DOB, bank account details, medical notes
Documents	Private S3 bucket; presigned URLs only (1-hour expiry)	No document is ever publicly accessible by URL
Backups	AES-256 encrypted before upload to S3	spatie/laravel-backup with encryption key from environment
Encryption keys	Stored in environment variables only — never in codebase	Use Laravel Forge's environment management or HashiCorp Vault
Password reset tokens	Hashed with SHA-256 before storage	Laravel default — confirm this is not stored in plain text

3.5 Audit logging — mandatory fields
Every create, update, and delete operation on any business entity must produce an audit log entry. The audit log is append-only — no UPDATE or DELETE query must ever run against the activity_log table.

Field	Type	Description
id	UUID	Unique log entry identifier
firm_id	UUID FK	Tenant scoping — which firm this event belongs to
causer_id	UUID FK nullable	User who triggered the action (null for system events)
causer_type	string	User model class
subject_id	UUID FK nullable	The entity that was changed
subject_type	string	The entity model class (Matter, Contact, Invoice, etc.)
event	string	created | updated | deleted | viewed | exported | login | logout | failed_login
old_values	JSONB	State before change (null for create events)
new_values	JSONB	State after change (null for delete events)
ip_address	inet	Client IP address
user_agent	text	Client browser / device
created_at	timestamptz	Immutable timestamp
Retention: audit logs must be retained for a minimum of 7 years. Implement a read-only database user for audit log queries to prevent accidental mutation.

3.6 GDPR compliance controls
GDPR requirement	Implementation
Article 5 — Data minimisation	Collect only fields required for legal service delivery. Document justification for each PII field in a Data Inventory register.
Article 6 — Lawful basis	Track legal basis per data processing activity. For client data: contractual necessity. For marketing: explicit consent with timestamp.
Article 13/14 — Transparency	Privacy notice served at client portal registration. Consent timestamp and version stored against each contact record.
Article 15 — Right of access (DSAR)	DSAR workflow: firm admin can generate a complete data export for any contact in machine-readable JSON within 72 hours.
Article 17 — Right to erasure	Erasure workflow: anonymise PII fields (replace with [DELETED]), retain matter skeleton for legal professional obligations, log erasure in audit trail.
Article 25 — Data protection by design	RLS, field-level encryption, presigned URLs, and role-based access are built into the architecture — not added later.
Article 28 — Data processor	Data Processing Agreement available for each firm. Sub-processors: Stripe (payments), Hetzner (hosting), Resend (email), Twilio (SMS).
Article 30 — Records of processing	ROPA (Records of Processing Activities) report auto-generated from the data inventory register. Accessible to firm admin.
Article 32 — Security measures	TLS 1.3, AES-256 at rest, bcrypt passwords, RLS, MFA, audit logs, automated backups, annual penetration test.
Article 33 — Breach notification	Incident response runbook: detect → contain → assess → notify DPC within 72 hours if high risk. Breach log maintained.


4. Core Data Model
All tables are PostgreSQL. All primary keys are UUID v4. All tables include created_at and updated_at (timestamptz). All tenant-scoped tables include firm_id with an RLS policy. Soft deletes (deleted_at) on all business entities.

Table	Key columns	Relationships & notes
firms	id, name, slug, plan (enum), vat_number, law_society_number, logo_path, settings (jsonb), subscription_status, trial_ends_at	Root tenant table. All other tables reference firm_id. RLS policy: firm_id = current_setting('app.current_firm_id')
users	id, firm_id, email, password, role (enum), full_name, phone, rate_per_hour (decimal), totp_secret (encrypted), is_active, last_login_at	belongs_to firms. Roles: firm_admin, senior_solicitor, solicitor, paralegal, accounts. Email unique per firm.
contacts	id, firm_id, type (individual|company|other_party), name, email, phone, address (jsonb), pps_number (encrypted), dob (encrypted), company_number, gdpr_consent_at, gdpr_consent_version, marketing_consent, conflict_check_cleared_at	belongs_to firms. Duplicate detection on name+email at application layer.
matters	id, firm_id, matter_number, name, description, status (enum), practice_area (enum), fee_arrangement (enum), responsible_user_id, originating_user_id, opened_at, closed_at, custom_fields (jsonb)	belongs_to firms, responsible user, originating user. has_many time_entries, expenses, invoices, documents, tasks, calendar_events, notes.
matter_contacts	matter_id, contact_id, role (client|opposing_party|witness|expert|other)	Pivot table. A matter can have multiple contacts; a contact can appear in multiple matters.
time_entries	id, firm_id, matter_id, user_id, date, duration_minutes, rate (decimal), amount (decimal), billable (bool), billed (bool), invoice_id nullable, activity_type (enum), description, is_locked	belongs_to matter, user. Locked after invoicing — no further edits without admin override logged in audit.
expenses	id, firm_id, matter_id, user_id, date, vendor, amount, vat_amount, category (enum), billable, billed, invoice_id nullable, receipt_path, description	belongs_to matter, user.
invoices	id, firm_id, matter_id, invoice_number, status (enum: draft|sent|partial|paid|written_off), subtotal, vat_amount, vat_rate, total, discount_amount, discount_reason, due_date, sent_at, paid_at, stripe_payment_intent_id, notes	belongs_to matter. has_many invoice_line_items, payments.
invoice_line_items	id, invoice_id, description, quantity, unit_rate, amount, vat_amount, type (time|expense|fixed_fee)	belongs_to invoice.
payments	id, firm_id, invoice_id, amount, method (stripe_card|stripe_sepa|bank_transfer|cash|cheque), stripe_charge_id, paid_at, notes	Append-only. No payment record is ever deleted.
trust_entries	id, firm_id, matter_id, type (receipt|disbursement|transfer), amount, description, date, reference, balance_after	Append-only client account ledger. No update or delete permitted.
documents	id, firm_id, matter_id, uploaded_by_id, name, original_name, s3_key (encrypted), s3_bucket, version, parent_id nullable, mime_type, size_bytes, is_client_visible, is_signed, signed_at, signer_data (jsonb)	Version chain via parent_id. belongs_to matter, uploader.
document_templates	id, firm_id, name, practice_area, content (longtext with merge tags), created_by_id	Firm-level and system-level templates.
tasks	id, firm_id, matter_id, assignee_id, created_by_id, title, description, due_date, priority (enum), status (enum), recurrence_rule, completed_at	belongs_to matter, assignee.
calendar_events	id, firm_id, matter_id nullable, created_by_id, title, type (enum), start_at, end_at, location, video_url, attendees (jsonb), recurrence_rule, reminder_minutes, is_court_date, google_event_id, ms_event_id	belongs_to firm, optional matter.
notes	id, firm_id, matter_id, user_id, body (text), type (note|call_log|email_log|meeting_log), logged_at	Rich-text notes against a matter.
portal_sessions	id, firm_id, matter_id, contact_id, token_hash, expires_at, totp_verified, last_accessed_at	Magic-link portal access. Token hashed — never stored plain.
portal_messages	id, firm_id, matter_id, sender_id, sender_type (user|contact), body (text), read_at	Secure messaging between solicitor and client.
conflict_checks	id, firm_id, matter_id, performed_by_id, search_term, result (clear|conflict_found|reviewed_and_cleared), notes, performed_at	Logged permanently — cannot be deleted.
gdpr_consents	id, firm_id, contact_id, basis (contractual|consent|legitimate_interest), purpose, version, given_at, withdrawn_at	Append-only consent log.
dsars	id, firm_id, contact_id, requested_by_id, status (pending|in_progress|completed), due_at, completed_at, export_path	Data Subject Access Request workflow.
audit_logs	id, firm_id, causer_id nullable, causer_type, subject_id nullable, subject_type, event, old_values (jsonb), new_values (jsonb), ip_address, user_agent, created_at	Append-only. No index on firm_id to prevent accidental scope bypass — query by causer or subject only.


5. Functional Requirements
Each requirement is tagged with a unique ID. All P1 requirements must be complete before any release. P2 before v1.1. P3 on the roadmap.

5.1 Authentication and account management
ID	Requirement	Priority
AUTH-01	Email + password registration with email verification link (24-hour expiry)	P1
AUTH-02	Login with JWT access token (15 min) + rotating refresh token (7 day)	P1
AUTH-03	TOTP two-factor authentication setup, enforcement per firm (admin can mandate 2FA for all users)	P1
AUTH-04	Google Workspace and Microsoft 365 SSO via OAuth 2.0	P1
AUTH-05	Password reset via time-limited email link (1-hour expiry); token hashed in DB	P1
AUTH-06	Account lockout after 10 failed login attempts; unlock via email only	P1
AUTH-07	Active session list: user can view all active tokens and revoke any or all	P1
AUTH-08	Password strength validation: minimum 12 characters; HaveIBeenPwned breach check	P2
AUTH-09	Passwordless login (magic link) for client portal access	P1
AUTH-10	Audit log entry on every login, logout, failed login, and password change	P1

5.2 Firm setup and administration
ID	Requirement	Priority
ADMIN-01	Firm profile: name, logo (stored in S3), address, VAT number, Law Society registration number, time zone, default hourly rate	P1
ADMIN-02	User management: invite by email, assign role, deactivate/reactivate; deactivated users cannot log in but their historical data is retained	P1
ADMIN-03	Practice area configuration: add, edit, rename practice areas; each has custom intake templates and task checklists	P1
ADMIN-04	Custom matter fields per practice area (text, date, number, dropdown, checkbox types)	P2
ADMIN-05	Custom email templates: invoice, payment reminder, intake confirmation, appointment reminder, client portal invite	P1
ADMIN-06	Billing configuration: VAT rate (default 23%), invoice number prefix and sequence, payment terms (default 30 days)	P1
ADMIN-07	Subscription management: view current plan, upgrade/downgrade, download invoices from Stripe	P1
ADMIN-08	Audit log viewer: searchable by user, date range, event type, entity — read only	P1
ADMIN-09	GDPR admin panel: DSAR management, consent log, erasure workflow, ROPA report export	P1
ADMIN-10	Firm data export: full export of all firm data in JSON and CSV format for portability	P2
ADMIN-11	2FA enforcement: firm admin can mandate two-factor authentication for all firm users	P2

5.3 Contact and client management (CRM)
ID	Requirement	Priority
CRM-01	Create and manage contacts: Individual (with PPS number encrypted), Company (with CRO number), or Other Party	P1
CRM-02	Contact fields: name, email(s), phone(s), address(es), DOB (encrypted), ID verification status, source, tags	P1
CRM-03	Duplicate detection: warn on name + email or name + phone match at creation time; user must confirm to proceed	P1
CRM-04	Conflict-of-interest check: search all contacts and matters by name before opening a new matter; log result permanently	P1
CRM-05	Contact timeline: chronological feed of all interactions, matters, documents, and communications	P1
CRM-06	Lead pipeline: Enquiry → Consultation Booked → Engaged → Matter Opened / Declined — Kanban or list view	P1
CRM-07	Online intake form: embeddable iframe for firm's website; submissions create a lead record automatically	P1
CRM-08	Convert lead to matter with one action: pre-populate contact and matter fields from lead data	P1
CRM-09	GDPR consent capture on intake form; consent timestamp stored against contact record	P1
CRM-10	Self-service appointment booking: public URL per solicitor, configurable slots and appointment types	P2
CRM-11	Appointment booking: optional upfront consultation fee payment via Stripe before booking is confirmed	P2
CRM-12	Automated email and SMS reminders for booked appointments (24 hours and 1 hour before)	P2
CRM-13	Email marketing: send targeted emails to tagged contacts; unsubscribe link mandatory; consent check before send	P3

5.4 Matter management
ID	Requirement	Priority
MAT-01	Create matter: matter number (auto-generated, customisable prefix), name, practice area, status, responsible solicitor, originating solicitor, client(s), fee arrangement, court details, description	P1
MAT-02	Matter statuses (firm-configurable): Open, Pending Court Date, Awaiting Client, Awaiting Opponent, On Hold, Closed, Archived	P1
MAT-03	Matter overview tab: financial summary bar (total billed, collected, outstanding, unbilled time value, trust balance), open tasks count, next deadline, recent documents, recent activity	P1
MAT-04	Matter activity timeline: all actions (notes, emails, calls, documents uploaded, time entries, status changes) in reverse-chronological order with actor and timestamp	P1
MAT-05	Relate matters: link matters together (e.g. related family law matters for same client)	P2
MAT-06	Custom fields per matter, defined per practice area by firm admin	P2
MAT-07	Matter closure checklist: warn if open tasks, unbilled time, or trust balance before closing	P1
MAT-08	Archive closed matters; archived matters are read-only but fully searchable	P1
MAT-09	Matter notes: rich-text notes with author and timestamp; note types: Note, Phone Call, Email, Meeting	P1
MAT-10	Email-to-matter: each matter has a unique inbound email address; emails sent to it are automatically logged on the matter timeline	P2
MAT-11	Practice areas: Conveyancing, Family Law, Litigation, Employment, Wills and Probate, Corporate, Immigration, Criminal, Personal Injury, and Custom — configurable by firm admin	P1

5.5 Time recording
ID	Requirement	Priority
TIME-01	Manual time entry: date, matter, duration (HH:MM), activity type, rate (pre-filled from user rate), billable flag, description	P1
TIME-02	Timekeeper: persistent live timer in the top navigation bar; start, pause, and stop from any page	P1
TIME-03	Multiple concurrent timers: one active timer per matter, displayed as a list; switch between without losing time	P1
TIME-04	Timer auto-creates a time entry draft on stop; user reviews and saves	P1
TIME-05	Activity types (configurable): Advising, Drafting, Research, Court Attendance, Travel, Telephone, Correspondence, Meeting, Other	P1
TIME-06	Bulk edit time entries: change matter, date, billable status, or activity type on multiple entries simultaneously	P2
TIME-07	Time entry locking: entries are locked once included in a sent invoice; admin override with audit trail	P1
TIME-08	Daily and weekly timesheet view: hours recorded per solicitor per day, with billable vs non-billable split	P1
TIME-09	Time rounding: optional auto-round to nearest 6, 10, or 15 minutes — configurable per firm	P2
TIME-10	Mobile time entry: fully functional time recording on PWA (iOS and Android)	P1

5.6 Expense recording
ID	Requirement	Priority
EXP-01	Log expense: date, matter, vendor, amount, VAT amount (23% auto-calculated, editable), category, billable flag, description	P1
EXP-02	Expense categories (configurable): Court Fees, Counsel Fees, Travel, Disbursement, Stamp Duty, Search Fees, Translation, Other	P1
EXP-03	Receipt upload: attach PDF or image to an expense entry; stored in S3, linked to matter document library	P1
EXP-04	Expenses auto-populate into billing when generating an invoice	P1
EXP-05	Bulk mark expenses as non-billable or change matter	P2

5.7 Legal billing and invoicing
ID	Requirement	Priority
BILL-01	Generate invoice from unbilled time entries and expenses on a matter; select individual items to include	P1
BILL-02	Invoice contains: firm header (logo, name, address, VAT number), client details, itemised time and expenses, subtotal, VAT (rate configurable), total, payment terms, bank details, payment link	P1
BILL-03	Invoice number: sequential, firm-configurable prefix (e.g. INV-2026-0001)	P1
BILL-04	Invoice statuses: Draft → Sent → Partially Paid → Paid → Written Off	P1
BILL-05	Apply discount to invoice: flat amount or percentage; reason required for audit	P1
BILL-06	Write off invoice or partial balance: reason mandatory, recorded in audit log	P1
BILL-07	Invoice PDF: professional layout generated by DomPDF; compliant with Irish Revenue requirements	P1
BILL-08	Send invoice by email: PDF attached, Pay Now link included, sent from firm's connected email address	P1
BILL-09	Online payment: Stripe card (Visa, Mastercard) and Stripe SEPA Direct Debit for EUR payments	P1
BILL-10	Client portal invoice payment: client pays directly from portal without needing a login beyond magic link	P1
BILL-11	Automated payment reminders: configurable schedule (e.g. 7, 14, 30 days overdue); firm admin sets schedule	P1
BILL-12	Payment reconciliation: Stripe webhook auto-marks invoice as paid; manual mark-as-paid for bank transfers	P1
BILL-13	Recurring invoices: set a schedule (monthly, quarterly) to auto-generate draft invoices for retainer clients	P2
BILL-14	Credit notes: generate credit note against a paid invoice; credited amount reduces next invoice or is refunded	P2
BILL-15	Fee arrangements: Hourly Rate, Fixed Fee, Contingency, Retainer (all configurable per matter)	P1

5.8 Trust / client account ledger
ID	Requirement	Priority
TRUST-01	Dedicated client account ledger per matter, completely separate from office account	P1
TRUST-02	Record client account receipts, disbursements, and transfers to office account	P1
TRUST-03	Running balance displayed after each entry; balance cannot go negative (warning enforced)	P1
TRUST-04	Three-way reconciliation report: matter ledger vs. bank statement vs. client account control — required by SAR 2014	P1
TRUST-05	Consolidated trust statement: all matters for the firm, total funds held in client account	P1
TRUST-06	Trust entries are append-only: no entry can be edited or deleted after saving; corrections via reversing entry only	P1
TRUST-07	Trust ledger compliant with Solicitors Accounts Regulations 2014 (Ireland)	P1

5.9 Document management
ID	Requirement	Priority
DOC-01	Upload documents to a matter: any file type, max 100MB per file, stored in private S3	P1
DOC-02	Default folder structure per matter: Correspondence, Pleadings, Agreements, Evidence, Court Orders, Client Documents; firm can add custom folders	P1
DOC-03	Version control: uploading a file with the same name creates a new version; all versions accessible and downloadable	P1
DOC-04	In-browser preview: PDF and images rendered inline; DOCX converted to PDF for preview	P1
DOC-05	Full-text search across all documents in a firm (Meilisearch index updated asynchronously)	P1
DOC-06	Bulk download as ZIP	P2
DOC-07	Document templates with merge fields: {{client_name}}, {{matter_number}}, {{solicitor_name}}, {{today_date}}, {{firm_name}}, and all custom matter fields	P1
DOC-08	Generate document from template: one-click generation with auto-populated merge fields; result saved to matter	P1
DOC-09	System template library: starter templates per practice area (Conveyancing, Family Law, etc.)	P2
DOC-10	Send document for e-signature: add signatories (internal and external), send via DocuSeal	P1
DOC-11	Signatory receives email with secure link; signs via draw, type, or image upload in browser	P1
DOC-12	Signed PDF includes audit trail (signer name, timestamp, IP) embedded by DocuSeal	P1
DOC-13	Completion webhook: signed document auto-saved back to matter document library	P1
DOC-14	Client-visible flag per document: solicitor controls which documents appear in client portal	P1

5.10 Calendar and tasks
ID	Requirement	Priority
CAL-01	Calendar views: Day, Week, Month, Agenda; colour-coded by event type	P1
CAL-02	Create event: title, date/time, duration, location or video link, matter (optional), attendees (internal and external), recurrence rule	P1
CAL-03	Event types: Appointment, Court Date, Deadline, File Review, Consultation, Other	P1
CAL-04	Court Diary: dedicated view of all court date events across all matters	P1
CAL-05	Two-way sync: Google Calendar and Microsoft Outlook/Exchange — events created in SimpleLaw appear in external calendar and vice versa	P1
CAL-06	Configurable reminders per event: in-app notification and email, at user-defined intervals (e.g. 1 day before, 1 hour before)	P1
CAL-07	Firm-wide calendar view for firm admin: all solicitors' calendars overlaid with colour coding	P2
TASK-01	Create task: title, description, due date, priority (High/Medium/Low), assignee, matter association	P1
TASK-02	Task checklist templates per practice area: apply a template to a matter to auto-create all standard tasks	P1
TASK-03	Task views: Kanban board (To Do / In Progress / Review / Done) and filterable list view	P1
TASK-04	Recurring tasks with configurable frequency (daily, weekly, monthly, custom)	P2
TASK-05	Overdue task: badge count in navigation; daily email digest of overdue tasks to assignee	P1

5.11 Secure client portal
ID	Requirement	Priority
PORTAL-01	Activate client portal per matter: solicitor sends invite to client email; no account creation required	P1
PORTAL-02	Client authentication via magic link (email OTP); optional TOTP 2FA for returning clients	P1
PORTAL-03	Portal features: matter status display, shared documents (solicitor-controlled), invoice view and payment, secure messaging, appointment booking	P1
PORTAL-04	Secure messaging: threaded conversation between solicitor and client, logged to matter timeline	P1
PORTAL-05	Client document upload: client uploads ID, proof of address, or other documents via portal; solicitor receives notification	P1
PORTAL-06	Invoice payment from portal: Stripe card and SEPA, no login required beyond magic link	P1
PORTAL-07	Portal branding: firm name and logo displayed; no SimpleLaw branding visible to client (white-label)	P1
PORTAL-08	Portal fully mobile-responsive: functions on iOS and Android without app installation	P1
PORTAL-09	Portal session expires after 30 minutes of inactivity; client prompted to re-authenticate	P1
PORTAL-10	All portal actions logged in audit trail: documents viewed, downloaded, messages sent	P1

5.12 Reporting and dashboards
ID	Requirement	Priority
RPT-01	Firm dashboard: KPIs — hours recorded today/week/month, hours billed, collection rate, outstanding invoice total, trust balance, open matters count	P1
RPT-02	Revenue by solicitor, by practice area, by month — bar and line charts	P1
RPT-03	Aged Debtors Report: invoices outstanding grouped by 0–30, 31–60, 61–90, 90+ days	P1
RPT-04	Time recording report: all time entries by date range, solicitor, matter, activity type; exportable CSV/Excel	P1
RPT-05	Realisation rate: billed hours vs. worked hours per solicitor and per matter	P2
RPT-06	Matter profitability: revenue vs. write-offs per matter	P2
RPT-07	VAT report: VAT collected per period, formatted for Irish Revenue (ROS) filing	P1
RPT-08	Trust account statement: per matter and consolidated across all matters	P1
RPT-09	Client intake analytics: lead source breakdown, conversion rate by practice area	P2
RPT-10	Export any report to PDF, CSV, or Excel via Laravel Excel	P1
RPT-11	Scheduled reports: firm admin configures weekly or monthly email delivery of selected reports	P3

5.13 Integrations
Integration	Direction	Priority	Notes
Stripe	Outbound	P1	Card + SEPA payments; subscription billing via Cashier; webhook reconciliation
Google Calendar	Two-way	P1	OAuth 2.0; sync events; Socialite for auth
Microsoft Outlook / Exchange	Two-way	P1	MS Graph API; sync events; Socialite for auth
Gmail / Google Workspace	Outbound send	P1	Send client emails from firm's Gmail; OAuth
Microsoft 365 Mail	Outbound send	P1	Send from Outlook address; MS Graph API
Xero	Two-way	P1	Invoice + payment sync; chart of accounts mapping
QuickBooks Online	Two-way	P2	Invoice + payment sync
DocuSeal	API	P1	EU-hosted self-deployable e-signature; webhook on completion
Twilio	Outbound	P2	SMS appointment reminders and OTP; Irish numbers (+353)
Resend / Postmark	Outbound	P1	Transactional email; React Email templates
Zoom / Microsoft Teams	Outbound	P2	Auto-generate video links for calendar events
Klyant	Two-way	P2	Irish legal accounts software; client account sync
CRO (Companies Registration Office)	Inbound	P3	Auto-fill company contact data from company number
Meilisearch	Internal	P1	Self-hosted on same VPS; full-text search


6. Non-Functional Requirements

ID	Category	Requirement
NFR-01	Performance	Largest Contentful Paint (LCP) < 2.5 seconds on 4G. API response time p95 < 200ms for all read operations. Achieved via Laravel Octane, OPcache, Redis response caching, and PostgreSQL query optimisation.
NFR-02	Performance	Invoice PDF generation < 3 seconds. Report generation for datasets up to 12 months < 5 seconds. Larger reports queued via Laravel Horizon.
NFR-03	Scalability	Support 50 concurrent solicitor sessions on a single Hetzner CX31 VPS (4 vCPU, 8GB RAM). Scale vertically to CX41 (8 vCPU, 16GB) before horizontal scaling.
NFR-04	Availability	99.9% uptime SLA (< 8.7 hours downtime per year). Maintenance windows outside 08:00–20:00 IST Monday to Friday. Monitored by Better Uptime with 1-minute check interval.
NFR-05	Security	TLS 1.3 only. HSTS with 1-year max-age. Content Security Policy blocking inline scripts. X-Frame-Options: DENY. X-Content-Type-Options: nosniff.
NFR-06	Security	OWASP Top 10 penetration test completed before public launch. Annual pen test thereafter. All Critical and High findings remediated before release.
NFR-07	Security	Dependency audit: composer audit and npm audit run in CI/CD pipeline. Any known vulnerability blocks deployment.
NFR-08	Data	PostgreSQL PITR (Point-in-Time Recovery) enabled. Daily full backup. Backup restore tested monthly. Recovery Time Objective (RTO): 4 hours. Recovery Point Objective (RPO): 24 hours.
NFR-09	GDPR	All data stored in EU (Hetzner Frankfurt or DigitalOcean Amsterdam). No data transferred outside EU without explicit GDPR transfer mechanism.
NFR-10	Accessibility	WCAG 2.1 Level AA. Full keyboard navigation. ARIA labels on all interactive elements. Screen reader tested with NVDA and VoiceOver.
NFR-11	Browser support	Chrome, Firefox, Safari, Edge — latest 2 major versions. No Internet Explorer support.
NFR-12	Mobile	Full PWA functionality. Installable on iOS 16+ and Android 12+. Offline read access for matter summary and last-viewed documents.
NFR-13	Localisation	Primary locale: en-IE. Currency: EUR. Date format: DD/MM/YYYY. VAT rate: 23% default. Week starts Monday.
NFR-14	Code quality	Laravel Pint (PSR-12 code style) enforced in CI. PHPStan level 6 static analysis. ESLint + Prettier for TypeScript. No merge to main with failing checks.
NFR-15	Test coverage	PHP unit + feature test coverage >= 80%. All critical paths (auth, billing, trust ledger, GDPR) >= 95%. Playwright E2E tests for 5 key user flows. Cross-tenant isolation automated test suite.


7. Application Architecture
7.1 Request lifecycle with Inertia.js
Understanding this is critical for all developers. There is no REST API. There is no separate frontend server making API calls.
    • The browser makes a standard HTTP request to a Laravel route.
    • Laravel middleware runs: tenant resolution → authentication → authorisation → rate limiting.
    • The Laravel controller fetches data, runs business logic, and returns an Inertia response: return Inertia::render('Matters/Show', ['matter' => $matter]).
    • On the first page load, Inertia returns a full HTML page with the React component hydrated. On subsequent navigations, it returns a JSON payload with only the new component name and props.
    • React renders the component client-side. No separate API endpoint exists. No JWT is sent in a header to a separate backend.
    • Form submissions use Inertia's useForm hook, which sends a standard form POST to a Laravel route — fully CSRF-protected automatically.
Security implication: because there is no public API, there is no API authentication attack surface. All requests go through Laravel's full middleware stack. This is the primary security advantage of Inertia over a decoupled frontend.

7.2 Project folder structure
Path	Purpose
app/Http/Controllers/	Laravel controllers — one per resource (MatterController, InvoiceController, etc.)
app/Http/Middleware/	Custom middleware: SetTenant, EnsureFirmSetupComplete, RequiresTwoFactor
app/Models/	Eloquent models with RLS scopes, encrypted casts, and audit log traits
app/Policies/	RBAC policies — one per model. Every controller action calls $this->authorize()
app/Actions/	Single-responsibility action classes (CreateMatter, GenerateInvoicePdf, SendPortalInvite)
app/Services/	Business logic services (BillingService, TrustLedgerService, GdprService)
app/Jobs/	Queued jobs (SendInvoiceEmail, SyncCalendarEvent, GenerateReport, ProcessDocuSealWebhook)
app/Events/ + app/Listeners/	Laravel events for decoupled side effects (MatterClosed, InvoicePaid, DocumentSigned)
database/migrations/	Schema migrations — one file per change, never edited after running in production
database/seeders/	Demo data seeders for development and staging environments only
resources/js/Pages/	React page components — rendered by Inertia (Matters/Index, Matters/Show, etc.)
resources/js/Components/	Reusable React components (DataTable, MoneyInput, StatusBadge, TimerWidget)
resources/js/Layouts/	App layout (AppLayout.tsx), Auth layout (AuthLayout.tsx), Portal layout
resources/js/hooks/	Custom React hooks (useTimer, useMatter, useForm extensions)
resources/js/types/	TypeScript type definitions (generated from Laravel models via Ziggy + custom types)
routes/web.php	All application routes — Inertia returns, no JSON routes here
routes/webhooks.php	Stripe and DocuSeal webhook routes — excluded from CSRF middleware, verified by signature
tests/Unit/	Unit tests for Services, Actions, and model methods
tests/Feature/	Feature tests for controller endpoints (HTTP request → response assertions)
tests/Feature/Security/	Cross-tenant isolation tests — mandatory test suite
tests/Browser/	Playwright E2E tests for key user flows
config/	Laravel configuration: sanctum.php, multitenancy.php, permission.php, activitylog.php
.github/workflows/	CI/CD: test.yml (run on PR), deploy.yml (run on merge to main)

7.3 Key architectural patterns — mandatory
    • Action classes: all business operations are encapsulated in single-responsibility Action classes in app/Actions/. Controllers call actions, not services directly. This keeps controllers thin and actions testable in isolation.
    • Form Requests: all input validation is in dedicated FormRequest classes (app/Http/Requests/). Controllers never validate input inline.
    • Repository pattern: not required — Eloquent models with local scopes are sufficient. Do not add unnecessary abstraction layers.
    • Event-driven side effects: when an invoice is paid, fire an InvoicePaid event. Listeners handle: updating matter balance, sending receipt, logging to audit trail. This keeps the core action clean.
    • Queued everything slow: PDF generation, email sending, calendar sync, document indexing, report generation — all queued via Laravel Horizon. No request should ever block on an external service call.
    • No business logic in controllers or React components: controllers orchestrate, actions execute, React displays.


8. UI/UX Requirements
8.1 Navigation structure
    • Left sidebar (collapsible to icon-only mode): Dashboard, Matters, Clients, Calendar, Time, Billing, Documents, Reports, Settings.
    • Top bar (persistent): Active timer counter with matter name, notifications bell (unread count badge), global search trigger (Cmd+K / Ctrl+K), quick-add (+) button, user avatar menu.
    • Quick-add (+) opens a modal: New Matter, New Contact, New Time Entry, New Task, New Event — accessible from every page.
    • Global search (Cmd+K): unified search across matters, contacts, and documents — results grouped by type, powered by Meilisearch.
    • Breadcrumb trail on all nested pages (e.g. Matters / Smith vs Jones / Documents).
8.2 Matter page tab layout
Tab	Contents
Overview	Financial summary bar, open task count, next deadline, recent activity feed, matter details card
Time and Expenses	Time entry list, expense list, unbilled totals, Add Time and Add Expense buttons
Documents	Folder tree, document list with version badges, Upload and Generate buttons
Tasks	Kanban board and list toggle, task cards with priority colour coding
Calendar	Matter-specific event list and mini calendar
Billing	Invoice list, Draft Invoice button, payment status badges
Portal	Portal status, invite client button, portal message thread
Notes	Chronological note list, Add Note dropdown (Note / Call / Email / Meeting)
Activity	Full immutable audit timeline for this matter
8.3 Design system
Element	Specification
Primary colour	Navy #1B3F6E — navigation, primary buttons, headings
Accent colour	Teal #0F6E56 — success states, active timers, positive values
Danger colour	Red #C0392B — overdue tasks, negative balances, destructive actions
Warning colour	Amber #D4850A — pending items, approaching deadlines
Background	White #FFFFFF primary surface; Light grey #F4F7FC secondary surface
Typography	Inter or Geist Sans; base 14px body; 12px labels; 20px section headings; 28px page titles
Border radius	6px cards and inputs; 4px badges; 12px modals
Dark mode	Supported — CSS prefers-color-scheme via Tailwind dark: variants; respect system preference
Responsive breakpoints	Mobile < 768px; Tablet 768–1279px; Desktop >= 1280px
Accessibility	WCAG 2.1 AA; minimum 4.5:1 contrast ratio for all text; focus rings on all interactive elements
8.4 Critical user flows — target completion times
Flow	Steps	Target time
Log time entry	Click timer icon → select matter → start timer → stop → review → save	< 20 seconds
Open new matter	Click + → New Matter → select/create client → fill details → save	< 90 seconds
Send invoice	Matter → Billing tab → select unbilled items → Generate → Preview → Send	< 3 minutes
Client intake	Share intake URL → client submits form → lead appears in CRM → conflict check → Convert to Matter	< 5 minutes (solicitor steps only)
Upload and send for e-signature	Upload document → Request Signature → add signatories → send → client signs	< 4 minutes


9. Implementation Phases
Phases are sequential. No phase begins until the previous phase passes all automated tests and a security review. Each phase ends with a demo to the project lead.

Phase	Deliverables	Requirements covered	Duration
Phase 1 Foundation	Laravel project setup, PostgreSQL with RLS, Redis, multi-tenancy scaffold, RBAC with Spatie, authentication (email+password, 2FA, SSO), audit logging, firm setup, user management, Inertia.js + React + Tailwind baseline, CI/CD pipeline, automated cross-tenant security tests	AUTH-01–10, ADMIN-01–03, ADMIN-06–08, NFR-14, NFR-15 (security suite)	4–5 weeks
Phase 2 Core workflow	Matter CRUD, contact CRM, conflict-of-interest check, time recording with Timekeeper, expense recording, manual time entry, matter notes and activity timeline, basic dashboard KPIs	MAT-01–09, CRM-01–06, TIME-01–10, EXP-01–05, RPT-01	4–5 weeks
Phase 3 Billing and trust	Invoice generation, PDF export (DomPDF), Stripe card and SEPA payments, Stripe webhooks, trust/client account ledger, SAR 2014 reconciliation report, automated payment reminders, aged debtors report, VAT report	BILL-01–12, TRUST-01–07, RPT-03, RPT-07–08	4–5 weeks
Phase 4 Documents and portal	Document upload to S3, folder structure, version control, in-browser preview, document templates with merge fields, e-signatures via DocuSeal, client portal (magic link auth, document sharing, invoice payment, secure messaging)	DOC-01–14, PORTAL-01–10	4–5 weeks
Phase 5 Calendar and integrations	Calendar (Day/Week/Month/Agenda), tasks and Kanban, court diary, Google Calendar two-way sync, Outlook two-way sync, Gmail and Outlook send integration, Xero accounting sync, Stripe subscription management	CAL-01–07, TASK-01–05, Integrations P1	4–5 weeks
Phase 6 Growth and reporting	Online intake form (embeddable), lead pipeline CRM, appointment booking, full reporting suite, Excel/CSV exports, full-text search (Meilisearch), GDPR admin panel (DSAR, erasure, ROPA, consent log), Laravel Octane performance tuning	CRM-07–12, RPT-02, RPT-04–10, ADMIN-09, NFR-01–02	3–4 weeks
Phase 7 Hardening and launch	OWASP penetration test, remediation of all findings, load testing (200 concurrent users), backup restore drill, WCAG 2.1 AA accessibility audit, browser compatibility testing, performance profiling, production deployment runbook, staff training	NFR-05–15 (all)	3–4 weeks


10. Developer Security Checklist
Every developer on this project must complete the following checklist for each feature module before it is considered done. This is not optional.

10.1 Every controller method must:
    1. Call $this->authorize() or Gate::authorize() with the relevant Policy method — no exceptions
    2. Use a dedicated FormRequest class for input validation — no inline validation
    3. Return an Inertia response — never a raw JSON response (webhooks excepted)
    4. Trigger the appropriate audit log entry via spatie/laravel-activitylog
    5. Have a corresponding Feature test asserting both authorised and unauthorised access
10.2 Every Eloquent model must:
    6. Use the HasTenantScoping trait from spatie/laravel-multitenancy — never access cross-tenant data
    7. Use the LogsActivity trait for all business models — define $logAttributes for changed fields
    8. Declare encrypted casts for any PII fields: PPS numbers, dates of birth, bank account details
    9. Use UUIDs as primary keys — never auto-incrementing integers (prevents enumeration attacks)
    10. Include SoftDeletes — never hard-delete business data
10.3 Every database migration must:
    11. Include firm_id with NOT NULL constraint and foreign key on all tenant-scoped tables
    12. Enable RLS on the table and define the policy: CREATE POLICY firm_isolation ON table_name USING (firm_id = current_setting('app.current_firm_id')::uuid)
    13. Add appropriate indexes: firm_id on all tables; (firm_id, status) on high-query tables like matters and invoices
    14. Never drop or modify a column without a data migration plan — add new columns, migrate data, then drop old
10.4 Every file upload must:
    15. Be stored in a private S3 bucket — never in the public directory
    16. Be accessed via a presigned URL with a maximum 1-hour expiry
    17. Have its MIME type validated server-side (not just by extension)
    18. Have its size validated against plan limits before upload
    19. Log the upload event in the audit trail with user, matter, and file name
10.5 Before every merge to main:
    20. All PHPUnit feature and unit tests pass (composer test)
    21. PHPStan level 6 passes with no errors (composer analyse)
    22. Laravel Pint code style passes (composer pint --test)
    23. ESLint and TypeScript type checking pass (npm run lint && npm run typecheck)
    24. composer audit and npm audit show no known vulnerabilities
    25. Cross-tenant security test suite passes (php artisan test --group=security)




12. Acceptance Criteria
The application is considered production-ready only when all of the following are verified and signed off by the project lead:

12.1 Functional acceptance
    • All P1 functional requirements implemented and verified via manual QA walkthrough.
    • All 5 critical user flows (Section 8.4) completed by a non-technical test user in under the specified target time.
    • Invoice PDF verified by an Irish accountant as compliant with Revenue requirements.
    • Trust ledger three-way reconciliation verified against a sample bank statement.
    • Client portal tested on iOS Safari, Android Chrome, and desktop Chrome — all features functional.
    • GDPR erasure workflow tested: contact PII anonymised, audit trail preserved, matter skeleton retained.
12.2 Security acceptance
    • OWASP ZAP scan: zero Critical, zero High vulnerabilities.
    • Cross-tenant isolation test suite: 100% pass rate across all endpoints.
    • Penetration test report reviewed; all Critical and High findings remediated and re-tested.
    • Two-factor authentication tested on Google Authenticator (iOS and Android).
    • All presigned document URLs expire correctly after 1 hour — verified by automated test.
    • Audit log verified append-only: database user used by application has no UPDATE or DELETE on activity_log table.
12.3 Performance acceptance
    • Lighthouse score: Performance >= 85, Accessibility >= 90, Best Practices >= 95 on Matter overview page.
    • Load test: 50 concurrent users, all API responses p95 < 300ms, no 5xx errors.
    • Invoice PDF generation: < 3 seconds for standard invoice, verified on production server.
    • Full-text document search: results returned in < 500ms for a firm with 10,000 documents.
12.4 Code quality acceptance
    • PHP test coverage >= 80% overall; >= 95% on billing, trust ledger, and authentication modules.
    • PHPStan level 6 passes with zero errors.
    • No secrets, API keys, or credentials committed to the repository (verified by git-secrets scan).
    • All environment variables documented in .env.example with descriptions.
    • README.md contains: local development setup, deployment instructions, and runbook for common operations.


