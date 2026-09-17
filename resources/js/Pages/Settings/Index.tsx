import { useState } from 'react';
import { Head, Link, router, usePage } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { PageTabs } from '@/components/ui/page-tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { applyTheme, type ThemeChoice } from '@/lib/theme';
import FirmSetupForm from '@/components/settings/FirmSetupForm';
import UsersManager, { type UserItem, type RoleOption } from '@/components/settings/UsersManager';
import RolesManager, { type RoleData } from '@/components/settings/RolesManager';
import {
    Building2, KeyRound, Moon, Monitor, Palette, Sun, UserRound, Users,
    ShieldCheck, Shield,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Firm, PageProps } from '@/types';

interface Props {
    preferences: { theme?: string };
    canEditFirm: boolean;
    canManageTeam: boolean;
    firm: Firm | null;
    isSuperAdmin: boolean;
    users?: UserItem[];
    availableRoles?: RoleOption[];
    roles?: RoleData[];
    groupedPermissions?: Record<string, { id: number; name: string }[]>;
}

type Category = 'account' | 'firm';
type SectionKey = 'profile' | 'appearance' | 'security' | 'company' | 'users' | 'roles';

interface Section {
    key: SectionKey;
    label: string;
    icon: LucideIcon;
}

const ACCOUNT_SECTIONS: Section[] = [
    { key: 'profile', label: 'Profile', icon: UserRound },
    { key: 'appearance', label: 'Appearance', icon: Palette },
    { key: 'security', label: 'Security', icon: KeyRound },
];

const THEMES: { value: ThemeChoice; label: string; hint: string; icon: LucideIcon }[] = [
    { value: 'light', label: 'Light', hint: 'Always light', icon: Sun },
    { value: 'dark', label: 'Dark', hint: 'Always dark', icon: Moon },
    { value: 'system', label: 'System', hint: 'Follow your device', icon: Monitor },
];

function sectionCategory(section: SectionKey): Category {
    return section === 'company' || section === 'users' || section === 'roles' ? 'firm' : 'account';
}

export default function SettingsIndex({
    preferences, canEditFirm, canManageTeam, firm, isSuperAdmin,
    users, availableRoles, roles, groupedPermissions,
}: Props) {
    const { auth, theme: activeTheme } = usePage<PageProps>().props;
    const user = auth.user!;

    const firmSections: Section[] = [
        ...(canEditFirm && firm ? [{ key: 'company', label: 'Company', icon: Building2 } as Section] : []),
        ...(canManageTeam && users && availableRoles ? [{ key: 'users', label: 'Users', icon: Users } as Section] : []),
        ...(canManageTeam && roles && groupedPermissions ? [{ key: 'roles', label: 'Roles', icon: Shield } as Section] : []),
    ];
    const showFirmCategory = firmSections.length > 0;

    // Deep links (?section=users) land on the right panel; unknown or
    // unavailable sections fall back to the profile panel.
    const [section, setSection] = useState<SectionKey>(() => {
        const wanted = typeof window !== 'undefined'
            ? new URLSearchParams(window.location.search).get('section')
            : null;
        const available: SectionKey[] = [
            ...ACCOUNT_SECTIONS.map((s) => s.key),
            ...firmSections.map((s) => s.key),
        ];
        return (wanted as SectionKey) && available.includes(wanted as SectionKey)
            ? (wanted as SectionKey)
            : 'profile';
    });
    const category: Category = showFirmCategory ? sectionCategory(section) : 'account';
    const sections = category === 'firm' ? firmSections : ACCOUNT_SECTIONS;

    function switchCategory(next: Category) {
        setSection(next === 'firm' ? firmSections[0].key : 'profile');
    }

    const [saving, setSaving] = useState<string | null>(null);

    const [profile, setProfile] = useState({ full_name: user.full_name, phone: (user as any).phone ?? '' });
    const [profileErrors, setProfileErrors] = useState<Record<string, string>>({});

    const [password, setPassword] = useState({ current_password: '', password: '', password_confirmation: '' });
    const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({});

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

    return (
        <AppLayout title="Settings">
            <Head title="Settings" />

            <div className="mb-6">
                <h1 className="text-2xl font-extrabold tracking-tight">Settings</h1>
                <p className="mt-0.5 text-sm text-muted-foreground">Your preferences apply to you on every device. Firm settings apply to the whole practice.</p>
            </div>

            <PageTabs
                tabs={[
                    { key: 'account', label: 'My Account', icon: UserRound },
                    ...(showFirmCategory ? [{ key: 'firm', label: 'Firm & Team', icon: Building2 }] : []),
                ]}
                value={category}
                onChange={(key) => switchCategory(key as Category)}
            />

            <div className="flex flex-col gap-4 lg:flex-row">
                {/* Vertical sections for the active category */}
                <nav aria-label="Settings sections" className="flex shrink-0 gap-1 overflow-x-auto lg:w-56 lg:flex-col">
                    {sections.map((s) => {
                        const active = section === s.key;
                        const Icon = s.icon;
                        return (
                            <button
                                key={s.key}
                                type="button"
                                onClick={() => setSection(s.key)}
                                aria-current={active ? 'page' : undefined}
                                className={cn(
                                    'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors',
                                    active
                                        ? 'bg-primary/10 text-primary'
                                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                                )}
                            >
                                <Icon className="h-4 w-4 shrink-0" />
                                {s.label}
                            </button>
                        );
                    })}
                </nav>

                <div className="min-w-0 flex-1">
                    {section === 'profile' && (
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

                    {section === 'appearance' && (
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

                    {section === 'security' && (
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

                    {section === 'company' && canEditFirm && firm && (
                        <FirmSetupForm firm={firm} isSuperAdmin={isSuperAdmin} />
                    )}

                    {section === 'users' && canManageTeam && users && availableRoles && (
                        <UsersManager users={users} availableRoles={availableRoles} />
                    )}

                    {section === 'roles' && canManageTeam && roles && groupedPermissions && (
                        <RolesManager roles={roles} groupedPermissions={groupedPermissions} />
                    )}
                </div>
            </div>
        </AppLayout>
    );
}
