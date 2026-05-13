import { usePage } from '@inertiajs/react';
import type { PageProps } from '@/types';

interface AuthLayoutProps {
    children: React.ReactNode;
    title: string;
    description?: string;
}

export default function AuthLayout({ children, title, description }: AuthLayoutProps) {
    const { flash } = usePage<PageProps>().props;

    return (
        <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
            {/* Subtle background pattern */}
            <div className="pointer-events-none absolute inset-0">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.03] via-transparent to-accent/[0.02]" />
                <div className="absolute top-0 right-0 h-[500px] w-[500px] rounded-full bg-primary/[0.03] blur-3xl" />
                <div className="absolute bottom-0 left-0 h-[400px] w-[400px] rounded-full bg-accent/[0.02] blur-3xl" />
            </div>

            <div className="relative z-10 w-full max-w-md">
                {/* Logo */}
                <div className="mb-8 flex justify-center">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20">
                            <span className="text-sm font-bold text-primary">LD</span>
                        </div>
                        <div>
                            <span className="text-2xl font-bold tracking-tight text-foreground">Simple Lawyer</span>
                            <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Management System</p>
                        </div>
                    </div>
                </div>

                {/* Card */}
                <div className="surface-elevated p-8">
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

                <p className="mt-6 text-center text-xs text-muted-foreground">
                    © {new Date().getFullYear()} Simple Lawyer. All rights reserved.
                </p>
            </div>
        </div>
    );
}
