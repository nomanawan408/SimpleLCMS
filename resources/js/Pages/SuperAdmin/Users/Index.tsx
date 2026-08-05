import { Head, router, useForm } from '@inertiajs/react';
import { useState } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { formatDate } from '@/lib/utils';
import { Users, Search, Shield, Key, Trash2, Pencil } from 'lucide-react';

interface Firm {
    id: string;
    name: string;
}

interface UserRow {
    id: string;
    full_name: string;
    email: string;
    role: string;
    is_active: boolean;
    firm_id: string | null;
    firm?: { id: string; name: string } | null;
    created_at: string;
    last_login_at: string | null;
}

interface PaginatedUsers {
    data: UserRow[];
    current_page: number;
    last_page: number;
    total: number;
    links: { url: string | null; label: string; active: boolean }[];
}

interface Props {
    users: PaginatedUsers;
    firms: Firm[];
    filters: { firm_id?: string; search?: string; role?: string };
}

const roleVariant: Record<string, 'default' | 'success' | 'warning' | 'destructive' | 'secondary' | 'info'> = {
    super_admin: 'destructive',
    firm_admin: 'default',
    admin: 'default',
    administrator: 'default',
    solicitor: 'info',
    lawyer: 'info',
    barrister: 'info',
    paralegal: 'secondary',
    secretary: 'secondary',
    clerk: 'secondary',
    consultant: 'secondary',
    manager: 'success',
    accounts: 'warning',
};

export default function UsersIndex({ users, firms, filters }: Props) {
    const [editUser, setEditUser] = useState<UserRow | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<UserRow | null>(null);
    const [resetConfirm, setResetConfirm] = useState<UserRow | null>(null);

    const editForm = useForm({
        full_name: '',
        email: '',
        role: '',
        is_active: true,
    });

    const handleSearch = (value: string) => {
        router.get('/superadmin/users', { ...filters, search: value }, { preserveState: true, replace: true });
    };

    const handleFirmFilter = (firmId: string) => {
        router.get('/superadmin/users', { ...filters, firm_id: firmId === '_all' ? '' : firmId }, { preserveState: true, replace: true });
    };

    const openEdit = (user: UserRow) => {
        setEditUser(user);
        editForm.setData({
            full_name: user.full_name,
            email: user.email,
            role: user.role,
            is_active: user.is_active,
        });
    };

    const submitEdit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editUser) return;
        editForm.put(`/superadmin/users/${editUser.id}`, {
            onSuccess: () => setEditUser(null),
        });
    };

    const handleDelete = () => {
        if (!deleteConfirm) return;
        useForm({}).delete(`/superadmin/users/${deleteConfirm.id}`, {
            onSuccess: () => setDeleteConfirm(null),
        });
    };

    const handleResetPassword = () => {
        if (!resetConfirm) return;
        useForm({}).put(`/superadmin/users/${resetConfirm.id}/reset-password`, {
            onSuccess: () => setResetConfirm(null),
        });
    };

    return (
        <AppLayout title="Manage Users">
            <Head title="Manage Users" />

            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-lg font-semibold">All Users</h2>
                    <p className="text-sm text-muted-foreground">{users.total} user{users.total !== 1 ? 's' : ''} across all firms</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search users…"
                            defaultValue={filters.search ?? ''}
                            onChange={(e) => handleSearch(e.target.value)}
                            className="pl-9 w-64"
                        />
                    </div>
                    <Select value={filters.firm_id ?? '_all'} onValueChange={handleFirmFilter}>
                        <SelectTrigger className="w-48"><SelectValue placeholder="All Firms" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="_all">All Firms</SelectItem>
                            {firms.map(f => (
                                <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <Card className="surface-card">
                <CardContent className="p-0">
                    {users.data.length === 0 ? (
                        <div className="px-6 py-10 text-center text-sm text-muted-foreground">
                            <Users className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                            No users found.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-border/60">
                                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">User</th>
                                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">Firm</th>
                                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">Role</th>
                                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">Last Login</th>
                                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/40">
                                    {users.data.map(user => (
                                        <tr key={user.id} className="hover:bg-muted/30 transition-colors">
                                            <td className="px-4 py-3">
                                                <div>
                                                    <p className="font-medium">{user.full_name}</p>
                                                    <p className="text-xs text-muted-foreground">{user.email}</p>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="text-sm">{user.firm?.name ?? '—'}</span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <Badge variant={roleVariant[user.role] ?? 'secondary'} className="capitalize">
                                                    {user.role}
                                                </Badge>
                                            </td>
                                            <td className="px-4 py-3">
                                                <Badge variant={user.is_active ? 'success' : 'destructive'}>
                                                    {user.is_active ? 'Active' : 'Inactive'}
                                                </Badge>
                                            </td>
                                            <td className="px-4 py-3 text-muted-foreground">
                                                {user.last_login_at ? formatDate(user.last_login_at) : 'Never'}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center justify-end gap-1">
                                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(user)} title="Edit">
                                                        <Pencil className="h-3.5 w-3.5" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setResetConfirm(user)} title="Reset Password">
                                                        <Key className="h-3.5 w-3.5" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteConfirm(user)} title="Delete">
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

                    {/* Pagination */}
                    {users.last_page > 1 && (
                        <div className="flex items-center justify-between px-4 py-3 border-t border-border/60">
                            <p className="text-xs text-muted-foreground">
                                Page {users.current_page} of {users.last_page}
                            </p>
                            <div className="flex gap-1">
                                {users.links.map((link, i) => (
                                    <Button
                                        key={i}
                                        variant={link.active ? 'default' : 'outline'}
                                        size="sm"
                                        className="h-8 px-3 text-xs"
                                        disabled={!link.url}
                                        onClick={() => link.url && router.get(link.url, {}, { preserveState: true })}
                                    >
                                        {link.label}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Edit User Dialog */}
            <Dialog open={!!editUser} onOpenChange={() => setEditUser(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Edit User</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={submitEdit} className="space-y-4">
                        <div className="space-y-2">
                            <Label>Full Name</Label>
                            <Input value={editForm.data.full_name} onChange={e => editForm.setData('full_name', e.target.value)} />
                            {editForm.errors.full_name && <p className="text-xs text-destructive">{editForm.errors.full_name}</p>}
                        </div>
                        <div className="space-y-2">
                            <Label>Email</Label>
                            <Input type="email" value={editForm.data.email} onChange={e => editForm.setData('email', e.target.value)} />
                            {editForm.errors.email && <p className="text-xs text-destructive">{editForm.errors.email}</p>}
                        </div>
                        <div className="space-y-2">
                            <Label>Role</Label>
                            <Select value={editForm.data.role} onValueChange={v => editForm.setData('role', v)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="super_admin">Super Admin</SelectItem>
                                    <SelectItem value="firm_admin">Firm Admin</SelectItem>
                                    <SelectItem value="manager">Manager</SelectItem>
                                    <SelectItem value="solicitor">Solicitor</SelectItem>
                                    <SelectItem value="lawyer">Lawyer</SelectItem>
                                    <SelectItem value="barrister">Barrister</SelectItem>
                                    <SelectItem value="paralegal">Paralegal</SelectItem>
                                    <SelectItem value="secretary">Secretary</SelectItem>
                                    <SelectItem value="clerk">Clerk</SelectItem>
                                    <SelectItem value="consultant">Consultant</SelectItem>
                                    <SelectItem value="accounts">Accounts</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="is_active"
                                checked={editForm.data.is_active}
                                onChange={e => editForm.setData('is_active', e.target.checked)}
                                className="rounded border-input"
                            />
                            <Label htmlFor="is_active" className="text-sm">Active</Label>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setEditUser(null)}>Cancel</Button>
                            <Button type="submit" disabled={editForm.processing}>
                                {editForm.processing ? 'Saving…' : 'Save Changes'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation */}
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
                        <Button variant="destructive" onClick={handleDelete}>Delete User</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Reset Password Confirmation */}
            <Dialog open={!!resetConfirm} onOpenChange={() => setResetConfirm(null)}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Reset Password</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">
                        Generate a new password for <strong>{resetConfirm?.full_name}</strong>? The new password will be displayed after reset.
                    </p>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setResetConfirm(null)}>Cancel</Button>
                        <Button onClick={handleResetPassword}>Reset Password</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
