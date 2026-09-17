<?php

namespace Tests\Feature;

use App\Exceptions\SraComplianceException;
use App\Models\FinancialTransaction;
use App\Models\LedgerPosting;
use App\Models\Matter;
use App\Models\TrustEntry;
use App\Services\Accounting\LedgerService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * SRA Accounts Rules 2019 ledger: double entry, zero-deficit lock (5.3),
 * immutability via reversals, tenant isolation, reconciliation math.
 */
class LedgerTest extends TestCase
{
    use RefreshDatabase;

    private function service(string $firmId, string $userId): LedgerService
    {
        return new LedgerService($firmId, $userId);
    }

    private function receipt(LedgerService $svc, string $matterId, string $amount, string $narrative = 'Test receipt'): FinancialTransaction
    {
        return $svc->recordClientReceipt([
            'matter_id' => $matterId,
            'transaction_date' => now()->toDateString(),
            'narrative' => $narrative,
            'reference' => 'BACS-1',
            'amount' => $amount,
        ]);
    }

    public function test_receipt_posts_two_balanced_legs_and_a_trust_row(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $matter = Matter::factory()->forFirm($firm, $admin)->create();
        $svc = $this->service($firm->id, $admin->id);

        $txn = $this->receipt($svc, $matter->id, '55000.00');

        $this->assertCount(2, $txn->postings);
        $this->assertEquals(
            0,
            $txn->postings->sum(fn ($p) => $p->entry_type === 'debit' ? (float) $p->amount : -(float) $p->amount)
        );
        $this->assertDatabaseHas('ledger_postings', [
            'transaction_id' => $txn->id, 'account_type' => 'cash_sheet_client', 'entry_type' => 'debit', 'amount' => '55000.00',
        ]);
        $this->assertDatabaseHas('ledger_postings', [
            'transaction_id' => $txn->id, 'account_type' => 'matter_client', 'entry_type' => 'credit', 'amount' => '55000.00',
            'balance_after' => '55000.00',
        ]);
        $this->assertDatabaseHas('trust_entries', [
            'matter_id' => $matter->id, 'type' => 'receipt', 'amount' => '55000.00', 'balance_after' => '55000.00',
        ]);
        $this->assertSame('55000.00', $svc->clientBalance($matter->id));
    }

    public function test_payment_beyond_balance_is_blocked_to_the_penny(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $matter = Matter::factory()->forFirm($firm, $admin)->create();
        $svc = $this->service($firm->id, $admin->id);
        $this->receipt($svc, $matter->id, '50.00');

        try {
            $svc->recordClientPayment([
                'matter_id' => $matter->id, 'transaction_date' => now()->toDateString(),
                'narrative' => 'Overdraw attempt', 'amount' => '50.01',
            ]);
            $this->fail('Expected SraComplianceException.');
        } catch (SraComplianceException $e) {
            $this->assertStringContainsString('5.3', $e->getMessage());
        }

        // Nothing was written.
        $this->assertSame(1, FinancialTransaction::count());
        $this->assertSame('50.00', $svc->clientBalance($matter->id));
    }

    public function test_payment_of_exact_balance_succeeds(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $matter = Matter::factory()->forFirm($firm, $admin)->create();
        $svc = $this->service($firm->id, $admin->id);
        $this->receipt($svc, $matter->id, '50.00');

        $svc->recordClientPayment([
            'matter_id' => $matter->id, 'transaction_date' => now()->toDateString(),
            'narrative' => 'Exact spend', 'amount' => '50.00',
        ]);

        $this->assertSame('0.00', $svc->clientBalance($matter->id));
    }

    public function test_pence_arithmetic_uses_decimals_not_floats(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $matter = Matter::factory()->forFirm($firm, $admin)->create();
        $svc = $this->service($firm->id, $admin->id);

        $this->receipt($svc, $matter->id, '0.10', 'Ten p one');
        $this->receipt($svc, $matter->id, '0.10', 'Ten p two');
        $this->receipt($svc, $matter->id, '0.10', 'Ten p three');

        // 0.1 + 0.1 + 0.1 !== 0.3 in floats; must succeed in decimals.
        $svc->recordClientPayment([
            'matter_id' => $matter->id, 'transaction_date' => now()->toDateString(),
            'narrative' => 'Thirty pence', 'amount' => '0.30',
        ]);

        $this->assertSame('0.00', $svc->clientBalance($matter->id));
    }

    public function test_transfer_posts_four_legs_and_requires_a_reference(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $matter = Matter::factory()->forFirm($firm, $admin)->create();
        $svc = $this->service($firm->id, $admin->id);
        $this->receipt($svc, $matter->id, '2000.00');

        try {
            $svc->recordTransfer([
                'matter_id' => $matter->id, 'transaction_date' => now()->toDateString(),
                'narrative' => 'No ref transfer', 'reference' => '', 'amount' => '100.00',
            ]);
            $this->fail('Expected SraComplianceException for missing reference.');
        } catch (SraComplianceException) {
        }

        $txn = $svc->recordTransfer([
            'matter_id' => $matter->id, 'transaction_date' => now()->toDateString(),
            'narrative' => 'Costs per bill', 'reference' => 'INV-1024', 'amount' => '1200.00',
        ]);

        $this->assertCount(4, $txn->postings);
        foreach ([
            ['matter_client', 'debit'], ['cash_sheet_client', 'credit'],
            ['cash_sheet_business', 'debit'], ['matter_business', 'credit'],
        ] as [$account, $entry]) {
            $this->assertDatabaseHas('ledger_postings', [
                'transaction_id' => $txn->id, 'account_type' => $account, 'entry_type' => $entry, 'amount' => '1200.00',
            ]);
        }
        $this->assertSame('800.00', $svc->clientBalance($matter->id));
        // Office legs run debits − credits ("debt owed"): a bare transfer with
        // no bill recorded over-applies, hence the negative (office CR) figure.
        $this->assertSame('-1200.00', $svc->officeBalance($matter->id));
        // Legacy trust mirror: client money out only.
        $this->assertDatabaseHas('trust_entries', [
            'matter_id' => $matter->id, 'type' => 'disbursement', 'amount' => '1200.00', 'balance_after' => '800.00',
        ]);
    }

    public function test_transfer_beyond_balance_is_blocked(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $matter = Matter::factory()->forFirm($firm, $admin)->create();
        $svc = $this->service($firm->id, $admin->id);
        $this->receipt($svc, $matter->id, '100.00');

        $this->expectException(SraComplianceException::class);
        $svc->recordTransfer([
            'matter_id' => $matter->id, 'transaction_date' => now()->toDateString(),
            'narrative' => 'Too much', 'reference' => 'INV-1', 'amount' => '100.01',
        ]);
    }

    public function test_reversal_mirrors_legs_links_original_and_cannot_repeat(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $matter = Matter::factory()->forFirm($firm, $admin)->create();
        $svc = $this->service($firm->id, $admin->id);
        $original = $this->receipt($svc, $matter->id, '300.00');

        $reversal = $svc->recordReversal($original->id, 'Entered in error');

        $this->assertSame('reversal', $reversal->transaction_type);
        $this->assertSame($original->id, $reversal->reversal_of_id);
        $this->assertCount(2, $reversal->postings);
        $this->assertSame('0.00', $svc->clientBalance($matter->id));
        // Original untouched.
        $this->assertSame('client_receipt', $original->fresh()->transaction_type);

        try {
            $svc->recordReversal($original->id, 'Second attempt');
            $this->fail('Expected SraComplianceException for double reversal.');
        } catch (SraComplianceException) {
        }

        try {
            $svc->recordReversal($reversal->id, 'Reversing a reversal');
            $this->fail('Expected SraComplianceException for reversal of reversal.');
        } catch (SraComplianceException) {
        }
    }

    public function test_reversal_that_would_overdraw_is_blocked(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $matter = Matter::factory()->forFirm($firm, $admin)->create();
        $svc = $this->service($firm->id, $admin->id);
        $original = $this->receipt($svc, $matter->id, '300.00');
        $svc->recordClientPayment([
            'matter_id' => $matter->id, 'transaction_date' => now()->toDateString(),
            'narrative' => 'Spend it', 'amount' => '300.00',
        ]);

        $this->expectException(SraComplianceException::class);
        $svc->recordReversal($original->id, 'Too late to reverse');
    }

    public function test_ledger_is_tenant_isolated(): void
    {
        [$firmA, $adminA] = $this->createFirmAndAdmin();
        [$firmB, $adminB] = $this->createFirmAndAdmin();
        $matterA = Matter::factory()->forFirm($firmA, $adminA)->create();

        $svcB = $this->service($firmB->id, $adminB->id);

        // Firm B cannot post to firm A's matter.
        try {
            $svcB->recordClientReceipt([
                'matter_id' => $matterA->id, 'transaction_date' => now()->toDateString(),
                'narrative' => 'Intrusion', 'amount' => '10.00',
            ]);
            $this->fail('Expected lock to reject cross-firm matter.');
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException) {
        }

        // Firm B sees a zero balance for firm A's matter, never its money.
        $this->receipt($this->service($firmA->id, $adminA->id), $matterA->id, '999.00');
        $this->assertSame('0.00', $svcB->clientBalance($matterA->id));
    }

    public function test_reconciliation_math_balanced_and_breach(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $matter = Matter::factory()->forFirm($firm, $admin)->create();
        $svc = $this->service($firm->id, $admin->id);
        $this->receipt($svc, $matter->id, '1000.00');
        $svc->recordClientPayment([
            'matter_id' => $matter->id, 'transaction_date' => now()->toDateString(),
            'narrative' => 'Court fee', 'amount' => '300.00',
        ]);

        $ok = $svc->runReconciliation(now()->toDateString(), '700.00', 'Month end');
        $this->assertSame('balanced', $ok->status);
        $this->assertSame('700.00', $ok->system_cash_sheet_balance);
        $this->assertSame('700.00', $ok->aggregate_client_ledger_balance);
        $this->assertSame('0.00', $ok->discrepancy);

        $breach = $svc->runReconciliation(now()->toDateString(), '699.00');
        $this->assertSame('discrepancy_found', $breach->status);
        $this->assertSame('-1.00', $breach->discrepancy);
    }

    public function test_matter_with_postings_cannot_be_force_deleted(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $matter = Matter::factory()->forFirm($firm, $admin)->create();
        $this->receipt($this->service($firm->id, $admin->id), $matter->id, '10.00');

        // Savepoint: Postgres aborts the whole transaction on an FK violation,
        // so contain the expected failure to prove nothing was deleted after.
        \Illuminate\Support\Facades\DB::beginTransaction();
        try {
            $matter->forceDelete();
            \Illuminate\Support\Facades\DB::rollBack();
            $this->fail('Expected FK restrict to block force delete.');
        } catch (\Illuminate\Database\QueryException) {
            \Illuminate\Support\Facades\DB::rollBack();
        }

        $this->assertNotSoftDeleted($matter);
        $this->assertDatabaseHas('ledger_postings', ['matter_id' => $matter->id]);
    }
}
