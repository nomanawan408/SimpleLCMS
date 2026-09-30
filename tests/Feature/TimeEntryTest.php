<?php

namespace Tests\Feature;

use App\Models\Matter;
use App\Models\TimeEntry;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TimeEntryTest extends TestCase
{
    use RefreshDatabase;

    // ── Index ──────────────────────────────────────────────────────────

    public function test_staff_sees_own_and_assigned_matter_entries(): void
    {
        [$firm, $user] = $this->createFirmAndUser();
        $other = User::factory()->forFirm($firm)->create();
        $mine = Matter::factory()->forFirm($firm)->create();
        $theirs = Matter::factory()->forFirm($firm, $other)->create();
        $this->assignToMatter($user, $mine);

        $ownEntry = TimeEntry::factory()->forMatter($mine)->forUser($user)->create();
        $sharedEntry = TimeEntry::factory()->forMatter($mine)->forUser($other)->create();
        $hiddenEntry = TimeEntry::factory()->forMatter($theirs)->forUser($other)->create();

        $this->actingAsUser($user)->get('/time')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('entries.total', 2)
                ->where('entries.data', fn ($data) => collect($data)->pluck('id')->doesntContain($hiddenEntry->id)));
    }

    public function test_admin_sees_all_firm_entries(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $solicitor = User::factory()->forFirm($firm)->create();
        $matter    = Matter::factory()->forFirm($firm, $admin)->create();

        TimeEntry::factory()->forMatter($matter)->forUser($admin)->create();
        TimeEntry::factory()->forMatter($matter)->forUser($solicitor)->create();

        $this->actingAsUser($admin)->get('/time')
            ->assertOk()
            ->assertInertia(fn ($page) => $page->where('entries.total', 2));
    }

    public function test_solicitor_cannot_see_entries_from_other_firm(): void
    {
        [$firm,  $user]  = $this->createFirmAndUser();
        [$firm2, $user2] = $this->createFirmAndUser();
        $matter2 = Matter::factory()->forFirm($firm2, $user2)->create();
        TimeEntry::factory()->forMatter($matter2)->forUser($user2)->create();

        $this->actingAsUser($user)->get('/time')
            ->assertOk()
            ->assertInertia(fn ($page) => $page->where('entries.total', 0));
    }

    // ── Store ──────────────────────────────────────────────────────────

    public function test_can_log_time_entry(): void
    {
        [$firm, $user] = $this->createFirmAndUser();
        $matter = Matter::factory()->forFirm($firm, $user)->create();

        $this->actingAsUser($user)->postJson('/time', [
            'matter_id'        => $matter->id,
            'date'             => now()->toDateString(),
            'duration_minutes' => 60,
            'rate'             => 200.00,
            'billable'         => true,
            'activity_type'    => 'advising',
            'description'      => 'Initial consultation',
        ])->assertOk()
          ->assertJsonPath('entry.duration_minutes', 60);

        $this->assertDatabaseHas('time_entries', [
            'matter_id' => $matter->id,
            'user_id'   => $user->id,
            'amount'    => 200.00,
        ]);
    }

    public function test_amount_calculated_from_rate_and_duration(): void
    {
        [$firm, $user] = $this->createFirmAndUser(['rate_per_hour' => 300.00]);
        $matter = Matter::factory()->forFirm($firm, $user)->create();

        $response = $this->actingAsUser($user)->postJson('/time', [
            'matter_id'        => $matter->id,
            'date'             => now()->toDateString(),
            'duration_minutes' => 90,
            'rate'             => 300.00,
            'billable'         => true,
            'activity_type'    => 'advising',
        ]);

        $response->assertOk();
        $this->assertDatabaseHas('time_entries', [
            'matter_id' => $matter->id,
            'amount'    => 450.00,
        ]);
    }

    public function test_cannot_log_time_to_other_firms_matter(): void
    {
        [$firm,  $user]  = $this->createFirmAndUser();
        [$firm2, $user2] = $this->createFirmAndUser();
        $otherMatter = Matter::factory()->forFirm($firm2, $user2)->create();

        $this->actingAsUser($user)->postJson('/time', [
            'matter_id'        => $otherMatter->id,
            'date'             => now()->toDateString(),
            'duration_minutes' => 60,
            'rate'             => 200.00,
            'billable'         => true,
            'activity_type'    => 'advising',
        ])->assertStatus(422);
    }

    // ── Update ─────────────────────────────────────────────────────────

    public function test_can_update_unbilled_entry(): void
    {
        [$firm, $user] = $this->createFirmAndUser();
        $matter = Matter::factory()->forFirm($firm, $user)->create();
        $entry  = TimeEntry::factory()->forMatter($matter)->forUser($user)->create([
            'duration_minutes' => 60,
            'rate'             => 100.00,
            'amount'           => 100.00,
        ]);

        $this->actingAsUser($user)->putJson("/time/{$entry->id}", [
            'duration_minutes' => 120,
            'rate'             => 200.00,
        ])->assertOk();

        $this->assertDatabaseHas('time_entries', [
            'id'               => $entry->id,
            'duration_minutes' => 120,
            'amount'           => 400.00,
        ]);
    }

    public function test_cannot_update_billed_entry(): void
    {
        [$firm, $user] = $this->createFirmAndUser();
        $matter = Matter::factory()->forFirm($firm, $user)->create();
        $entry  = TimeEntry::factory()->billed()->forMatter($matter)->forUser($user)->create();

        $this->actingAsUser($user)->putJson("/time/{$entry->id}", [
            'duration_minutes' => 120,
        ])->assertStatus(422);
    }

    public function test_cannot_update_locked_entry(): void
    {
        [$firm, $user] = $this->createFirmAndUser();
        $matter = Matter::factory()->forFirm($firm, $user)->create();
        $entry  = TimeEntry::factory()->locked()->forMatter($matter)->forUser($user)->create();

        $this->actingAsUser($user)->putJson("/time/{$entry->id}", [
            'duration_minutes' => 120,
        ])->assertStatus(422);
    }

    // ── Destroy ────────────────────────────────────────────────────────

    public function test_can_delete_unbilled_entry(): void
    {
        [$firm, $user] = $this->createFirmAndAdmin();
        $matter = Matter::factory()->forFirm($firm, $user)->create();
        $entry  = TimeEntry::factory()->forMatter($matter)->forUser($user)->create();

        $this->actingAsUser($user)->deleteJson("/time/{$entry->id}")
            ->assertOk();

        $this->assertSoftDeleted('time_entries', ['id' => $entry->id]);
    }

    public function test_cannot_delete_billed_entry(): void
    {
        [$firm, $user] = $this->createFirmAndAdmin();
        $matter = Matter::factory()->forFirm($firm, $user)->create();
        $entry  = TimeEntry::factory()->billed()->forMatter($matter)->forUser($user)->create();

        $this->actingAsUser($user)->deleteJson("/time/{$entry->id}")
            ->assertStatus(422);
    }

    // ── Timer ──────────────────────────────────────────────────────────

    public function test_can_start_and_stop_timer(): void
    {
        [$firm, $user] = $this->createFirmAndUser();
        $matter = Matter::factory()->forFirm($firm, $user)->create();

        $this->actingAsUser($user)->postJson('/time/timer/start', [
            'matter_id' => $matter->id,
        ])->assertOk()
          ->assertJsonPath('timer.matter_id', $matter->id);

        $stop = $this->postJson('/time/timer/stop');
        $stop->assertOk()
             ->assertJsonPath('matter_id', $matter->id);
    }

    public function test_stop_timer_without_active_timer_returns_404(): void
    {
        [$firm, $user] = $this->createFirmAndUser();

        $this->actingAsUser($user)->postJson('/time/timer/stop')
            ->assertStatus(404);
    }

    // ── Stats ──────────────────────────────────────────────────────────

    public function test_stats_reflect_unbilled_time(): void
    {
        [$firm, $user] = $this->createFirmAndUser();
        $matter = Matter::factory()->forFirm($firm, $user)->create();

        TimeEntry::factory()->forMatter($matter)->forUser($user)->create([
            'date'             => now()->toDateString(),
            'duration_minutes' => 60,
            'rate'             => 200.00,
            'amount'           => 200.00,
            'billable'         => true,
            'billed'           => false,
        ]);

        $this->actingAsUser($user)->get('/time')
            ->assertOk()
            ->assertInertia(fn ($page) =>
                $page->where('stats.unbilled_hours', 1)
                     ->where('stats.unbilled_amount', 200)
            );
    }

    // ── Matters dropdown ───────────────────────────────────────────────

    public function test_on_hold_matter_appears_in_matters_dropdown(): void
    {
        [$firm, $user] = $this->createFirmAndUser();
        $matter = Matter::factory()->forFirm($firm, $user)->create(['status' => 'on_hold']);

        $this->actingAsUser($user)->get('/time')
            ->assertOk()
            ->assertInertia(fn ($page) =>
                $page->where('matters.0.id', $matter->id)
            );
    }

    public function test_closed_matter_excluded_from_matters_dropdown(): void
    {
        [$firm, $user] = $this->createFirmAndUser();
        Matter::factory()->forFirm($firm, $user)->closed()->create();

        $this->actingAsUser($user)->get('/time')
            ->assertOk()
            ->assertInertia(fn ($page) => $page->where('matters', []));
    }

    // ── Row ownership (matter Show table mirrors these rules) ──────────

    public function test_non_owner_cannot_update_or_delete_colleagues_entry(): void
    {
        [$firm, $user] = $this->createFirmAndUser();
        $other = User::factory()->forFirm($firm)->create();
        $mine = Matter::factory()->forFirm($firm)->create(['status' => 'open']);
        $this->assignToMatter($user, $mine);
        $this->assignToMatter($other, $mine);

        // Both hold the default lawyer set (edit/delete_time_entries).
        $this->assignFirmRole($other, 'lawyer');

        $entry = TimeEntry::factory()->forMatter($mine)->forUser($other)->create([
            'billed' => false, 'description' => 'Theirs',
        ]);

        $this->actingAsUser($user)
            ->putJson("/time/{$entry->id}", ['description' => 'Mine now'])
            ->assertForbidden();
        $this->assertSame('Theirs', $entry->fresh()->description);

        $this->actingAsUser($user)
            ->deleteJson("/time/{$entry->id}")
            ->assertForbidden();
        $this->assertDatabaseHas('time_entries', ['id' => $entry->id]);
    }

    public function test_owner_with_edit_permission_updates_own_open_entry(): void
    {
        [$firm, $user] = $this->createFirmAndUser();
        $mine = Matter::factory()->forFirm($firm)->create(['status' => 'open']);
        $this->assignToMatter($user, $mine);

        $entry = TimeEntry::factory()->forMatter($mine)->forUser($user)->create([
            'billed' => false, 'description' => 'Draft',
        ]);

        $this->actingAsUser($user)
            ->putJson("/time/{$entry->id}", ['description' => 'Final'])
            ->assertOk();
        $this->assertSame('Final', $entry->fresh()->description);
    }
}
