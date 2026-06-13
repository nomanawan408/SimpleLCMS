import { Head, useForm } from '@inertiajs/react';
import { useState } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { formatDate, initials } from '@/lib/utils';
import { Plus, Eye, EyeOff } from 'lucide-react';

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
    const [dialogOpen, setDialogOpen] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const { data, setData, post, processing, errors, reset } = useForm({
        full_name: '',
        email: '',
        password: '',
        password_confirmation: '',
        role: availableRoles[0]?.name ?? '',
        phone: '',
        rate_per_hour: '',
    });

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        post('/admin/users', {
            onSuccess: () => {
                reset();
                setDialogOpen(false);
            },
        });
    };

    return (
        <AppLayout title="User Management">
            <Head title="User Management" />

            <div className="max-w-4xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <p className="text-sm text-muted-foreground">{users.length} member{users.length !== 1 ? 's' : ''} in your firm</p>
                    </div>
                    <Button onClick={() => { reset(); setDialogOpen(true); }}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add User
                    </Button>
                </div>

                {/* Users List */}
                <Card>
                    <CardContent className="p-0">
                        <div className="divide-y">
                            {users.map((user) => (
                                <div key={user.id} className="flex items-center gap-4 px-4 py-3">
                                    <Avatar className="h-9 w-9 shrink-0">
                                        <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                                            {initials(user.full_name)}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium">{user.full_name}</p>
                                        <p className="text-xs text-muted-foreground">{user.email}</p>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        {user.roles.length > 0 ? (
                                            user.roles.map((role) => (
                                                <Badge key={role} variant="secondary" className="hidden sm:inline-flex capitalize">
                                                    {role.replace(/_/g, ' ')}
                                                </Badge>
                                            ))
                                        ) : (
                                            <Badge variant="secondary" className="hidden sm:inline-flex capitalize">
                                                {user.role}
                                            </Badge>
                                        )}
                                        {user.totp_enabled && (
                                            <Badge variant="success" className="hidden md:inline-flex text-xs">2FA</Badge>
                                        )}
                                        <Badge variant={user.is_active ? 'success' : 'secondary'} className="text-xs">
                                            {user.is_active ? 'Active' : 'Inactive'}
                                        </Badge>
                                        <span className="text-xs text-muted-foreground hidden lg:block">
                                            Last login: {user.last_login_at ? formatDate(user.last_login_at) : 'Never'}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Add User Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Add New User</DialogTitle>
                        <DialogDescription>
                            Fill in the user's details and assign a role. They can log in with the email and password you set.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={submit} className="space-y-4">
                        {/* Name & Email */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="full_name">Full Name *</Label>
                                <Input
                                    id="full_name"
                                    autoFocus
                                    value={data.full_name}
                                    onChange={(e) => setData('full_name', e.target.value)}
                                    placeholder="Noman Awan"
                                />
                                {errors.full_name && <p className="text-xs text-destructive">{errors.full_name}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="email">Email Address *</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    value={data.email}
                                    onChange={(e) => setData('email', e.target.value)}
                                    placeholder="noman@firm.co.uk"
                                />
                                {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                            </div>
                        </div>

                        {/* Password */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="password">Password *</Label>
                                <div className="relative">
                                    <Input
                                        id="password"
                                        type={showPassword ? 'text' : 'password'}
                                        value={data.password}
                                        onChange={(e) => setData('password', e.target.value)}
                                        placeholder="Min 8 characters"
                                    />
                                    <button
                                        type="button"
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                        onClick={() => setShowPassword(!showPassword)}
                                        tabIndex={-1}
                                    >
                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                                {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="password_confirmation">Confirm Password *</Label>
                                <Input
                                    id="password_confirmation"
                                    type={showPassword ? 'text' : 'password'}
                                    value={data.password_confirmation}
                                    onChange={(e) => setData('password_confirmation', e.target.value)}
                                    placeholder="Repeat password"
                                />
                                {errors.password_confirmation && <p className="text-xs text-destructive">{errors.password_confirmation}</p>}
                            </div>
                        </div>

                        {/* Role */}
                        <div className="space-y-2">
                            <Label>Role *</Label>
                            <Select value={data.role} onValueChange={(v) => setData('role', v)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a role" />
                                </SelectTrigger>
                                <SelectContent>
                                    {availableRoles.map((role) => (
                                        <SelectItem key={role.id} value={role.name}>
                                            <div>
                                                <span className="capitalize">{role.name.replace(/_/g, ' ')}</span>
                                                {role.description && (
                                                    <span className="ml-2 text-xs text-muted-foreground">— {role.description}</span>
                                                )}
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {errors.role && <p className="text-xs text-destructive">{errors.role}</p>}
                        </div>

                        {/* Phone & Rate */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="phone">Phone</Label>
                                <Input
                                    id="phone"
                                    value={data.phone}
                                    onChange={(e) => setData('phone', e.target.value)}
                                    placeholder="+44 7700 900000"
                                />
                                {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="rate_per_hour">Hourly Rate (£)</Label>
                                <Input
                                    id="rate_per_hour"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={data.rate_per_hour}
                                    onChange={(e) => setData('rate_per_hour', e.target.value)}
                                    placeholder="150.00"
                                />
                                {errors.rate_per_hour && <p className="text-xs text-destructive">{errors.rate_per_hour}</p>}
                            </div>
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={processing}>
                                {processing ? 'Creating…' : 'Create User'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
