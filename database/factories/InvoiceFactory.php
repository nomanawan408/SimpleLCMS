<?php

namespace Database\Factories;

use App\Models\Firm;
use App\Models\Invoice;
use App\Models\Matter;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Invoice>
 */
class InvoiceFactory extends Factory
{
    protected $model = Invoice::class;

    public function definition(): array
    {
        $subtotal = fake()->randomFloat(2, 200, 2000);
        $vatRate  = 20.00;
        $vatAmt   = round($subtotal * $vatRate / 100, 2);
        return [
            'firm_id'        => Firm::factory(),
            'matter_id'      => Matter::factory(),
            'invoice_number' => 'INV-' . now()->year . '-' . str_pad(fake()->unique()->numberBetween(1, 9999), 4, '0', STR_PAD_LEFT),
            'status'         => 'draft',
            'subtotal'       => $subtotal,
            'vat_amount'     => $vatAmt,
            'vat_rate'       => $vatRate,
            'total'          => $subtotal + $vatAmt,
            'discount_amount' => 0,
            'due_date'       => now()->addDays(30)->toDateString(),
        ];
    }

    public function sent(): static
    {
        return $this->state(fn () => ['status' => 'sent', 'sent_at' => now()]);
    }

    public function paid(): static
    {
        return $this->state(fn () => ['status' => 'paid', 'paid_at' => now()]);
    }

    public function forFirm(Firm $firm): static
    {
        return $this->state(fn () => ['firm_id' => $firm->id]);
    }

    public function forMatter(Matter $matter): static
    {
        return $this->state(fn () => [
            'firm_id'   => $matter->firm_id,
            'matter_id' => $matter->id,
        ]);
    }
}
