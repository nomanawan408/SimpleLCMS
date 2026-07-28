<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Invoice {{ $invoice->invoice_number }}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color: #1e293b; font-size: 13px; line-height: 1.5; }
        .container { max-width: 700px; margin: 0 auto; padding: 30px; }
        .header { background: linear-gradient(135deg, #003837 0%, #006B64 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; }
        .header h1 { font-size: 22px; font-weight: 700; margin-bottom: 4px; }
        .header p { font-size: 13px; color: rgba(255,255,255,0.7); }
        .content { background: #fff; border: 1px solid #e2e8f0; border-top: none; padding: 30px; }
        .section { margin-bottom: 25px; }
        .section-title { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; margin-bottom: 8px; }
        .grid { display: flex; gap: 40px; }
        .grid-col { flex: 1; }
        .summary-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; }
        .summary-row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 13px; }
        .summary-row.total { font-size: 16px; font-weight: 700; border-top: 2px solid #e2e8f0; padding-top: 10px; margin-top: 5px; }
        .summary-row .label { color: #64748b; }
        .summary-row .value { font-weight: 600; }
        .total-amount { color: #006B64; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
        th { background: #f1f5f9; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; text-align: left; padding: 10px 12px; }
        th:last-child, td:last-child { text-align: right; }
        td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
        .bank-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; }
        .bank-title { font-size: 14px; font-weight: 700; color: #166534; margin-bottom: 8px; }
        .bank-subtitle { font-size: 12px; color: #15803d; margin-bottom: 12px; }
        .bank-row { display: flex; padding: 3px 0; font-size: 12px; }
        .bank-label { color: #4b5563; width: 130px; }
        .bank-value { font-weight: 600; color: #1e293b; }
        .bank-instructions { font-size: 11px; color: #4b5563; font-style: italic; border-top: 1px solid #bbf7d0; padding-top: 10px; margin-top: 10px; }
        .footer { border-top: 1px solid #f1f5f9; padding-top: 20px; margin-top: 20px; }
        .footer p { font-size: 13px; color: #555; margin-bottom: 6px; }
        .firm-footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 15px 20px; text-align: center; font-size: 11px; color: #94a3b8; border-radius: 0 0 8px 8px; }
        .note-box { background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 15px; margin-top: 20px; }
        .note-box p { font-size: 12px; color: #92400e; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>{{ $firm->name }}</h1>
            <p>Invoice {{ $invoice->invoice_number }}</p>
        </div>

        <div class="content">
            <div class="section">
                <p style="margin-bottom: 15px; font-size: 14px;">Dear {{ $clientName }},</p>
                <p style="font-size: 14px; color: #555; line-height: 1.6;">
                    Please find below your invoice <strong>{{ $invoice->invoice_number }}</strong> for
                    <strong>{{ $invoice->matter->name ?? 'legal services' }}</strong>.
                </p>
            </div>

            <div class="section">
                <div class="summary-box">
                    <div class="summary-row">
                        <span class="label">Invoice Number</span>
                        <span class="value">{{ $invoice->invoice_number }}</span>
                    </div>
                    <div class="summary-row">
                        <span class="label">Date Issued</span>
                        <span class="value">{{ $invoice->created_at->format('d M Y') }}</span>
                    </div>
                    <div class="summary-row">
                        <span class="label">Due Date</span>
                        <span class="value">{{ $invoice->due_date ? $invoice->due_date->format('d M Y') : 'N/A' }}</span>
                    </div>
                    <div class="summary-row total">
                        <span class="label">Total Due</span>
                        <span class="value total-amount">&pound;{{ number_format($invoice->total, 2) }}</span>
                    </div>
                </div>
            </div>

            @if($lineItems && $lineItems->count() > 0)
            <div class="section">
                <table>
                    <thead>
                        <tr>
                            <th>Description</th>
                            <th style="text-align: right;">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        @foreach($lineItems as $item)
                        <tr>
                            <td>{{ $item->description }}</td>
                            <td>&pound;{{ number_format($item->amount + $item->vat_amount, 2) }}</td>
                        </tr>
                        @endforeach
                    </tbody>
                </table>
            </div>
            @endif

            @if($bankDetails['bank_name'] || $bankDetails['bank_iban'])
            <div class="section">
                <div class="bank-box">
                    <div class="bank-title">Payment by Bank Transfer</div>
                    <div class="bank-subtitle">Please make payment to the following account:</div>
                    @if($bankDetails['bank_name'])
                    <div class="bank-row">
                        <span class="bank-label">Bank</span>
                        <span class="bank-value">{{ $bankDetails['bank_name'] }}</span>
                    </div>
                    @endif
                    @if($bankDetails['bank_account_name'])
                    <div class="bank-row">
                        <span class="bank-label">Account Name</span>
                        <span class="bank-value">{{ $bankDetails['bank_account_name'] }}</span>
                    </div>
                    @endif
                    @if($bankDetails['bank_sort_code'])
                    <div class="bank-row">
                        <span class="bank-label">Sort Code</span>
                        <span class="bank-value">{{ $bankDetails['bank_sort_code'] }}</span>
                    </div>
                    @endif
                    @if($bankDetails['bank_account_number'])
                    <div class="bank-row">
                        <span class="bank-label">Account Number</span>
                        <span class="bank-value">{{ $bankDetails['bank_account_number'] }}</span>
                    </div>
                    @endif
                    @if($bankDetails['bank_iban'])
                    <div class="bank-row">
                        <span class="bank-label">IBAN</span>
                        <span class="bank-value">{{ $bankDetails['bank_iban'] }}</span>
                    </div>
                    @endif
                    @if($bankDetails['bank_swift_code'])
                    <div class="bank-row">
                        <span class="bank-label">SWIFT/BIC</span>
                        <span class="bank-value">{{ $bankDetails['bank_swift_code'] }}</span>
                    </div>
                    @endif
                    @if($bankDetails['payment_instructions'])
                    <div class="bank-instructions">
                        {!! nl2br(e($bankDetails['payment_instructions'])) !!}
                    </div>
                    @endif
                </div>
            </div>
            @endif

            <div class="footer">
                <p>If you have any questions about this invoice, please don't hesitate to contact us.</p>
                <p>Kind regards,<br><strong>{{ $firm->name }}</strong></p>
            </div>
        </div>

        <div class="firm-footer">
            {{ $firm->name }}
            @if($firm->address_line1) | {{ $firm->address_line1 }}@endif
            @if($firm->city), {{ $firm->city }}@endif
            @if($firm->postcode) {{ $firm->postcode }}@endif
            @if($firm->phone) | {{ $firm->phone }}@endif
            @if($firm->email) | {{ $firm->email }}@endif
            @if($firm->vat_number)<br>VAT No: {{ $firm->vat_number }}@endif
            @if($firm->sra_number) | SRA: {{ $firm->sra_number }}@endif
        </div>
    </div>
</body>
</html>
