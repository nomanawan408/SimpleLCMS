import { Head, router, useForm } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils';
import { Download, Trash2, Upload, HardDrive, AlertCircle } from 'lucide-react';
import { useState } from 'react';

interface Backup {
    filename: string;
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

    const handleRestoreBackup = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const file = formData.get('backup_file') as File;

        if (!file || file.size === 0) {
            alert('Please select a backup file to restore.');
            return;
        }

        if (!confirm('WARNING: This will completely replace the current database and files. Are you absolutely sure?')) {
            return;
        }

        setRestoreProcessing(true);
        router.post('/superadmin/backups/restore', formData, {
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
                        <h1 className="text-2xl font-bold tracking-tight">System Backups</h1>
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
                                    <label className="block text-sm font-medium mb-2">Upload Backup File</label>
                                    <input
                                        type="file"
                                        name="backup_file"
                                        accept=".tar.gz,.gz"
                                        className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                                        required
                                    />
                                    <p className="text-xs text-muted-foreground mt-1">Maximum file size: 100MB</p>
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
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b">
                                            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Filename</th>
                                            <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Size</th>
                                            <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Date Created</th>
                                            <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {backups.map((backup) => (
                                            <tr key={backup.filename} className="border-b last:border-0">
                                                <td className="px-4 py-3 font-medium">{backup.filename}</td>
                                                <td className="px-4 py-3 hidden md:table-cell">
                                                    <Badge variant="secondary">{backup.size_formatted}</Badge>
                                                </td>
                                                <td className="px-4 py-3 hidden sm:table-cell">
                                                    {formatDate(backup.created_at_formatted)}
                                                </td>
                                                <td className="px-4 py-3 text-right space-x-2">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        asChild
                                                    >
                                                        <a href={`/superadmin/backups/${backup.filename}`}>
                                                            <Download className="h-4 w-4 mr-1" />
                                                            Download
                                                        </a>
                                                    </Button>
                                                    <Button
                                                        variant="destructive"
                                                        size="sm"
                                                        onClick={() => handleDeleteBackup(backup.filename)}
                                                    >
                                                        <Trash2 className="h-4 w-4 mr-1" />
                                                        Delete
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}
