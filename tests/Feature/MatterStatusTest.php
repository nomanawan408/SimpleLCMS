<?php

namespace Tests\Feature;

use App\Models\Contact;
use App\Models\Matter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Covers the status values added on top of the original
 * open/pending_court_date/awaiting_client/awaiting_opponent/on_hold/closed/
 * archived set, and the "still counts as an active matter" logic that goes
 * with them.
 */
class MatterStatusTest extends TestCase
{
    use RefreshDatabase;

    /** Every status the database column accepts must also pass validation, or vice versa. */
    public function test_every_declared_status_is_accepted_by_the_database_and_validation(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $matter = Matter::factory()->forFirm($firm, $admin)->create();

        foreach (Matter::ALL_STATUSES as $status) {
            $this->actingAsUser($admin)
                ->patch("/matters/{$matter->id}", ['status' => $status])
                ->assertRedirect();

            $this->assertDatabaseHas('matters', ['id' => $matter->id, 'status' => $status]);
        }
    }

    public function test_an_unknown_status_is_a_validation_error_not_a_server_error(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $matter = Matter::factory()->forFirm($firm, $admin)->create();

        $this->actingAsUser($admin)
            ->patch("/matters/{$matter->id}", ['status' => 'invented_status'])
            ->assertSessionHasErrors('status');
    }

    public function test_new_awaiting_statuses_are_selectable(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $matter = Matter::factory()->forFirm($firm, $admin)->create();

        foreach ([
            'awaiting_response',
            'awaiting_third_party',
            'awaiting_respondent_solicitors',
            'awaiting_claimant_solicitors',
        ] as $status) {
            $this->actingAsUser($admin)
                ->patch("/matters/{$matter->id}", ['status' => $status])
                ->assertRedirect();

            $this->assertDatabaseHas('matters', ['id' => $matter->id, 'status' => $status]);
        }
    }

    /**
     * A matter moved into one of the "actively being worked" statuses must
     * keep counting as open everywhere status = 'open' used to be checked
     * literally: the dashboard's open-matters figure, the invoice-creation
     * matter picker, and the reports page's default filter. Otherwise a
     * matter disappears from all three the moment someone gives it a more
     * specific status, despite nothing about the work actually changing.
     */
    public function test_actively_working_statuses_still_count_as_open(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();

        foreach (Matter::ACTIVE_STATUSES as $status) {
            $matter = Matter::factory()->forFirm($firm, $admin)->create(['status' => $status, 'name' => "Matter ({$status})"]);

            $this->actingAsUser($admin)->get('/dashboard')
                ->assertInertia(fn ($page) => $page->where('stats.open_matters', fn ($count) => $count >= 1));

            $this->actingAsUser($admin)->get('/billing/create')
                ->assertInertia(fn ($page) => $page->has('matters', fn ($matters) => $matters
                    ->where('0.id', $matter->id)
                    ->etc()));

            $matter->delete();
        }
    }

    /**
     * The new "awaiting" statuses behave like the existing awaiting_client /
     * awaiting_opponent: waiting on someone else's action, so they do not
     * count toward the same three checks. This documents the intended
     * design rather than leaving it as an accidental omission.
     */
    public function test_awaiting_statuses_do_not_count_as_open(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();

        $awaiting = ['awaiting_response', 'awaiting_third_party', 'awaiting_respondent_solicitors', 'awaiting_claimant_solicitors'];

        foreach ($awaiting as $status) {
            $matter = Matter::factory()->forFirm($firm, $admin)->create(['status' => $status]);

            $this->actingAsUser($admin)->get('/dashboard')
                ->assertInertia(fn ($page) => $page->where('stats.open_matters', 0));

            $this->actingAsUser($admin)->get('/billing/create')
                ->assertInertia(fn ($page) => $page->has('matters', 0));

            $matter->delete();
        }
    }

    public function test_matters_index_can_filter_by_a_new_status(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        Matter::factory()->forFirm($firm, $admin)->create(['status' => 'awaiting_third_party']);
        Matter::factory()->forFirm($firm, $admin)->create(['status' => 'open']);

        $this->actingAsUser($admin)
            ->get('/matters?status=awaiting_third_party')
            ->assertInertia(fn ($page) => $page->where('matters.total', 1));
    }
}
