import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { useState } from 'react';
import AuthLayout from '@/Layouts/AuthLayout';
import AppLayout from '@/Layouts/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { PageProps } from '@/types';

interface Props {
    qrCodeUrl: string;
    secret: string;
}

/**
 * Totp enrollment and management. Rendered inside the app shell when the
 * user is fully authenticated, and inside the auth shell otherwise — the
 * controller guarantees only verified sessions reach the mutating actions.
 */
export default function TwoFactorSetup({ qrCodeUrl, secret }: Props) {
    const { auth } = usePage<PageProps>().props;
    const enabled = !!auth.user?.totp_enabled;
    const [copied, setCopied] = useState(false);

    const enableForm = useForm({ password: '', code: '' });
    const disableForm = useForm({ password: '', code: '' });
    const regenForm = useForm({ password: '', code: '' });

    const copySecret = async () => {
        try {
            await navigator.clipboard.writeText(secret);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            /* clipboard unavailable — the secret stays visible below */
        }
    };

    const content = (
            <div className="mx-auto max-w-lg space-y-4">
                {!enabled && (
                    <Card className="rounded-2xl border border-border/60 bg-card shadow-sm">
                        <CardContent className="space-y-4 p-6">
                            <div>
                                <p className="text-sm font-semibold text-foreground">1. Add to your authenticator app</p>
                                <a href={qrCodeUrl} className="mt-1 block break-all text-xs text-primary hover:underline">
                                    {qrCodeUrl}
                                </a>
                                <div className="mt-3 flex items-center gap-2">
                                    <code className="flex-1 rounded-lg bg-muted px-3 py-2 font-mono text-sm">{secret}</code>
                                    <Button type="button" size="sm" variant="outline" onClick={copySecret}>
                                        {copied ? 'Copied' : 'Copy'}
                                    </Button>
                                </div>
                            </div>
                            <form
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    enableForm.post('/two-factor/enable');
                                }}
                                className="space-y-3"
                            >
                                <div className="space-y-1.5">
                                    <Label htmlFor="enable-password">2. Confirm your password</Label>
                                    <Input
                                        id="enable-password" type="password" autoComplete="current-password"
                                        value={enableForm.data.password}
                                        onChange={(e) => enableForm.setData('password', e.target.value)}
                                    />
                                    {enableForm.errors.password && <p className="text-xs text-destructive">{enableForm.errors.password}</p>}
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="code">3. Confirm with a 6-digit code</Label>
                                    <Input
                                        id="code" type="text" inputMode="numeric" maxLength={6} autoComplete="one-time-code"
                                        value={enableForm.data.code}
                                        onChange={(e) => enableForm.setData('code', e.target.value)}
                                        placeholder="000000"
                                        className="text-center font-mono text-xl tracking-[0.4em]"
                                    />
                                    {enableForm.errors.code && <p className="text-xs text-destructive">{enableForm.errors.code}</p>}
                                </div>
                                <Button type="submit" className="w-full" disabled={enableForm.processing || enableForm.data.code.length !== 6 || !enableForm.data.password}>
                                    {enableForm.processing ? 'Confirming…' : 'Enable 2FA'}
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                )}

                {enabled && (
                    <>
                        <Card className="rounded-2xl border border-border/60 bg-card shadow-sm">
                            <CardContent className="space-y-3 p-6">
                                <p className="text-sm font-semibold text-foreground">Recovery codes</p>
                                <p className="text-sm text-muted-foreground">
                                    Eight single-use codes for signing in if you lose your device. Generating a new set
                                    destroys the old one — store them somewhere safe, not in your inbox.
                                </p>
                                <form
                                    onSubmit={(e) => {
                                        e.preventDefault();
                                        regenForm.post('/two-factor/recovery-codes');
                                    }}
                                    className="grid gap-3 sm:grid-cols-2"
                                >
                                    <div className="space-y-1.5">
                                        <Label htmlFor="regen-password">Password</Label>
                                        <Input
                                            id="regen-password" type="password" autoComplete="current-password"
                                            value={regenForm.data.password}
                                            onChange={(e) => regenForm.setData('password', e.target.value)}
                                        />
                                        {regenForm.errors.password && <p className="text-xs text-destructive">{regenForm.errors.password}</p>}
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="regen-code">Authenticator code</Label>
                                        <Input
                                            id="regen-code" type="text" inputMode="numeric" maxLength={6} autoComplete="one-time-code"
                                            value={regenForm.data.code}
                                            onChange={(e) => regenForm.setData('code', e.target.value)}
                                            placeholder="000000" className="font-mono"
                                        />
                                        {regenForm.errors.code && <p className="text-xs text-destructive">{regenForm.errors.code}</p>}
                                    </div>
                                    <Button type="submit" variant="outline" className="sm:col-span-2" disabled={regenForm.processing}>
                                        {regenForm.processing ? 'Generating…' : 'Generate new recovery codes'}
                                    </Button>
                                </form>
                            </CardContent>
                        </Card>

                        <Card className="rounded-2xl border border-border/60 bg-card shadow-sm">
                            <CardContent className="space-y-3 p-6">
                                <p className="text-sm font-semibold text-destructive">Disable two-factor authentication</p>
                                <form
                                    onSubmit={(e) => {
                                        e.preventDefault();
                                        if (!window.confirm('Disable 2FA? Your account will rely on password alone.')) return;
                                        disableForm.delete('/two-factor');
                                    }}
                                    className="grid gap-3 sm:grid-cols-2"
                                >
                                    <div className="space-y-1.5">
                                        <Label htmlFor="disable-password">Password</Label>
                                        <Input
                                            id="disable-password" type="password" autoComplete="current-password"
                                            value={disableForm.data.password}
                                            onChange={(e) => disableForm.setData('password', e.target.value)}
                                        />
                                        {disableForm.errors.password && <p className="text-xs text-destructive">{disableForm.errors.password}</p>}
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="disable-code">Authenticator code</Label>
                                        <Input
                                            id="disable-code" type="text" inputMode="numeric" maxLength={6} autoComplete="one-time-code"
                                            value={disableForm.data.code}
                                            onChange={(e) => disableForm.setData('code', e.target.value)}
                                            placeholder="000000" className="font-mono"
                                        />
                                        {disableForm.errors.code && <p className="text-xs text-destructive">{disableForm.errors.code}</p>}
                                    </div>
                                    <Button type="submit" variant="destructive" className="sm:col-span-2" disabled={disableForm.processing}>
                                        {disableForm.processing ? 'Disabling…' : 'Disable 2FA'}
                                    </Button>
                                </form>
                            </CardContent>
                        </Card>

                        <Button asChild variant="ghost" size="sm">
                            <Link href="/settings">Back to Settings</Link>
                        </Button>
                    </>
                )}
            </div>
    );

    if (enabled) {
        return (
            <AppLayout title="Two-Factor Authentication">
                <Head title="Two-Factor Setup" />
                {content}
            </AppLayout>
        );
    }

    return (
        <AuthLayout
            title="Set up two-factor authentication"
            description="Open your authenticator app, add this account, then confirm below."
        >
            <Head title="Two-Factor Setup" />
            {content}
        </AuthLayout>
    );
}
