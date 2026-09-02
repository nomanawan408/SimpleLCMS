# AGENTS.md — simpleLawyer

## Stack (verify via manifests, not prose)
- **Backend:** Laravel `^13.0` PHP `^8.3` (`composer.json:8`), Inertia `*` + Ziggy `*`, Sanctum, Scout/Meilisearch, Horizon/Reverb/Octane, DomPDF `^3.0`, `spatie/permission+activitylog+multitenancy+medialibrary+csp+health`, `pragmarx/google2fa ^8.0`
- **Frontend:** React `18.3` + `@inertiajs/react ^2.0` (`package.json:14`), TS `5.8` `strict:true` (`tsconfig.json:14`), Vite `5.4` + `laravel-vite-plugin` (`vite.config.js:8`), Tailwind `3.4` + `tailwindcss-animate`, Radix + shadcn, `cmdk`, `zod`+`react-hook-form`
- **Entrypoints:** `resources/js/app.tsx:1` + `resources/css/app.css:1` → `vite.config.js:9` alias `@` → `resources/js/*` (`tsconfig.json:20`, `vite.config.js:15`)

## Commands (exact, non-obvious)
```bash
composer setup          # install + copy .env.example + key:generate + migrate + npm install + build (composer.json:50)
composer dev            # concurrently: serve + queue:listen + pail + vite (composer.json:58) — needs all 4
composer test           # config:clear + php artisan test (composer.json:62) — NOT phpunit directly
php artisan test --parallel            # CI uses this (ci-cd.yml:95)
php artisan test --filter=InvoiceTest  # single file
php artisan test tests/Feature/SecurityRegressionTest.php
php -l app/Http/Controllers/InvoiceController.php  # verify PHP after edits (required by reviewer prompt)
npm run build           # vite build — only when frontend touched; builds to public/build/ (manifest.json)
npm run typecheck       # tsc --noEmit (tsconfig noUnusedLocals false)
npm run lint            # eslint resources/js --ext .ts,.tsx (package.json:9)
```
> No `npm` in some shells — check `node -v` first. Do not run `npm run build` on every change.

## Architecture
- **Monolith, no API:** `routes/web.php` (247 lines) is the only app router; `routes/webhooks.php:5` empty stub (Stripe/DocuSeal placeholder), `routes/console.php:12` schedules `app:send-deadline-notifications` daily 07:00 — requires `schedule:run` cron.
- **Middleware stack `bootstrap/app.php:16`:** `SecurityHeaders` + `HandleInertiaRequests` + `AddLinkHeadersForPreloadedAssets` globally; aliases `set.tenant`, `requires.two.factor`, `firm.setup`, `redirect.super.admin`, `role`/`permission` (Spatie). Route groups: guest → `firm/setup/{token}` throttle `10,1` → `auth`+`requires.two.factor`+`set.tenant` → `admin` `can:admin-panel` → `superadmin` `role:super_admin` (`routes/web.php:46-247`).
- **Models `app/Models/` (17, all `HasUuids`):** `Firm` generates `nextInvoiceNumber()` `{prefix}-{YYYY}-{0000}` (`Firm.php:65`), `Matter` 16 statuses (`Matter.php:30`), `TimeSession` live timers, `Invoice`/`Payment`/`TrustEntry` append-only. Most use trait `BelongsToFirm`.
- **Docs are stale:** `README.md:1` is stock Laravel; authoritative spec is `software requirments.md v2.0` (Laravel 11 claim) vs `tech req.md v3.0` (Laravel 13) vs `composer.json:14` (`^13.0` wins). Trust `composer.json`/`phpunit.xml`.

## Tenancy & Auth (gotchas that break everything)
- **Tenant isolation:** `app/Models/Concerns/BelongsToFirm.php:21` adds global scope `where firm_id = TenantContext::firmId()` and stamps `firm_id` on `creating`; throws `CrossTenantWriteException` on mismatch. `TenantContext` is set by `SetTenant.php:17` only if `user.firm_id` present and not `super_admin`. Tests bypass CSRF+Inertia checks via `TestCase.php:17`.
- **Permissions:** 44 perms seeded in `tests/TestCase.php:30` (`view_dashboard`, `manage_matters`… `export_data`). 5 roles: `super_admin` (all), `firm_admin` (full), `solicitor`/`paralegal`/`secretary` (progressively read-only). Helper `actingAsUser()` must set `session(['totp_verified'=>true])` (`TestCase.php:35`) or `requires.two.factor` redirects to `/two-factor`.
- **Billing/time invariants (reviewer checks):** Money recalculation is server-side in `InvoiceController.php:209` + `TimeController.php:137`; do not trust client line totals. Entries with `is_locked` or `billed=true` cannot be edited/deleted (`TimeController.php:172`). Cancelling/deleting an invoice releases `time_entries`/`expenses` (`InvoiceController.php:362`).

## Frontend Conventions
- **Theme:** Legl teal brand `#01B88E` (`tailwind.config.js:30` `brand.500`). Semantic: `bg-primary` is `#00856E` `170 100% 26%` — the only teal that passes 4.5:1 for white text (`app.css:29`). `--accent #02CA9F` (`app.css:45`) is **decorative only** (chips/dots), never a solid button. `AppLayout.tsx:1` sidebar is hardcoded `#0F172A`.
- **Type scale enforced `app.css:120`:** `text-xs` labels/badges, `text-sm` body/tables, `text-base` values/card titles, `text-xl` KPI — label must never be larger than its value.
- **Fluid root** `html { clamp(14px,12px+0.3125vw,24px) }` (`app.css:148`) — do not use `text-[Npx]` fixed sizes.
- **Paths:** Components under `resources/js/components/` (lowercase) + `ui/` shadcn primitives; pages under `resources/js/Pages/` (PascalCase `.tsx`). `resources/js/components/GlobalSearch.tsx:1` (Cmd+K, 200ms debounce) and `NotificationBell.tsx:1` (poll 45s) are in header.

## Testing & DB Mismatch
- **Local DB `phpunit.xml:26` expects `pgsql` `lexdesk_test` `postgres:password`@`5432`; CI `ci-cd.yml:21` actually runs `mysql:8.0` `simplelaw_test` `simplelaw:simplelaw_pass` and overrides with `DB_CONNECTION=mysql` (`ci-cd.yml:78`). `.env.example:23` defaults to `mysql simplelaw`. Result: `php artisan migrate --seed` locally fails unless you align env to phpunit or CI; Pint/PHPStan/audit not in CI (`ci-cd.yml:69` only `npm run build` → `migrate` → `test --parallel`).
- **Fixtures:** `tests/TestCase.php:113` `createFirmAndAdmin()` / `createFirmAndUser()` use factories (`User::factory()->firmAdmin()->forFirm($firm)`) and auto-assign `firm_admin` role. Always `assignRole()` after factory — role string on model alone is not enough for Spatie gates.
- **Security suite:** `tests/Feature/SecurityRegressionTest.php:13` (615 lines, SL-01→SL-26) is the real coverage; no `tests/Feature/Security/` directory or Playwright `tests/Browser/` despite spec.

## CI / Deploy
- **Workflow `.github/workflows/ci-cd.yml:15`:** triggers `push main,v2` + `PR→main`; `ci` job caches `vendor`/`node_modules`, `npm ci`, `npm run build`, `cp .env.example .env`, `migrate:fresh --seed`, `test --parallel`; `deploy` job (Hostinger SSH) only on `push main` + `needs:ci`, migrations gated by `secrets.RUN_MIGRATIONS=true` + `MIGRATION_CONFIRMATION=true` (`ci-cd.yml:132`).

## Subagents (`opencode.json:4`)
Use without asking: `explore` (read-only, `file_path:line_number`), `backend-specialist` (controllers/models/policies, verify `php -l`), `frontend-specialist` (Pages/Layouts, verify `npm run build`, Legl teal), `reviewer` (check billing server-side, `firm_id` scoping, secrets), `implementer` (execute + verify both).
