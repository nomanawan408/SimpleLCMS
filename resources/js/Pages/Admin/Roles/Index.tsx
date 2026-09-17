import { Head } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import RolesManager, { type RoleData } from '@/components/settings/RolesManager';

interface Props {
    roles: RoleData[];
    groupedPermissions: Record<string, { id: number; name: string }[]>;
}

export default function RolesIndex({ roles, groupedPermissions }: Props) {
    return (
        <AppLayout title="Roles & Permissions">
            <Head title="Roles & Permissions" />
            <RolesManager roles={roles} groupedPermissions={groupedPermissions} />
        </AppLayout>
    );
}
