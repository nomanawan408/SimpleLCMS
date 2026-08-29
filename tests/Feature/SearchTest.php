<?php

namespace Tests\Feature;

use App\Models\Contact;
use App\Models\Document;
use App\Models\Invoice;
use App\Models\Matter;
use App\Models\Task;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SearchTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_short_query_returns_nothing(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        Matter::factory()->forFirm($firm, $admin)->create(['name' => 'Smith v Jones']);

        $this->actingAsUser($admin)->getJson('/search?q=s')
            ->assertOk()
            ->assertJson(['results' => []]);
    }

    public function test_finds_a_matter_by_name_or_matter_number(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $matter = Matter::factory()->forFirm($firm, $admin)->create(['name' => 'Smith v Jones']);

        $this->actingAsUser($admin)->getJson('/search?q=Smith')
            ->assertOk()
            ->assertJsonPath('results.matters.0.id', $matter->id);

        $this->actingAsUser($admin)->getJson('/search?q='.$matter->matter_number)
            ->assertOk()
            ->assertJsonPath('results.matters.0.id', $matter->id);
    }

    public function test_finds_a_contact_by_name_or_email(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $contact = Contact::factory()->forFirm($firm)->create([
            'name' => 'Priya Sharma', 'email' => 'priya@example.com',
        ]);

        $this->actingAsUser($admin)->getJson('/search?q=Priya')
            ->assertOk()
            ->assertJsonPath('results.contacts.0.id', $contact->id);

        $this->actingAsUser($admin)->getJson('/search?q=priya@example.com')
            ->assertOk()
            ->assertJsonPath('results.contacts.0.id', $contact->id);
    }

    public function test_finds_an_invoice_by_number(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $invoice = Invoice::factory()->create(['firm_id' => $firm->id, 'invoice_number' => 'INV-2026-0042']);

        $this->actingAsUser($admin)->getJson('/search?q=0042')
            ->assertOk()
            ->assertJsonPath('results.invoices.0.id', $invoice->id);
    }

    public function test_finds_a_task_by_title(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $task = Task::factory()->create(['firm_id' => $firm->id, 'title' => 'File the defence bundle']);

        $this->actingAsUser($admin)->getJson('/search?q=defence')
            ->assertOk()
            ->assertJsonPath('results.tasks.0.id', $task->id);
    }

    public function test_finds_a_document_by_original_filename(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $matter = Matter::factory()->forFirm($firm, $admin)->create();
        $document = Document::create([
            'firm_id' => $firm->id, 'matter_id' => $matter->id, 'uploaded_by_id' => $admin->id,
            'name' => 'x', 'original_name' => 'engagement-letter.pdf',
            's3_key' => 'documents/x.pdf', 'folder' => 'General',
            'mime_type' => 'application/pdf', 'size_bytes' => 10, 'version' => 1,
        ]);

        $this->actingAsUser($admin)->getJson('/search?q=engagement')
            ->assertOk()
            ->assertJsonPath('results.documents.0.id', $document->id);
    }

    /** A user without view_invoices must never see invoice results, matching the permission that gates /billing itself. */
    public function test_invoice_results_are_withheld_without_the_permission(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        Invoice::factory()->create(['firm_id' => $firm->id, 'invoice_number' => 'INV-2026-0099']);

        $clerk = \App\Models\User::factory()->forFirm($firm)->create();
        $clerk->syncRoles([]);
        $clerk->syncPermissions(['view_matters', 'view_contacts']);

        $this->actingAsUser($clerk->fresh())->getJson('/search?q=0099')
            ->assertOk()
            ->assertJsonMissingPath('results.invoices');
    }

    /** A matter in another firm must never surface, matching every other list in the app. */
    public function test_results_never_cross_firms(): void
    {
        [$firmA, $adminA] = $this->createFirmAndAdmin();
        [$firmB, $adminB] = $this->createFirmAndAdmin();
        Matter::factory()->forFirm($firmB, $adminB)->create(['name' => 'Unique Matter Name Xyz']);

        $this->actingAsUser($adminA)->getJson('/search?q=Unique Matter Name Xyz')
            ->assertOk()
            ->assertJson(['results' => []]);
    }

    public function test_results_are_grouped_by_category_in_one_response(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        Matter::factory()->forFirm($firm, $admin)->create(['name' => 'Consolidated Metals Ltd']);
        Contact::factory()->forFirm($firm)->create(['name' => 'Consolidated Metals Contact']);

        $this->actingAsUser($admin)->getJson('/search?q=Consolidated')
            ->assertOk()
            ->assertJsonCount(1, 'results.matters')
            ->assertJsonCount(1, 'results.contacts');
    }
}
