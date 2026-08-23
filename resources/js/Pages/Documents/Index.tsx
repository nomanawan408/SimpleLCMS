import { useRef, useState } from 'react';
import { Head, Link, router, useForm } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatDate, cn } from '@/lib/utils';
import { Download, Eye, FileText, Paperclip, Plus, Trash2, Upload, X } from 'lucide-react';
import type { Document, PaginatedData } from '@/types';

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

    const { data, setData, post, processing, errors, reset } = useForm({
        file: null as File | null,
        matter_id: '',
        is_client_visible: false,
    });

    const handleUpload = () => {
        post('/documents', {
            forceFormData: true,
            onSuccess: () => {
                setUploadModalOpen(false);
                reset();
            },
        });
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
                    <h1 className="text-[26px] font-extrabold tracking-tight">Documents</h1>
                    <p className="text-sm text-muted-foreground mt-1">All matters share a dedicated folder — uploads from a matter go to its own folder automatically.</p>
                </div>
                <Button onClick={() => setUploadModalOpen(true)} className="rounded-xl gap-2 bg-primary shadow-sm">
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
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-border/60 bg-muted/20">
                                        <th className="text-left px-5 py-3.5 text-xs font-bold uppercase tracking-widest text-muted-foreground">Name</th>
                                        <th className="text-left px-5 py-3.5 text-xs font-bold uppercase tracking-widest text-muted-foreground">Matter</th>
                                        <th className="text-left px-5 py-3.5 text-xs font-bold uppercase tracking-widest text-muted-foreground">Uploaded by</th>
                                        <th className="text-left px-5 py-3.5 text-xs font-bold uppercase tracking-widest text-muted-foreground">Date</th>
                                        <th className="text-right px-5 py-3.5 text-xs font-bold uppercase tracking-widest text-muted-foreground">Size</th>
                                        <th className="px-5 py-3.5" />
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/40">
                                    {documents.data.map((doc) => (
                                        <tr key={doc.id} className="hover:bg-muted/20 transition-colors">
                                            <td className="px-5 py-4">
                                                <p className="text-[14px] font-semibold text-foreground">{doc.name}</p>
                                                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium mt-1 ${visibilityBadgeStyles[doc.is_client_visible ? 'success' : 'secondary']}`}>
                                                    {doc.is_client_visible ? 'Client visible' : 'Internal'}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4 text-[14px] text-muted-foreground">
                                                {doc.matter ? (
                                                    <Link href={`/matters/${doc.matter.id}`} className="hover:text-primary transition-colors font-medium">
                                                        {doc.matter.name}
                                                    </Link>
                                                ) : '—'}
                                            </td>
                                            <td className="px-5 py-4 text-[14px] text-muted-foreground">{(doc as any).uploadedBy?.full_name ?? '—'}</td>
                                            <td className="px-5 py-4 text-[14px] text-muted-foreground">{formatDate(doc.created_at)}</td>
                                            <td className="px-5 py-4 text-right text-[14px] tabular-nums text-muted-foreground">{formatBytes(doc.size_bytes)}</td>
                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-1 justify-end">
                                                    <Button variant="ghost" size="icon" className="h-8 w-8" title="View" onClick={() => setViewerDoc(doc as any)}>
                                                        <Eye className="h-3.5 w-3.5" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8" title="Download" asChild>
                                                        <a href={`/documents/${doc.id}/download`} download>
                                                            <Download className="h-3.5 w-3.5" />
                                                        </a>
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-destructive hover:text-destructive"
                                                        onClick={() => handleDelete(doc.id)}
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
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
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Upload Document</DialogTitle>
                        <DialogDescription>Upload a file to attach to a matter.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>File * <span className="text-muted-foreground font-normal">(max 20 MB)</span></Label>
                            <Input
                                ref={fileRef}
                                type="file"
                                onChange={(e) => setData('file', e.target.files?.[0] ?? null)}
                            />
                            {errors.file && <p className="text-xs text-destructive">{errors.file}</p>}
                        </div>
                        <div className="space-y-2">
                            <Label>Matter *</Label>
                            <Select value={data.matter_id} onValueChange={(v) => setData('matter_id', v)}>
                                <SelectTrigger><SelectValue placeholder="Select a matter…" /></SelectTrigger>
                                <SelectContent>
                                    {matters.map((m) => (
                                        <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {errors.matter_id && <p className="text-xs text-destructive">{errors.matter_id}</p>}
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-border accent-primary"
                                checked={data.is_client_visible}
                                onChange={(e) => setData('is_client_visible', e.target.checked)}
                            />
                            <span className="text-sm font-medium">Visible to client</span>
                        </label>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setUploadModalOpen(false)} disabled={processing}>Cancel</Button>
                        <Button onClick={handleUpload} disabled={processing || !data.file || !data.matter_id} className="gap-2">
                            <Upload className="h-4 w-4" />
                            {processing ? 'Uploading…' : 'Upload'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            {/* ── Document Viewer Modal ── */}
            {viewerDoc && (
                <Dialog open={!!viewerDoc} onOpenChange={() => setViewerDoc(null)}>
                    <DialogContent className="max-w-5xl w-full h-[90vh] flex flex-col p-0 gap-0">
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
