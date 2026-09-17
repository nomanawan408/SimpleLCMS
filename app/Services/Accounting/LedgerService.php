<?php

namespace App\Services\Accounting;

use App\Exceptions\SraComplianceException;
use App\Models\BankReconciliation;
use App\Models\FinancialTransaction;
use App\Models\LedgerPosting;
use App\Models\Matter;
use App\Models\TrustEntry;
use Illuminate\Support\Facades\DB;

/**
 * The sole writer of SRA ledger data (and, by extension, the legacy
 * trust_entries rows it keeps in sync). Every public method:
 *
 *  - runs inside one DB transaction (all legs or nothing),
 *  - locks the matter row before any funds check (no TOCTOU overdraft),
 *  - moves money as decimal strings compared with bccomp(..., 2),
 *  - scopes every query to the constructor firm (BelongsToFirm backs this).
 *
 * There are deliberately no update/delete paths: corrections are reversals.
 */
class LedgerService
{
    public function __construct(
        protected string $firmId,
        protected string $userId,
    ) {}

    // ── Balances ────────────────────────────────────────────────

    /** Matter client balance (credits − debits) as a decimal string. */
    public function clientBalance(string $matterId): string
    {
        return bcsub($this->legTotal($matterId, 'matter_client', 'credit'), $this->legTotal($matterId, 'matter_client', 'debit'), 2);
    }

    /** Matter office balance (debits − credits, i.e. applied to office) as a decimal string. */
    public function officeBalance(string $matterId): string
    {
        return bcsub($this->legTotal($matterId, 'matter_business', 'debit'), $this->legTotal($matterId, 'matter_business', 'credit'), 2);
    }

    /** System client cash-sheet balance (debits − credits) as a decimal string. */
    public function cashSheetBalance(?string $asAtDate = null): string
    {
        return $this->sheetBalance('cash_sheet_client', $asAtDate);
    }

    /** System office cash-sheet balance (debits − credits) as a decimal string. */
    public function officeCashBalance(?string $asAtDate = null): string
    {
        return $this->sheetBalance('cash_sheet_business', $asAtDate);
    }

    protected function sheetBalance(string $accountType, ?string $asAtDate = null): string
    {
        $q = LedgerPosting::where('firm_id', $this->firmId)->where('account_type', $accountType);
        if ($asAtDate !== null) {
            $q->where('value_date', '<=', $asAtDate);
        }

        return bcsub((string) (clone $q)->where('entry_type', 'debit')->sum('amount'), (string) (clone $q)->where('entry_type', 'credit')->sum('amount'), 2);
    }

    /** Sum of every matter client balance as a decimal string. */
    public function aggregateClientLedgerBalance(?string $asAtDate = null): string
    {
        $matterIds = FinancialTransaction::where('firm_id', $this->firmId)->distinct()->pluck('matter_id');

        $total = '0';
        foreach ($matterIds as $matterId) {
            $total = bcadd($total, $this->clientBalanceAsAt($matterId, $asAtDate), 2);
        }

        return $total;
    }

    // ── Workflows ───────────────────────────────────────────────

    /**
     * @param array{matter_id:string, transaction_date:string, narrative:string, reference?:?string, amount:string} $data
     */
    public function recordClientReceipt(array $data): FinancialTransaction
    {
        $amount = $this->normalizeAmount($data['amount']);

        return DB::transaction(function () use ($data, $amount) {
            $this->lockMatter($data['matter_id']);

            $transaction = $this->createTransaction($data, 'client_receipt', $amount);

            $sheetLeg = $this->post($transaction, 'cash_sheet_client', 'debit', $amount, $data['transaction_date']);
            $this->stampBalanceAfter($sheetLeg);
            $clientLeg = $this->post($transaction, 'matter_client', 'credit', $amount, $data['transaction_date']);
            $this->stampBalanceAfter($clientLeg);

            $this->syncTrustRow($data['matter_id'], 'receipt', $amount, $data['transaction_date'], $data['reference'] ?? null, $data['narrative']);

            return $transaction->load('postings');
        });
    }

    /**
     * @param array{matter_id:string, transaction_date:string, narrative:string, reference?:?string, amount:string} $data
     *
     * @throws SraComplianceException (SRA Rule 5.3)
     */
    public function recordClientPayment(array $data): FinancialTransaction
    {
        $amount = $this->normalizeAmount($data['amount']);

        return DB::transaction(function () use ($data, $amount) {
            $this->assertSufficientClientFunds($data['matter_id'], $amount);

            $transaction = $this->createTransaction($data, 'client_payment', $amount);

            $clientLeg = $this->post($transaction, 'matter_client', 'debit', $amount, $data['transaction_date']);
            $this->stampBalanceAfter($clientLeg);
            $sheetLeg = $this->post($transaction, 'cash_sheet_client', 'credit', $amount, $data['transaction_date']);
            $this->stampBalanceAfter($sheetLeg);

            $this->syncTrustRow($data['matter_id'], 'disbursement', $amount, $data['transaction_date'], $data['reference'] ?? null, $data['narrative']);

            return $transaction->load('postings');
        });
    }

    /**
     * Client → office transfer against a delivered bill. The bill itself lives
     * in Billing (invoices); this moves the cash and records the application.
     * Reference (invoice/bill number) is mandatory.
     *
     * @param array{matter_id:string, transaction_date:string, narrative:string, reference:string, amount:string} $data
     *
     * @throws SraComplianceException (SRA Rule 5.3)
     */
    public function recordTransfer(array $data): FinancialTransaction
    {
        $amount = $this->normalizeAmount($data['amount']);

        if (blank($data['reference'] ?? null)) {
            throw new SraComplianceException('A client-to-office transfer must reference the delivered bill or invoice number.');
        }

        return DB::transaction(function () use ($data, $amount) {
            $this->assertSufficientClientFunds($data['matter_id'], $amount);

            $transaction = $this->createTransaction($data, 'client_to_office_transfer', $amount);

            // Client side out…
            $clientLeg = $this->post($transaction, 'matter_client', 'debit', $amount, $data['transaction_date']);
            $this->stampBalanceAfter($clientLeg);
            $clientSheet = $this->post($transaction, 'cash_sheet_client', 'credit', $amount, $data['transaction_date']);
            $this->stampBalanceAfter($clientSheet);
            // …office side in.
            $officeSheet = $this->post($transaction, 'cash_sheet_business', 'debit', $amount, $data['transaction_date']);
            $this->stampBalanceAfter($officeSheet);
            $officeLeg = $this->post($transaction, 'matter_business', 'credit', $amount, $data['transaction_date']);
            $this->stampBalanceAfter($officeLeg);

            // Office money is not client money: only the client leg syncs.
            $this->syncTrustRow($data['matter_id'], 'disbursement', $amount, $data['transaction_date'], $data['reference'] ?? null, $data['narrative']);

            return $transaction->load('postings');
        });
    }

    /**
     * Correct a mistake by posting a mirror transaction. The original is never
     * touched. Reversing a receipt behaves like a withdrawal (funds lock);
     * an original can only ever have one reversal.
     *
     * @throws SraComplianceException
     */
    public function recordReversal(string $transactionId, string $narrative): FinancialTransaction
    {
        return DB::transaction(function () use ($transactionId, $narrative) {
            $original = FinancialTransaction::where('firm_id', $this->firmId)
                ->with('postings')
                ->findOrFail($transactionId);

            if ($original->transaction_type === 'reversal') {
                throw new SraComplianceException('A reversal cannot itself be reversed. Post a fresh correcting entry instead.');
            }

            if (FinancialTransaction::where('firm_id', $this->firmId)->where('reversal_of_id', $original->id)->exists()) {
                throw new SraComplianceException('This transaction has already been reversed.');
            }

            // Mirror flips client money back: if the net effect removes client
            // funds, it must pass the same deficit lock as a payment.
            $clientOut = $original->postings
                ->where('account_type', 'matter_client')
                ->sum(fn ($p) => $p->entry_type === 'credit' ? (float) $p->amount : -(float) $p->amount);

            if ($clientOut > 0) {
                $this->assertSufficientClientFunds($original->matter_id, number_format($clientOut, 2, '.', ''));
            }

            $this->lockMatter($original->matter_id);

            $reversal = FinancialTransaction::create([
                'firm_id'          => $this->firmId,
                'matter_id'        => $original->matter_id,
                'transaction_date' => now()->toDateString(),
                'reference'        => $original->reference,
                'narrative'        => $narrative,
                'transaction_type' => 'reversal',
                'reversal_of_id'   => $original->id,
                'created_by'       => $this->userId,
            ]);

            foreach ($original->postings as $posting) {
                $mirror = $this->post(
                    $reversal,
                    $posting->account_type,
                    $posting->entry_type === 'debit' ? 'credit' : 'debit',
                    (string) $posting->amount,
                    $reversal->transaction_date->toDateString(),
                );
                $this->stampBalanceAfter($mirror);
            }

            // Mirror the legacy trust rows the original created.
            foreach ($original->postings->where('account_type', 'matter_client') as $posting) {
                $this->syncTrustRow(
                    $original->matter_id,
                    $posting->entry_type === 'credit' ? 'disbursement' : 'receipt',
                    (string) $posting->amount,
                    $reversal->transaction_date->toDateString(),
                    $original->reference,
                    $narrative,
                );
            }

            return $reversal->load('postings');
        });
    }

    /**
     * Run a 5-week reconciliation as at a value date. All figures computed
     * server-side; the caller only supplies the paper balance and notes.
     */
    public function runReconciliation(string $asAtDate, string $paperBalance, ?string $notes = null): BankReconciliation
    {
        $system = $this->cashSheetBalance($asAtDate);
        $aggregate = $this->aggregateClientLedgerBalance($asAtDate);
        $paper = $this->normalizeAmount($paperBalance);

        $internalNotes = $notes ?? '';
        if (bccomp($system, $aggregate, 2) !== 0) {
            $internalNotes = trim($internalNotes . ' [SYSTEM FLAG: cash sheet does not equal aggregate client ledgers — the double entry itself is corrupt.]');
        }

        return BankReconciliation::create([
            'firm_id'                         => $this->firmId,
            'as_at_date'                      => $asAtDate,
            'reconciliation_date'             => now()->toDateString(),
            'paper_statement_balance'         => $paper,
            'system_cash_sheet_balance'       => $system,
            'aggregate_client_ledger_balance' => $aggregate,
            'discrepancy'                     => bcsub($paper, $system, 2),
            'status'                          => bccomp(bcsub($paper, $system, 2), '0', 2) === 0 ? 'balanced' : 'discrepancy_found',
            'notes'                           => $internalNotes ?: null,
            'performed_by'                    => $this->userId,
        ]);
    }

    // ── Internals ───────────────────────────────────────────────

    /**
     * MUST be called inside a DB transaction, before any funds check or
     * insert for the matter. Serializes concurrent postings per matter.
     */
    protected function lockMatter(string $matterId): Matter
    {
        return Matter::where('firm_id', $this->firmId)
            ->where('id', $matterId)
            ->lockForUpdate()
            ->firstOrFail();
    }

    /**
     * MUST be called inside a DB transaction, after lockMatter().
     *
     * @throws SraComplianceException (SRA Rule 5.3)
     */
    public function assertSufficientClientFunds(string $matterId, string $withdrawalAmount): void
    {
        $this->lockMatter($matterId);

        $balance = $this->clientBalance($matterId);

        if (bccomp(bcsub($balance, $withdrawalAmount, 2), '0', 2) < 0) {
            throw new SraComplianceException(
                'Transaction Blocked: Insufficient client funds. Current available balance: £'
                . number_format((float) $balance, 2)
                . '. Requested withdrawal: £' . number_format((float) $withdrawalAmount, 2)
                . '. Overdrawing a client account violates SRA Accounts Rule 5.3.'
            );
        }
    }

    protected function legTotal(string $matterId, string $accountType, string $entryType, ?string $asAtDate = null): string
    {
        $q = LedgerPosting::where('firm_id', $this->firmId)
            ->where('matter_id', $matterId)
            ->where('account_type', $accountType)
            ->where('entry_type', $entryType);
        if ($asAtDate !== null) {
            $q->where('value_date', '<=', $asAtDate);
        }

        return (string) $q->sum('amount');
    }

    protected function clientBalanceAsAt(string $matterId, ?string $asAtDate): string
    {
        if ($asAtDate === null) {
            return $this->clientBalance($matterId);
        }

        return bcsub(
            $this->legTotal($matterId, 'matter_client', 'credit', $asAtDate),
            $this->legTotal($matterId, 'matter_client', 'debit', $asAtDate),
            2
        );
    }

    protected function normalizeAmount(mixed $amount): string
    {
        if (! is_numeric($amount) || bccomp((string) $amount, '0', 2) <= 0) {
            throw new SraComplianceException('Amount must be a positive number.');
        }

        return number_format((float) $amount, 2, '.', '');
    }

    /** @param array{matter_id:string, transaction_date:string, narrative:string, reference?:?string} $data */
    protected function createTransaction(array $data, string $type, string $amount): FinancialTransaction
    {
        return FinancialTransaction::create([
            'firm_id'          => $this->firmId,
            'matter_id'        => $data['matter_id'],
            'transaction_date' => $data['transaction_date'],
            'reference'        => $data['reference'] ?? null,
            'narrative'        => $data['narrative'],
            'transaction_type' => $type,
            'created_by'       => $this->userId,
        ]);
    }

    protected function post(FinancialTransaction $transaction, string $accountType, string $entryType, string $amount, string $valueDate): LedgerPosting
    {
        return LedgerPosting::create([
            'firm_id'        => $this->firmId,
            'transaction_id' => $transaction->id,
            'matter_id'      => $transaction->matter_id,
            'account_type'   => $accountType,
            'entry_type'     => $entryType,
            'amount'         => $amount,
            'value_date'     => $valueDate,
        ]);
    }

    /**
     * Snapshot the running balance onto any leg, so every chronological view
     * (matter ledger and both cash sheets) renders pagination-safe balances.
     * Matter legs run per-matter; cash-sheet legs run firm-wide.
     */
    protected function stampBalanceAfter(LedgerPosting $leg): void
    {
        $leg->balance_after = match ($leg->account_type) {
            'matter_client' => $this->clientBalance($leg->matter_id),
            'matter_business' => $this->officeBalance($leg->matter_id),
            'cash_sheet_client' => $this->cashSheetBalance(),
            'cash_sheet_business' => $this->officeCashBalance(),
        };
        $leg->save();
    }

    protected function syncTrustRow(string $matterId, string $type, string $amount, string $date, ?string $reference, string $narrative): void
    {
        $receipts = (string) TrustEntry::where('firm_id', $this->firmId)->where('matter_id', $matterId)->where('type', 'receipt')->sum('amount');
        $disbursements = (string) TrustEntry::where('firm_id', $this->firmId)->where('matter_id', $matterId)->where('type', 'disbursement')->sum('amount');
        $prior = bcsub($receipts, $disbursements, 2);
        $after = $type === 'receipt' ? bcadd($prior, $amount, 2) : bcsub($prior, $amount, 2);

        TrustEntry::create([
            'firm_id'       => $this->firmId,
            'matter_id'     => $matterId,
            'type'          => $type,
            'amount'        => $amount,
            'description'   => $narrative,
            'date'          => $date,
            'reference'     => $reference,
            'balance_after' => $after,
        ]);
    }
}
