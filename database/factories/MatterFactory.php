<?php

namespace Database\Factories;

use App\Models\Firm;
use App\Models\Matter;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Matter>
 */
class MatterFactory extends Factory
{
    protected $model = Matter::class;

    public function definition(): array
    {
        static $counter = 0;
        $counter++;

        return [
            'firm_id'             => Firm::factory(),
            'matter_number'       => 'M-' . now()->year . '-' . str_pad($counter, 4, '0', STR_PAD_LEFT),
            'name'                => fake()->sentence(4),
            'description'         => fake()->paragraph(),
            'status'              => 'open',
            'practice_area'       => fake()->randomElement(['litigation', 'family_law', 'conveyancing', 'employment']),
            'fee_arrangement'     => 'hourly_rate',
            'responsible_user_id' => null,
            'opened_at'           => now(),
        ];
    }

    public function open(): static
    {
        return $this->state(fn () => ['status' => 'open']);
    }

    public function closed(): static
    {
        return $this->state(fn () => ['status' => 'closed', 'closed_at' => now()]);
    }

    public function archived(): static
    {
        return $this->state(fn () => ['status' => 'archived']);
    }

    public function forFirm(Firm $firm, ?User $user = null): static
    {
        return $this->state(fn () => [
            'firm_id'             => $firm->id,
            'responsible_user_id' => $user?->id,
        ]);
    }
}
