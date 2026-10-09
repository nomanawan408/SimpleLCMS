<?php

namespace Tests\Feature;

use App\Models\Document;
use App\Models\Matter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class DocumentTest extends TestCase
{
    use RefreshDatabase;

    public function test_can_upload_document(): void
    {
        Storage::fake('local');
        [$firm, $user] = $this->createFirmAndUser();
        $matter = Matter::factory()->forFirm($firm, $user)->create();

        $file = UploadedFile::fake()->create('contract.pdf', 100, 'application/pdf');

        $this->actingAsUser($user)->post('/documents', [
            'file'              => $file,
            'matter_id'         => $matter->id,
            'folder'            => 'Contracts',
            'is_client_visible' => false,
        ])->assertRedirect();

        $this->assertDatabaseHas('documents', [
            'firm_id'   => $firm->id,
            'matter_id' => $matter->id,
            'folder'    => 'Contracts',
        ]);
    }

    public function test_matter_id_is_required_for_upload(): void
    {
        Storage::fake('local');
        [$firm, $user] = $this->createFirmAndUser();

        $file = UploadedFile::fake()->create('doc.pdf', 50, 'application/pdf');

        $this->actingAsUser($user)->post('/documents', [
            'file' => $file,
        ])->assertSessionHasErrors('matter_id');
    }

    public function test_file_size_limit_enforced(): void
    {
        Storage::fake('local');
        [$firm, $user] = $this->createFirmAndUser();
        $matter = Matter::factory()->forFirm($firm, $user)->create();

        // Over the 100 MB limit: rejected.
        $oversized = UploadedFile::fake()->create('huge.pdf', 150 * 1024, 'application/pdf');

        $this->actingAsUser($user)->post('/documents', [
            'file'      => $oversized,
            'matter_id' => $matter->id,
        ])->assertSessionHasErrors('file');

        // A 43 MB bundle (previously rejected at 20 MB) now uploads.
        $bundle = UploadedFile::fake()->create('bundle.pdf', 43 * 1024, 'application/pdf');

        $this->actingAsUser($user)->post('/documents', [
            'file'      => $bundle,
            'matter_id' => $matter->id,
        ])->assertSessionHasNoErrors();
    }

    public function test_can_delete_document(): void
    {
        Storage::fake('local');
        [$firm, $user] = $this->createFirmAndAdmin();
        $matter = Matter::factory()->forFirm($firm, $user)->create();

        $doc = Document::create([
            'firm_id'          => $firm->id,
            'matter_id'        => $matter->id,
            'uploaded_by_id'   => $user->id,
            'name'             => 'test.pdf',
            'original_name'    => 'test.pdf',
            'folder'           => 'general',
            'is_client_visible' => false,
            'is_signed'        => false,
        ]);

        $this->actingAsUser($user)->delete("/documents/{$doc->id}")
            ->assertRedirect();

        $this->assertSoftDeleted('documents', ['id' => $doc->id]);
    }

    public function test_documents_index_can_search_by_file_name(): void
    {
        [$firm, $user] = $this->createFirmAndAdmin();
        $matter = Matter::factory()->forFirm($firm, $user)->create();

        $make = fn (string $name) => Document::create([
            'firm_id' => $firm->id,
            'matter_id' => $matter->id,
            'uploaded_by_id' => $user->id,
            'name' => $name,
            'original_name' => $name,
            'folder' => 'general',
            'is_client_visible' => false,
            'is_signed' => false,
        ]);
        $match = $make('engagement-letter.pdf');
        $make('attendance-note.pdf');

        $this->actingAsUser($user)->get('/documents?search=engagement')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('documents.total', 1)
                ->where('documents.data.0.id', $match->id)
                ->where('filters.search', 'engagement'));
    }

    public function test_cannot_upload_to_other_firms_matter(): void
    {
        Storage::fake('local');
        [$firm,  $user]  = $this->createFirmAndUser();
        [$firm2, $user2] = $this->createFirmAndUser();
        $matter2 = Matter::factory()->forFirm($firm2, $user2)->create();

        $file = UploadedFile::fake()->create('doc.pdf', 50, 'application/pdf');

        // The matter_id rule is firm-scoped, so another firm's matter is not
        // a valid value -- and the BelongsToFirm scope means it is not
        // visible either. Both fail closed.
        $this->actingAsUser($user)->post('/documents', [
            'file'      => $file,
            'matter_id' => $matter2->id,
        ])->assertSessionHasErrors('matter_id');

        $this->assertDatabaseCount('documents', 0);
    }
}
