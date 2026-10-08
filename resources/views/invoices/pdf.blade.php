<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Invoice {{ $invoice->invoice_number }}</title>
    <style>
        /* DomPDF-safe: tables only, no flexbox. A4 with narrow margins so the
           dotted frame sits close to the edge like the firm template. */
        @page { size: A4; margin: 26px 30px; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Helvetica, Arial, sans-serif; color: #222222; font-size: 10.5pt; line-height: 1.45; }
        .brand { color: #b02a30; }
        .frame { border: 1px dotted #8a8a8a; padding: 14px 16px; }
        table.layout { width: 100%; border-collapse: collapse; }
        table.layout td { vertical-align: top; }

        /* ── Header ── */
        .logo-cell { width: 128px; }
        .logo-cell img { width: 118px; }
        .firm-address { text-align: left; font-size: 9.5pt; padding-left: 8px; }
        .firm-address .addr { margin-bottom: 10px; }
        .invoice-title-cell { text-align: right; width: 170px; }
        .invoice-title { font-size: 25pt; font-weight: bold; color: #b02a30; letter-spacing: 1px; margin-bottom: 12px; }
        .invoice-meta { font-size: 9.5pt; color: #444444; }
        .invoice-meta .num { color: #1a5a8a; }
        .header-rule { border-top: 1px dotted #8a8a8a; margin: 10px 0 0 0; }

        /* ── TO / FOR ── */
        .tofor { margin-top: 10px; border-top: 1px dotted #8a8a8a; border-bottom: 1px dotted #8a8a8a; }
        .tofor td { padding: 8px 10px 12px 10px; }
        .tofor .divider { border-left: 1px dotted #8a8a8a; }
        .block-label { font-size: 10.5pt; font-weight: bold; color: #b02a30; margin-bottom: 2px; }
        .tofor p { font-size: 10pt; }
        .delivered { font-style: italic; text-decoration: underline; margin-top: 10px; }

        /* ── Items table ── */
        table.items { width: 100%; border-collapse: collapse; margin-top: 10px; }
        table.items th {
            font-size: 10pt; font-weight: bold; color: #b02a30; text-transform: uppercase;
            text-align: left; padding: 4px 8px;
            border-top: 1px dotted #8a8a8a; border-bottom: 1px dotted #8a8a8a;
        }
        table.items th.num, table.items td.num { text-align: right; }
        table.items th.c, table.items td.c { text-align: center; }
        table.items td {
            font-size: 10pt; padding: 5px 8px;
            border-bottom: 1px solid #63a78f;
        }
        table.items tr.total-row td {
            border-top: 1px dotted #8a8a8a; border-bottom: 1px dotted #8a8a8a;
            padding: 6px 8px; font-weight: bold; color: #b02a30;
        }

        /* ── Below the table ── */
        .terms { margin-top: 8px; font-size: 10pt; }
        .terms .brand { font-weight: bold; }
        .thanks { margin-top: 8px; font-size: 10.5pt; font-weight: bold; color: #b02a30; }
        .bank-heading { margin-top: 14px; font-size: 11pt; font-weight: bold; color: #222222; }
        .footer-band {
            margin: 12px -16px -14px -16px; background: #e3bcbc;
            padding: 10px 16px; font-size: 7.5pt; color: #5a2b2b;
            text-align: center; line-height: 1.5;
        }

        /* ── Page 2 ── */
        .page-break { page-break-before: always; }
        .bank-block { font-size: 10.5pt; margin-bottom: 14px; }
        .bank-block .acct-name { font-weight: bold; color: #b02a30; }
        .important { font-size: 10.5pt; font-weight: bold; color: #b02a30; margin: 14px 0 6px 0; }
        .assess-title { font-size: 10.5pt; font-weight: bold; color: #b02a30; margin: 14px 0 6px 0; }
        ul.assess { margin: 4px 0 0 18px; font-size: 10pt; }
        ul.assess li { margin-bottom: 7px; }
        .signed-label { font-size: 10.5pt; font-weight: bold; color: #b02a30; margin-top: 26px; }
        .signature img { width: 190px; margin-top: 2px; }
    </style>
</head>
<body>
@php
    // Firm letterhead falls back to the template's printed details so the
    // design holds even where the firm profile is incomplete.
    $addrLines = array_filter([
        $firm->address_line1 ?: 'The Business Centre',
        $firm->address_line2 ?: '527 Moseley Road',
        trim(($firm->city ?: 'Birmingham') . ' ' . ($firm->postcode ?: 'B12 9BU')),
    ]);
    $phoneLine = $firm->phone ?: '0330 043 8403 / 0121 256 8043 / 07886 878 751';
    $emailLine = $firm->email ?: 'legal@godwinausten.co.uk';

    $clientAddr = is_array($clientContact->address ?? null) ? $clientContact->address : [];
    $clientLines = array_filter([
        $clientAddr['line1'] ?? null,
        $clientAddr['line2'] ?? null,
        trim((($clientAddr['city'] ?? '') . ' ' . ($clientAddr['postcode'] ?? ''))),
        $clientAddr['country'] ?? null,
    ]);

    $qty = function ($q) {
        $s = number_format((float) $q, 2, '.', '');
        return rtrim(rtrim($s, '0'), '.') ?: '0';
    };

    $rows = [];
    if ($lineItems && $lineItems->count() > 0) {
        foreach ($lineItems as $item) {
            $rows[] = [
                'desc'   => $item->description,
                'hours'  => $qty($item->quantity),
                'rate'   => '£' . number_format((float) $item->unit_rate, 2),
                'amount' => '£' . number_format((float) $item->amount + (float) $item->vat_amount, 2),
            ];
        }
    } else {
        $rows[] = [
            'desc'   => 'See above',
            'hours'  => 'Fixed Fee',
            'rate'   => 'Fixed Fee',
            'amount' => '£' . number_format((float) $invoice->total, 2),
        ];
    }
    $padRows = max(0, 11 - count($rows));

    $bank = [
        'name'   => $firm->bank_account_name ?: 'Godwin-Austen Ltd',
        'bank'   => $firm->bank_name ?: 'Metro',
        'sort'   => $firm->bank_sort_code ?: '23-05-80',
        'number' => $firm->bank_account_number ?: '55072027',
        'bic'    => $firm->bank_swift_code ?: 'MYMBGB2L',
        'iban'   => $firm->bank_iban ?: 'GB78MYMB23058055072027',
    ];
@endphp

    {{-- ══════════ PAGE 1 ══════════ --}}
    <div class="frame">
        <table class="layout">
            <tr>
                <td class="logo-cell">
                    @if($logoPath)<img src="{{ $logoPath }}" alt="Godwin Austen Solicitors">@endif
                </td>
                <td class="firm-address">
                    <div class="addr">
                        @foreach($addrLines as $line){{ $line }}<br>@endforeach
                    </div>
                    <div class="addr">
                        {{ $phoneLine }}<br>
                        {{ $emailLine }}
                    </div>
                </td>
                <td class="invoice-title-cell">
                    <div class="invoice-title">INVOICE</div>
                    <div class="invoice-meta">
                        INVOICE: <span class="num">{{ $invoice->invoice_number }}</span><br>
                        DATE: {{ $invoice->created_at->format('d.m.Y') }}
                    </div>
                </td>
            </tr>
        </table>
        <div class="header-rule"></div>

        <table class="layout tofor">
            <tr>
                <td style="width: 50%;">
                    <div class="block-label">TO:</div>
                    <p>{{ $clientContact->full_name ?? $clientName }}</p>
                    @foreach($clientLines as $line)<p>{{ $line }}</p>@endforeach
                    <p class="delivered">Delivered via email</p>
                </td>
                <td class="divider" style="width: 50%;">
                    <div class="block-label">FOR:</div>
                    <p>Advice re {{ $invoice->matter->name ?? 'legal services' }}</p>
                    <p>Our ref: {{ $invoice->matter->matter_number ?? '' }}</p>
                </td>
            </tr>
        </table>

        <table class="items">
            <thead>
                <tr>
                    <th style="width: 46%;">Description</th>
                    <th class="c" style="width: 18%;">Hours</th>
                    <th class="c" style="width: 18%;">Rate</th>
                    <th class="num" style="width: 18%;">Amount</th>
                </tr>
            </thead>
            <tbody>
                @foreach($rows as $row)
                <tr>
                    <td>{{ $row['desc'] }}</td>
                    <td class="c">{{ $row['hours'] }}</td>
                    <td class="c">{{ $row['rate'] }}</td>
                    <td class="num">{{ $row['amount'] }}</td>
                </tr>
                @endforeach
                @for($i = 0; $i < $padRows; $i++)
                <tr><td>&nbsp;</td><td></td><td></td><td></td></tr>
                @endfor
                <tr class="total-row">
                    <td colspan="3" style="text-align: right;">TOTAL</td>
                    <td class="num">£{{ number_format((float) $invoice->total, 2) }}</td>
                </tr>
            </tbody>
        </table>

        <p class="terms"><span class="brand">Payment Terms:</span> Payment due on receipt of invoice</p>
        <p class="thanks">THANK YOU</p>
        <p class="bank-heading">Please make bank transfers to (preferred):</p>

        <div class="footer-band">
            Godwin Austen Solicitors is a trading style of Godwin Austen Ltd, a company registered in
            England and Wales under company registration number 16580461, with the registered office at
            The Business Centre, 527 Moseley Road, Birmingham, B12 9BU. Authorised and regulated by the
            Solicitors Regulation Authority (SRA) under authorisation number 8008658.
        </div>
    </div>

    {{-- ══════════ PAGE 2 ══════════ --}}
    <div class="page-break"></div>
    <div class="frame">
        <div class="bank-block">
            <div class="acct-name">{{ $bank['name'] }}</div>
            <div>Bank Name: {{ $bank['bank'] }}</div>
            <div>Sort Code: {{ $bank['sort'] }}</div>
            <div>Account No: {{ $bank['number'] }}</div>
            <div>SWIFT BIC: {{ $bank['bic'] }}</div>
            <div>IBAN: {{ $bank['iban'] }}</div>
        </div>

        <div class="important">IMPORTANT</div>
        <p style="font-size: 10pt;">Please include the invoice number(s) when transferring funds to assist us in identifying the payment.</p>

        <div class="assess-title">Detailed Assessment by the Court</div>
        <ul class="assess">
            <li>If this is a contentious matter, you have the right to request, within 3 months of receiving this bill (provided we have not begun debt recovery proceedings), that we send you a detailed bill outlining the costs charged.</li>
            <li>Please note, requesting a detailed bill will render the original bill invalid. The detailed bill may reflect a higher amount if the recalculated costs warrant it.</li>
            <li>You are entitled to apply to the Court to have our bill assessed, regardless of whether the bill is contentious or non-contentious. However, you must make the application.</li>
            <li>If you apply within one month of receiving the bill, you have an automatic right to have it assessed. If you apply after one month, the Court may agree to an assessment but could impose conditions. In such cases, we will generally ask the Court to require you to pay the full bill amount into Court while the assessment is pending.</li>
            <li>If more than 12 months have passed since the bill was issued, the Court will typically only order an assessment under exceptional circumstances.</li>
        </ul>

        <div class="signed-label">Signed:</div>
        <div class="signature">
            @if($signaturePath)<img src="{{ $signaturePath }}" alt="Signed">@endif
        </div>
    </div>
</body>
</html>
