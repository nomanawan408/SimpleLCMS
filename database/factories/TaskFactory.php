<?php

namespace Database\Factories;

use App\Models\Firm;
use App\Models\Task;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Task>
 */
class TaskFactory extends Factory
{
    protected $model = Task::class;

    public function definition(): array
    {
        return [
            'firm_id'        => Firm::factory(),
            'matter_id'      => null,
            'assignee_id'    => null,
            'created_by_id'  => User::factory(),
            'title'          => fake()->sentence(5),
            'description'    => fake()->paragraph(),
            'due_date'       => now()->addDays(7)->toDateString(),
            'priority'       => 'medium',
            'status'         => 'todo',
            'completed_at'   => null,
        ];
    }

    public function forFirm(Firm $firm, ?User $createdBy = null): static
    {
        return $this->state(fn () => [
            'firm_id'       => $firm->id,
            'created_by_id' => $createdBy?->id ?? User::factory()->forFirm($firm)->create()->id,
        ]);
    }

    public function done(): static
    {
        return $this->state(fn () => ['status' => 'done', 'completed_at' => now()]);
    }
}
