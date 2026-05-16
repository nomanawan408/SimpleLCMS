<?php

namespace Database\Factories;

use App\Models\Expense;
use App\Models\Firm;
use App\Models\Matter;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Expense>
 */
class ExpenseFactory extends Factory
{
    protected $model = Expense::class;

    public function definition(): array
    {
        return [
            'firm_id'    => Firm::factory(),
            'matter_id'  => Matter::factory(),
            'user_id'    => User::factory(),
            'date'       => now()->toDateString(),
            'vendor'     => fake()->company(),
            'description' => fake()->sentence(),
            'amount'     => fake()->randomFloat(2, 10, 500),
            'vat_amount' => 0,
            'category'   => 'other',
            'billable'   => true,
            'billed'     => false,
        ];
    }

    public function forMatter(Matter $matter): static
    {
        return $this->state(fn () => [
            'firm_id'   => $matter->firm_id,
            'matter_id' => $matter->id,
        ]);
    }
}
