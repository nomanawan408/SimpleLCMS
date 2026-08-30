<?php

namespace App\Notifications;

use App\Models\Document;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

/**
 * Sent to a matter's responsible solicitor when someone else uploads a
 * document to it. Never sent when the responsible solicitor is the one
 * uploading -- you do not need to be told about your own upload.
 */
class DocumentUploadedNotification extends Notification
{
    use Queueable;

    public function __construct(
        private readonly Document $document,
        private readonly User $uploadedBy,
    ) {}

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function toArray(object $notifiable): array
    {
        $matterName = $this->document->matter?->name ?? 'a matter';

        return [
            'title' => 'New document uploaded',
            'message' => sprintf(
                '%s uploaded "%s" to %s.',
                $this->uploadedBy->full_name,
                $this->document->original_name ?? $this->document->name,
                $matterName,
            ),
            'url' => $this->document->matter_id ? "/matters/{$this->document->matter_id}?tab=documents" : '/documents',
            'icon' => 'document',
        ];
    }
}
