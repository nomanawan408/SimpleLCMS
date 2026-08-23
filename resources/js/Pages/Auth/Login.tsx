import { Head, Link, useForm } from '@inertiajs/react';
import AuthLayout from '@/Layouts/AuthLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Props {
    canResetPassword: boolean;
    status?: string;
}

export default function Login({ canResetPassword, status }: Props) {
    const { data, setData, post, processing, errors } = useForm({
        email: '',
        password: '',
        remember: false,
    });

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        post('/login');
    };

    return (
        <AuthLayout
            split
            title="Sign in to Simple Lawyer"
            description="Enter your credentials to access your firm's account"
            brandHeadline="Welcome back to your practice"
            brandSubheadline="Sign in to continue managing cases, contacts, billing, and time tracking."
        >
            <Head title="Sign In" />

            {status && (
                <div className="mb-4 rounded-md bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
                    {status}
                </div>
            )}

            <form onSubmit={submit} className="space-y-5">
                <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-xs font-medium text-foreground">
                        Email address
                    </Label>
                    <Input
                        id="email"
                        type="email"
                        autoComplete="email"
                        autoFocus
                        value={data.email}
                        onChange={(e) => setData('email', e.target.value)}
                        placeholder="you@lawfirm.ie"
                        className="h-10 rounded-md border-border bg-background px-3 text-sm text-foreground shadow-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
                    {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                </div>

                <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                        <Label htmlFor="password" className="text-xs font-medium text-foreground">
                            Password
                        </Label>
                        {canResetPassword && (
                            <Link href="/forgot-password" className="text-xs text-primary hover:underline">
                                Forgot password?
                            </Link>
                        )}
                    </div>
                    <Input
                        id="password"
                        type="password"
                        autoComplete="current-password"
                        value={data.password}
                        onChange={(e) => setData('password', e.target.value)}
                        className="h-10 rounded-md border-border bg-background px-3 text-sm text-foreground shadow-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
                    {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
                </div>

                <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2">
                        <input
                            id="remember"
                            type="checkbox"
                            className="h-4 w-4 rounded-sm border-border bg-background text-primary accent-primary"
                            checked={data.remember}
                            onChange={(e) => setData('remember', e.target.checked)}
                        />
                        <span className="text-xs text-muted-foreground">Keep me signed in</span>
                    </label>
                </div>

                <Button type="submit" className="w-full h-10 rounded-md bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90" disabled={processing}>
                    {processing ? 'Signing in…' : 'Sign in'}
                </Button>

                {/* Social login buttons removed to enforce simple email/password login */}
            </form>

            <p className="mt-6 text-center text-sm text-muted-foreground">
                New to Simple Lawyer?{' '}
                <Link href="/register" className="font-medium text-primary hover:underline">
                    Create a firm account
                </Link>
            </p>
        </AuthLayout>
    );
}
