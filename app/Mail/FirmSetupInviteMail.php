<?php

namespace App\Mail;

use App\Models\Firm;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Mail\Mailables\Address;
use Illuminate\Queue\SerializesModels;

class FirmSetupInviteMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public Firm $firm,
        public string $adminName,
        public string $adminEmail,
        public string $setupUrl,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            from: new Address(
                config('mail.from.address'),
                'SimpleLaw',
            ),
            subject: "Complete your firm setup on SimpleLaw — {$this->firm->name}",
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.firm-setup-invite',
            with: [
                'firm'      => $this->firm,
                'adminName' => $this->adminName,
                'setupUrl'  => $this->setupUrl,
            ],
        );
    }
}
