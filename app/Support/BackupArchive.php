<?php

namespace App\Support;

use RuntimeException;

/**
 * Provenance and naming rules for backup archives.
 *
 * Restore replays SQL into the database with full privileges, so the single
 * most important property is that the archive was produced by this system.
 * Every archive gets an HMAC sidecar at creation; restore refuses anything
 * that does not verify.
 */
class BackupArchive
{
    /** Backups are named by the command, never by user input. */
    public const FILENAME_PATTERN = '/^backup-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}-[0-9a-f]{8}\.tar\.gz$/';

    public static function directory(): string
    {
        return storage_path('app/backups');
    }

    /**
     * Resolve a caller-supplied name to a path inside the backup directory.
     *
     * basename() strips any directory component, and the pattern then admits
     * only names this system generates -- so no traversal, and no pointing at
     * an unrelated file that happens to sit in the directory.
     */
    public static function pathFor(string $filename): string
    {
        $safe = basename($filename);

        if (! preg_match(self::FILENAME_PATTERN, $safe)) {
            throw new RuntimeException('Not a recognised backup filename.');
        }

        return self::directory().'/'.$safe;
    }

    public static function signaturePathFor(string $archivePath): string
    {
        return $archivePath.'.sig';
    }

    /**
     * Write the provenance signature for a freshly created archive.
     */
    public static function sign(string $archivePath): void
    {
        file_put_contents(self::signaturePathFor($archivePath), self::computeSignature($archivePath));
        @chmod(self::signaturePathFor($archivePath), 0600);
    }

    /**
     * Verify that an archive was produced by this installation and is intact.
     */
    public static function verify(string $archivePath): bool
    {
        $sigPath = self::signaturePathFor($archivePath);

        if (! is_file($archivePath) || ! is_file($sigPath)) {
            return false;
        }

        return hash_equals(
            trim((string) file_get_contents($sigPath)),
            self::computeSignature($archivePath)
        );
    }

    /**
     * Streaming HMAC keyed on APP_KEY, so the signature cannot be forged
     * without the application key and large archives are never held in memory.
     */
    private static function computeSignature(string $archivePath): string
    {
        return hash_hmac_file('sha256', $archivePath, self::key());
    }

    private static function key(): string
    {
        $key = config('app.key');

        if (blank($key)) {
            throw new RuntimeException('APP_KEY must be set to sign or verify backups.');
        }

        return str_starts_with($key, 'base64:')
            ? base64_decode(substr($key, 7))
            : $key;
    }
}
