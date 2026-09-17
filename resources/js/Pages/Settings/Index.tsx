import { useState } from 'react';
import { Head, Link, router, usePage } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { PageTabs } from '@/components/ui/page-tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { applyTheme, type ThemeChoice } from '@/lib/theme';
import { Building2, KeyRound, Moon, Monitor, Palette, Sun, UserRound, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PageProps } from '@/types';

interface Props {
    preferences: { theme?: string };
    canEditFirm: boolean;
    firmDefaults: {
        name: string;
        vat_rate: number;
        invoice_prefix: string;
        payment_terms_days: number;
        default_hourly_rate: number;
    } | null;
}

const THEMES: { value: ThemeChoice; label: string; hint: string; icon: typeof Sun }[] = [
    { value: 'light', label: 'Light', hint: 'Always light', icon: Sun },
    { value: 'dark', label: 'Dark', hint: 'Always dark', icon: Moon },
    { value: 'system', label: 'System', hint: 'Follow your device', icon: Monitor },
];

export default function SettingsIndex({ preferences, canEditFirm, firmDefaults }: Props) {
    const { auth, theme: activeTheme } = usePage<PageProps>().props;
    const user = auth.user!;
    const [tab, setTab] = useState('profile');
    const [saving, setSaving] = useState<string | null>(null);

    const [profile, setProfile] = useState({ full_name: user.full_name, phone: (user as any).phone ?? '' });
    const [profileErrors, setProfileErrors] = useState<Record<string, string>>({});

    const [password, setPassword] = useState({ current_password: '', password: '', password_confirmation: '' });
    const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({});

    const [firm, setFirm] = useState({
        vat_rate: String(firmDefaults?.vat_rate ?? ''),
        invoice_prefix: firmDefaults?.invoice_prefix ?? '',
        payment_terms_days: String(firmDefaults?.payment_terms_days ?? ''),
        default_hourly_rate: String(firmDefaults?.default_hourly_rate ?? ''),
    });
    const [firmErrors, setFirmErrors] = useState<Record<string, string>>({});

    function put(url: string, data: Record<string, string | undefined>, key: string, onOk?: () => void, onErr?: (e: Record<string, string>) => void) {
        setSaving(key);
        router.put(url, data, {
            preserveScroll: true,
            onSuccess: () => onOk?.(),
            onError: (errors) => onErr?.(errors as Record<string, string>),
            onFinish: () => setSaving(null),
        });
    }

    function saveTheme(choice: ThemeChoice) {
        applyTheme(choice); // instant feedback, server prop confirms on return
        put('/settings/preferences', { theme: choice }, 'theme');
    }

    const tabs = [
        { key: 'profile', label: 'Profile', icon: UserRound },
        { key: 'appearance', label: 'Appearance', icon: Palette },
        { key: 'security', label: 'Security', icon: KeyRound },
        ...(canEditFirm && firmDefaults ? [{ key: 'firm', label: 'Firm', icon: Building2 }] : []),
    ];

    return (
        <AppLayout title="Settings">
            <Head title="Settings" />

            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-extrabold tracking-tight">Settings</h1>
                    <p className="mt-0.5 text-sm text-muted-foreground">Your preferences apply to you on every device. Firm settings apply to the whole practice.</p>
                </div>
            </div>

            <PageTabs tabs={tabs} value={tab} onChange={setTab} />

            {tab === 'profile' && (
                <Card className="rounded-2xl border border-border/60 bg-card shadow-sm">
                    <CardContent className="space-y-4 p-6">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label htmlFor="full_name">Full name</Label>
                                <Input id="full_name" value={profile.full_name} onChange={(e) => setProfile((p) => ({ ...p, full_name: e.target.value }))} />
                                {profileErrors.full_name && <p className="text-xs text-destructive">{profileErrors.full_name}</p>}
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="phone">Phone</Label>
                                <Input id="phone" value={profile.phone} onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))} />
                                {profileErrors.phone && <p className="text-xs text-destructive">{profileErrors.phone}</p>}
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Email</Label>
                            <Input value={user.email} disabled className="opacity-70" />
                            <p className="text-xs text-muted-foreground">Email changes need an administrator — contact your firm admin.</p>
                        </div>
                        <Button
                            disabled={saving !== null}
                            onClick={() => put('/settings/profile', profile, 'profile', undefined, setProfileErrors)}
                        >
                            {saving === 'profile' ? 'Saving…' : 'Save Profile'}
                        </Button>
                    </CardContent>
                </Card>
            )}

            {tab === 'appearance' && (
                <Card className="rounded-2xl border border-border/60 bg-card shadow-sm">
                    <CardContent className="p-6">
                        <p className="text-sm font-semibold text-foreground">Theme</p>
                        <p className="mb-4 mt-0.5 text-sm text-muted-foreground">Stored on your account — follows you across devices.</p>
                        <div className="grid gap-3 sm:grid-cols-3">
                            {THEMES.map((t) => {
                                const active = (activeTheme || preferences.theme || 'light') === t.value;
                                const Icon = t.icon;
                                return (
                                    <button
                                        key={t.value}
                                        type="button"
                                        onClick={() => saveTheme(t.value)}
                                        aria-pressed={active}
                                        className={cn(
                                            'flex items-center gap-3 rounded-xl border p-4 text-left transition-colors',
                                            active
                                                ? 'border-primary bg-primary/5 ring-1 ring-primary'
                                                : 'border-border/60 hover:border-primary/40 hover:bg-muted/40',
                                        )}
                                    >
                                        <span className={cn(
                                            'flex h-9 w-9 items-center justify-center rounded-lg',
                                            active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                                        )}>
                                            <Icon className="h-4 w-4" />
                                        </span>
                                        <span>
                                            <span className="block text-sm font-semibold text-foreground">{t.label}</span>
                                            <span className="block text-xs text-muted-foreground">{t.hint}</span>
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            )}

            {tab === 'security' && (
                <div className="space-y-4">
                    <Card className="rounded-2xl border border-border/60 bg-card shadow-sm">
                        <CardContent className="space-y-4 p-6">
                            <div>
                                <p className="text-sm font-semibold text-foreground">Change password</p>
                                <p className="mt-0.5 text-sm text-muted-foreground">Minimum 12 characters. You stay signed in on this device.</p>
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="current_password">Current password</Label>
                                <Input id="current_password" type="password" autoComplete="current-password" value={password.current_password} onChange={(e) => setPassword((p) => ({ ...p, current_password: e.target.value }))} />
                                {passwordErrors.current_password && <p className="text-xs text-destructive">{passwordErrors.current_password}</p>}
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-1.5">
                                    <Label htmlFor="new_password">New password</Label>
                                    <Input id="new_password" type="password" autoComplete="new-password" value={password.password} onChange={(e) => setPassword((p) => ({ ...p, password: e.target.value }))} />
                                    {passwordErrors.password && <p className="text-xs text-destructive">{passwordErrors.password}</p>}
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="new_password_confirmation">Confirm new password</Label>
                                    <Input id="new_password_confirmation" type="password" autoComplete="new-password" value={password.password_confirmation} onChange={(e) => setPassword((p) => ({ ...p, password_confirmation: e.target.value }))} />
                                </div>
                            </div>
                            <Button
                                disabled={saving !== null}
                                onClick={() => put('/settings/password', password, 'password',
                                    () => setPassword({ current_password: '', password: '', password_confirmation: '' }),
                                    setPasswordErrors)}
                            >
                                {saving === 'password' ? 'Changing…' : 'Change Password'}
                            </Button>
                        </CardContent>
                    </Card>
                    <Card className="rounded-2xl border border-border/60 bg-card shadow-sm">
                        <CardContent className="flex items-center justify-between gap-4 p-6">
                            <div className="flex items-center gap-3">
                                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                                    <ShieldCheck className="h-4 w-4" />
                                </span>
                                <div>
                                    <p className="text-sm font-semibold text-foreground">Two-factor authentication</p>
                                    <p className="text-xs text-muted-foreground">
                                        {user.totp_enabled ? 'Enabled — your account requires a code at sign-in.' : 'Not enabled — add an authenticator app for extra protection.'}
                                    </p>
                                </div>
                            </div>
                            <Button asChild variant="outline" size="sm">
                                <Link href="/two-factor/setup">{user.totp_enabled ? 'Manage' : 'Set up'}</Link>
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            )}

            {tab === 'firm' && canEditFirm && firmDefaults && (
                <Card className="rounded-2xl border border-border/60 bg-card shadow-sm">
                    <CardContent className="space-y-4 p-6">
                        <div>
                            <p className="text-sm font-semibold text-foreground">{firmDefaults.name} — billing defaults</p>
                            <p className="mt-0.5 text-sm text-muted-foreground">
                                Applies to new invoices across the firm. For bank details and full setup, use{' '}
                                <Link href="/admin/firm/setup" className="font-medium text-primary hover:underline">Firm Setup</Link>.
                            </p>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label htmlFor="vat_rate">VAT rate (%)</Label>
                                <Input id="vat_rate" inputMode="decimal" value={firm.vat_rate} onChange={(e) => setFirm((p) => ({ ...p, vat_rate: e.target.value }))} />
                                {firmErrors.vat_rate && <p className="text-xs text-destructive">{firmErrors.vat_rate}</p>}
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="invoice_prefix">Invoice prefix</Label>
                                <Input id="invoice_prefix" value={firm.invoice_prefix} onChange={(e) => setFirm((p) => ({ ...p, invoice_prefix: e.target.value }))} />
                                {firmErrors.invoice_prefix && <p className="text-xs text-destructive">{firmErrors.invoice_prefix}</p>}
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="payment_terms_days">Payment terms (days)</Label>
                                <Input id="payment_terms_days" inputMode="numeric" value={firm.payment_terms_days} onChange={(e) => setFirm((p) => ({ ...p, payment_terms_days: e.target.value }))} />
                                {firmErrors.payment_terms_days && <p className="text-xs text-destructive">{firmErrors.payment_terms_days}</p>}
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="default_hourly_rate">Default hourly rate (£)</Label>
                                <Input id="default_hourly_rate" inputMode="decimal" value={firm.default_hourly_rate} onChange={(e) => setFirm((p) => ({ ...p, default_hourly_rate: e.target.value }))} />
                                {firmErrors.default_hourly_rate && <p className="text-xs text-destructive">{firmErrors.default_hourly_rate}</p>}
                            </div>
                        </div>
                        <Button disabled={saving !== null} onClick={() => put('/settings/firm', firm, 'firm', undefined, setFirmErrors)}>
                            {saving === 'firm' ? 'Saving…' : 'Save Firm Defaults'}
                        </Button>
                    </CardContent>
                </Card>
            )}
        </AppLayout>
    );
}
