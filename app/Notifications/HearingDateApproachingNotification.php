<?php

namespace App\Notifications;

use App\Models\CalendarEvent;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

/**
 * Sent to a matter's responsible solicitor 3 days before a court hearing.
 * Fired once, on the one day the hearing crosses that exact threshold -- see
 * App\Console\Commands\SendDeadlineNotifications.
 */
class HearingDateApproachingNotification extends Notification
{
    use Queueable;

    public function __construct(private readonly CalendarEvent $event) {}

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function toArray(object $notifiable): array
    {
        $matterName = $this->event->matter?->name ?? 'a matter';
        $date = $this->event->start_at?->format('d M Y \a\t g:ia');

        return [
            'title' => 'Hearing in 3 days',
            'message' => sprintf('%s has a court hearing on %s.', $matterName, $date),
            'url' => $this->event->matter_id ? "/matters/{$this->event->matter_id}" : '/calendar',
            'icon' => 'hearing',
            // See TaskDueNotification -- lets the scheduled command guard
            // against sending this twice for the same event on the same day.
            'event_id' => $this->event->id,
        ];
    }
}
