<?php

namespace Tests\Feature;

use App\Models\Matter;
use App\Models\Note;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Matter notes are the timeline on the file. Editing mirrors
 * ContactNoteController: the matter permission + open-file gate comes from
 * MatterPolicy::update, and rewriting someone else's note is admin-only.
 */
class MatterNoteTest extends TestCase
{
    use RefreshDatabase;

    private function noteOn(Matter $matter, User $author, string $body = 'Client called.'): Note
    {
        return Note::create([
            'firm_id' => $matter->firm_id,
            'matter_id' => $matter->id,
            'contact_id' => null,
            'user_id' => $author->id,
            'body' => $body,
            'type' => 'note',
            'logged_at' => now(),
        ]);
    }

    public function test_can_add_a_note_to_a_matter(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $matter = Matter::factory()->forFirm($firm)->create();

        $this->actingAsUser($admin)->postJson("/matters/{$matter->id}/notes", [
            'body' => 'Client called about the completion date.',
            'type' => 'call_log',
        ])->assertOk();

        $this->assertDatabaseHas('notes', [
            'matter_id' => $matter->id,
            'contact_id' => null,
            'type' => 'call_log',
            'user_id' => $admin->id,
        ]);
    }

    public function test_can_edit_and_delete_own_note(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $matter = Matter::factory()->forFirm($firm)->create();
        $note = $this->noteOn($matter, $admin, 'Typo heer');

        $this->actingAsUser($admin)
            ->putJson("/matters/{$matter->id}/notes/{$note->id}", ['body' => 'Typo here'])
            ->assertOk();
        $this->assertSame('Typo here', $note->fresh()->body);

        $this->actingAsUser($admin)
            ->deleteJson("/matters/{$matter->id}/notes/{$note->id}")
            ->assertOk();
        $this->assertSoftDeleted('notes', ['id' => $note->id]);
    }

    public function test_an_unknown_note_type_is_rejected(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $matter = Matter::factory()->forFirm($firm)->create();

        $this->actingAsUser($admin)->postJson("/matters/{$matter->id}/notes", [
            'body' => 'x',
            'type' => 'smoke_signal',
        ])->assertStatus(422)->assertJsonValidationErrors('type');
    }

    public function test_note_must_belong_to_the_matter_in_the_url(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $matter = Matter::factory()->forFirm($firm)->create();
        $other = Matter::factory()->forFirm($firm)->create();
        $note = $this->noteOn($other, $admin, 'Other matter');

        $this->actingAsUser($admin)
            ->putJson("/matters/{$matter->id}/notes/{$note->id}", ['body' => 'Rewritten'])
            ->assertStatus(404);

        $this->assertSame('Other matter', $note->fresh()->body);
    }

    public function test_another_firm_cannot_reach_the_matter_or_its_notes(): void
    {
        [$firmA, $adminA] = $this->createFirmAndAdmin();
        $matterA = Matter::factory()->forFirm($firmA)->create();
        $noteA = $this->noteOn($matterA, $adminA);

        [$firmB, $adminB] = $this->createFirmAndAdmin();

        $this->actingAsUser($adminB)
            ->postJson("/matters/{$matterA->id}/notes", ['body' => 'Recon'])
            ->assertStatus(404);

        $this->actingAsUser($adminB)
            ->putJson("/matters/{$matterA->id}/notes/{$noteA->id}", ['body' => 'Rewritten'])
            ->assertStatus(404);

        $this->assertSame('Client called.', $noteA->fresh()->body);
    }

    /** A note is someone's own record; an assigned colleague may not rewrite it. */
    public function test_colleague_cannot_rewrite_another_users_note(): void
    {
        [$firm, $author] = $this->createFirmAndAdmin();
        $matter = Matter::factory()->forFirm($firm)->create();
        $note = $this->noteOn($matter, $author, 'Author note');

        $colleague = User::factory()->forFirm($firm)->create(['role' => 'lawyer']);
        $this->assignFirmRole($colleague, 'lawyer');
        $this->assignToMatter($colleague, $matter);

        $this->actingAsUser($colleague->fresh())
            ->putJson("/matters/{$matter->id}/notes/{$note->id}", ['body' => 'Rewritten'])
            ->assertStatus(403);

        $this->actingAsUser($colleague->fresh())
            ->deleteJson("/matters/{$matter->id}/notes/{$note->id}")
            ->assertStatus(403);

        $this->assertSame('Author note', $note->fresh()->body);
        $this->assertNull($note->fresh()->deleted_at);
    }

    public function test_firm_admin_can_edit_a_colleagues_note(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $matter = Matter::factory()->forFirm($firm)->create();

        $lawyer = User::factory()->forFirm($firm)->create(['role' => 'lawyer']);
        $this->assignFirmRole($lawyer, 'lawyer');
        $note = $this->noteOn($matter, $lawyer, 'Lawyer note');

        $this->actingAsUser($admin)
            ->putJson("/matters/{$matter->id}/notes/{$note->id}", ['body' => 'Tidied up'])
            ->assertOk();

        $this->assertSame('Tidied up', $note->fresh()->body);
    }

    /** Closed files are a read-only archive: the policy freezes note edits too. */
    public function test_closed_matter_notes_are_frozen_for_lawyers(): void
    {
        [$firm, $lawyer] = $this->createFirmAndUser(['role' => 'lawyer']);
        $matter = Matter::factory()->forFirm($firm)->create(['status' => 'closed']);
        $this->assignToMatter($lawyer, $matter);
        $note = $this->noteOn($matter, $lawyer, 'Before closing');

        $this->actingAsUser($lawyer)
            ->putJson("/matters/{$matter->id}/notes/{$note->id}", ['body' => 'Sneaky edit'])
            ->assertForbidden();

        $this->actingAsUser($lawyer)
            ->deleteJson("/matters/{$matter->id}/notes/{$note->id}")
            ->assertForbidden();

        $this->assertSame('Before closing', $note->fresh()->body);
    }

    public function test_firm_admin_can_edit_notes_on_a_closed_matter(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $matter = Matter::factory()->forFirm($firm)->create(['status' => 'closed']);
        $note = $this->noteOn($matter, $admin, 'Archived note');

        $this->actingAsUser($admin)
            ->putJson("/matters/{$matter->id}/notes/{$note->id}", ['body' => 'Corrected archive note'])
            ->assertOk();

        $this->assertSame('Corrected archive note', $note->fresh()->body);
    }
}
