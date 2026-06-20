import { Head, useForm, router } from '@inertiajs/react';
import { useState } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { formatDate, initials } from '@/lib/utils';
import { Plus, Pencil, Trash2, KeyRound, Eye, EyeOff } from 'lucide-react';

interface RoleOption {
    id: number;
    name: string;
    description: string | null;
    is_system: boolean;
}

interface UserItem {
    id: string;
    full_name: string;
    email: string;
    role: string;
    roles: string[];
    phone: string | null;
    rate_per_hour: string | null;
    is_active: boolean;
    totp_enabled: boolean;
    last_login_at: string | null;
    avatar_url: string | null;
    created_at: string;
}

interface Props {
    users: UserItem[];
    availableRoles: RoleOption[];
}

export default function UsersIndex({ users, availableRoles }: Props) {
    const [createOpen, setCreateOpen] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const [passwordOpen, setPasswordOpen] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);
    const [showPassword, setShowPassword] = useState(false);

    // ── Create User Form ──
    const createForm = useForm({
        full_name: '',
        email: '',
        password: '',
        password_confirmation: '',
        role: availableRoles[0]?.name ?? '',
        phone: '',
        rate_per_hour: '',
    });

    const submitCreate = (e: React.FormEvent) => {
        e.preventDefault();
        createForm.post('/admin/users', {
            onSuccess: () => { createForm.reset(); setCreateOpen(false); },
        });
    };

    // ── Edit User Form ──
    const editForm = useForm({
        full_name: '',
        email: '',
        role: '',
        is_active: true,
        phone: '',
        rate_per_hour: '',
    });

    const openEdit = (user: UserItem) => {
        setSelectedUser(user);
        editForm.setData({
            full_name: user.full_name,
            email: user.email,
            role: user.roles[0] || user.role,
            is_active: user.is_active,
            phone: user.phone || '',
            rate_per_hour: user.rate_per_hour || '',
        });
        setEditOpen(true);
    };

    const submitEdit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedUser) return;
        editForm.put(`/admin/users/${selectedUser.id}`, {
            onSuccess: () => setEditOpen(false),
        });
    };

    // ── Password Reset Form ──
    const passwordForm = useForm({
        password: '',
        password_confirmation: '',
    });

    const openPasswordReset = (user: UserItem) => {
        setSelectedUser(user);
        passwordForm.reset();
        setShowPassword(false);
        setPasswordOpen(true);
    };

    const submitPassword = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedUser) return;
        passwordForm.put(`/admin/users/${selectedUser.id}/reset-password`, {
            onSuccess: () => setPasswordOpen(false),
        });
    };

    // ── Delete User ──
    const openDelete = (user: UserItem) => {
        setSelectedUser(user);
        setDeleteOpen(true);
    };

    const confirmDelete = () => {
        if (!selectedUser) return;
        router.delete(`/admin/users/${selectedUser.id}`, {
            onSuccess: () => setDeleteOpen(false),
        });
    };

    return (
        <AppLayout title="User Management">
            <Head title="User Management" />

            <div className="max-w-4xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Users</h1>
                        <p className="text-sm text-muted-foreground mt-1">{users.length} member{users.length !== 1 ? 's' : ''} in your firm</p>
                    </div>
                    <Button onClick={() => { createForm.reset(); setCreateOpen(true); }}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add User
                    </Button>
                </div>

                <Card className="surface-card">
                    <CardContent className="p-0">
                        {users.length === 0 ? (
                            <div className="py-16 text-center">
                                <p className="text-muted-foreground text-sm mb-4">No users yet.</p>
                                <Button size="sm" onClick={() => setCreateOpen(true)}>
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add your first user
                                </Button>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b bg-muted/30">
                                            <th className="text-left px-4 py-3 font-medium text-muted-foreground tracking-tight">User</th>
                                            <th className="text-left px-4 py-3 font-medium text-muted-foreground tracking-tight hidden md:table-cell">Role</th>
                                            <th className="text-left px-4 py-3 font-medium text-muted-foreground tracking-tight">Status</th>
                                            <th className="text-left px-4 py-3 font-medium text-muted-foreground tracking-tight hidden lg:table-cell">Last Login</th>
                                            <th className="text-right px-4 py-3 font-medium text-muted-foreground tracking-tight">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/60">
                                        {users.map((user) => (
                                            <tr key={user.id} className="hover:bg-muted/20 transition-colors">
                                                <td className="px-4 py-3">
                                                    <p className="font-medium">{user.full_name}</p>
                                                    <p className="text-xs text-muted-foreground">{user.email}</p>
                                                </td>
                                                <td className="px-4 py-3 hidden md:table-cell">
                                                    {user.roles.length > 0 ? (
                                                        <div className="flex flex-wrap gap-1">
                                                            {user.roles.map((role) => (
                                                                <Badge key={role} variant="secondary" className="capitalize text-xs">
                                                                    {role.replace(/_/g, ' ')}
                                                                </Badge>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <Badge variant="secondary" className="capitalize text-xs">
                                                            {user.role}
                                                        </Badge>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <Badge variant={user.is_active ? 'success' : 'secondary'} className="text-xs">
                                                        {user.is_active ? 'Active' : 'Inactive'}
                                                    </Badge>
                                                    {user.totp_enabled && (
                                                        <Badge variant="info" className="ml-1 text-xs">2FA</Badge>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 hidden lg:table-cell text-xs text-muted-foreground">
                                                    {user.last_login_at ? formatDate(user.last_login_at) : 'Never'}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(user)} title="Edit user">
                                                            <Pencil className="h-3.5 w-3.5" />
                                                        </Button>
                                                        <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => openPasswordReset(user)} title="Reset password">
                                                            <KeyRound className="h-3.5 w-3.5" />
                                                        </Button>
                                                        <Button variant="outline" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => openDelete(user)} title="Delete user">
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
            </div>

            {/* ── Create User Dialog ── */}
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Add New User</DialogTitle>
                        <DialogDescription>
                            Fill in the user's details and assign a role. They can log in with the email and password you set.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={submitCreate} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="create_full_name">Full Name *</Label>
                                <Input id="create_full_name" autoFocus value={createForm.data.full_name} onChange={(e) => createForm.setData('full_name', e.target.value)} placeholder="Noman Awan" />
                                {createForm.errors.full_name && <p className="text-xs text-destructive">{createForm.errors.full_name}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="create_email">Email *</Label>
                                <Input id="create_email" type="email" value={createForm.data.email} onChange={(e) => createForm.setData('email', e.target.value)} placeholder="noman@firm.co.uk" />
                                {createForm.errors.email && <p className="text-xs text-destructive">{createForm.errors.email}</p>}
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="create_password">Password *</Label>
                                <div className="relative">
                                    <Input id="create_password" type={showPassword ? 'text' : 'password'} value={createForm.data.password} onChange={(e) => createForm.setData('password', e.target.value)} placeholder="Min 8 characters" />
                                    <button type="button" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowPassword(!showPassword)} tabIndex={-1}>
                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                                {createForm.errors.password && <p className="text-xs text-destructive">{createForm.errors.password}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="create_password_confirmation">Confirm *</Label>
                                <Input id="create_password_confirmation" type={showPassword ? 'text' : 'password'} value={createForm.data.password_confirmation} onChange={(e) => createForm.setData('password_confirmation', e.target.value)} placeholder="Repeat password" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Role *</Label>
                            <Select value={createForm.data.role} onValueChange={(v) => createForm.setData('role', v)}>
                                <SelectTrigger><SelectValue placeholder="Select a role" /></SelectTrigger>
                                <SelectContent>
                                    {availableRoles.map((role) => (
                                        <SelectItem key={role.id} value={role.name}>
                                            <span className="capitalize">{role.name.replace(/_/g, ' ')}</span>
                                            {role.description && <span className="ml-2 text-xs text-muted-foreground">— {role.description}</span>}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {createForm.errors.role && <p className="text-xs text-destructive">{createForm.errors.role}</p>}
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="create_phone">Phone</Label>
                                <Input id="create_phone" value={createForm.data.phone} onChange={(e) => createForm.setData('phone', e.target.value)} placeholder="+44 7700 900000" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="create_rate">Hourly Rate (£)</Label>
                                <Input id="create_rate" type="number" step="0.01" min="0" value={createForm.data.rate_per_hour} onChange={(e) => createForm.setData('rate_per_hour', e.target.value)} placeholder="150.00" />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={createForm.processing}>{createForm.processing ? 'Creating…' : 'Create User'}</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* ── Edit User Dialog ── */}
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Edit User</DialogTitle>
                        <DialogDescription>
                            Update {selectedUser?.full_name}'s details.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={submitEdit} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="edit_full_name">Full Name *</Label>
                                <Input id="edit_full_name" autoFocus value={editForm.data.full_name} onChange={(e) => editForm.setData('full_name', e.target.value)} />
                                {editForm.errors.full_name && <p className="text-xs text-destructive">{editForm.errors.full_name}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="edit_email">Email *</Label>
                                <Input id="edit_email" type="email" value={editForm.data.email} onChange={(e) => editForm.setData('email', e.target.value)} />
                                {editForm.errors.email && <p className="text-xs text-destructive">{editForm.errors.email}</p>}
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Role</Label>
                                <Select value={editForm.data.role} onValueChange={(v) => editForm.setData('role', v)}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {availableRoles.map((role) => (
                                            <SelectItem key={role.id} value={role.name}>
                                                <span className="capitalize">{role.name.replace(/_/g, ' ')}</span>
                                                {role.description && <span className="ml-2 text-xs text-muted-foreground">— {role.description}</span>}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {editForm.errors.role && <p className="text-xs text-destructive">{editForm.errors.role}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label>Status</Label>
                                <Select value={editForm.data.is_active ? 'active' : 'inactive'} onValueChange={(v) => editForm.setData('is_active', v === 'active')}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="active">Active</SelectItem>
                                        <SelectItem value="inactive">Inactive</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="edit_phone">Phone</Label>
                                <Input id="edit_phone" value={editForm.data.phone} onChange={(e) => editForm.setData('phone', e.target.value)} placeholder="+44 7700 900000" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="edit_rate">Hourly Rate (£)</Label>
                                <Input id="edit_rate" type="number" step="0.01" min="0" value={editForm.data.rate_per_hour} onChange={(e) => editForm.setData('rate_per_hour', e.target.value)} placeholder="150.00" />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={editForm.processing}>{editForm.processing ? 'Saving…' : 'Save Changes'}</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* ── Password Reset Dialog ── */}
            <Dialog open={passwordOpen} onOpenChange={setPasswordOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Reset Password</DialogTitle>
                        <DialogDescription>
                            Set a new password for {selectedUser?.full_name}. They will use this to log in.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={submitPassword} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="reset_password">New Password *</Label>
                            <div className="relative">
                                <Input id="reset_password" type={showPassword ? 'text' : 'password'} autoFocus value={passwordForm.data.password} onChange={(e) => passwordForm.setData('password', e.target.value)} placeholder="Min 8 characters" />
                                <button type="button" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowPassword(!showPassword)} tabIndex={-1}>
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                            {passwordForm.errors.password && <p className="text-xs text-destructive">{passwordForm.errors.password}</p>}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="reset_password_confirmation">Confirm Password *</Label>
                            <Input id="reset_password_confirmation" type={showPassword ? 'text' : 'password'} value={passwordForm.data.password_confirmation} onChange={(e) => passwordForm.setData('password_confirmation', e.target.value)} placeholder="Repeat password" />
                            {passwordForm.errors.password_confirmation && <p className="text-xs text-destructive">{passwordForm.errors.password_confirmation}</p>}
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setPasswordOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={passwordForm.processing}>{passwordForm.processing ? 'Resetting…' : 'Reset Password'}</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* ── Delete Confirmation Dialog ── */}
            <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Remove User</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to remove <strong>{selectedUser?.full_name}</strong>? This action can be undone by a super admin.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
                        <Button variant="destructive" onClick={confirmDelete}>Remove User</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
