<?php

namespace App\Console\Commands;

use App\Models\CalendarEvent;
use App\Models\Invoice;
use App\Models\Task;
use App\Notifications\HearingDateApproachingNotification;
use App\Notifications\InvoiceOverdueNotification;
use App\Notifications\TaskDueNotification;
use Illuminate\Console\Command;
use Illuminate\Notifications\DatabaseNotification;
use Illuminate\Support\Carbon;

/**
 * Sends the time-based notifications: a task due tomorrow, a task that
 * became overdue yesterday, a hearing 3 days out, an invoice that became
 * overdue yesterday. Immediate notifications (task assigned, document
 * uploaded) fire directly from their controllers instead -- there is
 * nothing to schedule about those.
 *
 * Deliberately queries for the exact day each threshold is crossed
 * (due_date = tomorrow, not due_date <= tomorrow) rather than an
 * open-ended range, so a matter crosses each milestone once and is not
 * re-notified every day it stays in that state afterwards.
 *
 * Requires the Laravel scheduler to actually run: add a single cron entry on
 * the server --
 *   * * * * * php /path/to/artisan schedule:run >> /dev/null 2>&1
 * -- see routes/console.php for the schedule itself.
 */
class SendDeadlineNotifications extends Command
{
    protected $signature = 'app:send-deadline-notifications';

    protected $description = 'Notify solicitors of tasks due tomorrow, overdue tasks, upcoming hearings, and overdue invoices';

    public function handle(): int
    {
        $today = Carbon::today();
        $sentToday = $this->alreadySentToday();

        $tasksSent = $this->sendTaskDueTomorrow($today, $sentToday) + $this->sendTasksOverdue($today, $sentToday);
        $hearingsSent = $this->sendHearingsApproaching($today, $sentToday);
        $invoicesSent = $this->sendInvoicesOverdue($today, $sentToday);

        $this->info("Sent {$tasksSent} task notifications, {$hearingsSent} hearing notifications, {$invoicesSent} invoice notifications.");

        return self::SUCCESS;
    }

    /**
     * Every notification of the relevant types already sent today, keyed by
     * type so each sender below can check "have I already told this person
     * about this exact task/event/invoice today" without a driver-specific
     * JSON query -- the volume here is always small (a handful of deadlines
     * a day), so decoding in PHP is simpler than relying on JSON path syntax
     * that differs between MySQL and Postgres.
     *
     * @return array<string, array<int, string>> type => list of subject ids already notified today
     */
    private function alreadySentToday(): array
    {
        $types = [
            TaskDueNotification::class => 'task_id',
            HearingDateApproachingNotification::class => 'event_id',
            InvoiceOverdueNotification::class => 'invoice_id',
        ];

        $result = [];

        foreach ($types as $type => $key) {
            $result[$type] = DatabaseNotification::where('type', $type)
                ->whereDate('created_at', Carbon::today())
                ->get()
                ->map(fn (DatabaseNotification $n) => $n->data[$key] ?? null)
                ->filter()
                ->all();
        }

        return $result;
    }

    private function sendTaskDueTomorrow(Carbon $today, array $sentToday): int
    {
        $tomorrow = $today->copy()->addDay();
        $sent = 0;

        Task::whereDate('due_date', $tomorrow)
            ->whereNotIn('status', ['done'])
            ->whereNotNull('assignee_id')
            ->with('assignee')
            ->each(function (Task $task) use ($sentToday, &$sent) {
                if (in_array($task->id, $sentToday[TaskDueNotification::class], true)) {
                    return;
                }
                $task->assignee?->notify(new TaskDueNotification($task, overdue: false));
                $sent++;
            });

        return $sent;
    }

    private function sendTasksOverdue(Carbon $today, array $sentToday): int
    {
        $yesterday = $today->copy()->subDay();
        $sent = 0;

        Task::whereDate('due_date', $yesterday)
            ->whereNotIn('status', ['done'])
            ->whereNotNull('assignee_id')
            ->with('assignee')
            ->each(function (Task $task) use ($sentToday, &$sent) {
                if (in_array($task->id, $sentToday[TaskDueNotification::class], true)) {
                    return;
                }
                $task->assignee?->notify(new TaskDueNotification($task, overdue: true));
                $sent++;
            });

        return $sent;
    }

    private function sendHearingsApproaching(Carbon $today, array $sentToday): int
    {
        $target = $today->copy()->addDays(3);
        $sent = 0;

        CalendarEvent::where('is_court_date', true)
            ->whereBetween('start_at', [$target->copy()->startOfDay(), $target->copy()->endOfDay()])
            ->with('matter.responsibleUser')
            ->each(function (CalendarEvent $event) use ($sentToday, &$sent) {
                if (in_array($event->id, $sentToday[HearingDateApproachingNotification::class], true)) {
                    return;
                }
                $responsible = $event->matter?->responsibleUser;
                $responsible?->notify(new HearingDateApproachingNotification($event));
                if ($responsible) {
                    $sent++;
                }
            });

        return $sent;
    }

    private function sendInvoicesOverdue(Carbon $today, array $sentToday): int
    {
        $yesterday = $today->copy()->subDay();
        $sent = 0;

        Invoice::whereDate('due_date', $yesterday)
            ->whereIn('status', ['sent', 'partial'])
            ->with('matter.responsibleUser')
            ->each(function (Invoice $invoice) use ($sentToday, &$sent) {
                if (in_array($invoice->id, $sentToday[InvoiceOverdueNotification::class], true)) {
                    return;
                }
                $responsible = $invoice->matter?->responsibleUser;
                $responsible?->notify(new InvoiceOverdueNotification($invoice));
                if ($responsible) {
                    $sent++;
                }
            });

        return $sent;
    }
}
