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

    /** Documents on a contact are the documents of the matters they are on. */
    public function test_contact_documents_come_from_their_matters(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $contact = Contact::factory()->create(['firm_id' => $firm->id]);
        $matter = \App\Models\Matter::factory()->create(['firm_id' => $firm->id]);
        $matter->contacts()->attach($contact->id, ['role' => 'client']);

        \App\Models\Document::create([
            'firm_id' => $firm->id, 'matter_id' => $matter->id, 'uploaded_by_id' => $admin->id,
            'name' => 'engagement-letter.pdf', 'original_name' => 'engagement-letter.pdf',
            's3_key' => 'documents/x.pdf', 'folder' => 'General',
            'mime_type' => 'application/pdf', 'size_bytes' => 2048, 'version' => 1,
        ]);

        // A document on an unrelated matter must not appear.
        $otherMatter = \App\Models\Matter::factory()->create(['firm_id' => $firm->id]);
        \App\Models\Document::create([
            'firm_id' => $firm->id, 'matter_id' => $otherMatter->id, 'uploaded_by_id' => $admin->id,
            'name' => 'unrelated.pdf', 'original_name' => 'unrelated.pdf',
            's3_key' => 'documents/y.pdf', 'folder' => 'General',
            'mime_type' => 'application/pdf', 'size_bytes' => 1024, 'version' => 1,
        ]);

        $this->actingAsUser($admin)
            ->get("/contacts/{$contact->id}")
            ->assertOk()
            ->assertSee('engagement-letter.pdf', false)
            ->assertDontSee('unrelated.pdf', false);
    }

    /** Without view_documents the tab is not offered and no files are sent. */
    public function test_documents_are_withheld_without_the_permission(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $contact = Contact::factory()->create(['firm_id' => $firm->id]);
        $matter = \App\Models\Matter::factory()->create(['firm_id' => $firm->id]);
        $matter->contacts()->attach($contact->id, ['role' => 'client']);

        \App\Models\Document::create([
            'firm_id' => $firm->id, 'matter_id' => $matter->id, 'uploaded_by_id' => $admin->id,
            'name' => 'private.pdf', 'original_name' => 'private.pdf',
            's3_key' => 'documents/z.pdf', 'folder' => 'General',
            'mime_type' => 'application/pdf', 'size_bytes' => 10, 'version' => 1,
        ]);

        $admin->syncRoles([]);
        $admin->syncPermissions(['view_contacts', 'edit_contacts']);

        $this->actingAsUser($admin->fresh())
            ->get("/contacts/{$contact->id}")
            ->assertOk()
            ->assertDontSee('private.pdf', false);
    }
}
