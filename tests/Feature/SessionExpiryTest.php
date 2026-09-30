<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Session expiry must never strand the user in front of Inertia's fatal
 * "must receive a valid Inertia response" modal. SPA visits get the
 * documented flow (409 + X-Inertia-Location to login with a message),
 * fetch pollers get JSON, plain loads get a redirected login with a message.
 */
class SessionExpiryTest extends TestCase
{
    use RefreshDatabase;

    private function inertiaVersion(): string
    {
        return hash_file('xxh128', public_path('build/manifest.json'));
    }

    public function test_expired_session_inertia_visit_goes_to_login_with_message(): void
    {
        $response = $this
            ->withHeader('X-Inertia', 'true')
            ->withHeader('X-Inertia-Version', $this->inertiaVersion())
            ->get('/dashboard');

        $response->assertStatus(409);
        $this->assertSame(route('login'), $response->headers->get('X-Inertia-Location'));
        $this->assertStringContainsString('session expired', (string) session('status'));
    }

    public function test_expired_session_fetch_caller_gets_json(): void
    {
        $this->getJson('/dashboard')->assertUnauthorized();
    }

    public function test_expired_session_plain_load_redirects_with_message(): void
    {
        $this->get('/dashboard')
            ->assertRedirect(route('login'))
            ->assertSessionHas('status');
    }

    public function test_authenticated_visit_is_unaffected(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();

        $this->actingAsUser($admin)->get('/dashboard')->assertOk();
    }
}
