# Software Specification: Legal Accounts & Ledger Module (SRA Accounts Rules 2019)

**Target Framework:** Laravel (PHP)  
**Target Module:** Manual Legal Accounting & Case Financial Ledger  
**Primary Users:** Legal Cashiers, Solicitors, Practice Managers, COFA (Compliance Officer for Finance and Administration)

---

## 1. Regulatory Context for Developers (Plain English)

Under the **SRA Accounts Rules 2019 (Solicitors Regulation Authority)**, legal accounting differs from standard commercial accounting. Client money is held **on trust** and must strictly be separated from the law firm's own business (office) money.

Key legal rules that dictate application logic:
1. **Separation of Money (SRA Rule 4.1):** Client money and Business money must run through completely separate ledger columns and virtual cash sheets.
2. **Strict Prohibition of Client Deficits (SRA Rule 5.3):** A client matter ledger balance can **never go below £0.00 (into debit)**. If Matter A spends money it does not have, it is illegally using Matter B's funds. The software **must hard-block** transactions that cause a negative client balance.
3. **Double-Entry Tracking (SRA Rule 8.1 & 8.3):** Every manually posted receipt or payment must instantly create matching double entries in the **Cash Sheet** and the individual **Matter Client Ledger**.
4. **Mandatory 5-Week Reconciliation (SRA Rule 8.5):** The system must offer a tool to reconcile paper bank statements against the system cash sheet and the aggregate total of all client ledgers:
   $$\text{Bank Statement Balance} = \text{System Cash Sheet Balance} = \sum \text{Individual Client Ledger Balances}$$
5. **Audit Trail & Immutability:** Accounting postings can **never be hard-deleted or overwritten**. Mistakes must be corrected using reversal or adjustment entries to maintain audit compliance.
6. **App Conventions (non-negotiable):** Every table uses UUID primary keys (`HasUuids`), carries `firm_id` with the `BelongsToFirm` global scope, and every service query is firm-scoped. Money is transported as numeric strings and stored `decimal(12,2)` — never PHP `float`. Deleting a matter must never delete its ledger (`restrictOnDelete`).

---

## 2. Ledger & Cash Sheet Architecture

Rather than managing live bank feeds, the module operates through **manual data entry** by staff. The system automatically maintains two main ledger views:

```
                           ┌──────────────────────────────────────┐
                           │      Law Firm Accounting System      │
                           └──────────────────┬───────────────────┘
                                              │
           ┌──────────────────────────────────┴──────────────────────────────────┐
           ▼                                                                     ▼
┌────────────────────────────────────┐                        ┌────────────────────────────────────┐
│      Matter Ledgers (Per Case)     │                        │      Cash Sheets (System-wide)     │
├────────────────────────────────────┤                        ├────────────────────────────────────┤
│ • Matter Client Ledger (Trust)     │                        │ • Client Account Cash Sheet        │
│ • Matter Business Ledger (Office)  │                        │ • Business Account Cash Sheet      │
└────────────────────────────────────┘                        └────────────────────────────────────┘
```

1. **Matter Ledger (Combined Client & Business Ledger):**
   * Displays individual case financial entries side-by-side.
   * **Client Columns (DR, CR, Balance):** Tracks funds belonging to the client (estate funds, deposits on account, damages received).
   * **Business Columns (DR, CR, Balance):** Tracks debt/invoices owed by the client to the firm.
2. **Cash Sheets (Virtual Bank Journals):**
   * **Client Cash Sheet:** Chronological, system-wide log of all client money entering and leaving the firm.
   * **Business Cash Sheet:** Chronological log of all office fees, expenses, and invoices.

---

## 3. Database Architecture (Laravel Migrations)

> **Amendment (architecture review):** the original draft used auto-increment IDs against UUID keys, had no `firm_id` tenant column, and cascaded deletes from matters — all three are ship-blockers in this codebase. The schema below is the corrected version. `bill_delivered` is intentionally **deferred**: office receivables already live in the `invoices` table, and booking them again here would corrupt both. Transfers carry the invoice number in `reference` instead.

### Migration 1: `financial_transactions`
Stores header details typed in by the user on the manual entry forms.

```php
return new class extends Migration {
    public function up(): void {
        Schema::create('financial_transactions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('firm_id');
            $table->uuid('matter_id');
            $table->date('transaction_date');
            $table->string('reference')->nullable(); // e.g., Cheque No, BACS ref, invoice no. for transfers
            $table->text('narrative');               // e.g., "Funds received from PRs"
            $table->enum('transaction_type', [
                'client_receipt',
                'client_payment',
                'client_to_office_transfer',
                'reversal',
            ]);
            // Corrections link back; originals are never edited or deleted.
            $table->uuid('reversal_of_id')->nullable();
            $table->uuid('created_by'); // User who manually logged it
            $table->timestamps();

            $table->foreign('firm_id')->references('id')->on('firms')->onDelete('cascade');
            // restrict: a matter with postings can never be deleted (immutability).
            $table->foreign('matter_id')->references('id')->on('matters')->onDelete('restrict');
            $table->foreign('reversal_of_id')->references('id')->on('financial_transactions')->onDelete('restrict');
            $table->foreign('created_by')->references('id')->on('users')->onDelete('restrict');
            $table->index(['firm_id', 'transaction_date']);
            $table->index(['firm_id', 'matter_id']);
        });
    }

    public function down(): void {
        Schema::dropIfExists('financial_transactions');
    }
};
```

### Migration 2: `ledger_postings`
Stores the double-entry breakdown generated automatically upon saving a transaction.

```php
return new class extends Migration {
    public function up(): void {
        Schema::create('ledger_postings', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('firm_id');
            $table->uuid('transaction_id');
            $table->uuid('matter_id');

            // Targets appropriate ledger view
            $table->enum('account_type', [
                'matter_client',        // Client account card for the specific matter
                'matter_business',      // Office/Business account card for the matter
                'cash_sheet_client',    // Overall Client Cash Sheet
                'cash_sheet_business'   // Overall Office Cash Sheet
            ]);

            $table->enum('entry_type', ['debit', 'credit']);
            $table->decimal('amount', 12, 2);
            // User-supplied value date (backdated entries sort correctly).
            $table->date('value_date');
            // Running balance snapshot for matter legs only (pagination-safe).
            $table->decimal('balance_after', 12, 2)->nullable();
            $table->timestamps();

            $table->foreign('firm_id')->references('id')->on('firms')->onDelete('cascade');
            $table->foreign('transaction_id')->references('id')->on('financial_transactions')->onDelete('cascade');
            $table->foreign('matter_id')->references('id')->on('matters')->onDelete('restrict');

            // Indexes for fast lookup
            $table->index(['firm_id', 'matter_id', 'account_type']);
            $table->index(['firm_id', 'account_type', 'value_date']);
        });
    }

    public function down(): void {
        Schema::dropIfExists('ledger_postings');
    }
};
```

### Migration 3: `bank_reconciliations`
Stores manual 5-week SRA reconciliation records for compliance checks. `status` is always computed server-side, never accepted from the client.

```php
return new class extends Migration {
    public function up(): void {
        Schema::create('bank_reconciliations', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('firm_id');
            // Last value-date included, so runs are reproducible.
            $table->date('as_at_date');
            $table->date('reconciliation_date');
            $table->decimal('paper_statement_balance', 12, 2);
            $table->decimal('system_cash_sheet_balance', 12, 2);
            $table->decimal('aggregate_client_ledger_balance', 12, 2);
            $table->decimal('discrepancy', 12, 2)->default(0.00);
            $table->enum('status', ['balanced', 'discrepancy_found']);
            $table->text('notes')->nullable();
            $table->uuid('performed_by');
            $table->timestamps();

            $table->foreign('firm_id')->references('id')->on('firms')->onDelete('cascade');
            $table->foreign('performed_by')->references('id')->on('users')->onDelete('restrict');
            $table->index(['firm_id', 'as_at_date']);
        });
    }

    public function down(): void {
        Schema::dropIfExists('bank_reconciliations');
    }
};
```

### Integration: legacy `trust_entries`
Nothing in the app currently writes `trust_entries` (the Accounts page and dashboard only read it). To avoid two sources of truth, **`LedgerService` is the sole writer**: every client receipt/disbursement/transfer also appends the matching legacy row (`receipt`/`disbursement` + `balance_after`) so existing screens keep working unchanged. No other code may write that table.

---

## 4. Workflows & Backend Logic (`LedgerService.php`)

Build a centralized service class: `App\Services\Accounting\LedgerService.php`. It is constructed with the acting user and firm (`new LedgerService($request->user())`) — **no `auth()` calls inside**, every query is firm-scoped, amounts travel as numeric strings, comparisons use `bccomp(..., 2)`.

### Rule 0: Serialization (fixes a race in the original draft)
The draft checked funds in one query and inserted in a later transaction. Two concurrent payments could both pass and jointly overdraw. Every funds check therefore runs **inside** the write transaction after `Matter::lockForUpdate()`, which serializes postings per matter.

### Rule 1: Zero-Deficit Lock (SRA Rule 5.3)

```php
namespace App\Services\Accounting;

use App\Models\LedgerPosting;
use App\Models\Matter;
use App\Exceptions\SraComplianceException;
use Illuminate\Support\Facades\DB;

class LedgerService
{
    public function __construct(
        protected string $firmId,
        protected string $userId,
    ) {}

    /** Current client balance as a decimal string, e.g. "56025.00". */
    public function clientBalance(string $matterId): string
    {
        $credits = (string) LedgerPosting::where('firm_id', $this->firmId)
            ->where('matter_id', $matterId)
            ->where('account_type', 'matter_client')
            ->where('entry_type', 'credit')
            ->sum('amount');

        $debits = (string) LedgerPosting::where('firm_id', $this->firmId)
            ->where('matter_id', $matterId)
            ->where('account_type', 'matter_client')
            ->where('entry_type', 'debit')
            ->sum('amount');

        return bcsub($credits, $debits, 2);
    }

    /**
     * Must be called INSIDE a DB transaction, after locking the matter row.
     * Throws SraComplianceException (rendered as a 422) on breach.
     */
    public function assertSufficientClientFunds(string $matterId, string $withdrawalAmount): void
    {
        Matter::where('firm_id', $this->firmId)
            ->where('id', $matterId)
            ->lockForUpdate()
            ->firstOrFail();

        $balance = $this->clientBalance($matterId);

        if (bccomp(bcsub($balance, $withdrawalAmount, 2), '0', 2) < 0) {
            throw new SraComplianceException(
                "Transaction Blocked: Insufficient client funds. Current available balance: £"
                . number_format((float) $balance, 2)
                . ". Requested withdrawal: £" . number_format((float) $withdrawalAmount, 2)
                . ". Overdrawing a client account violates SRA Accounts Rule 5.3."
            );
        }
    }
}
```

### Workflow A: Posting a Manual Client Receipt
*Example: Client pays £55,000 money on account / estate money.* Two postings: DEBIT Client Cash Sheet (money enters virtual bank) + CREDIT Matter Client Ledger (liability: firm holds funds).

### Workflow B: Posting a Manual Client Payment
*Example: Firm pays £300 court fees out of client funds.* Funds lock **inside** the transaction, then two postings: DEBIT Matter Client Ledger + CREDIT Client Cash Sheet.

### Workflow C: Client → Office Transfer (was enum-only in the draft — now specified)
*Example: £1,200 billed costs moved to office against INV-1024.* Requires a `reference` (the bill/invoice number). Four postings, funds lock inside the transaction:
1. DEBIT Matter Client Ledger (client balance falls)
2. CREDIT Client Cash Sheet (client bank falls)
3. DEBIT Business Cash Sheet (office bank rises)
4. CREDIT Matter Business Ledger (applied to office; visible as office CR)

### Workflow D: Reversal (was missing in the draft — required by §1.5)
Mistakes are corrected by posting a mirror `reversal` transaction linked via `reversal_of_id`: every posting of the original is re-posted with debit/credit flipped, same value date. Reversing a receipt behaves like a withdrawal, so it runs the same funds lock (a reversal that would breach 5.3 is blocked with the same exception). Originals are never touched. Double-reversal is rejected (`reversal_of_id` unique per original).

### Legacy sync
Receipts, payments and the client legs of transfers also append the matching `trust_entries` row (`receipt`/`disbursement` + computed `balance_after`) inside the same DB transaction, so the Accounts page and dashboard trust figures keep working. Office legs have no trust row (office money is not client money).

### HTTP layer (not in the draft — required)
- `LedgerController` with `receipt / payment / transfer / reversal` (POST) + `matterLedger / cashSheet` (GET) + `reconcile` (POST) + `reconciliations` (GET). No update/delete routes exist for transactions or postings — immutability is enforced by the absence of routes, not just convention.
- FormRequests validate: `matter_id` (uuid, `Rule::exists` scoped to firm), `amount` (`numeric|min:0.01`), `transaction_date` (`date|before_or_equal:today`), `narrative` (required, max 2000), `reference` (required for transfers), `reversal_of_id` (uuid, same-firm, not already reversed).
- Permissions (seeded, see §7): `view_ledger` (read), `post_ledger` (receipt/payment), `transfer_client_funds` (transfer), `reverse_ledger_entries` (reversal), `run_reconciliation` (reconcile). Controllers use `abort_unless(...hasPermissionTo(...), 403)` like the rest of the app.

### Reconciliation run (server-computed)
`POST /ledger/reconciliations { as_at_date, paper_statement_balance, notes? }` computes: cash-sheet balance (`cash_sheet_client` debits − credits with `value_date <= as_at`), aggregate client ledgers (sum of matter_client balances), `discrepancy = paper − system`, plus the internal check `system − aggregate` (a non-zero here means the double entry itself is corrupt — stored in `notes` and flagged). Status derives from the numbers; the client never sends it.

---

## 5. UI Views & Interface Requirements

### 1. Combined Matter Ledger (Per Case View)
Displays side-by-side columns matching standard UK legal accounting formats.

**Layout Wireframe:**

```
+------------+-------------------------------+----------+-----------------------+-----------------------+
| Date       | Details / Narrative           | Ref      | Business Account (£)  | Client Account (£)    |
|            |                               |          |  DR   |  CR   | Balance |  DR   |  CR   |Balance|
+------------+-------------------------------+----------+-------+-------+---------+-------+-------+-------+
| 06/01/2026 | Cash received from PRs        | REC-101  | -     | -     | 0.00    | -     | 300   | 300 CR|
| 15/01/2026 | Cash found in safe            | REC-102  | -     | -     | 0.00    | -     | 1,025 |1325 CR|
| 20/01/2026 | Life insurance payout         | BACS-99  | -     | -     | 0.00    | -     |55,000 |56325CR|
| 25/01/2026 | Probate court fee paid        | CHQ-501  | -     | -     | 0.00    | 300   | -     |56025CR|
| 28/01/2026 | Fee Invoice Delivered         | INV-1024 | 1,200 | -     |1200 DR  | -     | -     |56025CR|
+------------+-------------------------------+----------+-------+-------+---------+-------+-------+-------+
```

* **Client Balances:** Positive balances must render as `CR` (Credit), signifying money held on trust.
* **Business Balances:** Unpaid balances render as `DR` (Debit), showing debts owed to the firm.

### 2. General Cash Sheet View (Firm-wide View)
Chronological log of overall transactions, acting as the manual bank statement ledger. Filterable by date and transaction type.

* **Columns:** `Date` | `Matter Ref / Name` | `Narrative` | `Reference` | `DR (Receipt)` | `CR (Payment)` | `Running Balance`

### 3. SRA 5-Week Reconciliation Dashboard
Allows the COFA/Manager to verify system accuracy:
1. User enters the balance from their **Physical Paper Bank Statement**.
2. System calculates **System Cash Sheet Total** (`Sum of Cash Sheet Debits - Sum of Cash Sheet Credits`).
3. System calculates **Aggregate Client Ledger Total** (`Sum of all Matter Client Ledger Balances`).
4. **Validation Formula:**
   $$\text{Discrepancy} = \text{Paper Statement Balance} - \text{System Cash Sheet Balance}$$
5. If `Discrepancy != 0.00`, display an alert badge: `SRA RECONCILIATION BREACH DETECTED`.

---

## 6. Developer Safeguards Checklist

* [x] **No Hard Deletes:** No update/delete routes exist for `financial_transactions` and `ledger_postings` (enforced by absence, plus a test hitting `DELETE`/`PATCH` expecting 404/405). Corrections go through Workflow D reversals only.
* [x] **Zero-Deficit Enforcement:** Test that attempting to draw £50.01 from a matter holding £50.00 produces an explicit 422 blocking the submission — and that the check runs inside the locked transaction (concurrency test with two simultaneous £50.00 payments on £50.00: exactly one succeeds).
* [x] **Double-Entry Balance:** Every workflow test asserts total debits == total credits per transaction *and* cash-sheet movement == matter-leg movement.
* [x] **Atomic Transactions:** All multi-row postings use `DB::transaction()` so partial entries are never saved (test: force a mid-write exception, assert zero rows).
* [x] **Transfer Rules:** Transfer without `reference` is rejected (422); transfer exceeding balance is blocked; transfer posts exactly 4 legs.
* [x] **Reversal Rules:** Reversal links `reversal_of_id`, flips all legs, cannot itself be reversed twice, and runs the funds lock when it reduces a client balance.
* [x] **Tenant Isolation:** All service/route tests run with two firms; firm B can neither read nor post to firm A ledgers (404/403).
* [x] **Money Precision:** Amounts asserted as decimal strings end-to-end (e.g. three £0.10 receipts then a £0.30 payment succeeds — the classic float trap).
* [x] **Matter Summary Badge:** Add a summary block at the top of every matter page displaying:
  * **Client Balance:** `£XX.XX CR`
  * **Office Debt Owed:** `£XX.XX DR`

## 7. Permissions, Seeding & Build Order

New permissions: `view_ledger`, `post_ledger`, `transfer_client_funds`, `reverse_ledger_entries`, `run_reconciliation`.

| Role | view | post receipt/payment | transfer | reverse | reconcile |
|---|---|---|---|---|---|
| firm_admin, super_admin | ✅ | ✅ | ✅ | ✅ | ✅ |
| manager, accounts | ✅ | ✅ | ✅ | ✅ (accounts) | ✅ |
| solicitor, lawyer, barrister | ✅ | ✅ | — | — | — |
| paralegal, secretary, clerk, consultant | ✅ | — | — | — | — |

Seed via a dedicated data migration (firstOrCreate + targeted `givePermissionTo` — never re-sync whole roles on existing firms), and add the same lists to `RolePermissionSeeder` + `tests/TestCase.php` so fresh installs and CI agree.

Build order: migrations → models + exception → `LedgerService` + unit/feature tests → controller + routes + FormRequests → Inertia UI (matter ledger view, cash sheet, reconciliation dashboard, matter summary badge) → seed-permissions migration → docs.