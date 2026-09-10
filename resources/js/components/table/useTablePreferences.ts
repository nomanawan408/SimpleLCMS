import { useCallback, useEffect, useRef, useState } from 'react';
import {
    TablePreferences,
    clearLocalPrefs,
    fetchRemotePrefs,
    loadLocalPrefs,
    persistRemotePrefs,
    sanitizePrefs,
    saveLocalPrefs,
} from '@/lib/tablePreferences';

const SAVE_DEBOUNCE_MS = 800;

interface UseTablePreferencesResult {
    /** Effective prefs (server prop wins on first load, then local edits). */
    prefs: TablePreferences | null;
    /** True while the debounced backend save is pending. */
    saving: boolean;
    /** Merge a patch, persist locally instantly + remotely debounced. */
    update: (patch: TablePreferences) => void;
    /** Clear local + remote, back to column defaults. */
    reset: () => void;
}

/**
 * Per-user table layout state for one `tableKey` (e.g. 'matters.index').
 *
 * Priority on mount: Inertia `initial` prop (fresh from DB, no extra fetch)
 * → localStorage fallback → null (column defaults). Remote is re-fetched
 * once in the background so a layout saved on another device still arrives.
 */
export function useTablePreferences(tableKey: string, initial: TablePreferences | null | undefined): UseTablePreferencesResult {
    const [prefs, setPrefs] = useState<TablePreferences | null>(() => {
        const cleanInitial = sanitizePrefs(initial ?? null);
        if (cleanInitial) {
            saveLocalPrefs(tableKey, cleanInitial);
            return cleanInitial;
        }
        return loadLocalPrefs(tableKey);
    });
    const [saving, setSaving] = useState(false);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const prefsRef = useRef(prefs);
    prefsRef.current = prefs;
    const initialApplied = useRef(false);

    // Background refresh: picks up layouts saved on another device.
    useEffect(() => {
        if (initialApplied.current) return;
        initialApplied.current = true;
        if (initial !== undefined) return; // server prop already authoritative
        fetchRemotePrefs(tableKey)
            .then((remote) => {
                if (remote) {
                    setPrefs(remote);
                    saveLocalPrefs(tableKey, remote);
                }
            })
            .catch(() => {});
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tableKey]);

    const scheduleSave = useCallback(
        (next: TablePreferences | null) => {
            if (timer.current) clearTimeout(timer.current);
            setSaving(true);
            timer.current = setTimeout(() => {
                persistRemotePrefs(tableKey, next)
                    .catch(() => {})
                    .finally(() => setSaving(false));
            }, SAVE_DEBOUNCE_MS);
        },
        [tableKey],
    );

    useEffect(() => () => {
        if (timer.current) clearTimeout(timer.current);
    }, []);

    const update = useCallback(
        (patch: TablePreferences) => {
            const merged: TablePreferences = {
                ...(prefsRef.current ?? {}),
                ...patch,
                widths: { ...(prefsRef.current?.widths ?? {}), ...(patch.widths ?? {}) },
                visibility: { ...(prefsRef.current?.visibility ?? {}), ...(patch.visibility ?? {}) },
            };
            const clean = sanitizePrefs(merged);
            setPrefs(clean);
            saveLocalPrefs(tableKey, clean);
            scheduleSave(clean);
        },
        [tableKey, scheduleSave],
    );

    const reset = useCallback(() => {
        if (timer.current) clearTimeout(timer.current);
        setPrefs(null);
        clearLocalPrefs(tableKey);
        setSaving(true);
        persistRemotePrefs(tableKey, null)
            .catch(() => {})
            .finally(() => setSaving(false));
    }, [tableKey]);

    return { prefs, saving, update, reset };
}
