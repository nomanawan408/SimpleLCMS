<?php

namespace App\Support;

/**
 * Single source of truth for what may be stored in the document library and
 * how it is allowed to leave the server again.
 *
 * The threat is a file that the browser will treat as active content on this
 * origin -- HTML, SVG, XML with a stylesheet. Two independent layers stop it:
 * an upload allowlist, and a serve-time allowlist that decides the response
 * Content-Type from the server's own sniffing rather than anything the client
 * supplied.
 */
class DocumentMediaType
{
    /**
     * File extensions accepted by the upload endpoint. Deliberately excludes
     * html, htm, xhtml, svg, xml and anything executable.
     */
    public const ALLOWED_EXTENSIONS = [
        'pdf',
        'doc', 'docx', 'rtf', 'odt', 'txt',
        'xls', 'xlsx', 'csv', 'ods',
        'ppt', 'pptx',
        'png', 'jpg', 'jpeg', 'gif', 'webp', 'tif', 'tiff',
        'eml', 'msg',
        'zip',
    ];

    /**
     * Media types that may be rendered inline in the browser. Everything else
     * is sent as a download, so it can never execute against this origin.
     */
    private const INLINE_SAFE = [
        'application/pdf',
        'image/png',
        'image/jpeg',
        'image/gif',
        'image/webp',
        'text/plain',
    ];

    /**
     * Media types the browser may treat as active content. A file whose bytes
     * sniff to one of these is refused even when its extension looked
     * harmless -- a .txt full of markup is still markup.
     */
    private const ACTIVE_CONTENT = [
        'text/html',
        'application/xhtml+xml',
        'image/svg+xml',
        'text/xml',
        'application/xml',
        'application/javascript',
        'text/javascript',
        'application/x-httpd-php',
        'application/xhtml',
    ];

    private const FALLBACK = 'application/octet-stream';

    /**
     * Whether a file with this sniffed media type may be stored at all.
     */
    public static function isStorable(?string $sniffedMime): bool
    {
        $mime = strtolower(trim(explode(';', (string) $sniffedMime)[0]));

        return ! in_array($mime, self::ACTIVE_CONTENT, true);
    }

    /**
     * Resolve the Content-Type to send for a stored document.
     *
     * Anything not explicitly known to be safe inline collapses to a generic
     * binary type, which browsers will not render.
     */
    public static function responseType(?string $storedMime): string
    {
        $mime = strtolower(trim(explode(';', (string) $storedMime)[0]));

        return in_array($mime, self::INLINE_SAFE, true) ? $mime : self::FALLBACK;
    }

    /**
     * Whether a document may be displayed inline rather than downloaded.
     */
    public static function canDisplayInline(?string $storedMime): bool
    {
        return self::responseType($storedMime) !== self::FALLBACK;
    }

    /**
     * Response headers that hold regardless of media type: never sniff, never
     * execute, never frame, never cache.
     */
    public static function protectiveHeaders(): array
    {
        return [
            'X-Content-Type-Options' => 'nosniff',
            'Content-Security-Policy' => "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; object-src 'none'; frame-ancestors 'none'; sandbox",
            'Cache-Control' => 'private, no-store, max-age=0',
            'X-Frame-Options' => 'DENY',
        ];
    }
}
