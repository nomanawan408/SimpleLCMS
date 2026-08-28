import { AlertCircle, CheckCircle2, FileText, RotateCcw, X } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { UploadQueueItem } from '@/hooks/useUploadQueue';

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface UploadQueueListProps {
    items: UploadQueueItem[];
    overallProgress: number;
    succeeded: number;
    total: number;
    isUploading: boolean;
    onRetry: (id: string) => void;
    onRemove: (id: string) => void;
    className?: string;
}

/**
 * Live progress for a batch of file uploads: an overall bar summarising the
 * whole selection, then one row per file with its own bar and outcome.
 *
 * Shared between the standalone Documents page and a matter's Documents tab
 * so both give the same feedback for the same action.
 */
export function UploadQueueList({
    items,
    overallProgress,
    succeeded,
    total,
    isUploading,
    onRetry,
    onRemove,
    className,
}: UploadQueueListProps) {
    if (total === 0) return null;

    return (
        <div className={cn('space-y-3', className)}>
            <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                    <span>{isUploading ? 'Uploading…' : 'Upload complete'}</span>
                    <span className="tabular-nums">{succeeded} of {total}</span>
                </div>
                <Progress value={overallProgress} />
            </div>

            <div className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
                {items.map((item) => (
                    <div
                        key={item.id}
                        className="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/20 px-3 py-2"
                    >
                        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />

                        <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                                <p className="truncate text-sm font-medium text-foreground">{item.file.name}</p>
                                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                                    {formatBytes(item.file.size)}
                                </span>
                            </div>

                            {item.status === 'uploading' && (
                                <Progress value={item.progress} className="mt-1.5 h-1.5" />
                            )}

                            {item.status === 'queued' && (
                                <p className="mt-0.5 text-xs text-muted-foreground">Waiting…</p>
                            )}

                            {item.status === 'error' && (
                                <p className="mt-0.5 flex items-center gap-1 text-xs text-destructive">
                                    <AlertCircle className="h-3 w-3 shrink-0" />
                                    {item.error}
                                </p>
                            )}

                            {item.status === 'cancelled' && (
                                <p className="mt-0.5 text-xs text-muted-foreground">Cancelled.</p>
                            )}

                            {item.status === 'success' && (
                                <p className="mt-0.5 flex items-center gap-1 text-xs text-success">
                                    <CheckCircle2 className="h-3 w-3 shrink-0" />
                                    Uploaded
                                </p>
                            )}
                        </div>

                        <div className="flex shrink-0 items-center gap-0.5">
                            {(item.status === 'error' || item.status === 'cancelled') && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon-sm"
                                    title="Retry"
                                    onClick={() => onRetry(item.id)}
                                >
                                    <RotateCcw className="h-3.5 w-3.5" />
                                </Button>
                            )}
                            {item.status !== 'success' && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon-sm"
                                    title={item.status === 'uploading' ? 'Cancel' : 'Remove'}
                                    onClick={() => onRemove(item.id)}
                                >
                                    <X className="h-3.5 w-3.5" />
                                </Button>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
