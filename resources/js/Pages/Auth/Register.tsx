import { Head, Link, useForm } from '@inertiajs/react';
import AuthLayout from '@/Layouts/AuthLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function Register() {
    const { data, setData, post, processing, errors } = useForm({
        firm_name: '',
        full_name: '',
        email: '',
        password: '',
        password_confirmation: '',
    });

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        post('/register');
    };

    return (
        <AuthLayout title="Create your firm" description="Set up Simple Lawyer for your law firm in minutes">
            <Head title="Register" />

            <form onSubmit={submit} className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="firm_name">Firm name</Label>
                    <Input
                        id="firm_name"
                        type="text"
                        autoFocus
                        value={data.firm_name}
                        onChange={(e) => setData('firm_name', e.target.value)}
                        placeholder="Murphy & Associates Solicitors"
                    />
                    {errors.firm_name && <p className="text-xs text-destructive">{errors.firm_name}</p>}
                </div>

                <div className="space-y-2">
                    <Label htmlFor="full_name">Your full name</Label>
                    <Input
                        id="full_name"
                        type="text"
                        autoComplete="name"
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
                        autoComplete="email"
                        value={data.email}
                        onChange={(e) => setData('email', e.target.value)}
                        placeholder="john@lawfirm.co.uk"
                    />
                    {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                </div>

                <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                        id="password"
                        type="password"
                        autoComplete="new-password"
                        value={data.password}
                        onChange={(e) => setData('password', e.target.value)}
                        placeholder="Minimum 12 characters"
                    />
                    {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
                </div>

                <div className="space-y-2">
                    <Label htmlFor="password_confirmation">Confirm password</Label>
                    <Input
                        id="password_confirmation"
                        type="password"
                        autoComplete="new-password"
                        value={data.password_confirmation}
                        onChange={(e) => setData('password_confirmation', e.target.value)}
                    />
                </div>

                <Button type="submit" className="w-full" disabled={processing}>
                    {processing ? 'Creating firm…' : 'Create firm account'}
                </Button>

                <p className="text-xs text-center text-muted-foreground">
                    By registering you agree to our Terms of Service and Privacy Policy. Simple Lawyer is GDPR compliant.
                </p>
            </form>

            <p className="mt-4 text-center text-sm text-muted-foreground">
                Already have an account?{' '}
                <Link href="/login" className="font-medium text-primary hover:underline">
                    Sign in
                </Link>
            </p>
        </AuthLayout>
    );
}
