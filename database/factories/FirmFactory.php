<?php

namespace Database\Factories;

use App\Models\Firm;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Firm>
 */
class FirmFactory extends Factory
{
    protected $model = Firm::class;

    public function definition(): array
    {
        $name = fake()->company();
        return [
            'name'                => $name,
            'slug'                => Str::slug($name) . '-' . Str::random(6),
            'plan'                => 'professional',
            'subscription_status' => 'active',
            'timezone'            => 'Europe/London',
            'default_hourly_rate' => 250.00,
            'invoice_prefix'      => 'INV',
            'invoice_sequence'    => 1,
            'vat_rate'            => 20.00,
            'payment_terms_days'  => 30,
        ];
    }
}
