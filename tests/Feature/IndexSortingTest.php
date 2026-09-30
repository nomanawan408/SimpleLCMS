<?php

namespace Tests\Feature;

use App\Models\Invoice;
use App\Models\Matter;
use App\Models\Payment;
use App\Models\Task;
use App\Models\TimeEntry;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class IndexSortingTest extends TestCase
{
    use RefreshDatabase;

    public function test_contacts_sort_by_name(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        foreach (['Charlie', 'Alpha', 'Bravo'] as $name) {
            \App\Models\Contact::factory()->forFirm($firm)->create(['name' => $name]);
        }

        $this->actingAsUser($admin)->get('/contacts?sort_by=contact&sort_dir=asc')
            ->assertOk()
            ->assertInertia(fn ($page) => $page->where(
                'contacts.data',
                fn ($data) => collect($data)->pluck('name')->all() === ['Alpha', 'Bravo', 'Charlie']
            ));
    }

    public function test_time_entries_sort_by_amount_desc(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $matter = Matter::factory()->forFirm($firm, $admin)->create();
        foreach ([['Small', 30.0], ['Big', 90.0], ['Mid', 60.0]] as [$label, $amount]) {
            TimeEntry::factory()->forFirm($firm)->create([
                'matter_id' => $matter->id, 'user_id' => $admin->id,
                'description' => $label, 'amount' => $amount, 'billed' => false,
            ]);
        }

        $this->actingAsUser($admin)->get('/time?sort_by=amount&sort_dir=desc')
            ->assertOk()
            ->assertInertia(fn ($page) => $page->where(
                'entries.data',
                fn ($data) => collect($data)->pluck('description')->all() === ['Big', 'Mid', 'Small']
            ));
    }

    public function test_tasks_sort_by_title(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        foreach (['Zebra', 'Apple', 'Mango'] as $title) {
            Task::factory()->forFirm($firm, $admin)->create(['title' => $title, 'status' => 'todo']);
        }

        $this->actingAsUser($admin)->get('/tasks?sort_by=title&sort_dir=asc')
            ->assertOk()
            ->assertInertia(fn ($page) => $page->where(
                'tasks.data',
                fn ($data) => collect($data)->pluck('title')->all() === ['Apple', 'Mango', 'Zebra']
            ));
    }

    public function test_invoices_sort_by_total(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $matter = Matter::factory()->forFirm($firm, $admin)->create();
        foreach ([300, 100, 200] as $i => $total) {
            Invoice::factory()->forFirm($firm)->forMatter($matter)->create([
                'status' => 'sent', 'total' => $total, 'invoice_number' => 'INV-T-' . $i,
            ]);
        }
        $this->grantFinances($admin, true);

        $this->actingAsUser($admin)->get('/billing?sort_by=amount&sort_dir=asc')
            ->assertOk()
            ->assertInertia(fn ($page) => $page->where(
                'invoices.data',
                fn ($data) => collect($data)->pluck('total')->map(fn ($t) => (float) $t)->all() === [100.0, 200.0, 300.0]
            ));
    }

    public function test_transactions_sort_by_amount_with_invalid_key_fallback(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $this->grantFinances($admin, true);
        $matter = Matter::factory()->forFirm($firm, $admin)->create();
        $invoice = Invoice::factory()->forFirm($firm)->forMatter($matter)->create(['status' => 'sent']);
        foreach ([50, 150] as $amount) {
            Payment::create([
                'firm_id' => $firm->id, 'invoice_id' => $invoice->id,
                'amount' => $amount, 'method' => 'cash', 'paid_at' => now()->toDateString(),
            ]);
        }

        $this->actingAsUser($admin)->get('/transactions?sort_by=amount&sort_dir=desc')
            ->assertOk()
            ->assertInertia(fn ($page) => $page->where(
                'transactions.data',
                fn ($data) => collect($data)->pluck('amount')->map(fn ($t) => (float) $t)->all() === [150.0, 50.0]
            ));

        // Unknown key falls back to the default order and clears the echo.
        $this->actingAsUser($admin)->get('/transactions?sort_by=firm_id&sort_dir=desc')
            ->assertOk()
            ->assertInertia(fn ($page) => $page->where('filters.sort_by', null));
    }

    public function test_reconciliations_sort_by_as_at_date(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $this->grantFinances($admin, true);

        $this->actingAsUser($admin)->post('/ledger/reconciliations', [
            'as_at_date' => now()->subDays(2)->toDateString(), 'paper_statement_balance' => '100.00',
        ])->assertRedirect();
        $this->actingAsUser($admin)->post('/ledger/reconciliations', [
            'as_at_date' => now()->toDateString(), 'paper_statement_balance' => '100.00',
        ])->assertRedirect();

        $this->actingAsUser($admin)->get('/ledger/reconciliations?sort_by=as_at&sort_dir=asc')
            ->assertOk()
            ->assertInertia(fn ($page) => $page->where(
                'reconciliations.data',
                fn ($data) => collect($data)->pluck('as_at_date')->all()
                    === collect($data)->pluck('as_at_date')->sort()->values()->all()
                    && count($data) === 2
            ));
    }

}
