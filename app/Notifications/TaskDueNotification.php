<?php

namespace App\Notifications;

use App\Models\Task;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

/**
 * Sent to a task's assignee once, on the day it becomes due tomorrow, and
 * once more, on the day it becomes overdue -- not every day it remains
 * overdue afterwards. See App\Console\Commands\SendDeadlineNotifications,
 * which only ever queries for tasks whose due_date is exactly "tomorrow" or
 * exactly "yesterday" (i.e. one day overdue), so each milestone is crossed
 * on exactly one calendar day and this naturally fires only once per task.
 */
class TaskDueNotification extends Notification
{
    use Queueable;

    public function __construct(
        private readonly Task $task,
        private readonly bool $overdue,
    ) {}

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function toArray(object $notifiable): array
    {
        return [
            'title' => $this->overdue ? 'Task overdue' : 'Task due tomorrow',
            'message' => $this->overdue
                ? sprintf('"%s" was due yesterday and is not yet done.', $this->task->title)
                : sprintf('"%s" is due tomorrow.', $this->task->title),
            'url' => '/tasks',
            'icon' => 'task',
            // Lets the scheduled command that sends these check "have I
            // already notified about this exact task+milestone today", so
            // running it twice in one day (a re-run, a misfired cron) cannot
            // double-send.
            'task_id' => $this->task->id,
            'overdue' => $this->overdue,
        ];
    }
}
