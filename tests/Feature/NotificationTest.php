<?php

namespace Tests\Feature;

use App\Console\Commands\SendDeadlineNotifications;
use App\Models\CalendarEvent;
use App\Models\Contact;
use App\Models\Document;
use App\Models\Invoice;
use App\Models\Matter;
use App\Models\Task;
use App\Models\User;
use App\Notifications\DocumentUploadedNotification;
use App\Notifications\HearingDateApproachingNotification;
use App\Notifications\InvoiceOverdueNotification;
use App\Notifications\TaskAssignedNotification;
use App\Notifications\TaskDueNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Artisan;
use Tests\TestCase;

class NotificationTest extends TestCase
{
    use RefreshDatabase;

    // ── Immediate: task assignment ──────────────────────────────────────

    public function test_assigning_a_task_to_someone_else_notifies_them(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $assignee = User::factory()->forFirm($firm)->create();

        $this->actingAsUser($admin)->postJson('/tasks', [
            'title' => 'Draft the witness statement',
            'priority' => 'high',
            'assignee_id' => $assignee->id,
        ])->assertOk();

        $this->assertCount(1, $assignee->fresh()->notifications);
        $this->assertSame(TaskAssignedNotification::class, $assignee->fresh()->notifications->first()->type);
    }

    public function test_assigning_a_task_to_yourself_does_not_notify_you(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();

        $this->actingAsUser($admin)->postJson('/tasks', [
            'title' => 'Self-assigned task',
            'priority' => 'medium',
            'assignee_id' => $admin->id,
        ])->assertOk();

        $this->assertCount(0, $admin->fresh()->notifications);
    }

    public function test_reassigning_a_task_notifies_the_new_assignee_only(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $first = User::factory()->forFirm($firm)->create();
        $second = User::factory()->forFirm($firm)->create();
        $task = Task::factory()->forFirm($firm, $admin)->create(['assignee_id' => $first->id]);

        $this->actingAsUser($admin)->putJson("/tasks/{$task->id}", ['assignee_id' => $second->id])
            ->assertOk();

        $this->assertCount(0, $first->fresh()->notifications);
        $this->assertCount(1, $second->fresh()->notifications);
    }

    // ── Immediate: document upload ──────────────────────────────────────

    public function test_uploading_a_document_notifies_the_matters_responsible_solicitor(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $solicitor = User::factory()->forFirm($firm)->create();
        $matter = Matter::factory()->create(['firm_id' => $firm->id, 'responsible_user_id' => $solicitor->id]);

        $this->actingAsUser($admin)->post('/documents', [
            'file' => UploadedFile::fake()->create('bundle.pdf', 100, 'application/pdf'),
            'matter_id' => $matter->id,
        ])->assertRedirect();

        $this->assertCount(1, $solicitor->fresh()->notifications);
        $this->assertSame(DocumentUploadedNotification::class, $solicitor->fresh()->notifications->first()->type);
    }

    public function test_uploading_your_own_matters_document_does_not_notify_you(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $matter = Matter::factory()->create(['firm_id' => $firm->id, 'responsible_user_id' => $admin->id]);

        $this->actingAsUser($admin)->post('/documents', [
            'file' => UploadedFile::fake()->create('bundle.pdf', 100, 'application/pdf'),
            'matter_id' => $matter->id,
        ])->assertRedirect();

        $this->assertCount(0, $admin->fresh()->notifications);
    }

    // ── Scheduled: tasks due ─────────────────────────────────────────────

    public function test_a_task_due_tomorrow_notifies_its_assignee(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $assignee = User::factory()->forFirm($firm)->create();
        Task::factory()->forFirm($firm, $admin)->create([
            'assignee_id' => $assignee->id, 'due_date' => now()->addDay()->toDateString(), 'status' => 'todo',
        ]);

        Artisan::call('app:send-deadline-notifications');

        $this->assertCount(1, $assignee->fresh()->notifications);
        $data = $assignee->fresh()->notifications->first()->data;
        $this->assertFalse($data['overdue']);
    }

    public function test_a_task_overdue_by_one_day_notifies_its_assignee(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $assignee = User::factory()->forFirm($firm)->create();
        Task::factory()->forFirm($firm, $admin)->create([
            'assignee_id' => $assignee->id, 'due_date' => now()->subDay()->toDateString(), 'status' => 'todo',
        ]);

        Artisan::call('app:send-deadline-notifications');

        $this->assertCount(1, $assignee->fresh()->notifications);
        $this->assertTrue($assignee->fresh()->notifications->first()->data['overdue']);
    }

    public function test_a_completed_task_is_never_notified_about(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $assignee = User::factory()->forFirm($firm)->create();
        Task::factory()->forFirm($firm, $admin)->done()->create([
            'assignee_id' => $assignee->id, 'due_date' => now()->subDay()->toDateString(),
        ]);

        Artisan::call('app:send-deadline-notifications');

        $this->assertCount(0, $assignee->fresh()->notifications);
    }

    public function test_a_task_due_in_five_days_is_not_yet_notified_about(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $assignee = User::factory()->forFirm($firm)->create();
        Task::factory()->forFirm($firm, $admin)->create([
            'assignee_id' => $assignee->id, 'due_date' => now()->addDays(5)->toDateString(),
        ]);

        Artisan::call('app:send-deadline-notifications');

        $this->assertCount(0, $assignee->fresh()->notifications);
    }

    /** Running the command twice in one day (a re-run, a misfired cron) must not double-send. */
    public function test_running_the_command_twice_in_one_day_does_not_duplicate(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $assignee = User::factory()->forFirm($firm)->create();
        Task::factory()->forFirm($firm, $admin)->create([
            'assignee_id' => $assignee->id, 'due_date' => now()->addDay()->toDateString(),
        ]);

        Artisan::call('app:send-deadline-notifications');
        Artisan::call('app:send-deadline-notifications');

        $this->assertCount(1, $assignee->fresh()->notifications);
    }

    // ── Scheduled: hearings ──────────────────────────────────────────────

    public function test_a_hearing_exactly_three_days_out_notifies_the_responsible_solicitor(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $solicitor = User::factory()->forFirm($firm)->create();
        $matter = Matter::factory()->create(['firm_id' => $firm->id, 'responsible_user_id' => $solicitor->id]);
        CalendarEvent::factory()->forFirm($firm, $admin)->create([
            'matter_id' => $matter->id, 'is_court_date' => true, 'start_at' => now()->addDays(3)->setTime(10, 0),
        ]);

        Artisan::call('app:send-deadline-notifications');

        $this->assertCount(1, $solicitor->fresh()->notifications);
        $this->assertSame(HearingDateApproachingNotification::class, $solicitor->fresh()->notifications->first()->type);
    }

    public function test_a_hearing_ten_days_out_is_not_yet_notified_about(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $solicitor = User::factory()->forFirm($firm)->create();
        $matter = Matter::factory()->create(['firm_id' => $firm->id, 'responsible_user_id' => $solicitor->id]);
        CalendarEvent::factory()->forFirm($firm, $admin)->create([
            'matter_id' => $matter->id, 'is_court_date' => true, 'start_at' => now()->addDays(10)->setTime(10, 0),
        ]);

        Artisan::call('app:send-deadline-notifications');

        $this->assertCount(0, $solicitor->fresh()->notifications);
    }

    // ── Scheduled: invoices ──────────────────────────────────────────────

    public function test_an_invoice_overdue_by_one_day_notifies_the_responsible_solicitor(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $solicitor = User::factory()->forFirm($firm)->create();
        $matter = Matter::factory()->create(['firm_id' => $firm->id, 'responsible_user_id' => $solicitor->id]);
        Invoice::factory()->create([
            'firm_id' => $firm->id, 'matter_id' => $matter->id,
            'status' => 'sent', 'due_date' => now()->subDay()->toDateString(),
        ]);

        Artisan::call('app:send-deadline-notifications');

        $this->assertCount(1, $solicitor->fresh()->notifications);
        $this->assertSame(InvoiceOverdueNotification::class, $solicitor->fresh()->notifications->first()->type);
    }

    public function test_a_paid_invoice_past_its_due_date_is_never_notified_about(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $solicitor = User::factory()->forFirm($firm)->create();
        $matter = Matter::factory()->create(['firm_id' => $firm->id, 'responsible_user_id' => $solicitor->id]);
        Invoice::factory()->create([
            'firm_id' => $firm->id, 'matter_id' => $matter->id,
            'status' => 'paid', 'due_date' => now()->subDay()->toDateString(),
        ]);

        Artisan::call('app:send-deadline-notifications');

        $this->assertCount(0, $solicitor->fresh()->notifications);
    }

    // ── Endpoints & access control ───────────────────────────────────────

    public function test_recent_endpoint_returns_only_the_authenticated_users_own_notifications(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $other = User::factory()->forFirm($firm)->create();

        $task = Task::factory()->forFirm($firm, $admin)->create();
        $admin->notify(new TaskAssignedNotification($task, $admin));
        $other->notify(new TaskAssignedNotification($task, $admin));

        $response = $this->actingAsUser($admin)->getJson('/notifications/recent')->assertOk();

        $response->assertJsonCount(1, 'notifications');
        $this->assertSame(1, $response->json('unread_count'));
    }

    public function test_marking_a_notification_read_updates_read_at(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $task = Task::factory()->forFirm($firm, $admin)->create();
        $admin->notify(new TaskAssignedNotification($task, $admin));
        $notification = $admin->fresh()->notifications->first();

        $this->actingAsUser($admin)->postJson("/notifications/{$notification->id}/read")->assertOk();

        $this->assertNotNull($notification->fresh()->read_at);
    }

    /** A user must never be able to mark someone else's notification as read. */
    public function test_a_user_cannot_mark_another_users_notification_as_read(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $other = User::factory()->forFirm($firm)->create();
        $task = Task::factory()->forFirm($firm, $admin)->create();
        $other->notify(new TaskAssignedNotification($task, $admin));
        $notification = $other->fresh()->notifications->first();

        $this->actingAsUser($admin)->postJson("/notifications/{$notification->id}/read")->assertNotFound();

        $this->assertNull($notification->fresh()->read_at);
    }

    public function test_mark_all_read_clears_every_unread_notification_for_that_user(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $task = Task::factory()->forFirm($firm, $admin)->create();
        $admin->notify(new TaskAssignedNotification($task, $admin));
        $admin->notify(new TaskAssignedNotification($task, $admin));

        $this->actingAsUser($admin)->postJson('/notifications/read-all')
            ->assertOk()
            ->assertJson(['unread_count' => 0]);

        $this->assertSame(0, $admin->fresh()->unreadNotifications()->count());
    }

    public function test_the_shared_unread_count_reflects_actual_unread_notifications(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $task = Task::factory()->forFirm($firm, $admin)->create();
        $admin->notify(new TaskAssignedNotification($task, $admin));

        $this->actingAsUser($admin)->get('/dashboard')
            ->assertInertia(fn ($page) => $page->where('unreadNotificationsCount', 1));
    }

    public function test_notifications_index_page_lists_the_users_own_notifications_paginated(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $task = Task::factory()->forFirm($firm, $admin)->create();
        $admin->notify(new TaskAssignedNotification($task, $admin));

        $this->actingAsUser($admin)->get('/notifications')
            ->assertOk()
            ->assertInertia(fn ($page) => $page->where('notifications.total', 1));
    }
}
