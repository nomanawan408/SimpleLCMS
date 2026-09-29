<?php

namespace Tests\Feature;

use App\Models\Matter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Activitylog\Models\Activity;
use Tests\TestCase;

/**
 * Closed matters are a read-only archive for lawyers: assigned lawyers may
 * view but nothing may mutate the file. Firm admins keep full control, and
 * every closed-file view by a non-admin is audit-logged (GDPR trail).
 */
class ClosedMatterAccessTest extends TestCase
{
    use RefreshDatabase;

    private function closedAssignedMatter(): array
    {
        [$firm, $lawyer] = $this->createFirmAndUser(['role' => 'lawyer']);
        $matter = Matter::factory()->forFirm($firm)->create(['status' => 'closed']);
        $this->assignToMatter($lawyer, $matter);

        return [$firm, $lawyer, $matter];
    }

    public function test_assigned_lawyer_can_view_closed_matter_read_only(): void
    {
        [$firm, $lawyer, $matter] = $this->closedAssignedMatter();

        $this->actingAsUser($lawyer)
            ->get("/matters/{$matter->id}")
            ->assertOk();
    }

    public function test_assigned_lawyer_cannot_update_or_delete_closed_matter(): void
    {
        [$firm, $lawyer, $matter] = $this->closedAssignedMatter();

        $this->actingAsUser($lawyer)
            ->patch("/matters/{$matter->id}", ['name' => 'Sneaky rename'])
            ->assertForbidden();

        $this->actingAsUser($lawyer)
            ->delete("/matters/{$matter->id}")
            ->assertForbidden();

        $this->assertDatabaseMissing('matters', ['id' => $matter->id, 'name' => 'Sneaky rename']);
    }

    public function test_firm_admin_keeps_full_control_of_closed_matter(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $matter = Matter::factory()->forFirm($firm)->create(['status' => 'closed']);

        $this->actingAsUser($admin)
            ->patch("/matters/{$matter->id}", [
                'name' => $matter->name,
                'status' => 'open',
                'client_name' => $matter->client_name,
            ])
            ->assertSessionHasNoErrors();
    }

    public function test_lawyer_writes_to_closed_matter_are_rejected(): void
    {
        [$firm, $lawyer, $matter] = $this->closedAssignedMatter();
        $this->grantFinances($lawyer, true);

        // Task on a closed file.
        $this->actingAsUser($lawyer)
            ->post('/tasks', ['matter_id' => $matter->id, 'title' => 'Sneaky task', 'priority' => 'medium'])
            ->assertForbidden();

        // Time entry on a closed file.
        $this->actingAsUser($lawyer)
            ->post('/time', [
                'matter_id' => $matter->id,
                'date' => now()->toDateString(),
                'duration_minutes' => 30,
                'description' => 'Sneaky time',
            ])
            ->assertForbidden();

        // Hearing date on a closed file.
        $this->actingAsUser($lawyer)
            ->post("/matters/{$matter->id}/hearing-dates", ['hearing_date' => now()->addDay()->toDateString()])
            ->assertForbidden();

        // Expense on a closed file.
        $this->actingAsUser($lawyer)
            ->post("/matters/{$matter->id}/expenses", [
                'description' => 'Sneaky expense',
                'amount' => 10,
                'billable' => true,
                'date' => now()->toDateString(),
            ])
            ->assertForbidden();

        // Ledger posting on a closed file.
        $this->actingAsUser($lawyer)
            ->post('/ledger/entries', [
                'matter_id' => $matter->id,
                'transaction_type' => 'client_receipt',
                'amount' => 100,
                'transaction_date' => now()->toDateString(),
                'narrative' => 'Sneaky receipt',
            ])
            ->assertForbidden();

        // Note on a closed file.
        $this->actingAsUser($lawyer)
            ->post("/matters/{$matter->id}/notes", ['body' => 'Sneaky note'])
            ->assertForbidden();

        // Calendar event on a closed file.
        $this->actingAsUser($lawyer)
            ->post('/calendar', [
                'matter_id' => $matter->id,
                'title' => 'Sneaky event',
                'type' => 'appointment',
                'start_at' => now()->addDay()->toDateTimeString(),
            ])
            ->assertForbidden();
    }

    public function test_owner_cannot_update_or_delete_own_time_on_closed_matter(): void
    {
        [$firm, $lawyer, $matter] = $this->closedAssignedMatter();
        $entry = \App\Models\TimeEntry::factory()->forFirm($firm)->create([
            'matter_id' => $matter->id,
            'user_id' => $lawyer->id,
            'billed' => false,
            'is_locked' => false,
            'description' => 'Original',
        ]);

        // Update refused even by the owner with edit permission held.
        $this->actingAsUser($lawyer)
            ->putJson("/time/{$entry->id}", ['description' => 'Rewritten'])
            ->assertForbidden();
        $this->assertSame('Original', $entry->fresh()->description);

        // Delete refused the same way.
        $this->actingAsUser($lawyer)
            ->deleteJson("/time/{$entry->id}")
            ->assertForbidden();
        $this->assertDatabaseHas('time_entries', ['id' => $entry->id]);
    }

    public function test_admin_keeps_time_control_on_closed_matter(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $matter = Matter::factory()->forFirm($firm)->create(['status' => 'closed']);
        $entry = \App\Models\TimeEntry::factory()->forFirm($firm)->create([
            'matter_id' => $matter->id,
            'user_id' => $admin->id,
            'billed' => false,
            'is_locked' => false,
            'description' => 'Original',
        ]);

        $this->actingAsUser($admin)
            ->putJson("/time/{$entry->id}", ['description' => 'Corrected'])
            ->assertOk();
        $this->assertSame('Corrected', $entry->fresh()->description);

        $this->actingAsUser($admin)
            ->deleteJson("/time/{$entry->id}")
            ->assertOk();
        $this->assertSoftDeleted('time_entries', ['id' => $entry->id]);
    }

    public function test_closed_matter_view_is_audit_logged_for_lawyers_only(): void
    {
        // Create both firms up front: TenantContext follows the acting user,
        // so a second firm cannot be seeded mid-test after acting as firm 1.
        [$firm2, $admin] = $this->createFirmAndAdmin();
        $other = Matter::factory()->forFirm($firm2)->create(['status' => 'closed']);

        [$firm, $lawyer, $matter] = $this->closedAssignedMatter();

        $this->actingAsUser($lawyer)->get("/matters/{$matter->id}")->assertOk();

        $this->assertDatabaseHas('activity_log', [
            'description' => 'viewed_closed_matter',
            'subject_type' => Matter::class,
            'subject_id' => $matter->id,
            'causer_id' => $lawyer->id,
        ]);

        $this->actingAsUser($admin)->get("/matters/{$other->id}")->assertOk();

        $this->assertSame(
            0,
            Activity::where('description', 'viewed_closed_matter')->where('causer_id', $admin->id)->count()
        );
    }
}
