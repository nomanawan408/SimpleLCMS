# SimpleLaw Case Management System | Software Requirements Specification | v3.0 — Modernized for Laravel 13

## 1. Introduction

### 1.1 Purpose
This document serves as the authoritative Software Requirements Specification (SRS) for **SimpleLaw**, a secure, GDPR-compliant, cloud-based legal case management system designed for Irish law firms. This version (v3.0) updates the technical architecture to **Laravel 13**, focusing on security, scalability, and long-term maintainability.

### 1.2 Scope
SimpleLaw provides a comprehensive suite of tools for legal practice management, including:
*   **Matter Management:** Full lifecycle from intake to closure.
*   **CRM & Conflict Checking:** Robust client management and legal compliance.
*   **Time & Billing:** Precise time recording and SAR 2014 compliant billing.
*   **Trust Accounting:** Legal-grade ledger management for client funds.
*   **Document Management:** Secure storage, versioning, and e-signatures.
*   **AI-Powered Workflows:** Leveraging Laravel 13's AI SDK for document summarization and drafting.

---

## 2. Modernized Technology Stack (Laravel 13)

To ensure the application remains at the cutting edge of performance and security, the following stack is mandated.

| Layer | Technology | Version | Reason for Choice |
| :--- | :--- | :--- | :--- |
| **Language** | PHP | 8.3+ | Required for Laravel 13; performance and type-safety. |
| **Framework** | Laravel | 13.x | Latest stable; AI SDK, JSON:API, and enhanced security. |
| **Frontend Bridge** | Inertia.js | v2.x | Single-page app feel with server-side routing. |
| **Frontend** | React | 18.x / 19 | Type-safe UI with TypeScript and modern hooks. |
| **UI Components** | shadcn/ui | Latest | Accessible, customizable, and professionally styled. |
| **Database** | PostgreSQL | 16+ | Native Row-Level Security (RLS) for multi-tenancy. |
| **Cache/Queue** | Redis | 7.x | High-performance session and background job handling. |
| **Runtime** | Laravel Octane | FrankenPHP | Extreme performance with persistent memory. |
| **AI Engine** | Laravel AI SDK | Built-in | Native integration for LLM-driven legal features. |

---

## 3. Enhanced Security Architecture

Security is the core pillar of SimpleLaw. The following controls are non-negotiable.

### 3.1 Authentication & Authorization
*   **Identity Management:** Use **Laravel's new Starter Kits** with **WorkOS AuthKit** integration for enterprise-grade SSO (Google Workspace, Microsoft 365) and Passkey support.
*   **Attribute-Based Access Control (ABAC):** Leverage Laravel 13's `#[Authorize]` and `#[Middleware]` attributes for declarative, collocated authorization logic.
*   **Request Forgery Protection:** Implementation of the formalized `PreventRequestForgery` middleware for origin-aware verification.

### 3.2 Data Isolation (Multi-Tenancy)
*   **RLS Enforcement:** Every tenant-scoped table must utilize PostgreSQL Row-Level Security.
*   **Tenant Scoping:** Use `spatie/laravel-multitenancy` to automate `firm_id` scoping across all Eloquent queries.
*   **Cross-Tenant Verification:** Automated test suites must explicitly attempt cross-tenant data access to ensure 403 Forbidden responses.

### 3.3 Data Encryption
*   **At-Rest:** AES-256 encryption for sensitive PII (PPS numbers, DOB) using Laravel's Encrypted Casts.
*   **In-Transit:** TLS 1.3 only; HSTS enabled with a 1-year max-age.
*   **Backups:** Encrypted S3-compatible backups via `spatie/laravel-backup`.

---

## 4. Scalability & Performance Strategy

### 4.1 High-Performance Runtime
*   **FrankenPHP:** Deploy via Laravel Octane on FrankenPHP to benefit from worker modes, significantly reducing request latency.
*   **Queue Routing:** Utilize Laravel 13's `Queue::route(...)` for centralized job distribution across specialized Redis queues (e.g., `high-priority`, `document-processing`).

### 4.2 Database Optimization
*   **JSONB for Flexibility:** Use PostgreSQL `JSONB` for custom matter fields to maintain performance while allowing firm-level schema flexibility.
*   **Cache Touch:** Use `Cache::touch()` to extend TTL for frequently accessed matter data without re-fetching from the database.

### 4.3 Scalable Architecture
*   **Stateless Web Tier:** Ensure all sessions and file uploads are stored in Redis and S3 respectively, allowing horizontal scaling of web servers.
*   **Meilisearch:** Dedicated search cluster for sub-second full-text search across millions of legal records.

---

## 5. Maintainability & Long-Term Reliability

### 5.1 Code Standards
*   **Strict Typing:** Mandatory TypeScript for frontend and strict types for PHP 8.3.
*   **JSON:API Compliance:** Use Laravel 13's first-party JSON:API resources for any external-facing endpoints to ensure a standardized, predictable API.
*   **Declarative Logic:** Prefer PHP Attributes (`#[Tries]`, `#[Backoff]`) for queue job configuration to keep logic close to the implementation.

### 5.2 Observability
*   **Sentry (EU):** Real-time error tracking with source maps.
*   **Laravel Pulse:** Real-time monitoring of application health, slow routes, and heavy jobs.
*   **Audit Logging:** Immutable, append-only logs using `spatie/laravel-activitylog` with a 7-year retention policy.

---

## 6. Functional Requirements (Updated)

| ID | Requirement | Priority | Laravel 13 Enhancement |
| :--- | :--- | :--- | :--- |
| **AUTH-01** | Enterprise SSO | P1 | Integrated via WorkOS AuthKit for seamless firm onboarding. |
| **MAT-AI-01** | Matter Summarization | P2 | Use Laravel AI SDK to generate summaries of long case histories. |
| **DOC-AI-01** | Legal Drafting | P2 | AI-assisted drafting of standard letters using firm templates. |
| **BILL-01** | Smart Billing | P1 | Automated time entry classification using AI to suggest activity types. |
| **GDPR-01** | Right to Erasure | P1 | Automated workflow to anonymize PII while preserving matter skeletons. |

---

## 7. GDPR & Compliance

SimpleLaw is designed for the Irish jurisdiction.
*   **Data Residency:** Mandatory hosting on EU-based infrastructure (Hetzner Frankfurt / DigitalOcean AMS3).
*   **SAR 2014:** Trust ledger logic is immutable; no edits allowed, only reversing entries.
*   **DSAR Workflow:** One-click generation of machine-readable JSON exports for data subjects.

---
**Document Status:** v3.0 Approved for Development
**Date:** March 2026
