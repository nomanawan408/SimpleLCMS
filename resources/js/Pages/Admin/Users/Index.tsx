import { Head, useForm } from '@inertiajs/react';
import { useState } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { formatDate, initials } from '@/lib/utils';
import { Plus, X } from 'lucide-react';

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
    const [showInvite, setShowInvite] = useState(false);

    const { data, setData, post, processing, errors, reset } = useForm({
        full_name: '',
        email: '',
        role: availableRoles[0]?.name ?? '',
    });

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        post('/admin/users', {
            onSuccess: () => {
                reset();
                setShowInvite(false);
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
                    <Button onClick={() => setShowInvite(!showInvite)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Invite User
                    </Button>
                </div>

                {/* Invite Form */}
                {showInvite && (
                    <Card className="mb-6 border-primary/30 bg-primary/5">
                        <CardHeader className="flex flex-row items-center justify-between pb-3">
                            <CardTitle className="text-base">Invite New User</CardTitle>
                            <Button variant="ghost" size="icon" onClick={() => setShowInvite(false)}>
                                <X className="h-4 w-4" />
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                                <div className="space-y-2">
                                    <Label htmlFor="full_name">Full name</Label>
                                    <Input
                                        id="full_name"
                                        autoFocus
                                        value={data.full_name}
                                        onChange={(e) => setData('full_name', e.target.value)}
                                        placeholder="Aoife Murphy"
                                    />
                                    {errors.full_name && <p className="text-xs text-destructive">{errors.full_name}</p>}
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="email">Work email</Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        value={data.email}
                                        onChange={(e) => setData('email', e.target.value)}
                                        placeholder="user@firm.co.uk"
                                    />
                                    {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                                </div>
                                <div className="space-y-2">
                                    <Label>Role</Label>
                                    <Select value={data.role} onValueChange={(v) => setData('role', v)}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {availableRoles.map((role) => (
                                                <SelectItem key={role.id} value={role.name}>
                                                    <span className="capitalize">{role.name.replace(/_/g, ' ')}</span>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="sm:col-span-3 flex justify-end">
                                    <Button type="submit" disabled={processing}>
                                        {processing ? 'Sending invite…' : 'Send invite'}
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                )}

                {/* Users Table */}
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
        </AppLayout>
    );
}
