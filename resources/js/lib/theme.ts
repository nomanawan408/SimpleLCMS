export type ThemeChoice = 'light' | 'dark' | 'system';

function systemIsDark(): boolean {
    return typeof window !== 'undefined'
        && typeof window.matchMedia === 'function'
        && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/** Resolve a stored choice to a concrete theme. Unknown values fail light. */
export function resolveTheme(choice: string | null | undefined): 'light' | 'dark' {
    if (choice === 'dark') return 'dark';
    if (choice === 'system') return systemIsDark() ? 'dark' : 'light';
    return 'light';
}

/** Apply the theme to <html> (Tailwind darkMode: ['class']). */
export function applyTheme(choice: string | null | undefined): void {
    if (typeof document === 'undefined') return;
    document.documentElement.classList.toggle('dark', resolveTheme(choice) === 'dark');
    // Remember the raw choice so the OS-change watcher can re-resolve it.
    document.documentElement.dataset.themeChoice = choice ?? '';
}

/** Re-apply automatically when the OS theme flips (only matters for 'system'). */
export function watchSystemTheme(getChoice: () => string | null | undefined): () => void {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {};
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme(getChoice());
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
}
