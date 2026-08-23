import { usePage } from '@inertiajs/react';
import type { PageProps } from '@/types';

interface AuthLayoutProps {
    children: React.ReactNode;
    title: string;
    description?: string;
    /** When true, render a side-by-side split layout with branding panel on the left. */
    split?: boolean;
    /** Optional override for the branding panel headline. */
    brandHeadline?: string;
    /** Optional override for the branding panel subheadline. */
    brandSubheadline?: string;
}

export default function AuthLayout({ children, title, description, split = false, brandHeadline, brandSubheadline }: AuthLayoutProps) {
    const { flash } = usePage<PageProps>().props;

    const logo = (
        <div className="flex items-center gap-3">
            <img src="/assets/simplelaw-mark-transparent.svg" alt="Simple Lawyer" className="h-10 w-10 object-contain" />
            <div>
                <span className="text-2xl font-bold tracking-tight text-foreground">Simple Lawyer</span>
                <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Management System</p>
            </div>
        </div>
    );

    const formCard = (
        <div className="rounded-xl border border-border/70 bg-card p-8">
            <div className="mb-6">
                <h1 className="text-xl font-semibold tracking-tight text-foreground">{title}</h1>
                {description && (
                    <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
                )}
            </div>

            {flash.success && (
                <div className="flash-success mb-4">
                    {flash.success}
                </div>
            )}
            {flash.error && (
                <div className="flash-error mb-4">
                    {flash.error}
                </div>
            )}

            {children}
        </div>
    );

    // Side-by-side split layout: branding panel on the left, form on the right.
    if (split) {
        return (
            <div className="relative flex min-h-screen overflow-hidden bg-background">
                {/* Left branding panel */}
                <div className="relative hidden w-1/2 flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-brand-900 via-brand-700 to-brand-500 p-12 text-white lg:flex">
                    <div className="pointer-events-none absolute inset-0">
                        <div className="absolute -top-24 -left-24 h-[420px] w-[420px] rounded-full bg-white/[0.08] blur-3xl" />
                        <div className="absolute -bottom-32 -right-24 h-[420px] w-[420px] rounded-full bg-white/[0.06] blur-3xl" />
                        <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:24px_24px]" />
                    </div>

                    <div className="relative z-10 mx-auto max-w-md text-center">
                        <div className="mb-8 flex justify-center">
                            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25 backdrop-blur-sm">
                                <span className="text-lg font-bold text-white">LD</span>
                            </div>
                        </div>
                        <h2 className="text-3xl font-bold tracking-tight">
                            {brandHeadline ?? 'Manage your practice with confidence'}
                        </h2>
                        <p className="mt-4 text-base text-white/80">
                            {brandSubheadline ?? 'Streamline cases, contacts, billing, and time tracking in one place.'}
                        </p>

                        <div className="mt-10 grid grid-cols-3 gap-4 text-center">
                            <div>
                                <p className="text-2xl font-bold">500+</p>
                                <p className="text-xs text-white/70">Firms</p>
                            </div>
                            <div>
                                <p className="text-2xl font-bold">24/7</p>
                                <p className="text-xs text-white/70">Support</p>
                            </div>
                            <div>
                                <p className="text-2xl font-bold">SOC 2</p>
                                <p className="text-xs text-white/70">Secure</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right form panel */}
                <div className="relative flex w-1/2 items-center justify-center p-8 lg:p-12">
                    <div className="pointer-events-none absolute inset-0">
                        <div className="absolute top-1/3 right-0 h-[360px] w-[360px] rounded-full bg-primary/[0.04] blur-3xl" />
                        <div className="absolute bottom-0 left-0 h-[300px] w-[300px] rounded-full bg-accent/[0.03] blur-3xl" />
                    </div>
                    <div className="relative z-10 w-full max-w-md">
                        {formCard}
                        <p className="mt-6 text-center text-xs text-muted-foreground">
                            © {new Date().getFullYear()} Simple Lawyer. All rights reserved.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // Original centered layout for other auth pages.
    return (
        <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
            <div className="pointer-events-none absolute inset-0">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.03] via-transparent to-accent/[0.02]" />
                <div className="absolute top-0 right-0 h-[500px] w-[500px] rounded-full bg-primary/[0.03] blur-3xl" />
                <div className="absolute bottom-0 left-0 h-[400px] w-[400px] rounded-full bg-accent/[0.02] blur-3xl" />
            </div>

            <div className="relative z-10 w-full max-w-md">
                <div className="mb-8 flex justify-center">
                    {logo}
                </div>

                {formCard}

                <p className="mt-6 text-center text-xs text-muted-foreground">
                    © {new Date().getFullYear()} Simple Lawyer. All rights reserved.
                </p>
            </div>
        </div>
    );
}
