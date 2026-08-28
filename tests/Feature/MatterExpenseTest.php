<?php

namespace Tests\Feature;

use App\Models\Expense;
use App\Models\Invoice;
use App\Models\Matter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MatterExpenseTest extends TestCase
{
    use RefreshDatabase;

    private function matterAndAdmin(): array
    {
        [$firm, $admin] = $this->createFirmAndAdmin();

        return [$firm, $admin, Matter::factory()->create(['firm_id' => $firm->id])];
    }

    public function test_can_add_an_expense(): void
    {
        [$firm, $admin, $matter] = $this->matterAndAdmin();

        $this->actingAsUser($admin)->postJson("/matters/{$matter->id}/expenses", [
            'date' => '2026-08-27',
            'amount' => 120.00,
            'vat_amount' => 24.00,
            'billable' => true,
            'vendor' => 'HM Courts',
            'category' => 'court_fees',
            'description' => 'Issue fee',
        ])->assertOk();

        $this->assertDatabaseHas('expenses', [
            'matter_id' => $matter->id,
            'category' => 'court_fees',
            'amount' => 120.00,
            'vat_amount' => 24.00,
        ]);
    }

    /** VAT is optional -- an expense with no VAT figure (e.g. a receipt with
     *  none applied) must still save, defaulting to zero. */
    public function test_can_add_an_expense_without_vat(): void
    {
        [$firm, $admin, $matter] = $this->matterAndAdmin();

        $this->actingAsUser($admin)->postJson("/matters/{$matter->id}/expenses", [
            'date' => '2026-08-27',
            'amount' => 50.00,
            'billable' => true,
            'description' => 'Postage',
        ])->assertOk();

        $this->assertDatabaseHas('expenses', [
            'matter_id' => $matter->id,
            'amount' => 50.00,
            'vat_amount' => 0,
        ]);
    }

    /**
     * The form offers "No category" as an explicit choice, which sends
     * category: null rather than omitting the field. The column was NOT NULL
     * until now, so this request shape used to 500.
     */
    public function test_can_add_an_expense_with_no_category(): void
    {
        [$firm, $admin, $matter] = $this->matterAndAdmin();

        $this->actingAsUser($admin)->postJson("/matters/{$matter->id}/expenses", [
            'date' => '2026-08-27',
            'amount' => 15.00,
            'billable' => false,
            'category' => null,
            'description' => 'Miscellaneous',
        ])->assertOk();

        $this->assertDatabaseHas('expenses', [
            'matter_id' => $matter->id,
            'description' => 'Miscellaneous',
            'category' => null,
        ]);
    }

    /**
     * The category column is an enum. A free-text value used to reach the
     * database and return a 500; it must now be a normal field error.
     */
    public function test_unknown_category_is_a_validation_error_not_a_server_error(): void
    {
        [$firm, $admin, $matter] = $this->matterAndAdmin();

        $this->actingAsUser($admin)->postJson("/matters/{$matter->id}/expenses", [
            'date' => '2026-08-27',
            'amount' => 42.50,
            'billable' => true,
            'category' => 'Photocopying',
            'description' => 'Bundle copies',
        ])->assertStatus(422)->assertJsonValidationErrors('category');

        $this->assertSame(0, Expense::count());
    }

    public function test_can_edit_an_expense(): void
    {
        [$firm, $admin, $matter] = $this->matterAndAdmin();
        $expense = Expense::factory()->create([
            'firm_id' => $firm->id, 'matter_id' => $matter->id,
            'user_id' => $admin->id, 'amount' => 50, 'billed' => false, 'invoice_id' => null,
        ]);

        $this->actingAsUser($admin)->putJson("/matters/{$matter->id}/expenses/{$expense->id}", [
            'amount' => 75.25,
            'description' => 'Corrected amount',
        ])->assertOk();

        $expense->refresh();
        $this->assertSame('75.25', (string) $expense->amount);
        $this->assertSame('Corrected amount', $expense->description);
    }

    public function test_can_delete_an_expense(): void
    {
        [$firm, $admin, $matter] = $this->matterAndAdmin();
        $expense = Expense::factory()->create([
            'firm_id' => $firm->id, 'matter_id' => $matter->id,
            'user_id' => $admin->id, 'billed' => false, 'invoice_id' => null,
        ]);

        $this->actingAsUser($admin)
            ->deleteJson("/matters/{$matter->id}/expenses/{$expense->id}")
            ->assertOk();

        $this->assertSoftDeleted('expenses', ['id' => $expense->id]);
    }

    /** A billed expense sits on an invoice and must not move underneath it. */
    public function test_billed_expenses_cannot_be_edited_or_deleted(): void
    {
        [$firm, $admin, $matter] = $this->matterAndAdmin();
        $invoice = Invoice::factory()->create(['firm_id' => $firm->id, 'matter_id' => $matter->id]);
        $expense = Expense::factory()->create([
            'firm_id' => $firm->id, 'matter_id' => $matter->id, 'user_id' => $admin->id,
            'billed' => true, 'invoice_id' => $invoice->id, 'amount' => 100,
        ]);

        $this->actingAsUser($admin)
            ->putJson("/matters/{$matter->id}/expenses/{$expense->id}", ['amount' => 1])
            ->assertStatus(422);

        $this->actingAsUser($admin)
            ->deleteJson("/matters/{$matter->id}/expenses/{$expense->id}")
            ->assertStatus(422);

        $this->assertSame('100.00', (string) $expense->fresh()->amount);
        $this->assertDatabaseHas('expenses', ['id' => $expense->id, 'deleted_at' => null]);
    }

    public function test_expense_must_belong_to_the_matter_in_the_url(): void
    {
        [$firm, $admin, $matter] = $this->matterAndAdmin();
        $otherMatter = Matter::factory()->create(['firm_id' => $firm->id]);
        $expense = Expense::factory()->create([
            'firm_id' => $firm->id, 'matter_id' => $otherMatter->id,
            'user_id' => $admin->id, 'billed' => false, 'invoice_id' => null,
        ]);

        $this->actingAsUser($admin)
            ->putJson("/matters/{$matter->id}/expenses/{$expense->id}", ['amount' => 5])
            ->assertStatus(404);
    }

    public function test_another_firms_expense_is_not_reachable(): void
    {
        [$firmA, $adminA, $matterA] = $this->matterAndAdmin();
        $expenseA = Expense::factory()->create([
            'firm_id' => $firmA->id, 'matter_id' => $matterA->id,
            'user_id' => $adminA->id, 'billed' => false, 'invoice_id' => null,
        ]);

        [$firmB, $adminB] = $this->createFirmAndAdmin();

        $this->actingAsUser($adminB)
            ->deleteJson("/matters/{$matterA->id}/expenses/{$expenseA->id}")
            ->assertStatus(404);
    }

    /** Expenses are financial records and use the expense permissions. */
    public function test_users_without_expense_permissions_are_refused(): void
    {
        [$firm, $admin, $matter] = $this->matterAndAdmin();
        $admin->syncRoles([]);
        $admin->syncPermissions(['view_matters', 'edit_matters']);

        $this->actingAsUser($admin->fresh())->postJson("/matters/{$matter->id}/expenses", [
            'date' => '2026-08-27', 'amount' => 10, 'billable' => true, 'description' => 'x',
        ])->assertStatus(403);
    }
}
