<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\Firm;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

class UserModuleTest extends TestCase
{
    use RefreshDatabase;

    // ── User Index ──────────────────────────────────────────────

    public function test_admin_can_view_users_index(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();

        $this->actingAsUser($admin)
            ->get('/admin/users')
            ->assertStatus(200);
    }

    public function test_non_admin_without_permission_cannot_view_users(): void
    {
        [$firm, $user] = $this->createFirmAndUser(['role' => 'lawyer']);

        $this->actingAsUser($user)
            ->get('/admin/users')
            ->assertStatus(403);
    }

    public function test_users_index_returns_firm_scoped_users(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();

        $otherFirm = Firm::factory()->create();
        $otherUser = User::factory()->forFirm($otherFirm)->create(['role' => 'lawyer']);

        $response = $this->actingAsUser($admin)
            ->get('/admin/users');

        $response->assertStatus(200);
        $response->assertInertia(fn ($page) =>
            $page->component('Admin/Users/Index')
                ->has('users', 1)
        );
    }

    public function test_users_index_includes_available_roles(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();

        $response = $this->actingAsUser($admin)
            ->get('/admin/users');

        $response->assertStatus(200);
        $response->assertInertia(fn ($page) =>
            $page->component('Admin/Users/Index')
                ->has('availableRoles')
        );
    }

    // ── User Create / Store ─────────────────────────────────────

    public function test_admin_can_create_user(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();

        $this->actingAsUser($admin)->post('/admin/users', [
            'full_name'             => 'New Solicitor',
            'email'                 => 'new@lawfirm.co.uk',
            'password'              => 'Password123!',
            'password_confirmation' => 'Password123!',
            'role' => 'lawyer',
        ])->assertRedirect(route('admin.users.index'));

        $this->assertDatabaseHas('users', [
            'firm_id'   => $firm->id,
            'email'     => 'new@lawfirm.co.uk',
            'full_name' => 'New Solicitor',
            'role' => 'lawyer',
        ]);
    }

    public function test_created_user_gets_spatie_role_assigned(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();

        $this->actingAsUser($admin)->post('/admin/users', [
            'full_name'             => 'New Solicitor',
            'email'                 => 'solicitor@lawfirm.co.uk',
            'password'              => 'Password123!',
            'password_confirmation' => 'Password123!',
            'role' => 'lawyer',
        ]);

        $user = User::where('email', 'solicitor@lawfirm.co.uk')->first();
        $this->assertNotNull($user);
        $this->assertTrue($user->hasRole('lawyer'));
    }

    public function test_create_user_requires_full_name(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();

        $this->actingAsUser($admin)->post('/admin/users', [
            'email'                 => 'test@test.com',
            'password'              => 'Password123!',
            'password_confirmation' => 'Password123!',
            'role' => 'lawyer',
        ])->assertSessionHasErrors('full_name');
    }

    public function test_create_user_requires_valid_email(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();

        $this->actingAsUser($admin)->post('/admin/users', [
            'full_name'             => 'Test',
            'email'                 => 'not-an-email',
            'password'              => 'Password123!',
            'password_confirmation' => 'Password123!',
            'role' => 'lawyer',
        ])->assertSessionHasErrors('email');
    }

    public function test_create_user_requires_password_confirmation(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();

        $this->actingAsUser($admin)->post('/admin/users', [
            'full_name'             => 'Test',
            'email'                 => 'test@test.com',
            'password'              => 'Password123!',
            'password_confirmation' => 'DifferentPassword!',
            'role' => 'lawyer',
        ])->assertSessionHasErrors('password');
    }

    public function test_create_user_requires_minimum_password_length(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();

        $this->actingAsUser($admin)->post('/admin/users', [
            'full_name'             => 'Test',
            'email'                 => 'test@test.com',
            'password'              => 'short',
            'password_confirmation' => 'short',
            'role' => 'lawyer',
        ])->assertSessionHasErrors('password');
    }

    public function test_create_user_rejects_invalid_role(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();

        $this->actingAsUser($admin)->post('/admin/users', [
            'full_name'             => 'Test',
            'email'                 => 'test@test.com',
            'password'              => 'Password123!',
            'password_confirmation' => 'Password123!',
            'role'                  => 'nonexistent_role',
        ])->assertSessionHasErrors('role');
    }

    public function test_create_user_rejects_duplicate_email_in_firm(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        User::factory()->forFirm($firm)->create(['email' => 'taken@lawfirm.co.uk']);

        $this->actingAsUser($admin)->post('/admin/users', [
            'full_name'             => 'Duplicate',
            'email'                 => 'taken@lawfirm.co.uk',
            'password'              => 'Password123!',
            'password_confirmation' => 'Password123!',
            'role' => 'lawyer',
        ])->assertSessionHasErrors('email');
    }

    /**
     * Email is a login identity, and authentication resolves it globally
     * (Auth::attempt, sendResetLink, and the email-keyed reset token table).
     * Two rows sharing one address would make which of them authenticates
     * undefined, so the address must be unique across every firm.
     */
    public function test_same_email_rejected_across_firms(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();

        $otherFirm = Firm::factory()->create();
        User::factory()->forFirm($otherFirm)->create(['email' => 'shared@email.com']);

        $this->actingAsUser($admin)->post('/admin/users', [
            'full_name'             => 'Same Email',
            'email'                 => 'shared@email.com',
            'password'              => 'Password123!',
            'password_confirmation' => 'Password123!',
            'role' => 'lawyer',
        ])->assertSessionHasErrors('email');

        $this->assertDatabaseMissing('users', ['email' => 'shared@email.com', 'firm_id' => $firm->id]);
    }

    public function test_create_user_with_optional_fields(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();

        $this->actingAsUser($admin)->post('/admin/users', [
            'full_name'             => 'Full User',
            'email'                 => 'full@lawfirm.co.uk',
            'password'              => 'Password123!',
            'password_confirmation' => 'Password123!',
            'role' => 'lawyer',
            'phone'                 => '+44 7700 123456',
            'rate_per_hour'         => 150.00,
        ])->assertRedirect();

        $this->assertDatabaseHas('users', [
            'email'         => 'full@lawfirm.co.uk',
            'phone'         => '+44 7700 123456',
        ]);
    }

    // ── User Update ─────────────────────────────────────────────

    public function test_admin_can_promote_user_to_firm_admin(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $user = User::factory()->forFirm($firm)->create(['role' => 'lawyer']);
        $user->assignRole('lawyer');

        $this->actingAsUser($admin)->put("/admin/users/{$user->id}", [
            'role' => 'firm_admin',
        ])->assertRedirect();

        $this->assertDatabaseHas('users', ['id' => $user->id, 'role' => 'firm_admin']);
    }

    public function test_update_syncs_spatie_role(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $user = User::factory()->forFirm($firm)->create(['role' => 'lawyer']);
        $user->assignRole('lawyer');

        $this->actingAsUser($admin)->put("/admin/users/{$user->id}", [
            'role' => 'firm_admin',
        ]);

        $user->refresh();
        $this->assertTrue($user->hasRole('firm_admin'));
        $this->assertFalse($user->hasRole('lawyer'));
    }

    public function test_deleted_roles_are_rejected_on_update(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $user = User::factory()->forFirm($firm)->create(['role' => 'lawyer']);
        $user->assignRole('lawyer');

        $this->actingAsUser($admin)->put("/admin/users/{$user->id}", [
            'role' => 'solicitor',
        ])->assertSessionHasErrors('role');
    }

    public function test_admin_can_deactivate_user(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $user = User::factory()->forFirm($firm)->create(['role' => 'lawyer', 'is_active' => true]);
        $user->assignRole('lawyer');

        $this->actingAsUser($admin)->put("/admin/users/{$user->id}", [
            'is_active' => false,
        ])->assertRedirect();

        $this->assertDatabaseHas('users', ['id' => $user->id, 'is_active' => false]);
    }

    public function test_admin_can_update_rate_per_hour(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $user = User::factory()->forFirm($firm)->create(['role' => 'lawyer', 'rate_per_hour' => 100]);
        $user->assignRole('lawyer');

        $this->actingAsUser($admin)->put("/admin/users/{$user->id}", [
            'rate_per_hour' => 200,
        ])->assertRedirect();

        $this->assertDatabaseHas('users', ['id' => $user->id, 'rate_per_hour' => '200.00']);
    }

    public function test_cannot_update_user_from_another_firm(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();

        $otherFirm = Firm::factory()->create();
        $otherUser = User::factory()->forFirm($otherFirm)->create(['role' => 'lawyer']);

        $this->actingAsUser($admin)->put("/admin/users/{$otherUser->id}", [
            'role' => 'lawyer',
        ])->assertStatus(403);
    }

    // ── Role routes restored ──────────────────────────────────────
    // Firm admins manage their own roles (create, set permissions, assign).
    // Lawyers never reach these endpoints (admin-panel gate).

    public function test_role_routes_exist_and_are_admin_only(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        [$firm2, $lawyer] = $this->createFirmAndUser(['role' => 'lawyer']);

        $this->actingAsUser($admin)->get('/admin/roles')->assertOk();
        $this->actingAsUser($lawyer)->get('/admin/roles')->assertForbidden();
        $this->actingAsUser($lawyer)->post('/admin/roles', [])->assertForbidden();
        $this->actingAsUser($lawyer)->put('/admin/roles/1', [])->assertForbidden();
        $this->actingAsUser($lawyer)->delete('/admin/roles/1')->assertForbidden();
    }
}
