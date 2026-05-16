<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminUserTest extends TestCase
{
    use RefreshDatabase;

    public function test_firm_admin_can_invite_user(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();

        $this->actingAsUser($admin)->post('/admin/users', [
            'full_name' => 'New Solicitor',
            'email'     => 'new@example.com',
            'role'      => 'solicitor',
        ])->assertRedirect();

        $this->assertDatabaseHas('users', [
            'firm_id'   => $firm->id,
            'email'     => 'new@example.com',
            'role'      => 'solicitor',
        ]);
    }

    public function test_invalid_role_is_rejected(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();

        $this->actingAsUser($admin)->post('/admin/users', [
            'full_name' => 'Bad Role User',
            'email'     => 'bad@example.com',
            'role'      => 'administrator',
        ])->assertSessionHasErrors('role');
    }

    public function test_non_admin_cannot_access_admin_users(): void
    {
        [$firm, $user] = $this->createFirmAndUser(['role' => 'solicitor']);

        $this->actingAsUser($user)->get('/admin/users')
            ->assertStatus(403);
    }

    public function test_duplicate_email_in_firm_is_rejected(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        User::factory()->forFirm($firm)->create(['email' => 'existing@example.com']);

        $this->actingAsUser($admin)->post('/admin/users', [
            'full_name' => 'Duplicate',
            'email'     => 'existing@example.com',
            'role'      => 'solicitor',
        ])->assertSessionHasErrors('email');
    }

    public function test_firm_admin_can_update_user_role(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $user = User::factory()->forFirm($firm)->create(['role' => 'solicitor']);

        $this->actingAsUser($admin)->put("/admin/users/{$user->id}", [
            'role' => 'senior_solicitor',
        ])->assertRedirect();

        $this->assertDatabaseHas('users', ['id' => $user->id, 'role' => 'senior_solicitor']);
    }

    public function test_valid_roles_accepted(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();

        $validRoles = ['firm_admin', 'senior_solicitor', 'solicitor', 'paralegal', 'accounts'];

        foreach ($validRoles as $i => $role) {
            $this->actingAsUser($admin)->post('/admin/users', [
                'full_name' => "User {$i}",
                'email'     => "user{$i}@example.com",
                'role'      => $role,
            ])->assertRedirect();
        }

        $this->assertDatabaseCount('users', 1 + count($validRoles));
    }
}
