<?php

namespace Tests\Feature;

use App\Models\Contact;
use App\Models\Document;
use App\Models\Firm;
use App\Models\Matter;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class SuperAdminFirmTest extends TestCase
{
    use RefreshDatabase;

    private function superAdmin(): User
    {
        $user = User::factory()->create(['role' => 'super_admin', 'is_active' => true]);
        $user->assignRole('super_admin');

        return $user;
    }

    /** The edit dialog writes back every field, so the index must send them all. */
    public function test_firm_index_sends_every_editable_field(): void
    {
        $firm = Firm::factory()->create([
            'address_line1' => '1 Chancery Lane',
            'postcode' => 'WC2A 1LF',
            'timezone' => 'Europe/Dublin',
            'default_hourly_rate' => 325,
            'vat_rate' => 23,
        ]);

        $this->actingAsUser($this->superAdmin())
            ->get('/superadmin/firms')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->has('firms.0.address_line1')
                ->has('firms.0.postcode')
                ->has('firms.0.timezone')
                ->has('firms.0.default_hourly_rate')
                ->has('firms.0.vat_rate'));
    }

    public function test_updating_a_firm_persists_every_field(): void
    {
        $firm = Firm::factory()->create(['timezone' => 'Europe/London', 'vat_rate' => 20]);

        $this->actingAsUser($this->superAdmin())
            ->put("/superadmin/firms/{$firm->id}", [
                'name' => 'Renamed LLP',
                'address_line1' => '2 Fleet Street',
                'city' => 'London',
                'postcode' => 'EC4A 2AB',
                'timezone' => 'Europe/Dublin',
                'default_hourly_rate' => 400,
                'vat_rate' => 23,
            ])->assertRedirect();

        $firm->refresh();
        $this->assertSame('Renamed LLP', $firm->name);
        $this->assertSame('2 Fleet Street', $firm->address_line1);
        $this->assertSame('EC4A 2AB', $firm->postcode);
        $this->assertSame('Europe/Dublin', $firm->timezone);
        $this->assertSame('400.00', (string) $firm->default_hourly_rate);
        $this->assertSame('23.00', (string) $firm->vat_rate);
    }

    /**
     * roles.firm_id is nullOnDelete and a null firm_id marks a role as
     * platform-wide, so deleting a firm used to hand its private roles to
     * every other firm.
     */
    public function test_deleting_a_firm_removes_its_custom_roles(): void
    {
        $firm = Firm::factory()->create();
        $role = Role::create([
            'name' => 'Costs Draftsman', 'guard_name' => 'web',
            'firm_id' => $firm->id, 'is_system' => false,
        ]);

        $this->actingAsUser($this->superAdmin())
            ->delete("/superadmin/firms/{$firm->id}")
            ->assertRedirect();

        $this->assertDatabaseMissing('roles', ['id' => $role->id]);
        $this->assertDatabaseMissing('roles', ['name' => 'Costs Draftsman', 'firm_id' => null]);
    }

    public function test_deleting_a_firm_removes_its_data_and_document_files(): void
    {
        $firm = Firm::factory()->create();
        $user = User::factory()->forFirm($firm)->create();
        $matter = Matter::factory()->create(['firm_id' => $firm->id]);
        Contact::factory()->create(['firm_id' => $firm->id]);

        $key = 'documents/'.$firm->id.'/file.pdf';
        Storage::disk('local')->put($key, '%PDF-1.4');
        Document::create([
            'firm_id' => $firm->id, 'matter_id' => $matter->id, 'uploaded_by_id' => $user->id,
            'name' => 'f.pdf', 'original_name' => 'f.pdf', 's3_key' => $key,
            'folder' => 'General', 'mime_type' => 'application/pdf', 'size_bytes' => 8, 'version' => 1,
        ]);

        $this->actingAsUser($this->superAdmin())
            ->delete("/superadmin/firms/{$firm->id}")
            ->assertRedirect();

        $this->assertDatabaseMissing('firms', ['id' => $firm->id]);
        $this->assertDatabaseMissing('users', ['id' => $user->id]);
        $this->assertDatabaseMissing('matters', ['id' => $matter->id]);
        $this->assertFalse(Storage::disk('local')->exists($key), 'the document file should not be orphaned');
    }

    public function test_only_super_admins_reach_firm_management(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();

        $this->actingAsUser($admin)->get('/superadmin/firms')->assertStatus(403);
        $this->actingAsUser($admin)->delete("/superadmin/firms/{$firm->id}")->assertStatus(403);
        $this->assertDatabaseHas('firms', ['id' => $firm->id]);
    }
}
