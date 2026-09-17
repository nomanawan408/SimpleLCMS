<?php

namespace Tests\Feature;

use App\Models\Matter;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * HTTP boundary for the SRA ledger: permission gates, validation,
 * tenant isolation, SRA blocks surfacing as form errors, and the
 * absence of update/delete routes (immutability by design).
 */
class LedgerHttpTest extends TestCase
{
    use RefreshDatabase;

    private function solicitor($firm): User
    {
        $user = User::factory()->forFirm($firm)->create(['role' => 'solicitor']);
        $user->assignRole('solicitor');
        return $user;
    }

    private function secretary($firm): User
    {
        $user = User::factory()->forFirm($firm)->create(['role' => 'secretary']);
        $user->assignRole('secretary');
        return $user;
    }

    private function entryPayload(string $matterId, string $type = 'client_receipt', string $amount = '100.00'): array
    {
        return [
            'matter_id' => $matterId,
            'transaction_type' => $type,
            'transaction_date' => now()->toDateString(),
            'narrative' => 'Test entry',
            'reference' => 'BACS-9',
            'amount' => $amount,
        ];
    }

    public function test_view_only_role_can_read_but_not_post(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $matter = Matter::factory()->forFirm($firm, $admin)->create();
        $secretary = $this->secretary($firm);

        $this->actingAsUser($secretary)->get('/ledger/cash-sheet')->assertOk();
        $this->actingAsUser($secretary)->get("/ledger/matters/{$matter->id}")->assertOk();
        $this->actingAsUser($secretary)->get('/ledger/reconciliations')->assertOk();

        $this->actingAsUser($secretary)->post('/ledger/entries', $this->entryPayload($matter->id))->assertForbidden();
        $this->actingAsUser($secretary)->post('/ledger/reconciliations', [
            'as_at_date' => now()->toDateString(), 'paper_statement_balance' => '0',
        ])->assertForbidden();
    }

    public function test_solicitor_can_post_receipts_but_not_transfers_or_reversals(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $matter = Matter::factory()->forFirm($firm, $admin)->create();
        $solicitor = $this->solicitor($firm);

        $this->actingAsUser($solicitor)
            ->post('/ledger/entries', $this->entryPayload($matter->id))
            ->assertRedirect()
            ->assertSessionHasNoErrors();
        $this->assertDatabaseHas('financial_transactions', ['matter_id' => $matter->id, 'transaction_type' => 'client_receipt']);

        $txnId = \App\Models\FinancialTransaction::first()->id;
        $this->actingAsUser($solicitor)
            ->post('/ledger/entries', $this->entryPayload($matter->id, 'client_to_office_transfer'))
            ->assertForbidden();
        $this->actingAsUser($solicitor)
            ->post("/ledger/reversals/{$txnId}", ['narrative' => 'Nope'])
            ->assertForbidden();
    }

    public function test_firm_admin_full_flow_over_http(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $matter = Matter::factory()->forFirm($firm, $admin)->create();

        $this->actingAsUser($admin)
            ->post('/ledger/entries', $this->entryPayload($matter->id, 'client_receipt', '500.00'))
            ->assertRedirect()->assertSessionHasNoErrors();

        $this->actingAsUser($admin)
            ->post('/ledger/entries', $this->entryPayload($matter->id, 'client_to_office_transfer', '200.00'))
            ->assertRedirect()->assertSessionHasNoErrors();

        $txnId = \App\Models\FinancialTransaction::where('transaction_type', 'client_receipt')->first()->id;
        $this->actingAsUser($admin)
            ->post("/ledger/reversals/{$txnId}", ['narrative' => 'Should fail: only 300 left'])
            ->assertSessionHasErrors('amount');

        // Receipt 500 − transfer 200 = 300 on the client cash sheet.
        $this->actingAsUser($admin)
            ->post('/ledger/reconciliations', ['as_at_date' => now()->toDateString(), 'paper_statement_balance' => '300.00'])
            ->assertRedirect()->assertSessionHasNoErrors();
        $this->assertDatabaseHas('bank_reconciliations', ['firm_id' => $firm->id, 'status' => 'balanced']);
    }

    public function test_cross_firm_ledger_access_is_closed(): void
    {
        [$firmA, $adminA] = $this->createFirmAndAdmin();
        [$firmB, $adminB] = $this->createFirmAndAdmin();
        $matterB = Matter::factory()->forFirm($firmB, $adminB)->create();

        $this->actingAsUser($adminA)->get("/ledger/matters/{$matterB->id}")->assertNotFound();
        $this->actingAsUser($adminA)
            ->post('/ledger/entries', $this->entryPayload($matterB->id))
            ->assertSessionHasErrors('matter_id');
        $this->assertDatabaseMissing('financial_transactions', ['matter_id' => $matterB->id]);
    }

    public function test_entry_validation_rejects_bad_input(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $matter = Matter::factory()->forFirm($firm, $admin)->create();

        $bad = $this->entryPayload($matter->id);
        $bad['amount'] = '0';
        $this->actingAsUser($admin)->post('/ledger/entries', $bad)->assertSessionHasErrors('amount');

        $bad = $this->entryPayload($matter->id);
        $bad['transaction_date'] = now()->addDay()->toDateString();
        $this->actingAsUser($admin)->post('/ledger/entries', $bad)->assertSessionHasErrors('transaction_date');

        $bad = $this->entryPayload($matter->id, 'client_to_office_transfer');
        unset($bad['reference']);
        $this->actingAsUser($admin)->post('/ledger/entries', $bad)->assertSessionHasErrors('reference');
    }

    public function test_no_update_or_delete_routes_exist_for_ledger_writes(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $matter = Matter::factory()->forFirm($firm, $admin)->create();
        $this->actingAsUser($admin)->post('/ledger/entries', $this->entryPayload($matter->id))->assertRedirect();
        $txnId = \App\Models\FinancialTransaction::first()->id;

        foreach (['patch', 'put', 'delete'] as $method) {
            $this->actingAsUser($admin)->{$method}("/ledger/entries/{$txnId}", [])->assertNotFound();
        }
        $this->assertDatabaseHas('financial_transactions', ['id' => $txnId]);
    }
}
