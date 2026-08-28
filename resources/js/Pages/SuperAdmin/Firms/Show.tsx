import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useForm } from '@inertiajs/react';
import { formatDate, formatCurrency } from '@/lib/utils';
import { ArrowLeft, Building2, Users, Briefcase, Mail, Phone, MapPin, CreditCard, Key, Trash2 } from 'lucide-react';

interface FirmUser {
    id: string;
    full_name: string;
    email: string;
    role: string;
    is_active: boolean;
    last_login_at: string | null;
}

interface FirmData {
    id: string;
    name: string;
    slug: string;
    plan: string;
    subscription_status: string;
    trial_ends_at: string | null;
    email: string | null;
    phone: string | null;
    website: string | null;
    address_line1: string | null;
    city: string | null;
    postcode: string | null;
    vat_number: string | null;
    sra_number: string | null;
    default_hourly_rate: number;
    vat_rate: number;
    invoice_prefix: string;
    bank_name: string | null;
    bank_account_name: string | null;
    bank_sort_code: string | null;
    bank_account_number: string | null;
    users_count: number;
    matters_count: number;
    created_at: string;
    users?: FirmUser[];
}

interface Props {
    firm: FirmData;
}

const statusVariant: Record<string, 'default' | 'success' | 'warning' | 'destructive' | 'secondary'> = {
    active: 'success',
    trial: 'warning',
    past_due: 'destructive',
    cancelled: 'secondary',
};

const planLabels: Record<string, string> = {
    starter: 'Starter',
    professional: 'Professional',
    enterprise: 'Enterprise',
};

const roleVariant: Record<string, 'default' | 'success' | 'warning' | 'destructive' | 'secondary' | 'info'> = {
    admin: 'default',
    solicitor: 'info',
    lawyer: 'info',
    paralegal: 'secondary',
    accounts: 'warning',
};

export default function FirmShow({ firm }: Props) {
    const [resetConfirm, setResetConfirm] = useState<FirmUser | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<FirmUser | null>(null);

    const handleResetPassword = () => {
        if (!resetConfirm) return;
        useForm({}).put(`/superadmin/users/${resetConfirm.id}/reset-password`, {
            onSuccess: () => setResetConfirm(null),
        });
    };

    const handleDeleteUser = () => {
        if (!deleteConfirm) return;
        useForm({}).delete(`/superadmin/users/${deleteConfirm.id}`, {
            onSuccess: () => setDeleteConfirm(null),
        });
    };

    const users = firm.users ?? [];

    return (
        <AppLayout title={firm.name}>
            <Head title={firm.name} />

            <div className="mb-5 flex items-center justify-between">
                <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground -ml-2">
                    <Link href="/superadmin/firms">
                        <ArrowLeft className="h-4 w-4 mr-1.5" />
                        Back to Firms
                    </Link>
                </Button>
            </div>

            {/* Firm Header */}
            <Card className="surface-card mb-5">
                <CardContent className="p-5">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                                <Badge variant="outline" className="text-xs font-semibold">{planLabels[firm.plan] ?? firm.plan}</Badge>
                                <Badge variant={statusVariant[firm.subscription_status] ?? 'default'} className="text-xs font-semibold capitalize">
                                    {firm.subscription_status}
                                </Badge>
                            </div>
                            <h1 className="text-xl font-bold tracking-tight mb-1">{firm.name}</h1>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                                {firm.email && (
                                    <span className="flex items-center gap-1">
                                        <Mail className="h-3.5 w-3.5" />
                                        <a href={`mailto:${firm.email}`} className="hover:text-primary">{firm.email}</a>
                                    </span>
                                )}
                                {firm.phone && (
                                    <span className="flex items-center gap-1">
                                        <Phone className="h-3.5 w-3.5" />
                                        {firm.phone}
                                    </span>
                                )}
                                {firm.city && (
                                    <span className="flex items-center gap-1">
                                        <MapPin className="h-3.5 w-3.5" />
                                        {[firm.city, firm.postcode].filter(Boolean).join(', ')}
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="shrink-0 grid grid-cols-2 gap-4 text-right">
                            <div>
                                <p className="text-2xl font-bold text-primary">{firm.users_count}</p>
                                <p className="text-xs text-muted-foreground">Users</p>
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-primary">{firm.matters_count}</p>
                                <p className="text-xs text-muted-foreground">Matters</p>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                {/* Left Column - Details */}
                <div className="lg:col-span-2 space-y-5">
                    {/* Firm Details */}
                    <Card className="surface-card">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base tracking-tight flex items-center gap-2">
                                <Building2 className="h-4 w-4" />
                                Firm Details
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <p className="text-muted-foreground text-xs">Slug</p>
                                <p className="font-medium">{firm.slug}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground text-xs">Created</p>
                                <p className="font-medium">{formatDate(firm.created_at)}</p>
                            </div>
                            {firm.vat_number && (
                                <div>
                                    <p className="text-muted-foreground text-xs">VAT Number</p>
                                    <p className="font-medium">{firm.vat_number}</p>
                                </div>
                            )}
                            {firm.sra_number && (
                                <div>
                                    <p className="text-muted-foreground text-xs">SRA Number</p>
                                    <p className="font-medium">{firm.sra_number}</p>
                                </div>
                            )}
                            {firm.website && (
                                <div>
                                    <p className="text-muted-foreground text-xs">Website</p>
                                    <a href={firm.website} target="_blank" className="font-medium hover:text-primary">{firm.website}</a>
                                </div>
                            )}
                            {firm.trial_ends_at && (
                                <div>
                                    <p className="text-muted-foreground text-xs">Trial Ends</p>
                                    <p className="font-medium">{formatDate(firm.trial_ends_at)}</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Billing Info */}
                    <Card className="surface-card">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base tracking-tight flex items-center gap-2">
                                <CreditCard className="h-4 w-4" />
                                Billing Defaults
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                                <p className="text-muted-foreground text-xs">Hourly Rate</p>
                                <p className="font-medium">{formatCurrency(firm.default_hourly_rate)}/hr</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground text-xs">VAT Rate</p>
                                <p className="font-medium">{firm.vat_rate}%</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground text-xs">Invoice Prefix</p>
                                <p className="font-medium">{firm.invoice_prefix}</p>
                            </div>
                            {firm.bank_name && (
                                <>
                                    <div>
                                        <p className="text-muted-foreground text-xs">Bank</p>
                                        <p className="font-medium">{firm.bank_name}</p>
                                    </div>
                                    {firm.bank_account_name && (
                                        <div>
                                            <p className="text-muted-foreground text-xs">Account Name</p>
                                            <p className="font-medium">{firm.bank_account_name}</p>
                                        </div>
                                    )}
                                    {firm.bank_sort_code && (
                                        <div>
                                            <p className="text-muted-foreground text-xs">Sort Code</p>
                                            <p className="font-medium">{firm.bank_sort_code}</p>
                                        </div>
                                    )}
                                </>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column - Users */}
                <div>
                    <Card className="surface-card">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base tracking-tight flex items-center gap-2">
                                <Users className="h-4 w-4" />
                                Users ({users.length})
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            {users.length === 0 ? (
                                <div className="px-6 py-8 text-center text-sm text-muted-foreground">
                                    No users in this firm.
                                </div>
                            ) : (
                                <div className="divide-y divide-border/60">
                                    {users.map(user => (
                                        <div key={user.id} className="px-4 py-3 flex items-center justify-between">
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium truncate">{user.full_name}</p>
                                                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                                            </div>
                                            <div className="flex items-center gap-1 shrink-0 ml-2">
                                                <Badge variant={roleVariant[user.role] ?? 'secondary'} className="text-sm capitalize">
                                                    {user.role}
                                                </Badge>
                                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setResetConfirm(user)} title="Reset Password">
                                                    <Key className="h-3 w-3" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => setDeleteConfirm(user)} title="Delete">
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Reset Password Dialog */}
            <Dialog open={!!resetConfirm} onOpenChange={() => setResetConfirm(null)}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Reset Password</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">
                        Generate a new password for <strong>{resetConfirm?.full_name}</strong>?
                    </p>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setResetConfirm(null)}>Cancel</Button>
                        <Button onClick={handleResetPassword}>Reset Password</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete User Dialog */}
            <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Delete User</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">
                        Are you sure you want to delete <strong>{deleteConfirm?.full_name}</strong>? This cannot be undone.
                    </p>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
                        <Button variant="destructive" onClick={handleDeleteUser}>Delete User</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
