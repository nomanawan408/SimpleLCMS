import { useEffect, useState } from 'react';
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
    const slides = ['/assets/legal1.jpg', '/assets/legal2.jpg', '/assets/legal3.jpg'];
    const [slide, setSlide] = useState(0);
    useEffect(() => {
        if (!split) return;
        const id = setInterval(() => setSlide((s) => (s + 1) % slides.length), 4000);
        return () => clearInterval(id);
    }, [split]);

    const logo = (
        <div className="flex items-center gap-3">
            <img src="/assets/simplelaw-mark-transparent.svg" alt="Simple Lawyer" className="h-10 w-10 object-contain" />
            <div>
                <span className="text-2xl font-bold tracking-tight text-foreground">Simple Lawyer</span>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Management System</p>
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
                {/* Left branding panel — solicitor / law office slideshow - images prominent */}
                <div className="relative hidden w-1/2 flex-col overflow-hidden bg-slate-900 lg:flex">
                    {/* Slideshow — legal1/2/3.jpg - fully visible */}
                    <div className="absolute inset-0">
                        {slides.map((src, i) => (
                            <img
                                key={src}
                                src={src}
                                alt={`Legal ${i + 1}`}
                                className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${i === slide ? 'opacity-100' : 'opacity-0'}`}
                            />
                        ))}
                    </div>
                    {/* Light gradient only at bottom for text legibility - image stays bright */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
                    <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-black/20" />

                    {/* Top bar with logo — kept in original colors */}
                    <div className="relative z-10 flex w-full px-8 pt-8">
                        <div className="flex items-center gap-3 rounded-xl bg-white/90 px-4 py-2 shadow-lg backdrop-blur ring-1 ring-black/5">
                            <img src="/assets/simplelaw-mark-transparent.svg" alt="Simple Lawyer" className="h-8 w-8 object-contain" />
                            <span className="text-lg font-bold tracking-tight text-slate-900">Simple Lawyer</span>
                        </div>
                    </div>

                    {/* Bottom glass card - text prominent but image still visible behind */}
                    <div className="relative z-10 mt-auto p-8">
                        <div className="rounded-2xl bg-white/10 p-6 backdrop-blur-md ring-1 ring-white/20">
                            <h2 className="text-2xl font-bold tracking-tight text-white drop-shadow">
                                {brandHeadline ?? 'Trusted by Solicitors & Law Firms'}
                            </h2>
                            <p className="mt-2 text-sm leading-relaxed text-white/90">
                                {brandSubheadline ?? 'Your practice, organised — cases, clients, billing and time tracking in one secure place.'}
                            </p>
                            <div className="mt-5 grid grid-cols-3 gap-3 text-center">
                                <div className="rounded-xl bg-white/10 py-3 backdrop-blur">
                                    <p className="text-xl font-bold text-white">500+</p>
                                    <p className="text-xs text-white/70">Firms</p>
                                </div>
                                <div className="rounded-xl bg-white/10 py-3 backdrop-blur">
                                    <p className="text-xl font-bold text-white">24/7</p>
                                    <p className="text-xs text-white/70">Support</p>
                                </div>
                                <div className="rounded-xl bg-white/10 py-3 backdrop-blur">
                                    <p className="text-xl font-bold text-white">SOC 2</p>
                                    <p className="text-xs text-white/70">Secure</p>
                                </div>
                            </div>
                        </div>
                        {/* Slideshow dots + caption */}
                        <div className="mt-4 flex items-center justify-between">
                            <p className="text-xs text-white/60">Images {slide + 1} / {slides.length} · Professional legal environment</p>
                            <div className="flex gap-1.5">
                                {slides.map((_, i) => (
                                    <button
                                        key={i}
                                        onClick={() => setSlide(i)}
                                        aria-label={`Go to slide ${i + 1}`}
                                        className={`h-1.5 rounded-full transition-all ${i === slide ? 'w-6 bg-white' : 'w-2 bg-white/50 hover:bg-white/80'}`}
                                    />
                                ))}
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
