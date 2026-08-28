import { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';

export type UploadStatus = 'queued' | 'uploading' | 'success' | 'error' | 'cancelled';

export interface UploadQueueItem {
    id: string;
    file: File;
    status: UploadStatus;
    /** 0–100. Real byte-level progress from the browser's XHR upload event, not a fake timer. */
    progress: number;
    error?: string;
    /** The record returned by the server on success (e.g. the created Document). */
    result?: any;
}

interface UseUploadQueueOptions {
    /** Endpoint each file is POSTed to, one request per file. */
    url: string;
    /** How many files upload at once. More than a handful in parallel just contends for the same connection. */
    maxConcurrent?: number;
    /** Files larger than this are rejected instantly, no request made. Must match the server's own limit. */
    maxFileSizeBytes?: number;
    /** Builds the multipart body for one file -- this is where matter_id, folder, etc. get attached. */
    buildFormData: (file: File) => FormData;
    /** Fired once per file as soon as the server confirms it. */
    onItemSuccess?: (result: any, file: File) => void;
    /** Fired once when every queued/uploading item has settled (succeeded, failed, or was cancelled). */
    onAllSettled?: () => void;
}

function makeId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function firstValidationError(payload: any): string | null {
    if (!payload?.errors) return null;
    const first = Object.values(payload.errors as Record<string, string[]>)[0];
    return Array.isArray(first) ? first[0] : null;
}

function csrfToken(): string | undefined {
    return (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement | null)?.content;
}

/**
 * Drives a set of independent file uploads against one endpoint, with a
 * concurrency cap and live per-file progress.
 *
 * Each file is its own POST rather than one request carrying all of them:
 * that is what makes a live progress bar per file possible (the browser only
 * reports upload progress per XHR, not per file inside a shared multipart
 * body), and it means one bad file among twenty fails on its own instead of
 * taking the rest down with it.
 */
export function useUploadQueue({
    url,
    maxConcurrent = 3,
    maxFileSizeBytes = 20 * 1024 * 1024,
    buildFormData,
    onItemSuccess,
    onAllSettled,
}: UseUploadQueueOptions) {
    const [items, setItems] = useState<UploadQueueItem[]>([]);

    // The queue runner needs a synchronous, always-current view of the list to
    // decide what to dispatch next -- React state updates are not synchronous,
    // so a ref is the source of truth and state is just its mirror for render.
    const itemsRef = useRef<UploadQueueItem[]>([]);
    const controllers = useRef<Map<string, AbortController>>(new Map());
    const activeCount = useRef(0);
    const settledFired = useRef(true);

    const commit = (updater: (prev: UploadQueueItem[]) => UploadQueueItem[]) => {
        itemsRef.current = updater(itemsRef.current);
        setItems(itemsRef.current);
    };

    const patchItem = (id: string, patch: Partial<UploadQueueItem>) => {
        commit((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
    };

    const maybeFireAllSettled = () => {
        if (settledFired.current) return;
        const stillGoing = itemsRef.current.some((i) => i.status === 'queued' || i.status === 'uploading');
        if (!stillGoing) {
            settledFired.current = true;
            onAllSettled?.();
        }
    };

    const uploadItem = async (item: UploadQueueItem) => {
        activeCount.current += 1;
        patchItem(item.id, { status: 'uploading', progress: 0, error: undefined });

        const controller = new AbortController();
        controllers.current.set(item.id, controller);

        try {
            const res = await axios.post(url, buildFormData(item.file), {
                headers: { Accept: 'application/json', 'X-CSRF-TOKEN': csrfToken() },
                signal: controller.signal,
                onUploadProgress: (evt) => {
                    const percent = evt.total ? Math.round((evt.loaded / evt.total) * 100) : 0;
                    patchItem(item.id, { progress: percent });
                },
            });

            const result = res.data?.document ?? res.data;
            patchItem(item.id, { status: 'success', progress: 100, result });
            onItemSuccess?.(result, item.file);
        } catch (err: any) {
            if (axios.isCancel(err) || err?.code === 'ERR_CANCELED') {
                patchItem(item.id, { status: 'cancelled' });
            } else {
                const message = firstValidationError(err?.response?.data) || err?.response?.data?.message || 'Upload failed.';
                patchItem(item.id, { status: 'error', error: message });
            }
        } finally {
            controllers.current.delete(item.id);
            activeCount.current -= 1;
            processNext();
            maybeFireAllSettled();
        }
    };

    const processNext = () => {
        while (activeCount.current < maxConcurrent) {
            const next = itemsRef.current.find((i) => i.status === 'queued');
            if (!next) break;
            // uploadItem flips this item to 'uploading' synchronously before its
            // first await, so the next loop iteration will not pick it again.
            void uploadItem(next);
        }
    };

    const enqueue = (files: FileList | File[]) => {
        const incoming: UploadQueueItem[] = Array.from(files).map((file) => {
            if (file.size > maxFileSizeBytes) {
                return {
                    id: makeId(),
                    file,
                    status: 'error' as const,
                    progress: 0,
                    error: `File exceeds the ${Math.round(maxFileSizeBytes / (1024 * 1024))} MB limit.`,
                };
            }
            return { id: makeId(), file, status: 'queued' as const, progress: 0 };
        });

        if (incoming.length === 0) return;

        settledFired.current = false;
        commit((prev) => [...prev, ...incoming]);
        processNext();
    };

    const retry = (id: string) => {
        const item = itemsRef.current.find((i) => i.id === id);
        if (!item || item.status === 'uploading') return;

        settledFired.current = false;
        patchItem(id, { status: 'queued', progress: 0, error: undefined });
        processNext();
    };

    const removeItem = (id: string) => {
        controllers.current.get(id)?.abort();
        controllers.current.delete(id);
        commit((prev) => prev.filter((i) => i.id !== id));
    };

    const clearSettled = () => {
        commit((prev) => prev.filter((i) => i.status === 'queued' || i.status === 'uploading'));
    };

    const clearAll = () => {
        controllers.current.forEach((c) => c.abort());
        controllers.current.clear();
        activeCount.current = 0;
        commit(() => []);
    };

    // Abort anything still in flight if the page navigates away mid-upload,
    // so a stray request cannot try to update state that no longer exists.
    useEffect(() => () => {
        controllers.current.forEach((c) => c.abort());
    }, []);

    const stats = useMemo(() => {
        const total = items.length;
        const succeeded = items.filter((i) => i.status === 'success').length;
        const failed = items.filter((i) => i.status === 'error').length;
        const isUploading = items.some((i) => i.status === 'queued' || i.status === 'uploading');

        // Cancelled/errored items do not represent remaining work, so they are
        // left out of both the numerator and denominator of the overall bar.
        const counted = items.filter((i) => i.status !== 'cancelled' && i.status !== 'error');
        const overallProgress = counted.length
            ? Math.round(counted.reduce((sum, i) => sum + (i.status === 'success' ? 100 : i.progress), 0) / counted.length)
            : 0;

        return { total, succeeded, failed, isUploading, overallProgress };
    }, [items]);

    return { items, enqueue, retry, removeItem, clearSettled, clearAll, ...stats };
}
