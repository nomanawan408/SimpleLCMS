import { Head } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import UsersManager, { type UserItem, type RoleOption } from '@/components/settings/UsersManager';

interface Props {
    users: UserItem[];
    availableRoles: RoleOption[];
}

export default function UsersIndex({ users, availableRoles }: Props) {
    return (
        <AppLayout title="User Management">
            <Head title="User Management" />
            <UsersManager users={users} availableRoles={availableRoles} />
        </AppLayout>
    );
}
