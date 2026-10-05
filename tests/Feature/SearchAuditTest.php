<?php

namespace Tests\Feature;

use App\Models\Invoice;
use App\Models\Matter;
use App\Models\Task;
use App\Models\TimeEntry;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Every search surface must answer (200 + correctly filtered), never blow
 * up. Regression guard: the contacts search once 500'd on every query
 * because its closure captured an undefined $search variable.
 */
class SearchAuditTest extends TestCase
{
    use RefreshDatabase;

    public function test_contacts_search_filters_without_error(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        \App\Models\Contact::factory()->forFirm($firm)->create(['name' => 'Amelia Hart', 'email' => 'amelia@example.com']);
        \App\Models\Contact::factory()->forFirm($firm)->create(['name' => 'Brian Cole', 'email' => 'brian@example.com']);

        $this->actingAsUser($admin)->get('/contacts?search=Amelia')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('contacts.total', 1)
                ->where('contacts.data.0.name', 'Amelia Hart'));

        $this->actingAsUser($admin)->get('/contacts?search=brian@example.com')
            ->assertOk()
            ->assertInertia(fn ($page) => $page->where('contacts.total', 1));

        $this->actingAsUser($admin)->get('/contacts?search=zzz-no-match')
            ->assertOk()
            ->assertInertia(fn ($page) => $page->where('contacts.total', 0));
    }

    public function test_matters_search_filters_without_error(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        Matter::factory()->forFirm($firm, $admin)->create(['name' => 'Riverside Claim']);
        Matter::factory()->forFirm($firm, $admin)->create(['name' => 'Hilltop Defence']);

        $this->actingAsUser($admin)->get('/matters?search=Riverside')
            ->assertOk()
            ->assertInertia(fn ($page) => $page->where('matters.total', 1));
    }

    public function test_time_search_filters_without_error(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $matter = Matter::factory()->forFirm($firm, $admin)->create();
        TimeEntry::factory()->forFirm($firm)->create([
            'matter_id' => $matter->id, 'user_id' => $admin->id, 'description' => 'Court attendance',
        ]);
        TimeEntry::factory()->forFirm($firm)->create([
            'matter_id' => $matter->id, 'user_id' => $admin->id, 'description' => 'Filing paperwork',
        ]);

        $this->actingAsUser($admin)->get('/time?search=Court')
            ->assertOk()
            ->assertInertia(fn ($page) => $page->where('entries.total', 1));
    }

    public function test_tasks_search_filters_without_error(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        Task::factory()->forFirm($firm, $admin)->create(['title' => 'Prepare bundle']);
        Task::factory()->forFirm($firm, $admin)->create(['title' => 'Call client']);

        $this->actingAsUser($admin)->get('/tasks?search=bundle')
            ->assertOk()
            ->assertInertia(fn ($page) => $page->where('tasks.total', 1));
    }

    public function test_billing_search_filters_without_error(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $matter = Matter::factory()->forFirm($firm, $admin)->create();
        Invoice::factory()->forFirm($firm)->forMatter($matter)->create(['invoice_number' => 'INV-2026-0001']);
        Invoice::factory()->forFirm($firm)->forMatter($matter)->create(['invoice_number' => 'INV-2026-0002']);

        $this->actingAsUser($admin)->get('/billing?search=0001')
            ->assertOk()
            ->assertInertia(fn ($page) => $page->where('invoices.total', 1));
    }

    public function test_global_search_handles_special_characters(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();

        foreach (["o'brien", '100%', 'under_score', '"quoted"'] as $q) {
            $this->actingAsUser($admin)->getJson('/search?q=' . urlencode($q))->assertOk();
        }
    }

    public function test_search_combines_with_sorting(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        Matter::factory()->forFirm($firm, $admin)->create(['name' => 'Zulu Trust']);
        Matter::factory()->forFirm($firm, $admin)->create(['name' => 'Alpha Trust']);

        $this->actingAsUser($admin)->get('/matters?search=Trust&sort_by=matter&sort_dir=asc')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('matters.total', 2)
                ->where('matters.data', fn ($data) => collect($data)->pluck('name')->all() === ['Alpha Trust', 'Zulu Trust']));
    }
}
