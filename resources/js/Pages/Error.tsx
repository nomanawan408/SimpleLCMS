import { Head, Link } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle, FileQuestion, RefreshCw, ShieldAlert, Wrench } from 'lucide-react';

interface Props {
    status: number;
}

const COPY: Record<number, { icon: typeof ShieldAlert; title: string; body: string }> = {
    403: {
        icon: ShieldAlert,
        title: 'No access',
        body: 'Your role does not include this area. If you need it, ask your firm admin to adjust your role — every refusal is also logged for security.',
    },
    404: {
        icon: FileQuestion,
        title: 'Not found',
        body: 'This record does not exist or is outside your firm. Closed and unassigned items stay invisible rather than confirming they exist.',
    },
    419: {
        icon: RefreshCw,
        title: 'Session expired',
        body: 'Your session timed out for security. Reload and sign in again — no data was changed.',
    },
    500: {
        icon: Wrench,
        title: 'Something went wrong',
        body: 'The request failed unexpectedly. Nothing was half-saved; try again, and contact support if it persists.',
    },
    503: {
        icon: AlertTriangle,
        title: 'Temporarily unavailable',
        body: 'The application is briefly down for maintenance. Please try again in a moment.',
    },
};

export function ForbiddenState({ status = 403 }: { status?: number }) {
    const { icon: Icon, title, body } = COPY[status] ?? COPY[500];
    return (
        <div className="mx-auto flex max-w-md flex-col items-center py-16 text-center">
            <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                <Icon className="h-7 w-7" />
            </span>
            <p className="text-lg font-bold text-foreground">{title}</p>
            <p className="mt-2 text-sm text-muted-foreground">{body}</p>
        </div>
    );
}

export default function Error({ status }: Props) {
    return (
        <AppLayout title={`Error ${status}`}>
            <Head title={`Error ${status}`} />
            <Card className="rounded-2xl border border-border/60 bg-card shadow-sm">
                <CardContent className="p-6">
                    <ForbiddenState status={status} />
                    <div className="mt-2 flex items-center justify-center gap-2">
                        <Button asChild size="sm">
                            <Link href="/dashboard">Back to Dashboard</Link>
                        </Button>
                        {status === 419 && (
                            <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
                                Reload
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>
        </AppLayout>
    );
}
