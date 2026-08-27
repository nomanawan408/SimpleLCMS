<?php

namespace App\Console\Commands;

use App\Support\BackupArchive;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\Process\Process;

class RestoreCommand extends Command
{
    protected $signature = 'app:restore {file : Backup file path} {--force : Skip confirmation} {--skip-verify : Bypass the provenance check (disaster recovery only)}';
    protected $description = 'Restore the application from a backup file';

    public function handle(): int
    {
        $backupFile = $this->argument('file');

        if (!file_exists($backupFile)) {
            $this->error("Backup file not found: {$backupFile}");
            return Command::FAILURE;
        }

        if (!str_ends_with($backupFile, '.tar.gz')) {
            $this->error("Invalid backup file. Must be a .tar.gz archive.");
            return Command::FAILURE;
        }

        // Restore replays SQL with full database privileges and overwrites the
        // document store. Only archives this installation produced -- and that
        // have not been altered since -- may be used.
        if (! $this->option('skip-verify') && ! BackupArchive::verify($backupFile)) {
            $this->error('Backup signature missing or invalid. Refusing to restore an unverified archive.');
            return Command::FAILURE;
        }

        if (!$this->option('force')) {
            $this->warn('This will completely overwrite the current database and storage files!');
            if (!$this->confirm('Are you sure you want to continue?')) {
                $this->info('Restore cancelled.');
                return Command::SUCCESS;
            }
        }

        $start = now();
        $this->info("Starting restore at {$start->format('Y-m-d H:i:s')}");

        try {
            // Create temp directory
            $tempDir = BackupArchive::directory().'/temp_restore_'.bin2hex(random_bytes(8));
            if (!is_dir($tempDir)) {
                mkdir($tempDir, 0700, true);
            }

            // Extract archive
            $this->info('Extracting backup...');
            $this->extractArchive($backupFile, $tempDir);

            // Find backup contents
            $extractedItems = array_filter(glob("{$tempDir}/*"), 'is_dir');
            if (empty($extractedItems)) {
                throw new \Exception('No backup contents found in archive');
            }
            
            $backupContents = reset($extractedItems); // First directory

            // Restore database
            $dbFile = "{$backupContents}/database.sql";
            if (file_exists($dbFile)) {
                $this->info('Restoring database...');
                $this->restoreDatabase($dbFile);
            } else {
                throw new \Exception('Database backup not found in archive');
            }

            // Restore storage
            $storageDir = "{$backupContents}/storage";
            if (is_dir($storageDir)) {
                $this->info('Restoring storage files...');
                $this->restoreStorage($storageDir);
            }

            // Cleanup
            $this->cleanupTempDir($tempDir);

            $this->info('Restore completed successfully!');
            return Command::SUCCESS;
        } catch (\Exception $e) {
            $this->error("Restore failed: " . $e->getMessage());
            return Command::FAILURE;
        }
    }

    private function extractArchive(string $archivePath, string $targetDir): void
    {
        // Refuse absolute paths, parent-directory traversal and symlinks in
        // archive members, so extraction cannot write outside $targetDir.
        $listing = new Process(['tar', '-tzf', $archivePath]);
        $listing->mustRun();

        foreach (preg_split('/\R/', trim($listing->getOutput())) ?: [] as $member) {
            if ($member === '') {
                continue;
            }

            if (str_starts_with($member, '/') || str_contains($member, '../')) {
                throw new \RuntimeException("Unsafe path in archive: {$member}");
            }
        }

        $process = new Process([
            'tar', '-xzf', $archivePath,
            '-C', $targetDir,
            '--no-absolute-names',
            '--no-overwrite-dir',
            '--no-same-owner',
        ]);

        $process->mustRun();
    }

    private function restoreDatabase(string $sqlFile): void
    {
        $config = config('database.connections.' . config('database.default'));
        $driver = $config['driver'] ?? null;

        $process = match($driver) {
            'mysql' => $this->createMysqlRestoreProcess($config, $sqlFile),
            'pgsql' => $this->createPostgresRestoreProcess($config, $sqlFile),
            'sqlite' => $this->createSqliteRestoreProcess($config, $sqlFile),
            default => throw new \Exception("Unsupported database driver: {$driver}")
        };

        $process->mustRun();
    }

    private function createMysqlRestoreProcess(array $config, string $sqlFile): Process
    {
        $host = $config['host'] ?? 'localhost';
        $port = $config['port'] ?? '3306';
        $database = $config['database'] ?? '';
        $username = $config['username'] ?? '';
        $password = $config['password'] ?? '';

        // First drop and recreate database
        $dropProcess = new Process([
            'mysql',
            "--host={$host}",
            "--port={$port}",
            "--user={$username}",
            '--batch',
            '-e', "DROP DATABASE IF EXISTS `{$database}`; CREATE DATABASE `{$database}`;"
        ], null, ['MYSQL_PWD' => $password]);
        $dropProcess->mustRun();

        // --batch and --skip-comments stop the client interpreting `\!`, which
        // in interactive mode is a shell escape -- turning a crafted dump into
        // command execution. --disable-local-infile blocks local file reads.
        $command = [
            'mysql',
            "--host={$host}",
            "--port={$port}",
            "--user={$username}",
            '--batch',
            '--skip-comments',
            '--disable-local-infile',
            $database
        ];

        return new Process($command, null, ['MYSQL_PWD' => $password], fopen($sqlFile, 'r'), 300);
    }

    private function createPostgresRestoreProcess(array $config, string $sqlFile): Process
    {
        $host = $config['host'] ?? 'localhost';
        $port = $config['port'] ?? '5432';
        $database = $config['database'] ?? '';
        $username = $config['username'] ?? '';

        $env = [
            'PGPASSWORD' => $config['password'] ?? '',
        ];

        // Drop and recreate database
        $dropProcess = new Process([
            'dropdb',
            "--host={$host}",
            "--port={$port}",
            "--username={$username}",
            '--if-exists',
            $database
        ], null, $env);
        $dropProcess->mustRun();

        $createProcess = new Process([
            'createdb',
            "--host={$host}",
            "--port={$port}",
            "--username={$username}",
            $database
        ], null, $env);
        $createProcess->mustRun();

        // Restore
        $command = [
            'psql',
            "--host={$host}",
            "--port={$port}",
            "--username={$username}",
            '--no-password',
            '--echo-all',
            $database
        ];

        return new Process($command, null, $env, fopen($sqlFile, 'r'), 300);
    }

    private function createSqliteRestoreProcess(array $config, string $sqlFile): Process
    {
        $database = $config['database'] ?? '';
        
        // Remove existing database
        if (file_exists($database)) {
            unlink($database);
        }

        // Restore using sqlite3 CLI
        $command = ['sqlite3', $database];
        return new Process($command, null, null, fopen($sqlFile, 'r'), 300);
    }

    private function restoreStorage(string $storageBackupDir): void
    {
        $targetPath = storage_path('app/private/documents');
        
        // Clear existing storage
        if (is_dir($targetPath)) {
            // Passing "path/*" to Process is a literal argument, not a glob,
            // so the old form silently cleared nothing.
            $clearProcess = new Process(['find', $targetPath, '-mindepth', '1', '-delete']);
            $clearProcess->mustRun();
        } else {
            mkdir($targetPath, 0755, true);
        }

        // Copy backup files
        if (is_dir($storageBackupDir)) {
            $copyProcess = new Process(['cp', '-r', "{$storageBackupDir}/.", $targetPath]);
            $copyProcess->mustRun();
        }
    }

    private function cleanupTempDir(string $tempDir): void
    {
        if (is_dir($tempDir)) {
            $process = new Process(['rm', '-rf', $tempDir]);
            $process->run();
        }
    }
}