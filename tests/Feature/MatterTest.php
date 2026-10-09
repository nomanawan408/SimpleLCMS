<?php

namespace Tests\Feature;

use App\Models\Contact;
use App\Models\Matter;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MatterTest extends TestCase
{
    use RefreshDatabase;

    public function test_can_list_matters(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        Matter::factory()->forFirm($firm, $admin)->count(3)->create();

        $this->actingAsUser($admin)->get('/matters')
            ->assertOk()
            ->assertInertia(fn ($page) => $page->where('matters.total', 3));
    }

    public function test_can_create_matter(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $contact = Contact::factory()->forFirm($firm)->create();

        $this->actingAsUser($admin)->post('/matters', [
            'name'                => 'Smith v Jones',
            'practice_area'       => 'litigation',
            'fee_arrangement'     => 'hourly_rate',
            'responsible_user_id' => $admin->id,
            'contact_ids'         => [$contact->id],
        ])->assertRedirect();

        $this->assertDatabaseHas('matters', [
            'firm_id' => $firm->id,
            'name'    => 'Smith v Jones',
        ]);
    }

    public function test_matter_number_uses_year_plus_random_digits(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $contact = Contact::factory()->forFirm($firm)->create();

        $this->actingAsUser($admin)->post('/matters', [
            'name'                => 'Smith v Jones',
            'practice_area'       => 'litigation',
            'fee_arrangement'     => 'hourly_rate',
            'responsible_user_id' => $admin->id,
            'contact_ids'         => [$contact->id],
        ])->assertRedirect();

        $number = Matter::where('firm_id', $firm->id)->value('matter_number');

        // YYYY + 4 random digits (not month/day) + initials + serial.
        $this->assertMatchesRegularExpression(
            '/^' . now()->format('Y') . '\d{4}-[A-Z]{2}-\d{5}$/',
            $number
        );
    }

    public function test_can_add_multiple_hearing_dates(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $matter = Matter::factory()->forFirm($firm, $admin)->create();

        $this->actingAsUser($admin)->put("/matters/{$matter->id}/hearing-date", [
            'hearing_date' => now()->addDays(10)->toDateString(),
        ])->assertRedirect();

        $this->actingAsUser($admin)->post("/matters/{$matter->id}/hearing-dates", [
            'hearing_date' => now()->addDays(20)->toDateString(),
            'hearing_time' => '14:30',
        ])->assertRedirect()->assertSessionHasNoErrors();

        // Both exist: the add never overwrites, earliest stays the headline.
        $this->assertSame(2, \App\Models\CalendarEvent::where('matter_id', $matter->id)->where('is_court_date', true)->count());
        $this->assertSame(now()->addDays(10)->toDateString(), substr($matter->fresh()->hearing_date, 0, 10));

        $second = \App\Models\CalendarEvent::where('matter_id', $matter->id)->orderBy('start_at', 'desc')->first();
        $this->assertSame('14:30', $second->start_at->format('H:i'));
    }

    public function test_hearing_accepts_start_and_end_range(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $matter = Matter::factory()->forFirm($firm, $admin)->create();

        // No end given → historic one-hour default preserved.
        $this->actingAsUser($admin)->post("/matters/{$matter->id}/hearing-dates", [
            'hearing_date' => now()->addDays(10)->toDateString(),
            'hearing_time' => '10:00',
        ])->assertRedirect()->assertSessionHasNoErrors();

        $first = \App\Models\CalendarEvent::where('matter_id', $matter->id)->first();
        $this->assertSame('11:00', $first->end_at->format('H:i'));

        $this->actingAsUser($admin)->post("/matters/{$matter->id}/hearing-dates", [
            'hearing_date' => now()->addDays(20)->toDateString(),
            'hearing_time' => '14:00',
            'hearing_end_date' => now()->addDays(21)->toDateString(),
            'hearing_end_time' => '16:30',
        ])->assertRedirect()->assertSessionHasNoErrors();

        $second = \App\Models\CalendarEvent::where('matter_id', $matter->id)->orderBy('start_at', 'desc')->first();
        $this->assertSame('14:00', $second->start_at->format('H:i'));
        $this->assertSame(now()->addDays(21)->toDateString(), $second->end_at->toDateString());
        $this->assertSame('16:30', $second->end_at->format('H:i'));
    }

    public function test_hearing_end_append_exposes_multi_day_range(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $matter = Matter::factory()->forFirm($firm, $admin)->create();
        $event = \App\Models\CalendarEvent::factory()->forFirm($firm, $admin)->create([
            'matter_id' => $matter->id, 'is_court_date' => true,
            'start_at' => now()->addDays(7)->setTime(9, 0),
            'end_at' => now()->addDays(12)->setTime(17, 30),
        ]);

        $this->actingAsUser($admin)->get("/matters/{$matter->id}")
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('matter.hearing_end', $event->end_at->format('Y-m-d H:i:s'))
                ->where('matter.next_hearing.id', $event->id));

        $this->actingAsUser($admin)->get('/matters')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('matters.data.0.hearing_end', $event->end_at->format('Y-m-d H:i:s')));
    }

    public function test_next_hearing_eager_load_picks_the_earliest_per_matter(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $make = function (string $name, int $startDay, int $endDay) use ($firm, $admin) {
            $matter = Matter::factory()->forFirm($firm, $admin)->create(['name' => $name]);
            \App\Models\CalendarEvent::factory()->forFirm($firm, $admin)->create([
                'matter_id' => $matter->id, 'is_court_date' => true,
                'start_at' => now()->addDays($startDay)->setTime(9, 0),
                'end_at' => now()->addDays($endDay)->setTime(17, 30),
            ]);

            return $matter;
        };
        $make('Later first', 20, 22);
        $second = $make('Earlier second', 5, 9);
        // A second, later hearing on the same matter: eager loading must
        // still match the earliest per parent.
        \App\Models\CalendarEvent::factory()->forFirm($firm, $admin)->create([
            'matter_id' => $second->id, 'is_court_date' => true,
            'start_at' => now()->addDays(15)->setTime(9, 0),
            'end_at' => now()->addDays(16)->setTime(17, 30),
        ]);

        $matters = Matter::where('firm_id', $firm->id)->with('nextHearing')->orderBy('name')->get();
        $this->assertSame('Earlier second', $matters[0]->name);
        $this->assertSame(now()->addDays(5)->toDateString(), $matters[0]->nextHearing->start_at->toDateString());
        $this->assertSame(now()->addDays(9)->toDateString(), $matters[0]->nextHearing->end_at->toDateString());
        $this->assertSame(now()->addDays(20)->toDateString(), $matters[1]->nextHearing->start_at->toDateString());
        $this->assertSame(now()->addDays(22)->toDateString(), $matters[1]->nextHearing->end_at->toDateString());
    }

    public function test_show_exposes_upcoming_hearings_count_and_list(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $matter = Matter::factory()->forFirm($firm, $admin)->create();
        foreach ([3, 10] as $days) {
            \App\Models\CalendarEvent::factory()->forFirm($firm, $admin)->create([
                'matter_id' => $matter->id, 'is_court_date' => true,
                'start_at' => now()->addDays($days)->setTime(10, 0),
                'end_at' => now()->addDays($days)->setTime(11, 0),
            ]);
        }
        // A past hearing is not upcoming and must not be counted or listed.
        \App\Models\CalendarEvent::factory()->forFirm($firm, $admin)->create([
            'matter_id' => $matter->id, 'is_court_date' => true,
            'start_at' => now()->subDays(2)->setTime(10, 0),
            'end_at' => now()->subDays(2)->setTime(11, 0),
        ]);

        $this->actingAsUser($admin)->get("/matters/{$matter->id}")
            ->assertOk()
            ->assertInertia(fn ($page) => $page->where('matter.upcoming_hearings_count', 2));

        $this->actingAsUser($admin)->getJson("/matters/{$matter->id}/hearing-dates")
            ->assertOk()
            ->assertJsonCount(2, 'hearings');
    }

    public function test_hearing_end_before_start_is_rejected(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $matter = Matter::factory()->forFirm($firm, $admin)->create();

        $this->actingAsUser($admin)->post("/matters/{$matter->id}/hearing-dates", [
            'hearing_date' => now()->addDays(10)->toDateString(),
            'hearing_time' => '10:00',
            'hearing_end_date' => now()->addDays(9)->toDateString(),
        ])->assertSessionHasErrors('hearing_end_date');

        $this->assertSame(0, \App\Models\CalendarEvent::where('matter_id', $matter->id)->count());
    }

    public function test_hearing_dates_are_scoped_to_the_matter(): void
    {
        [$firmA, $adminA] = $this->createFirmAndAdmin();
        [$firmB, $adminB] = $this->createFirmAndAdmin();
        $matterA = Matter::factory()->forFirm($firmA, $adminA)->create();
        $matterB = Matter::factory()->forFirm($firmB, $adminB)->create();
        $foreign = \App\Models\CalendarEvent::factory()->forFirm($firmB, $adminB)->create([
            'matter_id' => $matterB->id, 'is_court_date' => true, 'start_at' => now()->addDays(5),
        ]);

        // Tenant-scoped binding 404s before authorization even runs.
        $this->actingAsUser($adminA)->get("/matters/{$matterB->id}/hearing-dates")->assertNotFound();
        $this->actingAsUser($adminA)->delete("/matters/{$matterA->id}/hearing-dates/{$foreign->id}")->assertNotFound();
        $this->assertDatabaseHas('calendar_events', ['id' => $foreign->id]);
    }

    public function test_deadline_defaults_to_16_00_without_time(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $matter = Matter::factory()->forFirm($firm, $admin)->create();
        \App\Models\Task::factory()->forFirm($firm, $admin)->create([
            'matter_id' => $matter->id, 'status' => 'todo', 'due_date' => null,
        ]);

        $this->actingAsUser($admin)->put("/matters/{$matter->id}/deadline", [
            'deadline' => '2026-10-01',
        ])->assertRedirect()->assertSessionHasNoErrors();

        $this->assertSame('2026-10-01 16:00:00', \App\Models\Task::where('matter_id', $matter->id)->value('due_date')->format('Y-m-d H:i:s'));
    }

    public function test_reformat_command_rewrites_old_numbers_keeping_serial(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $old = Matter::factory()->forFirm($firm, $admin)->create([
            'matter_number' => '20260823-SK-01002',
        ]);

        $this->artisan('matters:reformat-numbers')->assertExitCode(0);

        $new = $old->fresh()->matter_number;
        $this->assertMatchesRegularExpression('/^2026\d{4}-SK-01002$/', $new);
        $this->assertNotSame('20260823-SK-01002', $new);
    }

    public function test_paralegal_cannot_create_matter(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $paralegal = User::factory()->forFirm($firm)->create(['role' => 'lawyer']);
        $contact   = Contact::factory()->forFirm($firm)->create();

        $this->actingAsUser($paralegal)->post('/matters', [
            'name'                => 'Test Matter',
            'practice_area'       => 'litigation',
            'fee_arrangement'     => 'hourly_rate',
            'responsible_user_id' => $admin->id,
            'contact_ids'         => [$contact->id],
        ])->assertStatus(403);
    }

    public function test_can_update_matter(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $matter = Matter::factory()->forFirm($firm, $admin)->create(['name' => 'Old Name']);

        $this->actingAsUser($admin)->patch("/matters/{$matter->id}", [
            'name'                => 'New Name',
            'practice_area'       => 'family_law',
            'fee_arrangement'     => 'fixed_fee',
            'responsible_user_id' => $admin->id,
        ])->assertRedirect();

        $this->assertDatabaseHas('matters', ['id' => $matter->id, 'name' => 'New Name']);
    }

    public function test_only_firm_admin_can_delete_matter(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $solicitor = User::factory()->forFirm($firm)->create(['role' => 'lawyer']);
        $matter    = Matter::factory()->forFirm($firm, $admin)->create();

        $this->actingAsUser($solicitor)->delete("/matters/{$matter->id}")
            ->assertStatus(403);

        $this->actingAsUser($admin)->delete("/matters/{$matter->id}")
            ->assertRedirect();

        $this->assertSoftDeleted('matters', ['id' => $matter->id]);
    }

    public function test_matter_firm_isolation(): void
    {
        [$firm,  $admin]  = $this->createFirmAndAdmin();
        [$firm2, $admin2] = $this->createFirmAndAdmin();
        Matter::factory()->forFirm($firm2, $admin2)->count(2)->create();

        $this->actingAsUser($admin)->get('/matters')
            ->assertOk()
            ->assertInertia(fn ($page) => $page->where('matters.total', 0));
    }
}
