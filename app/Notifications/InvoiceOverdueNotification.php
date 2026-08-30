<?php

namespace App\Notifications;

use App\Models\Invoice;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

/**
 * Sent to a matter's responsible solicitor the day an invoice becomes
 * overdue (exactly one day past its due date) -- once, not every day it
 * remains unpaid afterwards. See
 * App\Console\Commands\SendDeadlineNotifications.
 */
class InvoiceOverdueNotification extends Notification
{
    use Queueable;

    public function __construct(private readonly Invoice $invoice) {}

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function toArray(object $notifiable): array
    {
        return [
            'title' => 'Invoice overdue',
            'message' => sprintf(
                'Invoice %s for %s is now overdue.',
                $this->invoice->invoice_number,
                $this->invoice->matter?->name ?? 'a matter',
            ),
            'url' => "/billing/{$this->invoice->id}",
            'icon' => 'invoice',
            // See TaskDueNotification -- lets the scheduled command guard
            // against sending this twice for the same invoice on the same day.
            'invoice_id' => $this->invoice->id,
        ];
    }
}
