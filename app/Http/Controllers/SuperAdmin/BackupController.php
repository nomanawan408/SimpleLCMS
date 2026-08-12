<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Http\Controllers\Controller;
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
        
        $backupPath = storage_path("app/backups/{$filename}");
        
        if (!file_exists($backupPath)) {
            abort(404);
        }
        
        return Response::download($backupPath, $filename);
    }
    
    public function restore(Request $request)
    {
        $this->authorizeSuperAdmin();
        
        $request->validate([
            'backup_file' => 'required|file|mimes:gz,tar,gzip|max:102400', // 100MB max
        ]);
        
        $file = $request->file('backup_file');
        $originalName = $file->getClientOriginalName();
        
        // Store temporarily
        $tempPath = $file->storeAs('backups/temp', $originalName, 'local');
        $fullPath = storage_path("app/{$tempPath}");
        
        try {
            // Run restore command
            $exitCode = Artisan::call('app:restore', [
                'file' => $fullPath,
                '--force' => true
            ]);
            
            // Clean up temp file
            unlink($fullPath);
            
            if ($exitCode === 0) {
                return back()->with('success', 'System restored successfully. You may need to log in again.');
            } else {
                return back()->with('error', 'Restore failed');
            }
        } catch (\Exception $e) {
            // Clean up temp file on error
            if (file_exists($fullPath)) {
                unlink($fullPath);
            }
            return back()->with('error', 'Restore failed: ' . $e->getMessage());
        }
    }
    
    public function destroy(Request $request, string $filename)
    {
        $this->authorizeSuperAdmin();
        
        $backupPath = storage_path("app/backups/{$filename}");
        
        if (file_exists($backupPath)) {
            unlink($backupPath);
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
        $backupsDir = storage_path('app/backups');
        
        if (!is_dir($backupsDir)) {
            return [];
        }
        
        $files = glob("{$backupsDir}/backup-*.tar.gz");
        $backups = [];
        
        foreach ($files as $file) {
            $filename = basename($file);
            $backups[] = [
                'filename' => $filename,
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