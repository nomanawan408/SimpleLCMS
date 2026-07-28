<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Complete Your Firm Setup</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px 0;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">

                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #003837 0%, #006B64 100%); padding: 30px 40px;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 700;">SimpleLaw</h1>
                            <p style="margin: 4px 0 0; color: rgba(255,255,255,0.7); font-size: 13px;">Complete Your Firm Setup</p>
                        </td>
                    </tr>

                    <!-- Content -->
                    <tr>
                        <td style="padding: 30px 40px;">
                            <p style="margin: 0 0 16px; font-size: 15px; color: #333;">Dear {{ $adminName }},</p>
                            <p style="margin: 0 0 16px; font-size: 14px; color: #555; line-height: 1.6;">
                                Your firm <strong>{{ $firm->name }}</strong> has been created on SimpleLaw. To get started, please complete the firm setup by adding your office address, billing defaults, and bank details.
                            </p>

                            <!-- CTA Button -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
                                <tr>
                                    <td align="center">
                                        <a href="{{ $setupUrl }}" style="display: inline-block; background: linear-gradient(135deg, #003837 0%, #006B64 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 15px; font-weight: 600;">
                                            Complete Firm Setup
                                        </a>
                                    </td>
                                </tr>
                            </table>

                            <p style="margin: 0 0 8px; font-size: 13px; color: #555; line-height: 1.6;">
                                This link will take you to a secure page where you can:
                            </p>
                            <ul style="margin: 0 0 16px; padding-left: 20px; font-size: 13px; color: #555; line-height: 1.8;">
                                <li>Add your office address</li>
                                <li>Set billing defaults (hourly rate, VAT, invoice prefix)</li>
                                <li>Add bank account details for receiving payments</li>
                            </ul>

                            <p style="margin: 0; font-size: 13px; color: #94a3b8; line-height: 1.6;">
                                If you did not expect this email, please ignore it.
                            </p>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #f8fafc; padding: 20px 40px; border-top: 1px solid #e2e8f0;">
                            <p style="margin: 0; font-size: 11px; color: #94a3b8; text-align: center; line-height: 1.6;">
                                SimpleLaw — Lawyer Case Management<br>
                                This is an automated message, please do not reply.
                            </p>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>
</body>
</html>
