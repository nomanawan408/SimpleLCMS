<?php

namespace Tests\Feature;

use App\Models\Matter;
use App\Models\TimeSession;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TimerCheckoutTest extends TestCase
{
    use RefreshDatabase;

    public function test_checkout_fully_clears_the_session(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $matter = Matter::factory()->forFirm($firm, $admin)->create();

        $this->actingAsUser($admin)
            ->postJson('/time/checkin', ['matter_id' => $matter->id])
            ->assertOk();

        $this->actingAsUser($admin)->postJson('/time/checkout')->assertOk();

        $this->assertDatabaseMissing('time_sessions', ['user_id' => $admin->id]);
        $this->actingAsUser($admin)->get('/dashboard')
            ->assertInertia(fn ($page) => $page->where('activeTimer', null));
    }

    public function test_checkout_while_paused_clears_the_session(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $matter = Matter::factory()->forFirm($firm, $admin)->create();

        $this->actingAsUser($admin)->postJson('/time/checkin', ['matter_id' => $matter->id])->assertOk();
        $this->actingAsUser($admin)->postJson('/time/pause')->assertOk();
        $this->actingAsUser($admin)->postJson('/time/checkout')->assertOk();

        $this->assertDatabaseMissing('time_sessions', ['user_id' => $admin->id]);
        $this->assertSame(1, \App\Models\TimeEntry::where('user_id', $admin->id)->count());
    }

    public function test_double_checkout_does_not_duplicate_entries(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $matter = Matter::factory()->forFirm($firm, $admin)->create();

        $this->actingAsUser($admin)->postJson('/time/checkin', ['matter_id' => $matter->id])->assertOk();
        $this->actingAsUser($admin)->postJson('/time/checkout')->assertOk();
        $this->actingAsUser($admin)->postJson('/time/checkout')->assertStatus(404);

        $this->assertSame(1, \App\Models\TimeEntry::where('user_id', $admin->id)->count());
    }

    public function test_second_checkin_conflict_names_the_matter_holding_the_timer(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $first = Matter::factory()->forFirm($firm, $admin)->create();
        $second = Matter::factory()->forFirm($firm, $admin)->create();

        $this->actingAsUser($admin)
            ->postJson('/time/checkin', ['matter_id' => $first->id])
            ->assertOk();

        // Same matter or another: 409, and the client gets the active
        // timer's matter so it can link there instead of failing silently.
        $this->actingAsUser($admin)
            ->postJson('/time/checkin', ['matter_id' => $second->id])
            ->assertStatus(409)
            ->assertJsonPath('active_timer.matter_id', $first->id)
            ->assertJsonPath('active_timer.matter_name', $first->name);
    }

    public function test_checkin_rate_is_honoured_through_to_checkout(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $matter = Matter::factory()->forFirm($firm, $admin)->create();

        $this->actingAsUser($admin)
            ->postJson('/time/checkin', ['matter_id' => $matter->id, 'rate' => 250])
            ->assertOk()
            ->assertJsonPath('session.rate', 250);

        $this->assertSame(250.0, (float) TimeSession::where('user_id', $admin->id)->first()->rate);

        // No rate at checkout: the check-in rate carries over, not the default.
        $this->actingAsUser($admin)->postJson('/time/checkout')->assertOk();

        $this->assertSame(250.0, (float) \App\Models\TimeEntry::where('user_id', $admin->id)->first()->rate);
    }
}
