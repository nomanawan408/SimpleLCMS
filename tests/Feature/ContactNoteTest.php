<?php

namespace Tests\Feature;

use App\Models\Contact;
use App\Models\Note;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ContactNoteTest extends TestCase
{
    use RefreshDatabase;

    public function test_can_add_a_note_to_a_contact(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $contact = Contact::factory()->create(['firm_id' => $firm->id]);

        $this->actingAsUser($admin)->postJson("/contacts/{$contact->id}/notes", [
            'body' => 'Client called about the completion date.',
            'type' => 'call_log',
        ])->assertOk();

        $this->assertDatabaseHas('notes', [
            'contact_id' => $contact->id,
            'matter_id' => null,
            'type' => 'call_log',
            'user_id' => $admin->id,
        ]);
    }

    public function test_notes_appear_on_the_contact_page(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $contact = Contact::factory()->create(['firm_id' => $firm->id]);

        Note::create([
            'firm_id' => $firm->id, 'contact_id' => $contact->id, 'user_id' => $admin->id,
            'body' => 'Initial enquiry taken.', 'type' => 'note', 'logged_at' => now(),
        ]);

        $this->actingAsUser($admin)
            ->get("/contacts/{$contact->id}")
            ->assertOk()
            ->assertSee('Initial enquiry taken.', false);
    }

    public function test_can_edit_and_delete_own_note(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $contact = Contact::factory()->create(['firm_id' => $firm->id]);
        $note = Note::create([
            'firm_id' => $firm->id, 'contact_id' => $contact->id, 'user_id' => $admin->id,
            'body' => 'Typo heer', 'type' => 'note', 'logged_at' => now(),
        ]);

        $this->actingAsUser($admin)
            ->putJson("/contacts/{$contact->id}/notes/{$note->id}", ['body' => 'Typo here'])
            ->assertOk();
        $this->assertSame('Typo here', $note->fresh()->body);

        $this->actingAsUser($admin)
            ->deleteJson("/contacts/{$contact->id}/notes/{$note->id}")
            ->assertOk();
        $this->assertSoftDeleted('notes', ['id' => $note->id]);
    }

    public function test_an_unknown_note_type_is_rejected(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $contact = Contact::factory()->create(['firm_id' => $firm->id]);

        $this->actingAsUser($admin)->postJson("/contacts/{$contact->id}/notes", [
            'body' => 'x', 'type' => 'smoke_signal',
        ])->assertStatus(422)->assertJsonValidationErrors('type');
    }

    public function test_note_must_belong_to_the_contact_in_the_url(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $contact = Contact::factory()->create(['firm_id' => $firm->id]);
        $other = Contact::factory()->create(['firm_id' => $firm->id]);
        $note = Note::create([
            'firm_id' => $firm->id, 'contact_id' => $other->id, 'user_id' => $admin->id,
            'body' => 'Other contact', 'type' => 'note', 'logged_at' => now(),
        ]);

        $this->actingAsUser($admin)
            ->deleteJson("/contacts/{$contact->id}/notes/{$note->id}")
            ->assertStatus(404);
    }

    public function test_another_firm_cannot_reach_the_contact_or_its_notes(): void
    {
        [$firmA, $adminA] = $this->createFirmAndAdmin();
        $contactA = Contact::factory()->create(['firm_id' => $firmA->id]);

        [$firmB, $adminB] = $this->createFirmAndAdmin();

        $this->actingAsUser($adminB)
            ->postJson("/contacts/{$contactA->id}/notes", ['body' => 'Recon'])
            ->assertStatus(404);

        $this->assertSame(0, Note::count());
    }

    /** A note is someone's own record; a colleague without manage_contacts may not rewrite it. */
    public function test_another_users_note_cannot_be_edited_without_manage_contacts(): void
    {
        [$firm, $author] = $this->createFirmAndAdmin();
        $contact = Contact::factory()->create(['firm_id' => $firm->id]);
        $note = Note::create([
            'firm_id' => $firm->id, 'contact_id' => $contact->id, 'user_id' => $author->id,
            'body' => 'Author note', 'type' => 'note', 'logged_at' => now(),
        ]);

        $colleague = \App\Models\User::factory()->forFirm($firm)->create();
        $colleague->syncRoles([]);
        $colleague->syncPermissions(['view_contacts', 'edit_contacts']);

        $this->actingAsUser($colleague->fresh())
            ->putJson("/contacts/{$contact->id}/notes/{$note->id}", ['body' => 'Rewritten'])
            ->assertStatus(403);

        $this->assertSame('Author note', $note->fresh()->body);
    }
}
