<?php

namespace Tests\Feature;

use App\Models\CalendarEvent;
use App\Models\Matter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CalendarTest extends TestCase
{
    use RefreshDatabase;

    public function test_can_create_event(): void
    {
        [$firm, $user] = $this->createFirmAndUser();

        $this->actingAsUser($user)->postJson('/calendar', [
            'title'    => 'Client Meeting',
            'type'     => 'appointment',
            'start_at' => now()->addDay()->toDateTimeString(),
            'end_at'   => now()->addDay()->addHour()->toDateTimeString(),
        ])->assertOk()
          ->assertJsonPath('event.title', 'Client Meeting');

        $this->assertDatabaseHas('calendar_events', [
            'firm_id' => $firm->id,
            'title'   => 'Client Meeting',
        ]);
    }

    public function test_end_at_defaults_to_one_hour_when_omitted(): void
    {
        [$firm, $user] = $this->createFirmAndUser();
        $start = now()->addDay()->toDateTimeString();

        $response = $this->actingAsUser($user)->postJson('/calendar', [
            'title'    => 'Quick Call',
            'type'     => 'appointment',
            'start_at' => $start,
        ])->assertOk();

        $event = CalendarEvent::where('firm_id', $firm->id)->first();
        $this->assertNotNull($event->end_at);
        $diff = $event->start_at->diffInMinutes($event->end_at);
        $this->assertEquals(60, $diff);
    }

    public function test_can_update_event(): void
    {
        [$firm, $user] = $this->createFirmAndUser();
        $event = CalendarEvent::factory()->forFirm($firm, $user)->create(['title' => 'Old Title']);

        $this->actingAsUser($user)->putJson("/calendar/{$event->id}", [
            'title' => 'New Title',
        ])->assertOk();

        $this->assertDatabaseHas('calendar_events', ['id' => $event->id, 'title' => 'New Title']);
    }

    public function test_can_delete_event(): void
    {
        [$firm, $user] = $this->createFirmAndUser();
        $event = CalendarEvent::factory()->forFirm($firm, $user)->create();

        $this->actingAsUser($user)->deleteJson("/calendar/{$event->id}")
            ->assertOk();

        $this->assertDatabaseMissing('calendar_events', ['id' => $event->id, 'deleted_at' => null]);
    }

    public function test_cannot_update_other_firms_event(): void
    {
        [$firm,  $user]  = $this->createFirmAndUser();
        [$firm2, $user2] = $this->createFirmAndUser();
        $event2 = CalendarEvent::factory()->forFirm($firm2, $user2)->create();

        $this->actingAsUser($user)->putJson("/calendar/{$event2->id}", [
            'title' => 'Hijacked',
        ])->assertStatus(403);
    }

    public function test_court_date_event_linked_to_matter(): void
    {
        [$firm, $user] = $this->createFirmAndUser();
        $matter = Matter::factory()->forFirm($firm, $user)->create();

        $this->actingAsUser($user)->postJson('/calendar', [
            'title'         => 'Hearing',
            'type'          => 'court_date',
            'matter_id'     => $matter->id,
            'start_at'      => now()->addWeek()->toDateTimeString(),
            'is_court_date' => true,
        ])->assertOk();

        $this->assertDatabaseHas('calendar_events', [
            'matter_id'     => $matter->id,
            'is_court_date' => true,
        ]);
    }
}
