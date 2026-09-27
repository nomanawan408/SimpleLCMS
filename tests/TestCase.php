<?php

namespace Tests;

use App\Models\Firm;
use App\Models\User;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;

abstract class TestCase extends BaseTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutMiddleware([
            \Illuminate\Foundation\Http\Middleware\PreventRequestForgery::class,
        ]);

        config(['inertia.testing.ensure_pages_exist' => false]);

        $this->seedRolesAndPermissions();
    }

    protected function seedRolesAndPermissions(): void
    {
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        // Three-role world: lawyers carry no permissions by default. Visibility
        // comes from matter assignment; money visibility from the two grants
        // below, handed out per user by firm admins.
        foreach (['view_finances', 'manage_finances'] as $permission) {
            Permission::firstOrCreate(['name' => $permission, 'guard_name' => 'web']);
        }

        $superAdmin = Role::firstOrCreate(['name' => 'super_admin', 'guard_name' => 'web']);
        $superAdmin->update(['is_system' => true]);
        $superAdmin->syncPermissions(Permission::all());

        $firmAdmin = Role::firstOrCreate(['name' => 'firm_admin', 'guard_name' => 'web']);
        $firmAdmin->update(['is_system' => true]);
        $firmAdmin->syncPermissions(Permission::all());

        $lawyer = Role::firstOrCreate(['name' => 'lawyer', 'guard_name' => 'web']);
        $lawyer->update(['is_system' => true]);
        $lawyer->syncPermissions([]);
    }

    protected function createFirmAndAdmin(array $firmAttrs = [], array $userAttrs = []): array
    {
        $firm  = Firm::factory()->create($firmAttrs);
        $admin = User::factory()->firmAdmin()->forFirm($firm)->create($userAttrs);
        $admin->assignRole('firm_admin');
        return [$firm, $admin];
    }

    protected function createFirmAndUser(array $userAttrs = []): array
    {
        $firm = Firm::factory()->create();
        $user = User::factory()->forFirm($firm)->create($userAttrs);
        $role = $user->role;
        if (Role::where('name', $role)->exists()) {
            $user->assignRole($role);
        }
        return [$firm, $user];
    }

    /**
     * Assign a user to a matter (the visibility gate for non-admins).
     */
    protected function assignToMatter(User $user, \App\Models\Matter $matter): void
    {
        $matter->assignees()->syncWithoutDetaching([$user->id]);
    }

    /**
     * Grant financial access. $manage implies view (both flags are set).
     */
    protected function grantFinances(User $user, bool $manage = false): void
    {
        $user->givePermissionTo($manage ? ['view_finances', 'manage_finances'] : ['view_finances']);
    }

    protected function actingAsUser(User $user): static
    {
        $this->actingAs($user);
        session(['totp_verified' => true]);
        return $this;
    }
}
