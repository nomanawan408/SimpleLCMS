<?php

namespace Tests\Feature;

use App\Models\Invoice;
use App\Models\Matter;
use App\Models\TimeEntry;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class InvoiceTest extends TestCase
{
    use RefreshDatabase;

    public function test_can_list_invoices(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $matter = Matter::factory()->forFirm($firm, $admin)->create();
        Invoice::factory()->forMatter($matter)->count(3)->create();

        $this->actingAsUser($admin)->get('/billing')
            ->assertOk()
            ->assertInertia(fn ($page) => $page->where('invoices.total', 3));
    }

    public function test_can_create_invoice_manually(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $matter = Matter::factory()->forFirm($firm, $admin)->create();

        $this->actingAsUser($admin)->post('/billing', [
            'matter_id'      => $matter->id,
            'invoice_number' => 'INV-TEST-001',
            'due_date'       => now()->addDays(30)->toDateString(),
            'vat_rate'       => 20,
            'notes'          => 'Test invoice',
            'line_items'     => [
                [
                    'description' => 'Legal services',
                    'quantity'    => 1,
                    'unit_rate'   => 500.00,
                    'amount'      => 500.00,
                    'vat_amount'  => 100.00,
                ],
            ],
        ])->assertRedirect();

        $this->assertDatabaseHas('invoices', [
            'firm_id'        => $firm->id,
            'invoice_number' => 'INV-TEST-001',
            'subtotal'       => 500.00,
        ]);
    }

    public function test_create_invoice_from_time_entries_marks_as_billed(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $matter = Matter::factory()->forFirm($firm, $admin)->create();

        $entry = TimeEntry::factory()->forMatter($matter)->forUser($admin)->create([
            'duration_minutes' => 60,
            'rate'             => 200.00,
            'amount'           => 200.00,
            'billable'         => true,
            'billed'           => false,
        ]);

        $this->actingAsUser($admin)->post('/time/invoice', [
            'entry_ids' => [$entry->id],
            'due_date'  => now()->addDays(30)->toDateString(),
        ])->assertRedirect();

        $this->assertDatabaseHas('time_entries', [
            'id'     => $entry->id,
            'billed' => true,
        ]);

        $this->assertDatabaseHas('invoices', [
            'firm_id'   => $firm->id,
            'matter_id' => $matter->id,
            'status'    => 'draft',
        ]);
    }

    public function test_cannot_invoice_already_billed_entries(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $matter = Matter::factory()->forFirm($firm, $admin)->create();
        $entry  = TimeEntry::factory()->billed()->forMatter($matter)->forUser($admin)->create();

        $this->actingAsUser($admin)->post('/time/invoice', [
            'entry_ids' => [$entry->id],
            'due_date'  => now()->addDays(30)->toDateString(),
        ])->assertRedirect()
          ->assertSessionHas('error');
    }

    public function test_can_mark_invoice_as_sent(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $matter  = Matter::factory()->forFirm($firm, $admin)->create();
        $invoice = Invoice::factory()->forMatter($matter)->create(['status' => 'draft']);

        $this->actingAsUser($admin)->post("/billing/{$invoice->id}", ['status' => 'sent'])
            ->assertRedirect();

        $this->assertDatabaseHas('invoices', ['id' => $invoice->id, 'status' => 'sent']);
    }

    public function test_can_record_payment_on_sent_invoice(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $matter  = Matter::factory()->forFirm($firm, $admin)->create();
        $invoice = Invoice::factory()->sent()->forMatter($matter)->create([
            'subtotal'    => 500.00,
            'vat_amount'  => 100.00,
            'total'       => 600.00,
        ]);

        $this->actingAsUser($admin)->post("/billing/{$invoice->id}/payments", [
            'amount'  => 600.00,
            'method'  => 'bank_transfer',
            'paid_at' => now()->toDateString(),
        ])->assertRedirect();

        $this->assertDatabaseHas('payments', [
            'invoice_id' => $invoice->id,
            'amount'     => 600.00,
        ]);

        $this->assertDatabaseHas('invoices', [
            'id'     => $invoice->id,
            'status' => 'paid',
        ]);
    }

    public function test_cannot_overpay_invoice(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $matter  = Matter::factory()->forFirm($firm, $admin)->create();
        $invoice = Invoice::factory()->sent()->forMatter($matter)->create([
            'subtotal'   => 100.00,
            'vat_amount' => 20.00,
            'total'      => 120.00,
        ]);

        $this->actingAsUser($admin)->post("/billing/{$invoice->id}/payments", [
            'amount'  => 500.00,
            'method'  => 'bank_transfer',
            'paid_at' => now()->toDateString(),
        ])->assertSessionHasErrors('amount');
    }

    public function test_invoice_firm_isolation(): void
    {
        [$firm,  $admin]  = $this->createFirmAndAdmin();
        [$firm2, $admin2] = $this->createFirmAndAdmin();
        $matter2  = Matter::factory()->forFirm($firm2, $admin2)->create();
        $invoice2 = Invoice::factory()->forMatter($matter2)->create();

        $this->actingAsUser($admin)->get('/billing')
            ->assertOk()
            ->assertInertia(fn ($page) => $page->where('invoices.total', 0));
    }

    public function test_deleting_invoice_unlinks_time_entries(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $matter = Matter::factory()->forFirm($firm, $admin)->create();
        $entry  = TimeEntry::factory()->forMatter($matter)->forUser($admin)->create([
            'billed' => true,
        ]);
        $invoice = Invoice::factory()->forMatter($matter)->create();
        $entry->update(['invoice_id' => $invoice->id]);

        $this->actingAsUser($admin)->delete("/billing/{$invoice->id}")
            ->assertRedirect();

        $this->assertDatabaseHas('time_entries', [
            'id'         => $entry->id,
            'billed'     => false,
            'invoice_id' => null,
        ]);
    }
}
