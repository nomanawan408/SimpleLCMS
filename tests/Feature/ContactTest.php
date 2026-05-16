<?php

namespace Tests\Feature;

use App\Models\Contact;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ContactTest extends TestCase
{
    use RefreshDatabase;

    public function test_can_list_contacts(): void
    {
        [$firm, $user] = $this->createFirmAndUser();
        Contact::factory()->forFirm($firm)->count(5)->create();

        $this->actingAsUser($user)->get('/contacts')
            ->assertOk()
            ->assertInertia(fn ($page) => $page->where('contacts.total', 5));
    }

    public function test_can_create_individual_contact(): void
    {
        [$firm, $user] = $this->createFirmAndUser();

        $this->actingAsUser($user)->post('/contacts', [
            'type'  => 'individual',
            'name'  => 'Jane Doe',
            'email' => 'jane@example.com',
            'phone' => '07700900000',
        ])->assertRedirect();

        $this->assertDatabaseHas('contacts', [
            'firm_id' => $firm->id,
            'name'    => 'Jane Doe',
            'type'    => 'individual',
        ]);
    }

    public function test_can_update_contact(): void
    {
        [$firm, $user] = $this->createFirmAndUser();
        $contact = Contact::factory()->forFirm($firm)->create(['name' => 'Old Name']);

        $this->actingAsUser($user)->patch("/contacts/{$contact->id}", [
            'type'  => 'individual',
            'name'  => 'New Name',
            'email' => $contact->email,
        ])->assertRedirect();

        $this->assertDatabaseHas('contacts', ['id' => $contact->id, 'name' => 'New Name']);
    }

    public function test_can_delete_contact(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $contact = Contact::factory()->forFirm($firm)->create();

        $this->actingAsUser($admin)->delete("/contacts/{$contact->id}")
            ->assertRedirect();

        $this->assertSoftDeleted('contacts', ['id' => $contact->id]);
    }

    public function test_solicitor_cannot_delete_contact(): void
    {
        [$firm, $user] = $this->createFirmAndUser(['role' => 'solicitor']);
        $contact = Contact::factory()->forFirm($firm)->create();

        $this->actingAsUser($user)->delete("/contacts/{$contact->id}")
            ->assertStatus(403);
    }

    public function test_duplicate_contact_warning_returned(): void
    {
        [$firm, $user] = $this->createFirmAndUser();
        Contact::factory()->forFirm($firm)->create(['name' => 'Jane Doe', 'email' => 'jane@example.com']);

        $this->actingAsUser($user)->post('/contacts', [
            'type'  => 'individual',
            'name'  => 'Jane Doe',
            'email' => 'jane@example.com',
        ])->assertSessionHasErrors('duplicate');
    }

    public function test_contact_firm_isolation(): void
    {
        [$firm,  $user]  = $this->createFirmAndUser();
        [$firm2, $user2] = $this->createFirmAndUser();
        Contact::factory()->forFirm($firm2)->count(3)->create();

        $this->actingAsUser($user)->get('/contacts')
            ->assertOk()
            ->assertInertia(fn ($page) => $page->where('contacts.total', 0));
    }
}
