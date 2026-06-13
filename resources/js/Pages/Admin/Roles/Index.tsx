import { Head, router, useForm } from '@inertiajs/react';
import { useState } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
    Plus, Shield, Pencil, Trash2, Users, Lock, CheckSquare, Square,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface RoleData {
    id: number;
    name: string;
    description: string | null;
    is_system: boolean;
    is_builtin: boolean;
    firm_id: string | null;
    permissions_count: number;
    users_count: number;
    permissions: string[];
}

interface Props {
    roles: RoleData[];
    groupedPermissions: Record<string, { id: number; name: string }[]>;
}

const ENTITY_LABELS: Record<string, string> = {
    matters: 'Matters',
    contacts: 'Contacts',
    entries: 'Time Entries',
    invoices: 'Invoices',
    documents: 'Documents',
    users: 'Users',
    settings: 'Firm Settings',
    calendar: 'Calendar',
    events: 'Events',
    tasks: 'Tasks',
    reports: 'Reports',
    trust: 'Trust',
    expenses: 'Expenses',
    data: 'Data Export',
};

function actionFromPerm(perm: string): string {
    const parts = perm.split('_');
    return parts[0];
}

function actionLabel(action: string): string {
    const map: Record<string, string> = {
        view: 'View', create: 'Create', edit: 'Edit', delete: 'Delete',
        manage: 'Manage', upload: 'Upload', export: 'Export',
    };
    return map[action] || action;
}

export default function RolesIndex({ roles, groupedPermissions }: Props) {
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingRole, setEditingRole] = useState<RoleData | null>(null);

    const { data, setData, post, put, processing, errors, reset } = useForm({
        name: '',
        description: '',
        permissions: [] as string[],
    });

    const openCreate = () => {
        setEditingRole(null);
        reset();
        setData({ name: '', description: '', permissions: [] });
        setDialogOpen(true);
    };

    const openEdit = (role: RoleData) => {
        setEditingRole(role);
        setData({
            name: role.name,
            description: role.description || '',
            permissions: [...role.permissions],
        });
        setDialogOpen(true);
    };

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingRole) {
            put(`/admin/roles/${editingRole.id}`, {
                onSuccess: () => setDialogOpen(false),
            });
        } else {
            post('/admin/roles', {
                onSuccess: () => {
                    reset();
                    setDialogOpen(false);
                },
            });
        }
    };

    const deleteRole = (role: RoleData) => {
        if (!confirm(`Delete role "${role.name}"? Users with this role will lose access.`)) return;
        router.delete(`/admin/roles/${role.id}`);
    };

    const togglePermission = (perm: string) => {
        setData('permissions',
            data.permissions.includes(perm)
                ? data.permissions.filter(p => p !== perm)
                : [...data.permissions, perm]
        );
    };

    const toggleGroup = (groupPerms: { name: string }[]) => {
        const names = groupPerms.map(p => p.name);
        const allSelected = names.every(n => data.permissions.includes(n));
        setData('permissions',
            allSelected
                ? data.permissions.filter(p => !names.includes(p))
                : [...new Set([...data.permissions, ...names])]
        );
    };

    return (
        <AppLayout title="Roles & Permissions">
            <Head title="Roles & Permissions" />

            <div className="max-w-5xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <p className="text-sm text-muted-foreground">
                            {roles.length} role{roles.length !== 1 ? 's' : ''} configured
                        </p>
                    </div>
                    <Button onClick={openCreate}>
                        <Plus className="h-4 w-4 mr-2" />
                        Create Role
                    </Button>
                </div>

                {/* Roles Grid */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {roles.map((role) => (
                        <Card key={role.id} className={cn(
                            'transition-all hover:shadow-md',
                            role.is_builtin && 'border-primary/20 bg-primary/5'
                        )}>
                            <CardContent className="p-5">
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <div className={cn(
                                            'flex h-8 w-8 items-center justify-center rounded-lg',
                                            role.is_builtin ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
                                        )}>
                                            <Shield className="h-4 w-4" />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-semibold capitalize">
                                                {role.name.replace(/_/g, ' ')}
                                            </h3>
                                            {role.is_builtin && (
                                                <Badge variant="info" className="text-[10px] px-1.5 py-0 mt-0.5">System</Badge>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        {!role.is_builtin && (
                                            <>
                                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(role)}>
                                                    <Pencil className="h-3.5 w-3.5" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteRole(role)}>
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </>
                                        )}
                                        {role.is_builtin && (
                                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(role)}>
                                                <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                                            </Button>
                                        )}
                                    </div>
                                </div>

                                {role.description && (
                                    <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{role.description}</p>
                                )}

                                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                    <span className="flex items-center gap-1">
                                        <Users className="h-3 w-3" />
                                        {role.users_count} user{role.users_count !== 1 ? 's' : ''}
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <Lock className="h-3 w-3" />
                                        {role.permissions_count} permission{role.permissions_count !== 1 ? 's' : ''}
                                    </span>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>

            {/* Create/Edit Role Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            {editingRole ? `Edit Role: ${editingRole.name.replace(/_/g, ' ')}` : 'Create New Role'}
                        </DialogTitle>
                        <DialogDescription>
                            {editingRole?.is_builtin
                                ? 'Built-in roles cannot be renamed or deleted, but you can adjust permissions.'
                                : 'Define a role name and select the permissions it should have.'}
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={submit} className="space-y-5">
                        {/* Role Name */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Role Name</Label>
                                <Input
                                    id="name"
                                    value={data.name}
                                    onChange={(e) => setData('name', e.target.value)}
                                    placeholder="e.g. Junior Solicitor"
                                    disabled={editingRole?.is_builtin}
                                    autoFocus={!editingRole}
                                />
                                {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="description">Description (optional)</Label>
                                <Input
                                    id="description"
                                    value={data.description}
                                    onChange={(e) => setData('description', e.target.value)}
                                    placeholder="Brief description of this role"
                                />
                                {errors.description && <p className="text-xs text-destructive">{errors.description}</p>}
                            </div>
                        </div>

                        {/* Permissions */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <Label className="text-sm font-semibold">Permissions</Label>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-xs"
                                    onClick={() => {
                                        const allPerms = Object.values(groupedPermissions).flat().map(p => p.name);
                                        const allSelected = allPerms.every(p => data.permissions.includes(p));
                                        setData('permissions', allSelected ? [] : allPerms);
                                    }}
                                >
                                    {Object.values(groupedPermissions).flat().every(p => data.permissions.includes(p.name))
                                        ? 'Deselect All'
                                        : 'Select All'}
                                </Button>
                            </div>

                            <div className="space-y-2 border rounded-lg divide-y max-h-[50vh] overflow-y-auto">
                                {Object.entries(groupedPermissions).map(([entity, perms]) => {
                                    const names = perms.map(p => p.name);
                                    const selectedCount = names.filter(n => data.permissions.includes(n)).length;
                                    const allSelected = selectedCount === names.length;

                                    return (
                                        <div key={entity} className="p-3">
                                            <div className="flex items-center justify-between mb-2">
                                                <button
                                                    type="button"
                                                    className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors"
                                                    onClick={() => toggleGroup(perms)}
                                                >
                                                    {allSelected
                                                        ? <CheckSquare className="h-4 w-4 text-primary" />
                                                        : <Square className="h-4 w-4 text-muted-foreground" />
                                                    }
                                                    {ENTITY_LABELS[entity] || entity}
                                                </button>
                                                <span className="text-xs text-muted-foreground">
                                                    {selectedCount}/{names.length}
                                                </span>
                                            </div>
                                            <div className="flex flex-wrap gap-2 pl-6">
                                                {perms.map((perm) => (
                                                    <button
                                                        key={perm.name}
                                                        type="button"
                                                        onClick={() => togglePermission(perm.name)}
                                                        className={cn(
                                                            'inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium transition-all border',
                                                            data.permissions.includes(perm.name)
                                                                ? 'bg-primary/10 border-primary/30 text-primary'
                                                                : 'bg-muted/50 border-transparent text-muted-foreground hover:bg-muted hover:border-muted-foreground/20'
                                                        )}
                                                    >
                                                        {actionLabel(actionFromPerm(perm.name))}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            {errors.permissions && <p className="text-xs text-destructive">{errors.permissions}</p>}
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={processing}>
                                {processing
                                    ? (editingRole ? 'Saving…' : 'Creating…')
                                    : (editingRole ? 'Save Changes' : 'Create Role')}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
