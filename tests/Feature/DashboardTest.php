<?php

namespace Tests\Feature;

use App\Models\Matter;
use App\Models\Task;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DashboardTest extends TestCase
{
    use RefreshDatabase;

    public function test_matter_state_buckets_partition_every_status(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $mk = fn (string $status) => Matter::factory()->forFirm($firm, $admin)->create(['status' => $status]);

        $mk('open');
        $mk('awaiting_client');
        $mk('in_progress');
        $mk('in_review');
        $mk('on_hold');
        $mk('closed');
        $mk('archived');

        $this->actingAsUser($admin)->get('/dashboard')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('stats.opened_matters', 2)
                ->where('stats.in_progress_matters', 2)
                ->where('stats.on_hold_matters', 1)
                ->where('stats.closed_matters', 2));
    }

    public function test_upcoming_widget_keeps_only_recent_overdues(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $recent = Task::factory()->forFirm($firm, $admin)->create(['status' => 'todo', 'due_date' => now()->subDays(2)->toDateString()]);
        $stale = Task::factory()->forFirm($firm, $admin)->create(['status' => 'todo', 'due_date' => now()->subDays(13)->toDateString()]);
        $future = Task::factory()->forFirm($firm, $admin)->create(['status' => 'todo', 'due_date' => now()->addDay()->toDateString()]);

        $this->actingAsUser($admin)->get('/dashboard')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                // Stale overdue stays in the count but leaves the widget.
                ->where('stats.overdue_tasks', 2)
                ->where('upcomingTasks', fn ($tasks) => collect($tasks)->pluck('id')->sort()->values()->all()
                    === collect([$recent->id, $future->id])->sort()->values()->all())
                ->where('upcomingTasks', fn ($tasks) => collect($tasks)->pluck('id')->doesntContain($stale->id)));
    }
}
