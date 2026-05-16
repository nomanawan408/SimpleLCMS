<?php

namespace Tests\Feature;

use App\Models\Matter;
use App\Models\Task;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TaskTest extends TestCase
{
    use RefreshDatabase;

    public function test_can_list_tasks(): void
    {
        [$firm, $user] = $this->createFirmAndUser();
        Task::factory()->forFirm($firm, $user)->count(4)->create();

        $this->actingAsUser($user)->get('/tasks')
            ->assertOk()
            ->assertInertia(fn ($page) => $page->where('tasks.total', 4));
    }

    public function test_can_create_task(): void
    {
        [$firm, $user] = $this->createFirmAndUser();

        $this->actingAsUser($user)->post('/tasks', [
            'title'    => 'Draft contract',
            'priority' => 'high',
            'due_date' => now()->addDays(3)->toDateString(),
        ])->assertRedirect();

        $this->assertDatabaseHas('tasks', [
            'firm_id' => $firm->id,
            'title'   => 'Draft contract',
            'status'  => 'todo',
        ]);
    }

    public function test_can_assign_task_to_user(): void
    {
        [$firm, $user] = $this->createFirmAndUser();
        $assignee = User::factory()->forFirm($firm)->create();
        $matter   = Matter::factory()->forFirm($firm, $user)->create();

        $this->actingAsUser($user)->post('/tasks', [
            'title'       => 'File documents',
            'priority'    => 'medium',
            'assignee_id' => $assignee->id,
            'matter_id'   => $matter->id,
        ])->assertRedirect();

        $this->assertDatabaseHas('tasks', [
            'firm_id'     => $firm->id,
            'assignee_id' => $assignee->id,
            'matter_id'   => $matter->id,
        ]);
    }

    public function test_can_update_task_status(): void
    {
        [$firm, $user] = $this->createFirmAndUser();
        $task = Task::factory()->forFirm($firm, $user)->create(['status' => 'todo']);

        $this->actingAsUser($user)->put("/tasks/{$task->id}", [
            'status' => 'in_progress',
        ])->assertRedirect();

        $this->assertDatabaseHas('tasks', ['id' => $task->id, 'status' => 'in_progress']);
    }

    public function test_task_firm_isolation(): void
    {
        [$firm,  $user]  = $this->createFirmAndUser();
        [$firm2, $user2] = $this->createFirmAndUser();
        Task::factory()->forFirm($firm2, $user2)->count(3)->create();

        $this->actingAsUser($user)->get('/tasks')
            ->assertOk()
            ->assertInertia(fn ($page) => $page->where('tasks.total', 0));
    }
}
