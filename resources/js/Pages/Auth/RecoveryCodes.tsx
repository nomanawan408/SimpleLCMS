import { Head, Link } from '@inertiajs/react';
import { useState } from 'react';
import AuthLayout from '@/Layouts/AuthLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle, Check, Copy, Printer } from 'lucide-react';

interface Props {
    codes: string[];
}

/**
 * One-time display of fresh recovery codes. The backend flashes them for a
 * single request: revisiting this URL renders nothing (the controller
 * redirects away without flash data), so codes cannot be harvested later
 * from history or a bookmark.
 */
export default function RecoveryCodes({ codes }: Props) {
    const [copied, setCopied] = useState(false);
    const [confirmed, setConfirmed] = useState(false);

    const copyAll = async () => {
        try {
            await navigator.clipboard.writeText(codes.join('\n'));
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            /* clipboard unavailable — codes remain visible below */
        }
    };

    return (
        <AuthLayout
            title="Save your recovery codes"
            description="Each code signs you in exactly once if you lose your device. Afterwards it is dead — store them somewhere safe, not in your inbox."
        >
            <Head title="Recovery Codes" />
            <Card className="rounded-2xl border border-amber-200 bg-amber-50/50">
                <CardContent className="p-5">
                    <div className="mb-3 flex items-start gap-2 text-amber-800">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                        <p className="text-xs font-medium">
                            This is the only time these codes are shown. Regenerating later destroys this set.
                        </p>
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {codes.map((code) => (
                            <code key={code} className="rounded-lg bg-white px-3 py-2 text-center font-mono text-sm font-semibold tracking-wider shadow-sm">
                                {code}
                            </code>
                        ))}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                        <Button type="button" size="sm" variant="outline" onClick={copyAll}>
                            <Copy className="mr-1.5 h-3.5 w-3.5" />
                            {copied ? 'Copied' : 'Copy all'}
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => window.print()}>
                            <Printer className="mr-1.5 h-3.5 w-3.5" />
                            Print
                        </Button>
                    </div>
                    <label className="mt-4 flex cursor-pointer items-start gap-2 text-sm">
                        <input
                            type="checkbox"
                            className="mt-0.5 h-4 w-4 rounded accent-primary"
                            checked={confirmed}
                            onChange={(e) => setConfirmed(e.target.checked)}
                        />
                        <span className="text-muted-foreground">I have stored these codes somewhere safe.</span>
                    </label>
                    <Button asChild className="mt-4 w-full" disabled={!confirmed}>
                        <Link href="/dashboard">
                            <Check className="mr-1.5 h-4 w-4" />
                            Done — go to Dashboard
                        </Link>
                    </Button>
                </CardContent>
            </Card>
        </AuthLayout>
    );
}
