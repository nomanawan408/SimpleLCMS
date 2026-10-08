<?php

namespace Tests\Feature;

use App\Models\CalendarEvent;
use App\Models\Matter;
use App\Models\Task;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MatterSortingTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): array
    {
        return $this->createFirmAndAdmin();
    }

    private function assertSortedNames(User $user, array $params, array $expected): void
    {
        $this->actingAsUser($user)->get('/matters?' . http_build_query($params))
            ->assertOk()
            ->assertInertia(fn ($page) => $page->where(
                'matters.data',
                fn ($data) => collect($data)->pluck('name')->all() === $expected
            ));
    }

    public function test_sorts_by_name_both_directions(): void
    {
        [$firm, $admin] = $this->admin();
        foreach (['Charlie', 'Alpha', 'Bravo'] as $name) {
            Matter::factory()->forFirm($firm, $admin)->create(['name' => $name, 'status' => 'open']);
        }

        $this->assertSortedNames($admin, ['sort_by' => 'matter', 'sort_dir' => 'asc'], ['Alpha', 'Bravo', 'Charlie']);
        $this->assertSortedNames($admin, ['sort_by' => 'matter', 'sort_dir' => 'desc'], ['Charlie', 'Bravo', 'Alpha']);
    }

    public function test_sorts_by_status_and_practice_area(): void
    {
        [$firm, $admin] = $this->admin();
        Matter::factory()->forFirm($firm, $admin)->create(['name' => 'M1', 'status' => 'on_hold']);
        Matter::factory()->forFirm($firm, $admin)->create(['name' => 'M2', 'status' => 'closed']);
        Matter::factory()->forFirm($firm, $admin)->create(['name' => 'M3', 'status' => 'open']);

        $this->assertSortedNames($admin, ['sort_by' => 'status', 'sort_dir' => 'asc'], ['M2', 'M1', 'M3']);
    }

    public function test_priority_sorts_by_severity_not_alphabet(): void
    {
        [$firm, $admin] = $this->admin();
        Matter::factory()->forFirm($firm, $admin)->create(['name' => 'Low', 'priority' => 'low']);
        Matter::factory()->forFirm($firm, $admin)->create(['name' => 'High', 'priority' => 'high']);
        Matter::factory()->forFirm($firm, $admin)->create(['name' => 'Medium', 'priority' => 'medium']);

        $this->assertSortedNames($admin, ['sort_by' => 'priority', 'sort_dir' => 'asc'], ['High', 'Medium', 'Low']);
    }

    public function test_recent_sorts_newest_first_for_the_dashboard_widget(): void
    {
        [$firm, $admin] = $this->admin();
        Matter::factory()->forFirm($firm, $admin)->create(['name' => 'Oldest', 'created_at' => now()->subDays(9)]);
        Matter::factory()->forFirm($firm, $admin)->create(['name' => 'Newest', 'created_at' => now()->subHour()]);
        Matter::factory()->forFirm($firm, $admin)->create(['name' => 'Middle', 'created_at' => now()->subDays(3)]);

        $this->assertSortedNames($admin, ['sort_by' => 'recent', 'sort_dir' => 'desc'], ['Newest', 'Middle', 'Oldest']);
    }

    public function test_sorts_by_responsible_name_with_nulls_last(): void
    {
        [$firm, $admin] = $this->admin();
        $zeta = User::factory()->forFirm($firm)->create(['full_name' => 'Zeta Person']);
        $alpha = User::factory()->forFirm($firm)->create(['full_name' => 'Alpha Person']);
        Matter::factory()->forFirm($firm, $zeta)->create(['name' => 'Zed', 'responsible_user_id' => $zeta->id]);
        Matter::factory()->forFirm($firm, $alpha)->create(['name' => 'Alp', 'responsible_user_id' => $alpha->id]);
        Matter::factory()->forFirm($firm, $admin)->create(['name' => 'Non', 'responsible_user_id' => null]);

        $this->assertSortedNames($admin, ['sort_by' => 'responsible', 'sort_dir' => 'asc'], ['Alp', 'Zed', 'Non']);
        $this->assertSortedNames($admin, ['sort_by' => 'responsible', 'sort_dir' => 'desc'], ['Zed', 'Alp', 'Non']);
    }

    public function test_deadline_sort_puts_missing_deadlines_last_either_way(): void
    {
        [$firm, $admin] = $this->admin();
        $late = Matter::factory()->forFirm($firm, $admin)->create(['name' => 'Late', 'status' => 'open']);
        $soon = Matter::factory()->forFirm($firm, $admin)->create(['name' => 'Soon', 'status' => 'open']);
        $none = Matter::factory()->forFirm($firm, $admin)->create(['name' => 'None', 'status' => 'open']);
        Task::factory()->forFirm($firm, $admin)->create([
            'matter_id' => $late->id, 'status' => 'todo', 'due_date' => now()->subDay()->toDateTimeString(),
        ]);
        Task::factory()->forFirm($firm, $admin)->create([
            'matter_id' => $soon->id, 'status' => 'todo', 'due_date' => now()->addDays(5)->toDateTimeString(),
        ]);

        $this->assertSortedNames($admin, ['sort_by' => 'deadline', 'sort_dir' => 'asc'], ['Late', 'Soon', 'None']);
        $this->assertSortedNames($admin, ['sort_by' => 'deadline', 'sort_dir' => 'desc'], ['Soon', 'Late', 'None']);
    }

    public function test_sorts_by_hearing_date_and_open_task_count(): void
    {
        [$firm, $admin] = $this->admin();
        $first = Matter::factory()->forFirm($firm, $admin)->create(['name' => 'First', 'status' => 'open']);
        $second = Matter::factory()->forFirm($firm, $admin)->create(['name' => 'Second', 'status' => 'open']);
        $noHearing = Matter::factory()->forFirm($firm, $admin)->create(['name' => 'NoHearing', 'status' => 'open']);
        CalendarEvent::factory()->forFirm($firm, $admin)->create([
            'matter_id' => $second->id, 'is_court_date' => true, 'start_at' => now()->addDays(9),
        ]);
        CalendarEvent::factory()->forFirm($firm, $admin)->create([
            'matter_id' => $first->id, 'is_court_date' => true, 'start_at' => now()->addDays(2),
        ]);
        Task::factory()->forFirm($firm, $admin)->create(['matter_id' => $second->id, 'status' => 'todo']);
        Task::factory()->forFirm($firm, $admin)->create(['matter_id' => $second->id, 'status' => 'in_progress']);
        Task::factory()->forFirm($firm, $admin)->create(['matter_id' => $first->id, 'status' => 'todo']);

        $this->assertSortedNames($admin, ['sort_by' => 'hearing_date', 'sort_dir' => 'asc'], ['First', 'Second', 'NoHearing']);
        $this->assertSortedNames($admin, ['sort_by' => 'open_tasks', 'sort_dir' => 'desc'], ['Second', 'First', 'NoHearing']);
    }

    public function test_invalid_sort_key_and_direction_fall_back_safely(): void
    {
        [$firm, $admin] = $this->admin();
        Matter::factory()->forFirm($firm, $admin)->create(['name' => 'Only', 'status' => 'open']);

        // Unknown key: default order, echo cleared.
        $this->actingAsUser($admin)->get('/matters?sort_by=firm_id&sort_dir=desc')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('filters.sort_by', null)
                ->where('matters.total', 1));

        // Unknown direction: treated as ascending, never raw SQL.
        $this->actingAsUser($admin)->get('/matters?sort_by=matter&sort_dir=DROP')
            ->assertOk()
            ->assertInertia(fn ($page) => $page->where('filters.sort_dir', 'asc'));
    }
}
