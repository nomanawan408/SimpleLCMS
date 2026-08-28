<?php

namespace App\Console\Commands;

use App\Support\BackupArchive;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\Process\Process;
use Symfony\Component\Process\Exception\ProcessFailedException;

class BackupCommand extends Command
{
    protected $signature = 'app:backup
        {--cleanup : Remove old backups (keep last 5)}
        {--no-database : Skip the database dump}
        {--no-files : Skip the document store}';
    protected $description = 'Create a backup of the application database and storage files';

    public function handle(): int
    {
        $start = now();
        $this->info("Starting backup at {$start->format('Y-m-d H:i:s')}");

        $backupName = 'backup-' . $start->format('Y-m-d-H-i-s') . '-' . substr(md5(uniqid()), 0, 8);
        $backupDir = BackupArchive::directory()."/{$backupName}";

        if (!is_dir($backupDir)) {
            mkdir($backupDir, 0700, true);
        }

        $includeDatabase = ! $this->option('no-database');
        $includeFiles = ! $this->option('no-files');

        if (! $includeDatabase && ! $includeFiles) {
            $this->error('Nothing selected to back up.');
            $this->cleanupTempDir($backupDir);

            return Command::FAILURE;
        }

        try {
            if ($includeDatabase) {
                $this->info('Backing up database...');
                $this->backupDatabase("{$backupDir}/database.sql");
            } else {
                $this->line('Skipping database.');
            }

            if ($includeFiles) {
                $this->info('Backing up storage files...');
                $this->backupStorage($backupDir);
            } else {
                $this->line('Skipping documents.');
            }

            // Restore reads this to know what the archive actually holds, so it
            // can offer only the parts that are really in there.
            $this->writeManifest($backupDir, $includeDatabase, $includeFiles);

            // Create archive
            $this->info('Creating archive...');
            $archivePath = $this->createArchive($backupDir, $backupName);

            // Cleanup temp directory
            $this->cleanupTempDir($backupDir);

            $this->info("Backup completed successfully: {$archivePath}");
            
            if ($this->option('cleanup')) {
                $this->cleanupOldBackups();
            }

            return Command::SUCCESS;
        } catch (\Exception $e) {
            $this->error("Backup failed: " . $e->getMessage());
            $this->cleanupTempDir($backupDir);
            return Command::FAILURE;
        }
    }

    private function backupDatabase(string $outputPath): void
    {
        $config = config('database.connections.' . config('database.default'));
        $driver = $config['driver'] ?? null;

        $process = match($driver) {
            'mysql' => $this->createMysqlDumpProcess($config),
            'pgsql' => $this->createPostgresDumpProcess($config),
            'sqlite' => $this->createSqliteDumpProcess($config),
            default => throw new \Exception("Unsupported database driver: {$driver}")
        };

        $process->mustRun();

        file_put_contents($outputPath, $process->getOutput());
    }

    private function createMysqlDumpProcess(array $config): Process
    {
        $host = $config['host'] ?? 'localhost';
        $port = $config['port'] ?? '3306';
        $database = $config['database'] ?? '';
        $username = $config['username'] ?? '';
        $password = $config['password'] ?? '';

        $command = [
            'mysqldump',
            "--host={$host}",
            "--port={$port}",
            "--user={$username}",
            '--single-transaction',
            '--routines',
            '--triggers',
            '--events',
            $database
        ];

        // MYSQL_PWD rather than --password=: process arguments are readable by
        // any local account via /proc, the environment is not.
        return new Process($command, null, ['MYSQL_PWD' => $password], null, 300);
    }

    private function createPostgresDumpProcess(array $config): Process
    {
        $host = $config['host'] ?? 'localhost';
        $port = $config['port'] ?? '5432';
        $database = $config['database'] ?? '';
        $username = $config['username'] ?? '';

        $env = [
            'PGPASSWORD' => $config['password'] ?? '',
        ];

        $command = [
            'pg_dump',
            "--host={$host}",
            "--port={$port}",
            "--username={$username}",
            '--no-password',
            '--verbose',
            '--clean',
            '--if-exists',
            '--create',
            $database
        ];

        return new Process($command, null, $env, null, 300);
    }

    private function createSqliteDumpProcess(array $config): Process
    {
        $database = $config['database'] ?? '';
        if (!file_exists($database)) {
            throw new \Exception("SQLite database not found: {$database}");
        }

        $command = ['sqlite3', $database, '.dump'];
        return new Process($command, null, null, null, 300);
    }

    private function backupStorage(string $backupDir): void
    {
        $storagePath = storage_path('app/private/documents');
        $targetPath = "{$backupDir}/storage";

        if (is_dir($storagePath)) {
            // Use system cp for efficiency
            $process = new Process(['cp', '-r', $storagePath, $targetPath]);
            $process->mustRun();
        } else {
            mkdir($targetPath, 0755, true);
        }
    }

    private function createArchive(string $backupDir, string $backupName): string
    {
        $archivePath = BackupArchive::directory()."/{$backupName}.tar.gz";
        
        $process = new Process([
            'tar', '-czf', $archivePath, '-C', dirname($backupDir), $backupName
        ]);
        
        $process->mustRun();

        @chmod($archivePath, 0600);

        // Record provenance now, so restore can prove this archive came from
        // this installation rather than from an attacker.
        BackupArchive::sign($archivePath);

        return $archivePath;
    }

    private function cleanupTempDir(string $backupDir): void
    {
        if (is_dir($backupDir)) {
            $process = new Process(['rm', '-rf', $backupDir]);
            $process->run(); // Don't throw on failure
        }
    }

    private function cleanupOldBackups(): void
    {
        $this->info('Cleaning up old backups...');
        $backupsDir = BackupArchive::directory();

        if (!is_dir($backupsDir)) return;

        $files = glob("{$backupsDir}/backup-*.tar.gz");
        if (count($files) <= 5) return;

        // Sort by modification time, newest first
        usort($files, fn($a, $b) => filemtime($b) <=> filemtime($a));

        // Remove oldest backups, keep last 5
        $toDelete = array_slice($files, 5);
        foreach ($toDelete as $file) {
            unlink($file);
            @unlink(BackupArchive::signaturePathFor($file));
            $this->line("Deleted old backup: " . basename($file));
        }
    }

    /**
     * Describes the archive's contents so restore never has to guess.
     */
    private function writeManifest(string $backupDir, bool $database, bool $files): void
    {
        file_put_contents("{$backupDir}/manifest.json", json_encode([
            'version' => 1,
            'created_at' => now()->toIso8601String(),
            'app_name' => config('app.name'),
            'db_driver' => config('database.default'),
            'contents' => [
                'database' => $database,
                'files' => $files,
            ],
        ], JSON_PRETTY_PRINT));
    }
}
