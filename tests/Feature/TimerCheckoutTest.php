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
}
