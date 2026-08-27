<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Vite;
use Symfony\Component\HttpFoundation\Response;

/**
 * Applies the response security headers the application previously had none
 * of: a nonce-based Content-Security-Policy plus the standard set that stops
 * MIME sniffing, framing, and referrer leakage of matter and contact URLs.
 *
 * Scripts are allowed by nonce rather than by 'unsafe-inline', so injected
 * markup cannot execute even if it reaches the page.
 */
class SecurityHeaders
{
    public function handle(Request $request, Closure $next): Response
    {
        // Laravel's Vite helper stamps this nonce onto the script and style
        // tags it renders; @routes receives the same one from the layout.
        $nonce = Vite::useCspNonce();

        $response = $next($request);

        // Streamed file responses set their own hardened headers in
        // DocumentController; leave those alone.
        if ($response->headers->has('Content-Security-Policy')) {
            return $response;
        }

        foreach ($this->headers($request, $nonce) as $header => $value) {
            $response->headers->set($header, $value);
        }

        return $response;
    }

    /**
     * @return array<string, string>
     */
    private function headers(Request $request, string $nonce): array
    {
        $headers = [
            'Content-Security-Policy' => $this->contentSecurityPolicy($nonce),
            'X-Content-Type-Options' => 'nosniff',
            'X-Frame-Options' => 'DENY',
            'Referrer-Policy' => 'strict-origin-when-cross-origin',
            'Permissions-Policy' => 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
            'Cross-Origin-Opener-Policy' => 'same-origin',
        ];

        // Only meaningful over TLS, and harmful if sent while a site is still
        // reachable over plain HTTP in development.
        if ($request->secure()) {
            $headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains';
        }

        return $headers;
    }

    private function contentSecurityPolicy(string $nonce): string
    {
        // 'self' plus a nonce, deliberately without 'strict-dynamic':
        // strict-dynamic makes browsers ignore the host allowlist, so a single
        // un-nonced tag anywhere breaks the whole UI. Omitting 'unsafe-inline'
        // is what actually stops injected inline script -- a nonce or hash in
        // the list already causes browsers to ignore 'unsafe-inline' anyway.
        $script = ["'self'", "'nonce-{$nonce}'"];
        $connect = ["'self'"];
        $style = ["'self'", "'unsafe-inline'"];

        // The Vite dev server serves modules and a HMR websocket from its own
        // origin, and React Refresh needs eval. None of this is emitted by a
        // production build.
        if ($this->usingViteDevServer()) {
            $devOrigin = $this->viteDevOrigin();

            $script[] = "'unsafe-eval'";
            $script[] = $devOrigin;
            $connect[] = $devOrigin;
            $connect[] = str_replace(['http://', 'https://'], ['ws://', 'wss://'], $devOrigin);
            $style[] = $devOrigin;
        }

        return implode('; ', [
            "default-src 'self'",
            'script-src '.implode(' ', $script),
            'style-src '.implode(' ', $style),
            "img-src 'self' data: blob:",
            "font-src 'self' data:",
            'connect-src '.implode(' ', $connect),
            "object-src 'none'",
            "base-uri 'self'",
            "form-action 'self'",
            "frame-ancestors 'none'",
            "frame-src 'none'",
        ]);
    }

    private function usingViteDevServer(): bool
    {
        return is_file(public_path('hot'));
    }

    private function viteDevOrigin(): string
    {
        $hot = trim((string) @file_get_contents(public_path('hot')));

        return $hot !== '' ? rtrim($hot, '/') : 'http://localhost:5173';
    }
}
