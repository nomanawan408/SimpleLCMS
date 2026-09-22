<?php

namespace Tests\Feature;

use App\Models\Task;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DashboardTest extends TestCase
{
    use RefreshDatabase;

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
