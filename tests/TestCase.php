<?php

namespace Tests;

use App\Models\Firm;
use App\Models\User;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    protected function createFirmAndAdmin(array $firmAttrs = [], array $userAttrs = []): array
    {
        $firm  = Firm::factory()->create($firmAttrs);
        $admin = User::factory()->firmAdmin()->forFirm($firm)->create($userAttrs);
        return [$firm, $admin];
    }

    protected function createFirmAndUser(array $userAttrs = []): array
    {
        $firm = Firm::factory()->create();
        $user = User::factory()->forFirm($firm)->create($userAttrs);
        return [$firm, $user];
    }

    protected function actingAsUser(User $user): static
    {
        $this->actingAs($user);
        session(['totp_verified' => true]);
        return $this;
    }
}
