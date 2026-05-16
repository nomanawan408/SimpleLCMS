<?php

namespace Database\Factories;

use App\Models\Contact;
use App\Models\Firm;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Contact>
 */
class ContactFactory extends Factory
{
    protected $model = Contact::class;

    public function definition(): array
    {
        return [
            'firm_id'    => Firm::factory(),
            'type'       => 'individual',
            'name'       => fake()->name(),
            'email'      => fake()->unique()->safeEmail(),
            'phone'      => fake()->phoneNumber(),
            'lead_status' => 'enquiry',
            'address'    => [],
            'tags'       => [],
        ];
    }

    public function forFirm(Firm $firm): static
    {
        return $this->state(fn () => ['firm_id' => $firm->id]);
    }

    public function company(): static
    {
        return $this->state(fn () => ['type' => 'company', 'name' => fake()->company()]);
    }
}
