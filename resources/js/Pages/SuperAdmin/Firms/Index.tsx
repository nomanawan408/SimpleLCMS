import { Head, useForm } from '@inertiajs/react';
import { useState } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { formatDate } from '@/lib/utils';
import { Building2, Plus, Pencil, Trash2 } from 'lucide-react';

interface FirmRow {
    id: string;
    name: string;
    slug: string;
    plan: string;
    subscription_status: string;
    trial_ends_at: string | null;
    email: string | null;
    phone: string | null;
    city: string | null;
    users_count: number;
    matters_count: number;
    created_at: string;
}

interface Props {
    firms: FirmRow[];
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

const emptyForm = {
    name: '',
    slug: '',
    email: '',
    phone: '',
    plan: 'starter',
    subscription_status: 'trial',
    trial_ends_at: '',
    address_line1: '',
    city: '',
    postcode: '',
    timezone: 'Europe/London',
    default_hourly_rate: '250',
    vat_rate: '20',
};

export default function FirmsIndex({ firms }: Props) {
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingFirm, setEditingFirm] = useState<FirmRow | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<FirmRow | null>(null);

    const { data, setData, post, put, processing, errors, reset, clearErrors } = useForm(emptyForm);

    const openCreate = () => {
        setEditingFirm(null);
        reset(emptyForm);
        clearErrors();
        setDialogOpen(true);
    };

    const openEdit = (firm: FirmRow) => {
        setEditingFirm(firm);
        reset({
            name: firm.name,
            slug: firm.slug,
            email: firm.email ?? '',
            phone: firm.phone ?? '',
            plan: firm.plan,
            subscription_status: firm.subscription_status,
            trial_ends_at: firm.trial_ends_at ? firm.trial_ends_at.slice(0, 10) : '',
            address_line1: '',
            city: firm.city ?? '',
            postcode: '',
            timezone: 'Europe/London',
            default_hourly_rate: '250',
            vat_rate: '20',
        });
        clearErrors();
        setDialogOpen(true);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingFirm) {
            put(`/superadmin/firms/${editingFirm.id}`, {
                onSuccess: () => setDialogOpen(false),
            });
        } else {
            post('/superadmin/firms', {
                onSuccess: () => setDialogOpen(false),
            });
        }
    };

    const handleDelete = () => {
        if (!deleteConfirm) return;
        useForm({}).delete(`/superadmin/firms/${deleteConfirm.id}`, {
            onSuccess: () => setDeleteConfirm(null),
        });
    };

    return (
        <AppLayout title="Manage Firms">
            <Head title="Manage Firms" />

            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-semibold">All Firms</h2>
                    <p className="text-sm text-muted-foreground">{firms.length} firm{firms.length !== 1 ? 's' : ''} registered</p>
                </div>
                <Button onClick={openCreate}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Firm
                </Button>
            </div>

            <Card className="surface-card">
                <CardContent className="p-0">
                    {firms.length === 0 ? (
                        <div className="px-6 py-10 text-center text-sm text-muted-foreground">
                            No firms registered yet. Create the first one to get started.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-border/60">
                                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">Firm</th>
                                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">Plan</th>
                                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">Users</th>
                                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">Matters</th>
                                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">Created</th>
                                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/40">
                                    {firms.map((firm) => (
                                        <tr key={firm.id} className="hover:bg-muted/30 transition-colors">
                                            <td className="px-4 py-3">
                                                <div>
                                                    <p className="font-medium">{firm.name}</p>
                                                    <p className="text-xs text-muted-foreground">{firm.email ?? '—'}{firm.city ? ` · ${firm.city}` : ''}</p>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <Badge variant="outline">{planLabels[firm.plan] ?? firm.plan}</Badge>
                                            </td>
                                            <td className="px-4 py-3">
                                                <Badge variant={statusVariant[firm.subscription_status] ?? 'default'} className="capitalize">
                                                    {firm.subscription_status}
                                                </Badge>
                                                {firm.trial_ends_at && (
                                                    <p className="text-[10px] text-muted-foreground mt-0.5">ends {formatDate(firm.trial_ends_at)}</p>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">{firm.users_count}</td>
                                            <td className="px-4 py-3">{firm.matters_count}</td>
                                            <td className="px-4 py-3 text-muted-foreground">{formatDate(firm.created_at)}</td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center justify-end gap-1">
                                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(firm)}>
                                                        <Pencil className="h-3.5 w-3.5" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteConfirm(firm)}>
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Create / Edit Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editingFirm ? 'Edit Firm' : 'Add New Firm'}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Firm name *</Label>
                            <Input id="name" value={data.name} onChange={(e) => setData('name', e.target.value)} />
                            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="slug">Slug *</Label>
                            <Input id="slug" value={data.slug} onChange={(e) => setData('slug', e.target.value)} placeholder="demo-law-firm" disabled={!!editingFirm} />
                            {errors.slug && <p className="text-xs text-destructive">{errors.slug}</p>}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <Input id="email" type="email" value={data.email} onChange={(e) => setData('email', e.target.value)} />
                                {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="phone">Phone</Label>
                                <Input id="phone" value={data.phone} onChange={(e) => setData('phone', e.target.value)} />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="plan">Plan *</Label>
                                <select
                                    id="plan"
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    value={data.plan}
                                    onChange={(e) => setData('plan', e.target.value)}
                                >
                                    <option value="starter">Starter</option>
                                    <option value="professional">Professional</option>
                                    <option value="enterprise">Enterprise</option>
                                </select>
                                {errors.plan && <p className="text-xs text-destructive">{errors.plan}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="subscription_status">Subscription Status *</Label>
                                <select
                                    id="subscription_status"
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    value={data.subscription_status}
                                    onChange={(e) => setData('subscription_status', e.target.value)}
                                >
                                    <option value="trial">Trial</option>
                                    <option value="active">Active</option>
                                    <option value="past_due">Past Due</option>
                                    <option value="cancelled">Cancelled</option>
                                </select>
                            </div>
                        </div>

                        {data.subscription_status === 'trial' && (
                            <div className="space-y-2">
                                <Label htmlFor="trial_ends_at">Trial ends at</Label>
                                <Input id="trial_ends_at" type="date" value={data.trial_ends_at} onChange={(e) => setData('trial_ends_at', e.target.value)} />
                            </div>
                        )}

                        <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="city">City</Label>
                                <Input id="city" value={data.city} onChange={(e) => setData('city', e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="default_hourly_rate">Hourly rate (£)</Label>
                                <Input id="default_hourly_rate" type="number" min="0" step="0.01" value={data.default_hourly_rate} onChange={(e) => setData('default_hourly_rate', e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="vat_rate">VAT rate (%)</Label>
                                <Input id="vat_rate" type="number" min="0" max="100" step="0.1" value={data.vat_rate} onChange={(e) => setData('vat_rate', e.target.value)} />
                            </div>
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={processing}>
                                {processing ? 'Saving…' : editingFirm ? 'Update Firm' : 'Create Firm'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation */}
            <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Delete Firm</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">
                        Are you sure you want to delete <strong>{deleteConfirm?.name}</strong>? This will permanently remove the firm, all its users, and all associated data. This action cannot be undone.
                    </p>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
                        <Button variant="destructive" onClick={handleDelete} disabled={processing}>
                            Delete Firm
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
