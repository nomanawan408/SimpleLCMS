<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PasswordResetTest extends TestCase
{
    use RefreshDatabase;

    public function test_unknown_address_gets_identical_response(): void
    {
        // Known and unknown addresses are indistinguishable: same redirect,
        // same generic status, never an error bag. Otherwise the endpoint
        // becomes a staff-email oracle for targeted phishing.
        [$firm, $admin] = $this->createFirmAndAdmin();

        $known = $this->post('/forgot-password', ['email' => $admin->email]);
        $known->assertRedirect()->assertSessionHasNoErrors();
        $knownStatus = session('status');

        $unknown = $this->post('/forgot-password', ['email' => 'nobody-here@example.com']);
        $unknown->assertRedirect()->assertSessionHasNoErrors();

        $this->assertSame($knownStatus, session('status'));
        $this->assertStringContainsString('If an account exists', session('status'));
    }

    public function test_reset_requests_are_throttled(): void
    {
        $statuses = [];
        for ($i = 0; $i < 7; $i++) {
            $statuses[] = $this->post('/forgot-password', ['email' => 'x@example.com'])->status();
        }

        $this->assertContains(429, $statuses);
    }
}
