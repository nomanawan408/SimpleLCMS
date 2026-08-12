<?php

namespace Tests\Feature;

use App\Models\Firm;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class BackupTest extends TestCase
{
    use RefreshDatabase;

    protected function superAdminUser(): User
    {
        $user = User::factory()->create([
            'role' => 'super_admin',
            'is_active' => true,
        ]);
        $user->assignRole('super_admin');
        return $user;
    }

    public function test_non_super_admin_cannot_access_backups(): void
    {
        [$firm, $user] = $this->createFirmAndUser(['role' => 'solicitor']);

        $this->actingAsUser($user)->get('/superadmin/backups')->assertForbidden();
        $this->actingAsUser($user)->post('/superadmin/backups')->assertForbidden();
        $this->actingAsUser($user)->post('/superadmin/backups/restore', [
            'backup_file' => null,
        ])->assertForbidden();
    }

    public function test_super_admin_can_view_backup_index(): void
    {
        $user = $this->superAdminUser();

        $this->actingAsUser($user)->get('/superadmin/backups')->assertOk();
    }

    public function test_super_admin_can_download_backup_file(): void
    {
        $user = $this->superAdminUser();

        $path = storage_path('app/backups/testfile-12345678.tar.gz');
        file_put_contents($path, 'test');

        try {
            $this->actingAsUser($user)
                ->get('/superadmin/backups/testfile-12345678.tar.gz')
                ->assertOk()
                ->assertDownload('testfile-12345678.tar.gz');
        } finally {
            @unlink($path);
        }
    }

    public function test_non_super_admin_cannot_download_backup(): void
    {
        [$firm, $user] = $this->createFirmAndUser(['role' => 'solicitor']);

        $this->actingAsUser($user)
            ->get('/superadmin/backups/testfile-12345678.tar.gz')
            ->assertForbidden();
    }
}