import '../css/app.css';
import { createInertiaApp } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { createRoot } from 'react-dom/client';
import { applyTheme, watchSystemTheme } from '@/lib/theme';

const appName = document.title || 'Simple Lawyer';

createInertiaApp({
    title: (title) => (title ? `${title} — ${appName}` : appName),
    resolve: (name) =>
        resolvePageComponent(
            `./Pages/${name}.tsx`,
            import.meta.glob('./Pages/**/*.tsx'),
        ),
    setup({ el, App, props }) {
        // First paint + OS flips. Per-visit re-application lives in the
        // layouts (AppLayout/AuthLayout re-render on every navigation).
        applyTheme((props.initialPage.props as Record<string, unknown>).theme as string | null);
        watchSystemTheme(() => document.documentElement.dataset.themeChoice ?? null);
        const root = createRoot(el);
        root.render(<App {...props} />);
    },
    progress: {
        color: '#01B88E',
    },
});
