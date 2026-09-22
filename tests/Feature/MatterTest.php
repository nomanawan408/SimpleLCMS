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
        $paralegal = User::factory()->forFirm($firm)->create(['role' => 'paralegal']);
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
        $solicitor = User::factory()->forFirm($firm)->create(['role' => 'solicitor']);
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
