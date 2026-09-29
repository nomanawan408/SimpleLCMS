import { Head, useForm } from '@inertiajs/react';
import AuthLayout from '@/Layouts/AuthLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function TwoFactor() {
    const { data, setData, post, processing, errors } = useForm({ code: '' });

    // Six digits: authenticator app. Fourteen characters (XXXX-XXXX-XXXX):
    // a single-use recovery code for a lost device. The backend consumes
    // recovery codes on first use and counts misses toward lockout.
    const looksComplete = data.code.length === 6 || data.code.length === 14;

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        post('/two-factor');
    };

    return (
        <AuthLayout title="Two-factor authentication" description="Enter the 6-digit code from your authenticator app">
            <Head title="Two-Factor Authentication" />

            <form onSubmit={submit} className="space-y-5">
                <div className="space-y-2">
                    <Label htmlFor="code">Verification code</Label>
                    <Input
                        id="code"
                        type="text"
                        inputMode="text"
                        maxLength={14}
                        autoFocus
                        autoComplete="one-time-code"
                        value={data.code}
                        onChange={(e) => setData('code', e.target.value.toUpperCase())}
                        placeholder="000000"
                        className="text-center text-2xl tracking-[0.5em] font-mono"
                    />
                    {errors.code && <p className="text-xs text-destructive">{errors.code}</p>}
                </div>

                <Button type="submit" className="w-full" disabled={processing || !looksComplete}>
                    {processing ? 'Verifying…' : 'Verify'}
                </Button>
            </form>

            <p className="mt-4 text-center text-xs text-muted-foreground">
                Open your authenticator app and enter the current 6-digit code. Lost your device? Enter one of your
                single-use recovery codes instead (each works exactly once).
            </p>
        </AuthLayout>
    );
}
