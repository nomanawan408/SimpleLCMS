import { Head, router, useForm } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import { Button } from '@/components/ui/button';
import {
    Table, TableHeader, TableHeaderRow, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils';
import { Download, Trash2, Upload, HardDrive, AlertCircle } from 'lucide-react';
import { useState } from 'react';

interface Backup {
    filename: string;
    verified: boolean;
    size: number;
    created_at: number;
    created_at_formatted: string;
    size_formatted: string;
}

interface Props {
    backups: Backup[];
}

export default function BackupsIndex({ backups }: Props) {
    const { post, processing } = useForm();

    const [restoreProcessing, setRestoreProcessing] = useState(false);

    const handleCreateBackup = () => {
        if (confirm('Are you sure you want to create a new backup? This may take several minutes.')) {
            post('/superadmin/backups');
        }
    };

    const handleDeleteBackup = (filename: string) => {
        if (confirm('Are you sure you want to delete this backup? This cannot be undone.')) {
            router.delete(`/superadmin/backups/${filename}`);
        }
    };

    const [selectedBackup, setSelectedBackup] = useState('');

    const handleRestoreBackup = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        if (!selectedBackup) {
            alert('Choose a backup to restore.');
            return;
        }

        if (!confirm('WARNING: This will completely replace the current database and files. Are you absolutely sure?')) {
            return;
        }

        setRestoreProcessing(true);
        router.post('/superadmin/backups/restore', { filename: selectedBackup }, {
            onFinish: () => setRestoreProcessing(false),
            onError: () => setRestoreProcessing(false),
        });
    };

    return (
        <AppLayout title="System Backups">
            <Head title="System Backups" />

            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-extrabold tracking-tight">System Backups</h1>
                        <p className="text-muted-foreground">
                            Manage application backups and restore from previous snapshots
                        </p>
                    </div>
                    <Button onClick={handleCreateBackup} disabled={processing}>
                        <HardDrive className="mr-2 h-4 w-4" />
                        {processing ? 'Creating...' : 'Create Backup'}
                    </Button>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                    {/* Create Backup Card */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Create New Backup</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <p className="text-sm text-muted-foreground">Backups include:</p>
                                <ul className="text-sm space-y-1">
                                    <li className="flex items-center">
                                        <span className="w-2 h-2 bg-primary rounded-full mr-2"></span>
                                        Complete database snapshot
                                    </li>
                                    <li className="flex items-center">
                                        <span className="w-2 h-2 bg-primary rounded-full mr-2"></span>
                                        All document storage files
                                    </li>
                                </ul>
                                <div className="rounded-md bg-yellow-50 border border-yellow-200 p-3 mt-4">
                                    <div className="flex">
                                        <AlertCircle className="h-5 w-5 text-yellow-600 mr-2 flex-shrink-0" />
                                        <div>
                                            <p className="text-sm font-medium text-yellow-800">Important</p>
                                            <p className="text-sm text-yellow-700">
                                                Backup process may take several minutes. Do not interrupt.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Restore Backup Card */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Restore from Backup</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleRestoreBackup} className="space-y-4">
                                <div>
                                    <label htmlFor="restore-source" className="block text-sm font-medium mb-2">
                                        Choose a backup
                                    </label>
                                    <select
                                        id="restore-source"
                                        value={selectedBackup}
                                        onChange={(e) => setSelectedBackup(e.target.value)}
                                        className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                        required
                                    >
                                        <option value="">Select a backup…</option>
                                        {backups.filter((b) => b.verified).map((b) => (
                                            <option key={b.filename} value={b.filename}>
                                                {b.created_at_formatted} — {b.size_formatted}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Only backups created by this system and passing their integrity check can be
                                        restored. To restore from an off-site copy, place the archive and its
                                        <code className="mx-1">.sig</code> file in the backups directory on the server.
                                    </p>
                                </div>

                                <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3">
                                    <div className="flex">
                                        <AlertCircle className="h-5 w-5 text-destructive mr-2 flex-shrink-0" />
                                        <div>
                                            <p className="text-sm font-medium text-destructive">Warning</p>
                                            <p className="text-sm text-destructive/80">
                                                This will completely overwrite the current system. All unsaved changes will be lost.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <Button type="submit" disabled={restoreProcessing} variant="destructive">
                                    <Upload className="mr-2 h-4 w-4" />
                                    {restoreProcessing ? 'Restoring...' : 'Restore System'}
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                </div>

                {/* Backup List */}
                <Card>
                    <CardHeader>
                        <CardTitle>Existing Backups</CardTitle>
                        <p className="text-sm text-muted-foreground">{backups.length} backup(s) available</p>
                    </CardHeader>
                    <CardContent>
                        {backups.length === 0 ? (
                            <div className="text-center py-10">
                                <HardDrive className="mx-auto h-12 w-12 text-muted-foreground" />
                                <h3 className="mt-4 text-lg font-medium">No backups found</h3>
                                <p className="mt-2 text-sm text-muted-foreground">
                                    Create your first backup using the button above.
                                </p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableHeaderRow>
                                            <TableHead>Filename</TableHead>
                                            <TableHead className="hidden md:table-cell">Size</TableHead>
                                            <TableHead className="hidden sm:table-cell">Date Created</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableHeaderRow>
                                    </TableHeader>
                                    <TableBody>
                                        {backups.map((backup) => (
                                            <TableRow key={backup.filename} className="last:border-0">
                                                <TableCell className="font-medium">{backup.filename}</TableCell>
                                                <TableCell className="hidden md:table-cell">
                                                    <Badge variant="secondary">{backup.size_formatted}</Badge>
                                                </TableCell>
                                                <TableCell className="hidden sm:table-cell">
                                                    {formatDate(backup.created_at_formatted)}
                                                </TableCell>
                                                <TableCell className="text-right space-x-2">
                                                    <Button variant="outline" size="sm" asChild>
                                                        <a href={`/superadmin/backups/${backup.filename}`}>
                                                            <Download className="h-4 w-4 mr-1" />
                                                            Download
                                                        </a>
                                                    </Button>
                                                    <Button variant="destructive" size="sm" onClick={() => handleDeleteBackup(backup.filename)}
                                                    >
                                                        <Trash2 className="h-4 w-4 mr-1" />
                                                        Delete
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}
