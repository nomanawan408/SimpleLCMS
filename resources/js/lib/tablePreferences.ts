/**
 * Shared types + storage helpers for per-user dynamic table layouts.
 *
 * Shape mirrors the `table_preferences.preferences` JSON column:
 *   { order: string[], widths: Record<columnId, px>, visibility: Record<columnId, bool> }
 * Local storage is the instant layer (no flash on revisit); the backend is
 * the source of truth across devices, synced debounced via useTablePreferences.
 */

export interface TablePreferences {
    order?: string[];
    widths?: Record<string, number>;
    visibility?: Record<string, boolean>;
}

export const TABLE_PREFS_VERSION = 'v1';

export const MIN_COL_WIDTH = 80;
export const MAX_COL_WIDTH = 600;

export function prefsStorageKey(tableKey: string): string {
    return `sl:table-prefs:${TABLE_PREFS_VERSION}:${tableKey}`;
}

export function loadLocalPrefs(tableKey: string): TablePreferences | null {
    try {
        const raw = localStorage.getItem(prefsStorageKey(tableKey));
        if (!raw) return null;
        const parsed = JSON.parse(raw) as TablePreferences;
        return sanitizePrefs(parsed);
    } catch {
        return null;
    }
}

export function saveLocalPrefs(tableKey: string, prefs: TablePreferences | null): void {
    try {
        if (!prefs || (Object.keys(prefs).length === 0)) {
            localStorage.removeItem(prefsStorageKey(tableKey));
            return;
        }
        localStorage.setItem(prefsStorageKey(tableKey), JSON.stringify(sanitizePrefs(prefs)));
    } catch {
        // Private-mode / quota errors must never break the table itself.
    }
}

export function clearLocalPrefs(tableKey: string): void {
    try {
        localStorage.removeItem(prefsStorageKey(tableKey));
    } catch {
        // ignore
    }
}

/** Clamp widths + drop malformed entries so a corrupt payload can't break layout. */
export function sanitizePrefs(prefs: TablePreferences | null | undefined): TablePreferences | null {
    if (!prefs || typeof prefs !== 'object') return null;
    const clean: TablePreferences = {};
    if (Array.isArray(prefs.order)) {
        const ids = prefs.order.filter((id) => typeof id === 'string' && id.length > 0 && id.length <= 64).slice(0, 30);
        if (ids.length > 0) clean.order = ids;
    }
    if (prefs.widths && typeof prefs.widths === 'object') {
        const widths: Record<string, number> = {};
        for (const [id, w] of Object.entries(prefs.widths).slice(0, 30)) {
            const px = Number(w);
            if (typeof id === 'string' && Number.isFinite(px)) {
                widths[id] = Math.min(MAX_COL_WIDTH, Math.max(MIN_COL_WIDTH, Math.round(px)));
            }
        }
        if (Object.keys(widths).length > 0) clean.widths = widths;
    }
    if (prefs.visibility && typeof prefs.visibility === 'object') {
        const visibility: Record<string, boolean> = {};
        for (const [id, v] of Object.entries(prefs.visibility).slice(0, 30)) {
            if (typeof id === 'string' && typeof v === 'boolean') visibility[id] = v;
        }
        if (Object.keys(visibility).length > 0) clean.visibility = visibility;
    }
    return Object.keys(clean).length > 0 ? clean : null;
}

function csrfToken(): string | undefined {
    return (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement | null)?.content;
}

export async function fetchRemotePrefs(tableKey: string): Promise<TablePreferences | null> {
    const res = await fetch(`/table-preferences?table_key=${encodeURIComponent(tableKey)}`, {
        headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return sanitizePrefs(data.preferences ?? null);
}

export async function persistRemotePrefs(tableKey: string, prefs: TablePreferences | null): Promise<void> {
    await fetch('/table-preferences', {
        method: 'PUT',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-CSRF-TOKEN': csrfToken() ?? '',
        },
        body: JSON.stringify({ table_key: tableKey, preferences: prefs }),
    });
}
