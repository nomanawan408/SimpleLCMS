<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Invoice {{ $invoice->invoice_number }}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px 0;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">

                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #003837 0%, #006B64 100%); padding: 30px 40px;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 700;">{{ $firm->name }}</h1>
                            <p style="margin: 4px 0 0; color: rgba(255,255,255,0.7); font-size: 13px;">Invoice {{ $invoice->invoice_number }}</p>
                        </td>
                    </tr>

                    <!-- Greeting -->
                    <tr>
                        <td style="padding: 30px 40px 20px;">
                            <p style="margin: 0 0 16px; font-size: 15px; color: #333;">Dear {{ $clientName }},</p>
                            <p style="margin: 0; font-size: 14px; color: #555; line-height: 1.6;">
                                Please find below your invoice <strong>{{ $invoice->invoice_number }}</strong> for
                                <strong>{{ $invoice->matter->name ?? 'legal services' }}</strong>.
                            </p>
                        </td>
                    </tr>

                    <!-- Invoice Summary -->
                    <tr>
                        <td style="padding: 0 40px 20px;">
                            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
                                <tr>
                                    <td style="padding: 20px;">
                                        <table width="100%" cellpadding="0" cellspacing="0">
                                            <tr>
                                                <td style="padding: 6px 0; font-size: 13px; color: #64748b;">Invoice Number</td>
                                                <td style="padding: 6px 0; font-size: 13px; color: #1e293b; text-align: right; font-weight: 600;">{{ $invoice->invoice_number }}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 6px 0; font-size: 13px; color: #64748b;">Date Issued</td>
                                                <td style="padding: 6px 0; font-size: 13px; color: #1e293b; text-align: right;">{{ $invoice->created_at->format('d M Y') }}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 6px 0; font-size: 13px; color: #64748b;">Due Date</td>
                                                <td style="padding: 6px 0; font-size: 13px; color: #1e293b; text-align: right; font-weight: 600;">{{ $invoice->due_date ? $invoice->due_date->format('d M Y') : 'N/A' }}</td>
                                            </tr>
                                            <tr>
                                                <td colspan="2" style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"></td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 8px 0; font-size: 15px; color: #1e293b; font-weight: 700;">Total Due</td>
                                                <td style="padding: 8px 0; font-size: 18px; color: #006B64; text-align: right; font-weight: 800;">£{{ number_format($invoice->total, 2) }}</td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Line Items -->
                    @if($lineItems && $lineItems->count() > 0)
                    <tr>
                        <td style="padding: 0 40px 20px;">
                            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
                                <thead>
                                    <tr style="background-color: #f1f5f9;">
                                        <th style="padding: 10px 12px; font-size: 11px; color: #64748b; text-align: left; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Description</th>
                                        <th style="padding: 10px 12px; font-size: 11px; color: #64748b; text-align: right; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    @foreach($lineItems as $item)
                                    <tr style="border-bottom: 1px solid #f1f5f9;">
                                        <td style="padding: 10px 12px; font-size: 13px; color: #334155;">{{ $item->description }}</td>
                                        <td style="padding: 10px 12px; font-size: 13px; color: #334155; text-align: right;">£{{ number_format($item->amount + $item->vat_amount, 2) }}</td>
                                    </tr>
                                    @endforeach
                                </tbody>
                            </table>
                        </td>
                    </tr>
                    @endif

                    <!-- Bank Details -->
                    @if($bankDetails['bank_name'] || $bankDetails['bank_iban'])
                    <tr>
                        <td style="padding: 0 40px 20px;">
                            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f0fdf4; border-radius: 8px; border: 1px solid #bbf7d0;">
                                <tr>
                                    <td style="padding: 20px;">
                                        <p style="margin: 0 0 12px; font-size: 14px; color: #166534; font-weight: 700;">Payment by Bank Transfer</p>
                                        <p style="margin: 0 0 12px; font-size: 12px; color: #15803d;">Please make payment to the following account:</p>
                                        <table width="100%" cellpadding="0" cellspacing="0">
                                            @if($bankDetails['bank_name'])
                                            <tr>
                                                <td style="padding: 4px 0; font-size: 12px; color: #4b5563; width: 130px;">Bank</td>
                                                <td style="padding: 4px 0; font-size: 12px; color: #1e293b; font-weight: 600;">{{ $bankDetails['bank_name'] }}</td>
                                            </tr>
                                            @endif
                                            @if($bankDetails['bank_account_name'])
                                            <tr>
                                                <td style="padding: 4px 0; font-size: 12px; color: #4b5563;">Account Name</td>
                                                <td style="padding: 4px 0; font-size: 12px; color: #1e293b; font-weight: 600;">{{ $bankDetails['bank_account_name'] }}</td>
                                            </tr>
                                            @endif
                                            @if($bankDetails['bank_sort_code'])
                                            <tr>
                                                <td style="padding: 4px 0; font-size: 12px; color: #4b5563;">Sort Code</td>
                                                <td style="padding: 4px 0; font-size: 12px; color: #1e293b; font-weight: 600;">{{ $bankDetails['bank_sort_code'] }}</td>
                                            </tr>
                                            @endif
                                            @if($bankDetails['bank_account_number'])
                                            <tr>
                                                <td style="padding: 4px 0; font-size: 12px; color: #4b5563;">Account Number</td>
                                                <td style="padding: 4px 0; font-size: 12px; color: #1e293b; font-weight: 600;">{{ $bankDetails['bank_account_number'] }}</td>
                                            </tr>
                                            @endif
                                            @if($bankDetails['bank_iban'])
                                            <tr>
                                                <td style="padding: 4px 0; font-size: 12px; color: #4b5563;">IBAN</td>
                                                <td style="padding: 4px 0; font-size: 12px; color: #1e293b; font-weight: 600;">{{ $bankDetails['bank_iban'] }}</td>
                                            </tr>
                                            @endif
                                            @if($bankDetails['bank_swift_code'])
                                            <tr>
                                                <td style="padding: 4px 0; font-size: 12px; color: #4b5563;">SWIFT/BIC</td>
                                                <td style="padding: 4px 0; font-size: 12px; color: #1e293b; font-weight: 600;">{{ $bankDetails['bank_swift_code'] }}</td>
                                            </tr>
                                            @endif
                                        </table>
                                        @if($bankDetails['payment_instructions'])
                                        <p style="margin: 12px 0 0; font-size: 11px; color: #4b5563; font-style: italic; border-top: 1px solid #bbf7d0; padding-top: 10px;">
                                            {!! nl2br(e($bankDetails['payment_instructions'])) !!}
                                        </p>
                                        @endif
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    @endif

                    <!-- Footer -->
                    <tr>
                        <td style="padding: 20px 40px 30px; border-top: 1px solid #f1f5f9;">
                            <p style="margin: 0 0 8px; font-size: 13px; color: #555;">
                                If you have any questions about this invoice, please don't hesitate to contact us.
                            </p>
                            <p style="margin: 0; font-size: 13px; color: #555;">
                                Kind regards,<br>
                                <strong>{{ $firm->name }}</strong>
                            </p>
                        </td>
                    </tr>

                    <!-- Firm Footer -->
                    <tr>
                        <td style="background-color: #f8fafc; padding: 20px 40px; border-top: 1px solid #e2e8f0;">
                            <p style="margin: 0; font-size: 11px; color: #94a3b8; text-align: center; line-height: 1.6;">
                                {{ $firm->name }}
                                @if($firm->address_line1) | {{ $firm->address_line1 }}@endif
                                @if($firm->city), {{ $firm->city }}@endif
                                @if($firm->postcode) {{ $firm->postcode }}@endif
                                @if($firm->phone) | {{ $firm->phone }}@endif
                                @if($firm->email) | {{ $firm->email }}@endif
                                @if($firm->vat_number)<br>VAT No: {{ $firm->vat_number }}@endif
                                @if($firm->sra_number) | SRA: {{ $firm->sra_number }}@endif
                            </p>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>
</body>
</html>
