import { Head, Link, useForm } from '@inertiajs/react';
import AuthLayout from '@/Layouts/AuthLayout';
import { Button } from '@/components/ui/button';

interface Props {
    status?: string;
    email?: string;
}

export default function VerifyEmail({ status, email }: Props) {
    const { post, processing } = useForm({});

    const resend = (e: React.FormEvent) => {
        e.preventDefault();
        post('/email/verification-notification');
    };

    return (
        <AuthLayout
            title="Confirm your email address"
            description={
                email
                    ? `We sent a verification link to ${email}. Open it to finish setting up your account.`
                    : "We sent you a verification link. Open it to finish setting up your account."
            }
        >
            <Head title="Verify Email" />

            {status === 'verification-link-sent' && (
                <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                    A new verification link has been sent.
                </div>
            )}

            <form onSubmit={resend} className="space-y-5">
                <Button type="submit" className="w-full" disabled={processing}>
                    {processing ? 'Sending…' : 'Resend verification email'}
                </Button>

                <Link
                    href="/logout"
                    method="post"
                    as="button"
                    className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
                >
                    Sign out
                </Link>
            </form>
        </AuthLayout>
    );
}
