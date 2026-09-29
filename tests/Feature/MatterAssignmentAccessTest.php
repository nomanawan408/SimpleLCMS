<?php

namespace Tests\Feature;

use App\Models\Matter;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Activitylog\Models\Activity;
use Tests\TestCase;

/**
 * Assignment is access: granting or revoking matter visibility (or moving
 * the responsible role) is a firm-admin-only act, and every change is
 * attributable in the audit trail. Lawyers keep editing everything else —
 * identical resubmits of the assignment set are no-ops, not violations.
 */
class MatterAssignmentAccessTest extends TestCase
{
    use RefreshDatabase;

    private function openAssignedMatter(): array
    {
        [$firm, $lawyer] = $this->createFirmAndUser(['role' => 'lawyer']);
        $matter = Matter::factory()->forFirm($firm)->create([
            'status' => 'open',
            'responsible_user_id' => $lawyer->id,
        ]);
        $outsider = User::factory()->forFirm($firm)->create(['role' => 'lawyer']);
        $this->assignFirmRole($outsider, 'lawyer');

        return [$firm, $lawyer, $matter, $outsider];
    }

    public function test_lawyer_cannot_grant_matter_access_to_an_outsider(): void
    {
        [$firm, $lawyer, $matter, $outsider] = $this->openAssignedMatter();

        $this->actingAsUser($lawyer)
            ->put("/matters/{$matter->id}", [
                'name' => $matter->name,
                'assignee_ids' => [$lawyer->id, $outsider->id],
            ])
            ->assertForbidden();

        $this->assertFalse($matter->fresh()->isAssignedTo($outsider));
    }

    public function test_lawyer_cannot_revoke_matter_access_or_reassign(): void
    {
        [$firm, $lawyer, $matter, $outsider] = $this->openAssignedMatter();
        $this->assignToMatter($outsider, $matter);

        // Revoke.
        $this->actingAsUser($lawyer)
            ->put("/matters/{$matter->id}", [
                'name' => $matter->name,
                'assignee_ids' => [$lawyer->id],
            ])
            ->assertForbidden();
        $this->assertTrue($matter->fresh()->isAssignedTo($outsider));

        // Reassign the responsible role.
        $this->actingAsUser($lawyer)
            ->put("/matters/{$matter->id}", [
                'name' => $matter->name,
                'responsible_user_id' => $outsider->id,
            ])
            ->assertForbidden();
        $this->assertSame($lawyer->id, $matter->fresh()->responsible_user_id);
    }

    public function test_lawyer_noop_assignment_resubmit_stays_allowed(): void
    {
        [$firm, $lawyer, $matter, $outsider] = $this->openAssignedMatter();

        $this->actingAsUser($lawyer)
            ->put("/matters/{$matter->id}", [
                'name' => 'Edited title stays possible',
                'responsible_user_id' => $lawyer->id,
                'assignee_ids' => [],
            ])
            ->assertSessionHasNoErrors();

        $this->assertSame('Edited title stays possible', $matter->fresh()->name);
        $this->assertSame(
            0,
            Activity::where('description', 'assignees_updated')->where('subject_id', $matter->id)->count()
        );
    }

    public function test_admin_grants_are_applied_and_audit_logged(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $lawyer = User::factory()->forFirm($firm)->create(['role' => 'lawyer']);
        $this->assignFirmRole($lawyer, 'lawyer');
        $matter = Matter::factory()->forFirm($firm)->create([
            'status' => 'open',
            'responsible_user_id' => $admin->id,
        ]);

        // Grant.
        $this->actingAsUser($admin)
            ->put("/matters/{$matter->id}", [
                'name' => $matter->name,
                'assignee_ids' => [$lawyer->id],
            ])
            ->assertSessionHasNoErrors();

        $this->assertTrue($matter->fresh()->isAssignedTo($lawyer));
        $grant = Activity::where('description', 'assignees_updated')
            ->where('subject_id', $matter->id)->latest('id')->firstOrFail();
        $this->assertContains($lawyer->id, array_column($grant->properties['added'] ?? [], 'id'));
        $this->assertSame($admin->id, $grant->causer_id);

        // Revoke.
        $this->actingAsUser($admin)
            ->put("/matters/{$matter->id}", [
                'name' => $matter->name,
                'assignee_ids' => [],
            ])
            ->assertSessionHasNoErrors();

        $this->assertFalse($matter->fresh()->isAssignedTo($lawyer));
        $revoke = Activity::where('description', 'assignees_updated')
            ->where('subject_id', $matter->id)->latest('id')->firstOrFail();
        $this->assertSame([$lawyer->id], array_column($revoke->properties['removed'] ?? [], 'id'));
    }

    public function test_matter_create_picker_lists_custom_role_users(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $junior = User::factory()->forFirm($firm)->create(['role' => 'lawyer']);
        $this->assignFirmRole($junior, 'lawyer');
        // A custom role (e.g. "junior lawyer") must still appear: assignment
        // is controlled separately, never by hiding people from the picker.
        $custom = \Spatie\Permission\Models\Role::create([
            'name' => 'junior lawyer', 'guard_name' => 'web', 'firm_id' => $firm->id,
        ]);
        $junior->syncRoles([$custom]);
        $junior->forceFill(['role' => 'junior lawyer'])->save();

        $this->actingAsUser($admin)->get('/matters/create')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('users', fn ($users) => collect($users)->pluck('id')->contains($junior->id)));
    }

    public function test_lawyer_cannot_staff_others_at_creation(): void
    {
        [$firm, $lawyer] = $this->createFirmAndUser(['role' => 'lawyer']);
        $other = User::factory()->forFirm($firm)->create(['role' => 'lawyer']);
        $this->assignFirmRole($other, 'lawyer');
        $contact = \App\Models\Contact::factory()->forFirm($firm)->create();
        $base = [
            'name' => 'Self matter',
            'practice_area' => 'litigation',
            'fee_arrangement' => 'hourly_rate',
            'contact_ids' => [$contact->id],
        ];

        // Naming someone else responsible is refused before any write.
        $this->actingAsUser($lawyer)->post('/matters', [
            ...$base, 'responsible_user_id' => $other->id,
        ])->assertForbidden();
        $this->assertDatabaseMissing('matters', ['name' => 'Self matter']);

        // Smuggling someone else into the team is refused too.
        $this->actingAsUser($lawyer)->post('/matters', [
            ...$base, 'responsible_user_id' => $lawyer->id, 'assignee_ids' => [$other->id],
        ])->assertForbidden();

        // Opening for yourself works.
        $this->actingAsUser($lawyer)->post('/matters', [
            ...$base, 'responsible_user_id' => $lawyer->id,
        ])->assertRedirect();
        $this->assertDatabaseHas('matters', ['name' => 'Self matter']);
    }

    public function test_matter_creation_logs_initial_access_grants(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $lawyer = User::factory()->forFirm($firm)->create(['role' => 'lawyer']);
        $this->assignFirmRole($lawyer, 'lawyer');
        $contact = \App\Models\Contact::factory()->forFirm($firm)->create();

        $this->actingAsUser($admin)
            ->post('/matters', [
                'name' => 'Team matter',
                'practice_area' => 'litigation',
                'fee_arrangement' => 'hourly_rate',
                'responsible_user_id' => $admin->id,
                'assignee_ids' => [$lawyer->id],
                'contact_ids' => [$contact->id],
                'status' => 'open',
                'priority' => 'medium',
            ])
            ->assertRedirect();

        $matter = Matter::where('name', 'Team matter')->firstOrFail();
        $this->assertTrue($matter->isAssignedTo($lawyer));

        $logged = Activity::where('description', 'assignees_updated')
            ->where('subject_id', $matter->id)->firstOrFail();
        $this->assertContains($lawyer->id, array_column($logged->properties['added'] ?? [], 'id'));
    }
    public function test_inline_responsible_endpoint_respects_assignment_gate(): void
    {
        [$firm, $lawyer, $matter, $outsider] = $this->openAssignedMatter();
        $manager = User::factory()->forFirm($firm)->create(['role' => 'lawyer']);
        $this->assignFirmRole($manager, 'lawyer');
        $manager->givePermissionTo(['view_matters', 'edit_matters', 'manage_assignments']);
        $this->assignToMatter($manager, $matter);

        // Manager with the permission reassigns: works + audited.
        $this->actingAsUser($manager)
            ->put("/matters/{$matter->id}/responsible", ['responsible_user_id' => $outsider->id])
            ->assertRedirect();
        $this->assertSame($outsider->id, $matter->fresh()->responsible_user_id);
        $this->assertTrue($matter->fresh()->isAssignedTo($outsider));
        $this->assertSame(1, Activity::where('description', 'assignees_updated')
            ->where('subject_id', $matter->id)->count());

        // Plain lawyer without the permission: refused, nothing written.
        $this->actingAsUser($lawyer)
            ->put("/matters/{$matter->id}/responsible", ['responsible_user_id' => $lawyer->id])
            ->assertForbidden();
    }

    public function test_inline_responsible_endpoint_rejects_cross_firm_user(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $matter = Matter::factory()->forFirm($firm)->create(['status' => 'open']);
        [$firmB] = $this->createFirmAndAdmin();
        $foreign = User::factory()->forFirm($firmB)->create(['role' => 'lawyer']);

        $this->actingAsUser($admin)
            ->put("/matters/{$matter->id}/responsible", ['responsible_user_id' => $foreign->id])
            ->assertSessionHasErrors('responsible_user_id');
    }
}
