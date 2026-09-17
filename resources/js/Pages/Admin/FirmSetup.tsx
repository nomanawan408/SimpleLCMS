import { Head } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import FirmSetupForm from '@/components/settings/FirmSetupForm';
import type { Firm } from '@/types';

interface Props {
    firm: Firm;
    isSuperAdmin: boolean;
}

export default function FirmSetup({ firm, isSuperAdmin }: Props) {
    return (
        <AppLayout title="Firm Setup">
            <Head title="Firm Setup" />
            <FirmSetupForm firm={firm} isSuperAdmin={isSuperAdmin} />
        </AppLayout>
    );
}
