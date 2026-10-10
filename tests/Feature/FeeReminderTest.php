<?php

namespace Tests\Feature;

use App\Models\Matter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Fee reminders reuse the existing task pipeline: a "Set fee reminder"
 * shortcut on the matter Billing tab POSTs to the existing task store
 * endpoint (title "Chase outstanding fees", matter-linked, assignee =
 * responsible user, due date defaulting to +28 days). Zero new
 * tables/queues/schedulers -- the task then surfaces via the dashboard
 * widget, calendar deadline, and the daily TaskDueNotification.
 *
 * The closed-matter freeze is preserved: lawyers cannot attach tasks to
 * closed matters (403, mirroring TaskController@store +
 * Matter::ensureMutableBy); only firm admins bypass.
 */
class FeeReminderTest extends TestCase
{
    use RefreshDatabase;

    public function test_lawyer_can_create_fee_reminder_on_open_matter(): void
    {
        [$firm, $lawyer] = $this->createFirmAndUser(['role' => 'lawyer']);
        $matter = Matter::factory()->forFirm($firm, $lawyer)->create(['status' => 'open']);
        $this->assignToMatter($lawyer, $matter);

        $due = now()->addDays(28)->toDateString();

        $response = $this->actingAsUser($lawyer)->postJson('/tasks', [
            'title' => "Chase outstanding fees — {$matter->matter_number}",
            'description' => 'Fee reminder: chase payment.',
            'matter_id' => $matter->id,
            'assignee_id' => $matter->responsible_user_id,
            'due_date' => $due,
            'priority' => 'medium',
            'status' => 'todo',
        ]);

        $response->assertOk()->assertJsonPath('task.title', "Chase outstanding fees — {$matter->matter_number}");

        $taskId = $response->json('task.id');
        $this->assertDatabaseHas('tasks', [
            'id' => $taskId,
            'firm_id' => $firm->id,
            'matter_id' => $matter->id,
            'assignee_id' => $lawyer->id,
            'status' => 'todo',
            'priority' => 'medium',
        ]);

        $task = \App\Models\Task::find($taskId);
        $this->assertTrue(
            $task->due_date->isSameDay(now()->addDays(28)),
            'Fee reminder should default to 28 days out.'
        );
    }

    public function test_lawyer_fee_reminder_blocked_on_closed_matter(): void
    {
        [$firm, $lawyer] = $this->createFirmAndUser(['role' => 'lawyer']);
        $matter = Matter::factory()->forFirm($firm, $lawyer)->create(['status' => 'closed']);
        $this->assignToMatter($lawyer, $matter);

        $this->actingAsUser($lawyer)->postJson('/tasks', [
            'title' => "Chase outstanding fees — {$matter->matter_number}",
            'matter_id' => $matter->id,
            'assignee_id' => $matter->responsible_user_id,
            'due_date' => now()->addDays(28)->toDateString(),
            'priority' => 'medium',
        ])->assertForbidden();

        $this->assertDatabaseMissing('tasks', [
            'matter_id' => $matter->id,
            'title' => "Chase outstanding fees — {$matter->matter_number}",
        ]);
    }

    public function test_admin_can_create_fee_reminder_on_closed_matter(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $matter = Matter::factory()->forFirm($firm, $admin)->create(['status' => 'closed']);

        $response = $this->actingAsUser($admin)->postJson('/tasks', [
            'title' => "Chase outstanding fees — {$matter->matter_number}",
            'description' => 'Fee reminder: chase payment.',
            'matter_id' => $matter->id,
            'assignee_id' => $matter->responsible_user_id,
            'due_date' => now()->addDays(28)->toDateString(),
            'priority' => 'medium',
        ]);

        $response->assertOk();

        $this->assertDatabaseHas('tasks', [
            'id' => $response->json('task.id'),
            'matter_id' => $matter->id,
            'assignee_id' => $admin->id,
        ]);
    }
}
