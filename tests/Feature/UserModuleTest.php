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
        [$firm, $user] = $this->createFirmAndUser(['role' => 'solicitor']);

        $this->actingAsUser($user)
            ->get('/admin/users')
            ->assertStatus(403);
    }

    public function test_users_index_returns_firm_scoped_users(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();

        $otherFirm = Firm::factory()->create();
        $otherUser = User::factory()->forFirm($otherFirm)->create(['role' => 'solicitor']);

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
            'role'                  => 'solicitor',
        ])->assertRedirect(route('admin.users.index'));

        $this->assertDatabaseHas('users', [
            'firm_id'   => $firm->id,
            'email'     => 'new@lawfirm.co.uk',
            'full_name' => 'New Solicitor',
            'role'      => 'solicitor',
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
            'role'                  => 'solicitor',
        ]);

        $user = User::where('email', 'solicitor@lawfirm.co.uk')->first();
        $this->assertNotNull($user);
        $this->assertTrue($user->hasRole('solicitor'));
    }

    public function test_create_user_requires_full_name(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();

        $this->actingAsUser($admin)->post('/admin/users', [
            'email'                 => 'test@test.com',
            'password'              => 'Password123!',
            'password_confirmation' => 'Password123!',
            'role'                  => 'solicitor',
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
            'role'                  => 'solicitor',
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
            'role'                  => 'solicitor',
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
            'role'                  => 'solicitor',
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
            'role'                  => 'solicitor',
        ])->assertSessionHasErrors('email');
    }

    public function test_same_email_allowed_in_different_firms(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();

        $otherFirm = Firm::factory()->create();
        User::factory()->forFirm($otherFirm)->create(['email' => 'shared@email.com']);

        $this->actingAsUser($admin)->post('/admin/users', [
            'full_name'             => 'Same Email',
            'email'                 => 'shared@email.com',
            'password'              => 'Password123!',
            'password_confirmation' => 'Password123!',
            'role'                  => 'solicitor',
        ])->assertRedirect();

        $this->assertDatabaseHas('users', ['email' => 'shared@email.com', 'firm_id' => $firm->id]);
    }

    public function test_create_user_with_optional_fields(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();

        $this->actingAsUser($admin)->post('/admin/users', [
            'full_name'             => 'Full User',
            'email'                 => 'full@lawfirm.co.uk',
            'password'              => 'Password123!',
            'password_confirmation' => 'Password123!',
            'role'                  => 'solicitor',
            'phone'                 => '+44 7700 123456',
            'rate_per_hour'         => 150.00,
        ])->assertRedirect();

        $this->assertDatabaseHas('users', [
            'email'         => 'full@lawfirm.co.uk',
            'phone'         => '+44 7700 123456',
        ]);
    }

    // ── User Update ─────────────────────────────────────────────

    public function test_admin_can_update_user_role(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $user = User::factory()->forFirm($firm)->create(['role' => 'solicitor']);
        $user->assignRole('solicitor');

        $this->actingAsUser($admin)->put("/admin/users/{$user->id}", [
            'role' => 'clerk',
        ])->assertRedirect();

        $this->assertDatabaseHas('users', ['id' => $user->id, 'role' => 'clerk']);
    }

    public function test_update_syncs_spatie_role(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $user = User::factory()->forFirm($firm)->create(['role' => 'solicitor']);
        $user->assignRole('solicitor');

        $this->actingAsUser($admin)->put("/admin/users/{$user->id}", [
            'role' => 'clerk',
        ]);

        $user->refresh();
        $this->assertTrue($user->hasRole('clerk'));
        $this->assertFalse($user->hasRole('solicitor'));
    }

    public function test_admin_can_deactivate_user(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $user = User::factory()->forFirm($firm)->create(['role' => 'solicitor', 'is_active' => true]);
        $user->assignRole('solicitor');

        $this->actingAsUser($admin)->put("/admin/users/{$user->id}", [
            'is_active' => false,
        ])->assertRedirect();

        $this->assertDatabaseHas('users', ['id' => $user->id, 'is_active' => false]);
    }

    public function test_admin_can_update_rate_per_hour(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $user = User::factory()->forFirm($firm)->create(['role' => 'solicitor', 'rate_per_hour' => 100]);
        $user->assignRole('solicitor');

        $this->actingAsUser($admin)->put("/admin/users/{$user->id}", [
            'rate_per_hour' => 200,
        ])->assertRedirect();

        $this->assertDatabaseHas('users', ['id' => $user->id, 'rate_per_hour' => '200.00']);
    }

    public function test_cannot_update_user_from_another_firm(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();

        $otherFirm = Firm::factory()->create();
        $otherUser = User::factory()->forFirm($otherFirm)->create(['role' => 'solicitor']);

        $this->actingAsUser($admin)->put("/admin/users/{$otherUser->id}", [
            'role' => 'clerk',
        ])->assertStatus(403);
    }

    // ── Role Index ──────────────────────────────────────────────

    public function test_admin_can_view_roles_index(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();

        $this->actingAsUser($admin)
            ->get('/admin/roles')
            ->assertStatus(200);
    }

    public function test_roles_index_returns_grouped_permissions(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();

        $this->actingAsUser($admin)
            ->get('/admin/roles')
            ->assertInertia(fn ($page) =>
                $page->component('Admin/Roles/Index')
                    ->has('groupedPermissions')
                    ->has('roles')
            );
    }

    // ── Role Create / Store ─────────────────────────────────────

    public function test_admin_can_create_custom_role(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();

        $this->actingAsUser($admin)->post('/admin/roles', [
            'name'        => 'junior_associate',
            'description' => 'Junior associate with limited access',
            'permissions' => ['view_dashboard', 'view_matters', 'view_contacts'],
        ])->assertRedirect(route('admin.roles.index'));

        $this->assertDatabaseHas('roles', [
            'name'    => 'junior_associate',
            'firm_id' => $firm->id,
        ]);
    }

    public function test_created_role_has_permissions_assigned(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();

        $this->actingAsUser($admin)->post('/admin/roles', [
            'name'        => 'custom_role',
            'description' => 'Custom role',
            'permissions' => ['view_dashboard', 'view_matters', 'view_contacts'],
        ]);

        $role = Role::where('name', 'custom_role')->first();
        $this->assertNotNull($role);
        $this->assertTrue($role->hasPermissionTo('view_dashboard'));
        $this->assertTrue($role->hasPermissionTo('view_matters'));
        $this->assertTrue($role->hasPermissionTo('view_contacts'));
    }

    public function test_create_role_requires_name(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();

        $this->actingAsUser($admin)->post('/admin/roles', [
            'description' => 'Missing name',
            'permissions' => ['view_dashboard'],
        ])->assertSessionHasErrors('name');
    }

    public function test_create_role_requires_permissions(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();

        $this->actingAsUser($admin)->post('/admin/roles', [
            'name'        => 'no_perms',
            'description' => 'No permissions',
            'permissions' => [],
        ])->assertSessionHasErrors('permissions');
    }

    public function test_create_role_rejects_invalid_permissions(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();

        $this->actingAsUser($admin)->post('/admin/roles', [
            'name'        => 'bad_perms',
            'description' => 'Bad permissions',
            'permissions' => ['nonexistent_permission'],
        ])->assertSessionHasErrors('permissions.0');
    }

    public function test_create_role_rejects_duplicate_name_in_firm(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();

        $this->actingAsUser($admin)->post('/admin/roles', [
            'name'        => 'duplicate_role',
            'description' => 'First',
            'permissions' => ['view_dashboard'],
        ])->assertRedirect();

        $this->actingAsUser($admin)->post('/admin/roles', [
            'name'        => 'duplicate_role',
            'description' => 'Second',
            'permissions' => ['view_matters'],
        ])->assertSessionHasErrors('name');
    }

    // ── Role Update ─────────────────────────────────────────────

    public function test_admin_can_update_custom_role(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();

        $role = Role::create([
            'name'       => 'old_name',
            'guard_name' => 'web',
            'firm_id'    => $firm->id,
            'is_system'  => false,
        ]);
        $role->syncPermissions(['view_dashboard']);

        $this->actingAsUser($admin)->put("/admin/roles/{$role->id}", [
            'name'        => 'new_name',
            'description' => 'Updated description',
            'permissions' => ['view_dashboard', 'view_matters'],
        ])->assertRedirect();

        $role->refresh();
        $this->assertEquals('new_name', $role->name);
        $this->assertEquals('Updated description', $role->description);
        $this->assertTrue($role->hasPermissionTo('view_matters'));
    }

    public function test_cannot_update_builtin_admin_role(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();

        $adminRole = Role::where('name', 'admin')->first();

        $this->actingAsUser($admin)->put("/admin/roles/{$adminRole->id}", [
            'name'        => 'changed_admin',
            'description' => 'Trying to change',
            'permissions' => ['view_dashboard'],
        ])->assertSessionHasErrors('name');
    }

    public function test_cannot_update_builtin_super_admin_role(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();

        $superRole = Role::where('name', 'super_admin')->first();

        $this->actingAsUser($admin)->put("/admin/roles/{$superRole->id}", [
            'name'        => 'changed_super',
            'description' => 'Trying to change',
            'permissions' => ['view_dashboard'],
        ])->assertSessionHasErrors('name');
    }

    public function test_cannot_update_role_from_another_firm(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();

        $otherFirm = Firm::factory()->create();
        $otherRole = Role::create([
            'name'       => 'other_firm_role',
            'guard_name' => 'web',
            'firm_id'    => $otherFirm->id,
            'is_system'  => false,
        ]);

        $this->actingAsUser($admin)->put("/admin/roles/{$otherRole->id}", [
            'name'        => 'hijacked',
            'description' => 'Attempting cross-firm edit',
            'permissions' => ['view_dashboard'],
        ])->assertStatus(403);
    }

    // ── Role Delete ─────────────────────────────────────────────

    public function test_admin_can_delete_custom_role(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();

        $role = Role::create([
            'name'       => 'deletable_role',
            'guard_name' => 'web',
            'firm_id'    => $firm->id,
            'is_system'  => false,
        ]);

        $this->actingAsUser($admin)
            ->delete("/admin/roles/{$role->id}")
            ->assertRedirect(route('admin.roles.index'));

        $this->assertDatabaseMissing('roles', ['id' => $role->id]);
    }

    public function test_cannot_delete_builtin_roles(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();

        $adminRole = Role::where('name', 'admin')->first();

        $this->actingAsUser($admin)
            ->delete("/admin/roles/{$adminRole->id}")
            ->assertSessionHasErrors('name');

        $this->assertDatabaseHas('roles', ['name' => 'admin']);
    }

    public function test_cannot_delete_role_from_another_firm(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();

        $otherFirm = Firm::factory()->create();
        $otherRole = Role::create([
            'name'       => 'protected_role',
            'guard_name' => 'web',
            'firm_id'    => $otherFirm->id,
            'is_system'  => false,
        ]);

        $this->actingAsUser($admin)
            ->delete("/admin/roles/{$otherRole->id}")
            ->assertStatus(403);

        $this->assertDatabaseHas('roles', ['id' => $otherRole->id]);
    }

    public function test_deleting_role_detaches_users(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();

        $role = Role::create([
            'name'       => 'temp_role',
            'guard_name' => 'web',
            'firm_id'    => $firm->id,
            'is_system'  => false,
        ]);

        $user = User::factory()->forFirm($firm)->create(['role' => 'solicitor']);
        $user->assignRole('temp_role');
        $this->assertTrue($user->hasRole('temp_role'));

        $this->actingAsUser($admin)->delete("/admin/roles/{$role->id}")->assertRedirect();

        $user->refresh();
        $this->assertFalse($user->hasRole('temp_role'));
    }

    // ── Role Assignment to Users ────────────────────────────────

    public function test_assigning_valid_role_to_user_via_update(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $user = User::factory()->forFirm($firm)->create(['role' => 'solicitor']);
        $user->assignRole('solicitor');

        $this->actingAsUser($admin)->put("/admin/users/{$user->id}", [
            'role' => 'admin',
        ])->assertRedirect();

        $user->refresh();
        $this->assertTrue($user->hasRole('admin'));
    }

    public function test_user_can_have_multiple_roles(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $user = User::factory()->forFirm($firm)->create(['role' => 'solicitor']);
        $user->assignRole('solicitor');
        $user->assignRole('paralegal');

        $this->assertTrue($user->hasRole('solicitor'));
        $this->assertTrue($user->hasRole('paralegal'));
    }

    // ── Valid enum roles in MySQL ───────────────────────────────

    public function test_all_valid_enum_roles_accepted(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();

        $validRoles = ['admin', 'administrator', 'solicitor', 'lawyer', 'barrister', 'clerk', 'consultant', 'manager', 'accounts'];

        foreach ($validRoles as $i => $role) {
            $this->actingAsUser($admin)->post('/admin/users', [
                'full_name'             => "User {$i}",
                'email'                 => "user{$i}@lawfirm.co.uk",
                'password'              => 'Password123!',
                'password_confirmation' => 'Password123!',
                'role'                  => $role,
            ])->assertRedirect();
        }

        $this->assertDatabaseCount('users', 1 + count($validRoles)); // 1 admin + N users
    }

    public function test_old_role_names_rejected_by_enum(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();

        $this->actingAsUser($admin)->post('/admin/users', [
            'full_name'             => 'Old Role',
            'email'                 => 'old@lawfirm.co.uk',
            'password'              => 'Password123!',
            'password_confirmation' => 'Password123!',
            'role'                  => 'firm_admin',
        ])->assertSessionHasErrors('role');
    }

    // ── Missing delete user route ───────────────────────────────

    public function test_admin_can_delete_user(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $user = User::factory()->forFirm($firm)->create(['role' => 'solicitor']);
        $user->assignRole('solicitor');

        $this->actingAsUser($admin)->delete("/admin/users/{$user->id}")
            ->assertRedirect();

        $this->assertSoftDeleted('users', ['id' => $user->id]);
    }

    public function test_admin_cannot_delete_themselves(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();

        $this->actingAsUser($admin)->delete("/admin/users/{$admin->id}")
            ->assertStatus(403);
    }

    public function test_admin_cannot_delete_user_from_another_firm(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();

        $otherFirm = Firm::factory()->create();
        $otherUser = User::factory()->forFirm($otherFirm)->create(['role' => 'solicitor']);

        $this->actingAsUser($admin)->delete("/admin/users/{$otherUser->id}")
            ->assertStatus(403);
    }

    // ── Inactive user cannot access admin ───────────────────────

    public function test_inactive_user_cannot_access_admin_users(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $admin->update(['is_active' => false]);

        $this->actingAsUser($admin)
            ->get('/admin/users')
            ->assertStatus(403);
    }

    // ── Role create/update authorizes with correct policy ───────

    public function test_role_controller_update_uses_correct_authorization(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();

        $role = Role::create([
            'name'       => 'test_role',
            'guard_name' => 'web',
            'firm_id'    => $firm->id,
            'is_system'  => false,
        ]);

        $response = $this->actingAsUser($admin)->put("/admin/roles/{$role->id}", [
            'name'        => 'test_role_updated',
            'description' => 'Updated',
            'permissions' => ['view_dashboard'],
        ]);

        $response->assertRedirect();
    }

    public function test_role_controller_delete_uses_correct_authorization(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();

        $role = Role::create([
            'name'       => 'deletable',
            'guard_name' => 'web',
            'firm_id'    => $firm->id,
            'is_system'  => false,
        ]);

        $response = $this->actingAsUser($admin)->delete("/admin/roles/{$role->id}");
        $response->assertRedirect();
    }
}
