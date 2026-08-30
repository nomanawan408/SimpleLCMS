<?php

namespace App\Notifications;

use App\Models\Task;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

/**
 * Sent when a task is assigned to someone -- on creation, or when an existing
 * task's assignee changes. Never sent to the person doing the assigning: you
 * do not need to be told you just did something.
 *
 * Database-only (no mail/broadcast channel). This app has no real-time
 * transport configured -- Reverb is a listed dependency but not running, and
 * the frontend has no WebSocket client -- so the bell polls instead of
 * pushing. See routes/console.php and the notification bell's poll interval.
 */
class TaskAssignedNotification extends Notification
{
    use Queueable;

    public function __construct(
        private readonly Task $task,
        private readonly User $assignedBy,
    ) {}

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function toArray(object $notifiable): array
    {
        return [
            'title' => 'Task assigned to you',
            'message' => sprintf('"%s" was assigned to you by %s.', $this->task->title, $this->assignedBy->full_name),
            'url' => '/tasks',
            'icon' => 'task',
        ];
    }
}
