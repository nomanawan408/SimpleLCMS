<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Http\Controllers\Controller;
use App\Support\BackupArchive;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Response;
use Symfony\Component\Process\Process;
use Inertia\Inertia;

class BackupController extends Controller
{
    public function index()
    {
        $this->authorizeSuperAdmin();
        
        $backups = $this->getBackupFiles();
        
        return Inertia::render('SuperAdmin/Backups/Index', [
            'backups' => $backups,
        ]);
    }
    
    public function store(Request $request)
    {
        $this->authorizeSuperAdmin();
        
        try {
            // Run backup command
            $exitCode = Artisan::call('app:backup', ['--cleanup' => true]);
            
            if ($exitCode === 0) {
                return back()->with('success', 'Backup created successfully');
            } else {
                return back()->with('error', 'Backup failed to create');
            }
        } catch (\Exception $e) {
            return back()->with('error', 'Backup failed: ' . $e->getMessage());
        }
    }
    
    public function download(Request $request, string $filename)
    {
        $this->authorizeSuperAdmin();

        // BackupArchive::pathFor() strips any directory component and admits
        // only names this system generates, so a route parameter can never
        // point outside the backup directory.
        try {
            $backupPath = BackupArchive::pathFor($filename);
        } catch (\RuntimeException) {
            abort(404);
        }

        if (! is_file($backupPath)) {
            abort(404);
        }

        return Response::download($backupPath, basename($backupPath));
    }
    
    public function restore(Request $request)
    {
        $this->authorizeSuperAdmin();

        // Restoring replays SQL with full database privileges. It runs only
        // against archives this system produced and signed -- an uploaded
        // archive would be arbitrary SQL from an untrusted source.
        $validated = $request->validate([
            'filename' => ['required', 'string', 'max:255'],
        ]);

        try {
            $backupPath = BackupArchive::pathFor($validated['filename']);
        } catch (\RuntimeException) {
            return back()->with('error', 'Unknown backup file.');
        }

        if (! is_file($backupPath)) {
            return back()->with('error', 'That backup no longer exists.');
        }

        if (! BackupArchive::verify($backupPath)) {
            activity()->causedBy($request->user())
                ->withProperties(['filename' => basename($backupPath)])
                ->log('backup_restore_rejected_unverified');

            return back()->with('error', 'That backup failed its integrity check and was not restored.');
        }

        activity()->causedBy($request->user())
            ->withProperties(['filename' => basename($backupPath), 'ip' => $request->ip()])
            ->log('backup_restore_started');

        try {
            $exitCode = Artisan::call('app:restore', [
                'file' => $backupPath,
                '--force' => true,
            ]);
        } catch (\Exception $e) {
            report($e);

            return back()->with('error', 'Restore failed. See the application log for details.');
        }

        if ($exitCode !== 0) {
            return back()->with('error', 'Restore failed. See the application log for details.');
        }

        activity()->causedBy($request->user())->log('backup_restore_completed');

        return back()->with('success', 'System restored successfully. You may need to log in again.');
    }

    public function destroy(Request $request, string $filename)
    {
        $this->authorizeSuperAdmin();
        
        try {
            $backupPath = BackupArchive::pathFor($filename);
        } catch (\RuntimeException) {
            return back()->with('error', 'Backup not found');
        }

        if (is_file($backupPath)) {
            unlink($backupPath);
            @unlink(BackupArchive::signaturePathFor($backupPath));

            activity()->causedBy($request->user())
                ->withProperties(['filename' => basename($backupPath)])
                ->log('backup_deleted');

            return back()->with('success', 'Backup deleted successfully');
        }

        return back()->with('error', 'Backup not found');
    }
    
    private function authorizeSuperAdmin(): void
    {
        abort_unless(auth()->user()->hasRole('super_admin'), 403);
    }
    
    private function getBackupFiles(): array
    {
        $backupsDir = BackupArchive::directory();
        
        if (!is_dir($backupsDir)) {
            return [];
        }
        
        $files = glob("{$backupsDir}/backup-*.tar.gz");
        $backups = [];
        
        foreach ($files as $file) {
            $filename = basename($file);
            $backups[] = [
                'filename' => $filename,
                'verified' => BackupArchive::verify($file),
                'size' => filesize($file),
                'created_at' => filemtime($file),
                'created_at_formatted' => date('Y-m-d H:i:s', filemtime($file)),
                'size_formatted' => $this->formatBytes(filesize($file)),
            ];
        }
        
        // Sort by creation time, newest first
        usort($backups, fn($a, $b) => $b['created_at'] <=> $a['created_at']);
        
        return $backups;
    }
    
    private function formatBytes(int $size, int $precision = 2): string
    {
        $units = ['B', 'KB', 'MB', 'GB', 'TB'];
        
        for ($i = 0; $size > 1024 && $i < count($units) - 1; $i++) {
            $size /= 1024;
        }
        
        return round($size, $precision) . ' ' . $units[$i];
    }
}