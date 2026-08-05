<?php

namespace Tests\Feature;

use App\Models\Matter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BillingAccessTest extends TestCase
{
    use RefreshDatabase;

    public function test_solicitor_cannot_access_billing_index(): void
    {
        [$firm, $user] = $this->createFirmAndUser(['role' => 'solicitor']);

        $this->actingAsUser($user)->get('/billing')->assertForbidden();
    }

    public function test_firm_admin_can_access_billing_index(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();

        $this->actingAsUser($admin)->get('/billing')->assertOk();
    }

    public function test_solicitor_cannot_access_billing_create(): void
    {
        [$firm, $user] = $this->createFirmAndUser(['role' => 'solicitor']);

        $this->actingAsUser($user)->get('/billing/create')->assertForbidden();
    }

    public function test_solicitor_cannot_create_invoice(): void
    {
        [$firm, $user] = $this->createFirmAndUser(['role' => 'solicitor']);
        $matter = Matter::factory()->forFirm($firm, $user)->create();

        $this->actingAsUser($user)->post('/billing', [
            'matter_id'      => $matter->id,
            'invoice_number' => 'INV-TEST-1',
            'due_date'       => now()->addDays(30)->toDateString(),
            'line_items'     => [[
                'description' => 'Legal services',
                'quantity'    => 1,
                'unit_rate'   => 100.00,
                'amount'      => 100.00,
                'vat_amount'  => 0,
            ]],
            'vat_rate' => 0,
        ])->assertForbidden();
    }

    public function test_paralegal_cannot_access_billing(): void
    {
        [$firm, $user] = $this->createFirmAndUser(['role' => 'paralegal']);

        $this->actingAsUser($user)->get('/billing')->assertForbidden();
    }
}
