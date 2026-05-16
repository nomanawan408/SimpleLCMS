<?php

namespace Tests\Feature;

use App\Models\Contact;
use App\Models\Matter;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MatterTest extends TestCase
{
    use RefreshDatabase;

    public function test_can_list_matters(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        Matter::factory()->forFirm($firm, $admin)->count(3)->create();

        $this->actingAsUser($admin)->get('/matters')
            ->assertOk()
            ->assertInertia(fn ($page) => $page->where('matters.total', 3));
    }

    public function test_can_create_matter(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $contact = Contact::factory()->forFirm($firm)->create();

        $this->actingAsUser($admin)->post('/matters', [
            'name'                => 'Smith v Jones',
            'practice_area'       => 'litigation',
            'fee_arrangement'     => 'hourly_rate',
            'responsible_user_id' => $admin->id,
            'contact_ids'         => [$contact->id],
        ])->assertRedirect();

        $this->assertDatabaseHas('matters', [
            'firm_id' => $firm->id,
            'name'    => 'Smith v Jones',
        ]);
    }

    public function test_paralegal_cannot_create_matter(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $paralegal = User::factory()->forFirm($firm)->create(['role' => 'paralegal']);
        $contact   = Contact::factory()->forFirm($firm)->create();

        $this->actingAsUser($paralegal)->post('/matters', [
            'name'                => 'Test Matter',
            'practice_area'       => 'litigation',
            'fee_arrangement'     => 'hourly_rate',
            'responsible_user_id' => $admin->id,
            'contact_ids'         => [$contact->id],
        ])->assertStatus(403);
    }

    public function test_can_update_matter(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $matter = Matter::factory()->forFirm($firm, $admin)->create(['name' => 'Old Name']);

        $this->actingAsUser($admin)->patch("/matters/{$matter->id}", [
            'name'                => 'New Name',
            'practice_area'       => 'family_law',
            'fee_arrangement'     => 'fixed_fee',
            'responsible_user_id' => $admin->id,
        ])->assertRedirect();

        $this->assertDatabaseHas('matters', ['id' => $matter->id, 'name' => 'New Name']);
    }

    public function test_only_firm_admin_can_delete_matter(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $solicitor = User::factory()->forFirm($firm)->create(['role' => 'solicitor']);
        $matter    = Matter::factory()->forFirm($firm, $admin)->create();

        $this->actingAsUser($solicitor)->delete("/matters/{$matter->id}")
            ->assertStatus(403);

        $this->actingAsUser($admin)->delete("/matters/{$matter->id}")
            ->assertRedirect();

        $this->assertSoftDeleted('matters', ['id' => $matter->id]);
    }

    public function test_matter_firm_isolation(): void
    {
        [$firm,  $admin]  = $this->createFirmAndAdmin();
        [$firm2, $admin2] = $this->createFirmAndAdmin();
        Matter::factory()->forFirm($firm2, $admin2)->count(2)->create();

        $this->actingAsUser($admin)->get('/matters')
            ->assertOk()
            ->assertInertia(fn ($page) => $page->where('matters.total', 0));
    }
}
