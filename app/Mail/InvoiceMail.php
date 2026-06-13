<?php

namespace App\Mail;

use App\Models\Firm;
use App\Models\Invoice;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Mail\Mailables\Address;
use Illuminate\Queue\SerializesModels;

class InvoiceMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public Invoice $invoice,
        public Firm $firm,
        public string $clientName,
        public string $clientEmail,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            from: new Address(
                $this->firm->email ?? 'noreply@simplelaw.co.uk',
                $this->firm->name,
            ),
            subject: "Invoice {$this->invoice->invoice_number} from {$this->firm->name}",
        );
    }

    public function content(): Content
    {
        $lineItems = $this->invoice->lineItems;
        $bankDetails = [
            'bank_name'           => $this->firm->bank_name,
            'bank_account_name'   => $this->firm->bank_account_name,
            'bank_sort_code'      => $this->firm->bank_sort_code,
            'bank_account_number' => $this->firm->bank_account_number,
            'bank_iban'           => $this->firm->bank_iban,
            'bank_swift_code'     => $this->firm->bank_swift_code,
            'payment_instructions'=> $this->firm->payment_instructions,
        ];

        return new Content(
            view: 'emails.invoice',
            with: [
                'invoice'     => $this->invoice,
                'firm'        => $this->firm,
                'clientName'  => $this->clientName,
                'lineItems'   => $lineItems,
                'bankDetails' => $bankDetails,
            ],
        );
    }
}
