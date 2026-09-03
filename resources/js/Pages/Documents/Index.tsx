import { useRef, useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import {
    Table, TableHeader, TableHeaderRow, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatDate, cn } from '@/lib/utils';
import { ArrowLeft, ChevronDown, Download, Eye, FileText, Folder, FolderOpen, Paperclip, Trash2, Upload, X } from 'lucide-react';
import type { Document, PaginatedData } from '@/types';
import { useUploadQueue } from '@/hooks/useUploadQueue';
import { UploadQueueList } from '@/components/documents/UploadQueueList';

interface Props {
    documents: PaginatedData<Document & { matter?: { id: string; name: string }; uploadedBy?: { full_name: string } }>;
    matters: { id: string; name: string }[];
    filters: { matter_id?: string };
}

function formatBytes(bytes: number | null): string {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const visibilityBadgeStyles: Record<string, string> = {
    success: 'bg-success/15 text-success border-success/25',
    secondary: 'bg-muted text-muted-foreground border-border',
};

export default function DocumentsIndex({ documents, matters, filters }: Props) {
    const [uploadModalOpen, setUploadModalOpen] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);
    const [viewerDoc, setViewerDoc] = useState<{ id: string; name: string; mime_type?: string } | null>(null);
    const [activeFolder, setActiveFolder] = useState<string | null>(null);

    const [uploadMatterId, setUploadMatterId] = useState('');
    const [uploadClientVisible, setUploadClientVisible] = useState(false);
    const [uploadFolder, setUploadFolder] = useState('');
    const existingFolders = [...new Set(documents.data.map((d: any) => { let f=(d as any).folder; if (f==='General' || f==='GENERAL' || f==='GENERAL CASE DOCUMENTS') f=(d as any).matter?.name || f; return f; }).filter(Boolean))] as string[];

    // One request per file rather than one request carrying all of them --
    // that is what makes a live progress bar per file possible, and it means
    // one bad file among many fails on its own instead of taking the batch
    // down with it. See useUploadQueue for the concurrency/progress logic.
    const uploadQueue = useUploadQueue({
        url: '/documents',
        buildFormData: (file) => {
            const fd = new FormData();
            fd.append('file', file);
            fd.append('matter_id', uploadMatterId);
            const baseFromMatter = matters.find((m) => m.id === uploadMatterId)?.name?.trim() || '';
            let rawFolder = (uploadFolder || activeFolder || baseFromMatter).trim();
            if (!rawFolder) rawFolder = baseFromMatter;
            if (uploadMatterId && baseFromMatter) {
                const isDefault = rawFolder === baseFromMatter || rawFolder.startsWith(baseFromMatter + '/');
                if (!isDefault && rawFolder) {
                    rawFolder = `${baseFromMatter}/${rawFolder}`;
                }
            }
            if (!rawFolder) rawFolder = baseFromMatter || 'General';
            fd.append('folder', rawFolder);
            fd.append('is_client_visible', uploadClientVisible ? '1' : '0');
            return fd;
        },
        // The document list is server-paginated Inertia state, so refresh it
        // once the whole batch has settled rather than after every file.
        onAllSettled: () => {
            // reload() always preserves scroll and state -- that is what
            // distinguishes it from a full visit -- so there is nothing else
            // to set here beyond which prop to refresh.
            router.reload({ only: ['documents'] });
        },
    });

    const openUploadModal = () => {
        uploadQueue.clearAll();
        setUploadMatterId('');
        setUploadClientVisible(false);
        setUploadFolder(activeFolder || '');
        setUploadModalOpen(true);
    };

    const handleFilesChosen = (fileList: FileList | null) => {
        if (!fileList || fileList.length === 0) return;
        uploadQueue.enqueue(fileList);
        // Without this, choosing the exact same file(s) again fires no change
        // event the second time, since the input's value has not changed.
        if (fileRef.current) fileRef.current.value = '';
    };

    const handleDelete = (id: string) => {
        if (!confirm('Delete this document? This cannot be undone.')) return;
        router.delete(`/documents/${id}`);
    };

    const setFilter = (key: string, value: string) => {
        const actual = value === '_all' ? '' : value;
        router.get('/documents', { ...filters, [key]: actual || undefined }, { preserveState: true, replace: true });
    };

    return (
        <AppLayout title="Documents">
            <Head title="Documents" />

            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                <div>
                    <h1 className="text-2xl font-extrabold tracking-tight">Documents</h1>
                    <p className="text-sm text-muted-foreground mt-1">All matters share a dedicated folder — uploads from a matter go to its own folder automatically.</p>
                </div>
                <Button onClick={openUploadModal} className="rounded-xl gap-2 bg-primary shadow-sm">
                    <Upload className="h-4 w-4" />
                    Upload
                </Button>
            </div>

            {/* Filters */}
            <Card className="rounded-2xl border border-border/60 bg-card shadow-sm mb-5">
                <CardContent className="p-4 flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                        <FileText className="h-4 w-4" /> Filter by matter
                    </div>
                    <Select value={filters.matter_id || '_all'} onValueChange={(v) => setFilter('matter_id', v)}>
                        <SelectTrigger className="w-64 h-9 rounded-xl">
                            <SelectValue placeholder="All matters" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="_all">All matters</SelectItem>
                            {matters.map((m) => (
                                <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </CardContent>
            </Card>

            <Card className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">
                <CardContent className="p-0">
                    {documents.data.length === 0 ? (
                        <div className="px-6 py-14 text-center">
                            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-3"><Paperclip className="h-6 w-6 text-muted-foreground/50" /></div>
                            <p className="text-sm font-semibold text-foreground">No documents found</p>
                            <p className="text-xs text-muted-foreground mt-1">Upload the first file — it will be saved to the matter&apos;s own folder.</p>
                        </div>
                    ) : (
                        (() => {
                            const groups = Object.entries(
                                documents.data.reduce((acc: Record<string, any[]>, doc: any) => {
                                    let folder = (doc as any).folder || (doc as any).matter?.name || '';
                                    if (folder === 'General' || folder === 'GENERAL' || folder === 'GENERAL CASE DOCUMENTS') folder = (doc as any).matter?.name || folder;
                                    if (!folder) return acc;
                                    (acc[folder] = acc[folder] || []).push(doc);
                                    return acc;
                                }, {} as Record<string, any[]>)
                            );
                            if (activeFolder) {
                                const docs = groups.find(([f]) => f === activeFolder)?.[1] as any[] | undefined;
                                if (!docs) {
                                    return (
                                        <div className="p-6 text-center text-sm text-muted-foreground">
                                            Folder not found. <button className="text-primary hover:underline" onClick={() => setActiveFolder(null)}>Back to folders</button>
                                        </div>
                                    );
                                }
                                return (
                                    <div>
                                        <div className="flex items-center gap-2 px-5 py-3 border-b border-border/60 bg-muted/20 sticky top-0 z-10">
                                            <Button variant="ghost" size="sm" onClick={() => setActiveFolder(null)} className="gap-1.5 h-8 rounded-full">
                                                <ArrowLeft className="h-4 w-4" /> Back to folders
                                            </Button>
                                            <span className="text-muted-foreground">/</span>
                                            <FolderOpen className="h-4 w-4 text-[#f59e0b]" />
                                            <span className="text-sm font-semibold truncate">{activeFolder}</span>
                                            <span className="text-xs bg-card border border-border/60 rounded-full px-2 py-0.5 tabular-nums">{docs.length} file{docs.length !== 1 ? 's' : ''}</span>
                                        </div>
                                        <div className="divide-y divide-border/40">
                                            {docs.map((doc) => (
                                                <div key={doc.id} className="px-5 py-3.5 flex items-center gap-3 hover:bg-muted/20 transition-colors">
                                                    <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium truncate">{doc.name}</p>
                                                        <p className="text-xs text-muted-foreground truncate">
                                                            {doc.matter ? (
                                                                <Link href={`/matters/${doc.matter.id}`} className="hover:text-primary font-medium" onClick={(e) => e.stopPropagation()}>
                                                                    {doc.matter.name}
                                                                </Link>
                                                            ) : (
                                                                '—'
                                                            )}
                                                            {' · '}
                                                            {(doc as any).uploadedBy?.full_name ?? '—'} · {formatDate(doc.created_at)} · {formatBytes((doc as any).size_bytes ?? (doc as any).size)}
                                                        </p>
                                                    </div>
                                                    <span className={`hidden sm:inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium shrink-0 ${visibilityBadgeStyles[doc.is_client_visible ? 'success' : 'secondary']}`}>
                                                        {doc.is_client_visible ? 'Client' : 'Internal'}
                                                    </span>
                                                    <div className="flex items-center gap-1 shrink-0">
                                                        <Button variant="ghost" size="icon" className="h-7 w-7" title="View" onClick={() => setViewerDoc(doc as any)}>
                                                            <Eye className="h-3.5 w-3.5" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" className="h-7 w-7" title="Download" asChild>
                                                            <a href={`/documents/${doc.id}/download`} download>
                                                                <Download className="h-3.5 w-3.5" />
                                                            </a>
                                                        </Button>
                                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(doc.id)}>
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            }
                            return (
                                <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                                    {groups.map(([folder, docs]) => (
                                        <button
                                            key={folder}
                                            type="button"
                                            onClick={() => setActiveFolder(folder)}
                                            className="group flex flex-col items-center gap-2 rounded-xl border border-border/60 bg-card hover:bg-muted/40 hover:border-[#f59e0b]/40 hover:shadow-sm p-5 text-center transition-all"
                                        >
                                            <Folder className="h-12 w-12 text-[#f59e0b] group-hover:text-[#d97706] transition-colors" />
                                            <span className="text-sm font-semibold leading-tight line-clamp-2 break-words w-full">{folder}</span>
                                            <span className="text-xs text-muted-foreground tabular-nums">{(docs as any[]).length} file{(docs as any[]).length !== 1 ? 's' : ''}</span>
                                        </button>
                                    ))}
                                </div>
                            );
                        })()
                    )}

                    {documents.last_page > 1 && (
                        <div className="flex items-center justify-between px-4 py-3 border-t">
                            <p className="text-sm text-muted-foreground">
                                {documents.from}–{documents.to} of {documents.total}
                            </p>
                            <div className="flex gap-2">
                                {documents.links.map((link, i) => (
                                    link.url ? (
                                        <Link
                                            key={i}
                                            href={link.url}
                                            className={cn(
                                                'px-3 py-1.5 text-xs rounded border transition-colors',
                                                link.active
                                                    ? 'bg-primary text-primary-foreground border-primary'
                                                    : 'hover:bg-muted border-border',
                                            )}
                                            dangerouslySetInnerHTML={{ __html: link.label }}
                                        />
                                    ) : (
                                        <span
                                            key={i}
                                            className="px-3 py-1.5 text-xs rounded border border-border text-muted-foreground opacity-50"
                                            dangerouslySetInnerHTML={{ __html: link.label }}
                                        />
                                    )
                                ))}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Upload Modal */}
            <Dialog open={uploadModalOpen} onOpenChange={setUploadModalOpen}>
                <DialogContent className="max-w-lg w-[95vw] sm:w-full">
                    <DialogHeader>
                        <DialogTitle>Upload Documents</DialogTitle>
                        <DialogDescription>Select a matter, then choose one or more files to upload.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 min-w-0">
                        <div className="space-y-2 min-w-0">
                            <Label>Matter *</Label>
                            <Select
                                value={uploadMatterId}
                                onValueChange={setUploadMatterId}
                                disabled={uploadQueue.total > 0}
                            >
                                <SelectTrigger className="w-full min-w-0 [&>span]:truncate"><SelectValue placeholder="Select a matter…" /></SelectTrigger>
                                <SelectContent className="max-w-[90vw] sm:max-w-lg">
                                    {matters.map((m) => (
                                        <SelectItem key={m.id} value={m.id} className="whitespace-normal break-words line-clamp-2" title={m.name}>{m.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2 min-w-0">
                            <Label>Folder</Label>
                            <div className="rounded-lg bg-muted/30 border border-border/40 px-3 py-2.5 flex items-start gap-2 text-sm min-w-0">
                                <Folder className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                                <span className="min-w-0 flex-1 break-words line-clamp-2" title={uploadMatterId ? (matters.find((m) => m.id === uploadMatterId)?.name || 'General') : 'Select a matter first'}>Default: <span className="font-mono font-medium break-all">{uploadMatterId ? (matters.find((m) => m.id === uploadMatterId)?.name || 'General') : 'Select a matter first'}</span></span>
                            </div>
                            <Input className="truncate" placeholder="Create subfolder (optional) — e.g. Correspondence" value={uploadFolder} onChange={(e) => setUploadFolder(e.target.value)} disabled={!uploadMatterId || uploadQueue.total > 0} />
                            {(() => {
                                if (!uploadMatterId) return <p className="text-xs text-muted-foreground">Choose a matter to see default folder.</p>;
                                if (!uploadFolder.trim()) return <p className="text-xs text-muted-foreground">Leave empty to use default. New names become subfolders inside the matter.</p>;
                                const base = matters.find((m) => m.id === uploadMatterId)?.name?.trim() || uploadFolder.split('/')[0];
                                const raw = uploadFolder.trim();
                                const isDefault = raw === base || raw === 'General' || raw === 'GENERAL' || raw === 'GENERAL CASE DOCUMENTS' || raw.startsWith(base + '/');
                                const display = isDefault ? raw || base : `${base}/${raw}`;
                                return isDefault ? <p className="text-xs text-muted-foreground break-all whitespace-normal line-clamp-2" title={display}>Will save inside <span className="font-mono break-all">{display}</span>.</p> : <p className="text-xs text-primary font-medium break-all whitespace-normal line-clamp-2" title={display}>Will be created as: <span className="font-mono break-all">{display}</span></p>;
                            })()}
                        </div>
                        <label className={cn('flex items-center gap-2', uploadQueue.total > 0 ? 'cursor-not-allowed opacity-60' : 'cursor-pointer')}>
                            <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-border accent-primary"
                                checked={uploadClientVisible}
                                disabled={uploadQueue.total > 0}
                                onChange={(e) => setUploadClientVisible(e.target.checked)}
                            />
                            <span className="text-sm font-medium">Visible to client</span>
                        </label>
                        <div className="space-y-2">
                            <Label>
                                Files * <span className="text-muted-foreground font-normal">(max 20 MB each)</span>
                            </Label>
                            <Input
                                ref={fileRef}
                                type="file"
                                multiple
                                disabled={!uploadMatterId}
                                onChange={(e) => handleFilesChosen(e.target.files)}
                            />
                            {!uploadMatterId && (
                                <p className="text-xs text-muted-foreground">Choose a matter first.</p>
                            )}
                        </div>

                        <UploadQueueList
                            items={uploadQueue.items}
                            overallProgress={uploadQueue.overallProgress}
                            succeeded={uploadQueue.succeeded}
                            total={uploadQueue.total}
                            isUploading={uploadQueue.isUploading}
                            onRetry={uploadQueue.retry}
                            onRemove={uploadQueue.removeItem}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setUploadModalOpen(false)} className="gap-2">
                            <X className="h-4 w-4" />
                            {uploadQueue.isUploading ? 'Upload in background' : 'Close'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            {/* ── Document Viewer Modal ── */}
            {viewerDoc && (
                <Dialog open={!!viewerDoc} onOpenChange={() => setViewerDoc(null)}>
                    <DialogContent className="max-w-5xl w-full h-[90vh] flex flex-col p-0 gap-0 [&>button]:hidden">
                        <div className="flex items-center justify-between px-5 py-3 border-b shrink-0">
                            <div className="flex items-center gap-2 min-w-0">
                                <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
                                <span className="text-sm font-medium truncate">{viewerDoc.name}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 ml-4">
                                <Button variant="outline" size="sm" asChild>
                                    <a href={`/documents/${viewerDoc.id}/download`} download>
                                        <Download className="h-3.5 w-3.5 mr-1" />
                                        Download
                                    </a>
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewerDoc(null)}>
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-hidden bg-muted/20">
                            {viewerDoc.mime_type?.startsWith('image/') ? (
                                <div className="h-full flex items-center justify-center p-6">
                                    <img
                                        src={`/documents/${viewerDoc.id}/view`}
                                        alt={viewerDoc.name}
                                        className="max-h-full max-w-full object-contain rounded shadow"
                                    />
                                </div>
                            ) : viewerDoc.mime_type === 'application/pdf' || !viewerDoc.mime_type ? (
                                <iframe
                                    src={`/documents/${viewerDoc.id}/view`}
                                    title={viewerDoc.name}
                                    className="w-full h-full border-0"
                                />
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center gap-4 text-muted-foreground">
                                    <FileText className="h-16 w-16 text-muted-foreground/30" />
                                    <p className="text-sm">Preview not available for this file type.</p>
                                    <Button variant="outline" size="sm" asChild>
                                        <a href={`/documents/${viewerDoc.id}/download`} download>
                                            <Download className="h-3.5 w-3.5 mr-1" />
                                            Download to view
                                        </a>
                                    </Button>
                                </div>
                            )}
                        </div>
                    </DialogContent>
                </Dialog>
            )}
        </AppLayout>
    );
}
