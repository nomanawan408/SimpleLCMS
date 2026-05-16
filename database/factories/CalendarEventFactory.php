<?php

namespace Database\Factories;

use App\Models\CalendarEvent;
use App\Models\Firm;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<CalendarEvent>
 */
class CalendarEventFactory extends Factory
{
    protected $model = CalendarEvent::class;

    public function definition(): array
    {
        $start = fake()->dateTimeBetween('now', '+30 days');
        return [
            'firm_id'       => Firm::factory(),
            'created_by_id' => User::factory(),
            'title'         => fake()->sentence(4),
            'type'          => 'appointment',
            'matter_id'     => null,
            'start_at'      => $start,
            'end_at'        => (clone $start)->modify('+1 hour'),
            'location'      => null,
            'is_court_date' => false,
        ];
    }

    public function forFirm(Firm $firm, ?User $user = null): static
    {
        return $this->state(fn () => [
            'firm_id'       => $firm->id,
            'created_by_id' => $user?->id ?? User::factory()->forFirm($firm)->create()->id,
        ]);
    }
}
