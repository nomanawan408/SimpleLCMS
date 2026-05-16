<?php

namespace Database\Factories;

use App\Models\Firm;
use App\Models\Matter;
use App\Models\TimeEntry;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<TimeEntry>
 */
class TimeEntryFactory extends Factory
{
    protected $model = TimeEntry::class;

    public function definition(): array
    {
        $rate    = fake()->randomFloat(2, 100, 500);
        $minutes = fake()->randomElement([30, 60, 90, 120]);
        return [
            'firm_id'          => Firm::factory(),
            'matter_id'        => Matter::factory(),
            'user_id'          => User::factory(),
            'date'             => fake()->dateTimeBetween('-30 days', 'now')->format('Y-m-d'),
            'duration_minutes' => $minutes,
            'rate'             => $rate,
            'amount'           => round($rate * $minutes / 60, 2),
            'billable'         => true,
            'billed'           => false,
            'is_locked'        => false,
            'activity_type'    => 'advising',
            'description'      => fake()->sentence(),
        ];
    }

    public function billed(): static
    {
        return $this->state(fn () => ['billed' => true]);
    }

    public function locked(): static
    {
        return $this->state(fn () => ['is_locked' => true]);
    }

    public function nonBillable(): static
    {
        return $this->state(fn () => ['billable' => false]);
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

    public function forUser(User $user): static
    {
        return $this->state(fn () => ['user_id' => $user->id]);
    }
}
