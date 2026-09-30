<?php

namespace Tests\Feature;

use App\Models\Matter;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

/**
 * Unified enforcement: permission (role) unlocks the module, assignment
 * unlocks the record, open-state unlocks mutation. Each gate is proven
 * independently: holding two of the three is still refused.
 */
class PermissionUnificationTest extends TestCase
{
    use RefreshDatabase;

    private function customRoleUser(string $firmId, array $permissions, string $roleName = 'Custom'): User
    {
        foreach ($permissions as $name) {
            Permission::firstOrCreate(['name' => $name, 'guard_name' => 'web']);
        }
        $role = Role::create(['name' => $roleName, 'guard_name' => 'web', 'firm_id' => $firmId]);
        $role->syncPermissions($permissions);
        $user = User::factory()->forFirm(\App\Models\Firm::find($firmId))->create(['role' => $roleName]);
        $user->assignRole($role);

        return $user->fresh();
    }

    public function test_permission_without_assignment_cannot_view_matter(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $matter = Matter::factory()->forFirm($firm)->create(['status' => 'open']);
        $user = $this->customRoleUser($firm->id, ['view_matters']);

        $this->actingAsUser($user)->get("/matters/{$matter->id}")->assertForbidden();
        $this->actingAsUser($user)->get('/matters')->assertOk();
    }

    public function test_assignment_without_permission_cannot_update_matter(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $matter = Matter::factory()->forFirm($firm)->create(['status' => 'open']);
        $user = $this->customRoleUser($firm->id, ['view_matters']);
        $this->assignToMatter($user, $matter);

        $this->actingAsUser($user)->get("/matters/{$matter->id}")->assertOk();
        $this->actingAsUser($user)
            ->put("/matters/{$matter->id}", ['name' => 'Sneaky'])
            ->assertForbidden();
        $this->assertDatabaseMissing('matters', ['id' => $matter->id, 'name' => 'Sneaky']);
    }

    public function test_lawyer_default_can_create_matter_and_work_assigned_timer(): void
    {
        [$firm, $lawyer] = $this->createFirmAndUser(['role' => 'lawyer']);
        $contact = \App\Models\Contact::factory()->forFirm($firm)->create();

        $this->actingAsUser($lawyer)->post('/matters', [
            'name' => 'Lawyer matter',
            'practice_area' => 'litigation',
            'fee_arrangement' => 'hourly_rate',
            'responsible_user_id' => $lawyer->id,
            'contact_ids' => [$contact->id],
        ])->assertRedirect();

        $matter = Matter::where('name', 'Lawyer matter')->firstOrFail();

        // Timer runs on the assigned matter and checking out ends it.
        $this->actingAsUser($lawyer)
            ->postJson('/time/checkin', ['matter_id' => $matter->id])
            ->assertOk();
        $this->actingAsUser($lawyer)->postJson('/time/checkout')->assertOk();
        $this->assertDatabaseMissing('time_sessions', ['user_id' => $lawyer->id]);
    }

    /**
     * The reported bug: a contacts-only custom role must see exactly one
     * module. Menus are filtered client-side from the same permission set,
     * so the backend matrix below is what guarantees the restriction.
     */
    public function test_contacts_only_user_is_confined_to_contacts(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $matter = Matter::factory()->forFirm($firm)->create(['status' => 'open']);
        $contact = \App\Models\Contact::factory()->forFirm($firm)->create();
        $matter->contacts()->attach($contact->id, ['role' => 'client']);

        $user = $this->customRoleUser($firm->id, ['view_contacts', 'create_contacts']);
        $this->assignToMatter($user, $matter);

        // Landing page stays reachable (scoped, empty of money).
        $this->actingAsUser($user)->get('/dashboard')->assertOk();

        // The one permitted module.
        $this->actingAsUser($user)->get('/contacts')->assertOk();
        $this->actingAsUser($user)->get("/contacts/{$contact->id}")->assertOk();

        // Everything else refuses, even with a matter assignment in hand.
        $this->actingAsUser($user)->get('/matters')->assertForbidden();
        $this->actingAsUser($user)->get("/matters/{$matter->id}")->assertForbidden();
        $this->actingAsUser($user)->get('/documents')->assertForbidden();
        $this->actingAsUser($user)->get('/time')->assertForbidden();
        $this->actingAsUser($user)->get('/calendar')->assertForbidden();
        $this->actingAsUser($user)->get('/tasks')->assertForbidden();
        $this->actingAsUser($user)->get('/billing')->assertForbidden();
        $this->actingAsUser($user)->get('/transactions')->assertForbidden();
        $this->actingAsUser($user)->get('/accounts')->assertForbidden();
        $this->actingAsUser($user)->get('/ledger/cash-sheet')->assertForbidden();
        $this->actingAsUser($user)->get('/ledger/reconciliations')->assertForbidden();
        $this->actingAsUser($user)->get('/reports')->assertForbidden();
        $this->actingAsUser($user)->get('/activities')->assertForbidden();

        // Search surfaces contacts only — never matters, documents or tasks.
        $response = $this->actingAsUser($user)->getJson('/search?q=' . substr($contact->name, 0, 4));
        $response->assertOk();
        $keys = array_keys($response->json('results'));
        $this->assertContains('contacts', $keys);
        $this->assertNotContains('matters', $keys);
        $this->assertNotContains('documents', $keys);
        $this->assertNotContains('tasks', $keys);
    }

    public function test_transactions_money_and_pickers_follow_assignment(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $matterA = Matter::factory()->forFirm($firm)->create(['status' => 'open']);
        $matterB = Matter::factory()->forFirm($firm)->create(['status' => 'open']);
        $lawyer = User::factory()->forFirm($firm)->create(['role' => 'lawyer']);
        $this->assignFirmRole($lawyer, 'lawyer');
        $this->grantFinances($lawyer);
        $this->assignToMatter($lawyer, $matterA);

        $invoiceB = \App\Models\Invoice::factory()->forFirm($firm)->forMatter($matterB)
            ->create(['status' => 'sent', 'total' => 500]);
        \App\Models\Payment::create([
            'firm_id' => $firm->id, 'invoice_id' => $invoiceB->id,
            'amount' => 500, 'method' => 'cash', 'paid_at' => now()->toDateString(),
        ]);

        $this->actingAsUser($lawyer)->get('/transactions')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('stats.total_received', 0)
                ->where('matters', fn ($matters) => collect($matters)->pluck('id')->contains($matterA->id)
                    && ! collect($matters)->pluck('id')->contains($matterB->id))
                ->where('openInvoices', fn ($invoices) => ! collect($invoices)->pluck('id')->contains($invoiceB->id)));
    }

    public function test_inertia_denial_renders_error_page(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $user = $this->customRoleUser($firm->id, ['view_contacts']);

        $version = hash_file('xxh128', public_path('build/manifest.json'));
        $this->actingAsUser($user)
            ->withHeader('X-Inertia', 'true')
            ->withHeader('X-Inertia-Version', $version)
            ->get('/matters')
            ->assertForbidden()
            ->assertSee('"component":"Error"', false);
    }

    /**
     * Structural guard against security theater: every permission row in the
     * database must be enforced by a gate in application code. A permission
     * offered on the Roles screen but checked nowhere implies control that
     * does not exist. (Scans string literals, which covers the dynamic
     * pass-throughs too — their names appear at the call sites.)
     */
    public function test_every_permission_is_enforced_somewhere(): void
    {
        static $haystack = null;
        if ($haystack === null) {
            $haystack = '';
            $iterator = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator(app_path()));
            foreach ($iterator as $file) {
                if ($file->isFile() && $file->getExtension() === 'php') {
                    $haystack .= file_get_contents($file->getPathname());
                }
            }
        }

        $unenforced = [];
        foreach (\Spatie\Permission\Models\Permission::pluck('name')->all() as $name) {
            if (! str_contains($haystack, "'{$name}'") && ! str_contains($haystack, "\"{$name}\"")) {
                $unenforced[] = $name;
            }
        }

        $this->assertSame([], $unenforced, 'Decorative permissions found: ' . implode(', ', $unenforced));
    }

    /**
     * The all-matters override: a supervisor role sees every file assigned
     * or not, without becoming firm_admin. Writes still need their own
     * override permission, and the closed freeze never lifts.
     */
    public function test_view_all_matters_opens_every_file_read_only(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $open = Matter::factory()->forFirm($firm)->create(['status' => 'open']);
        $closed = Matter::factory()->forFirm($firm)->create(['status' => 'closed']);
        $user = $this->customRoleUser($firm->id, ['view_all_matters']);

        $this->actingAsUser($user)->get('/matters')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('matters.data', fn ($data) => collect($data)->pluck('id')->contains($open->id)
                    && collect($data)->pluck('id')->contains($closed->id)));

        $this->actingAsUser($user)->get("/matters/{$open->id}")->assertOk();
        $this->actingAsUser($user)->get("/matters/{$closed->id}")->assertOk();

        // Read-only: no edit or delete without the write overrides.
        $this->actingAsUser($user)
            ->put("/matters/{$open->id}", ['name' => 'Sneaky'])
            ->assertForbidden();
        $this->actingAsUser($user)->delete("/matters/{$open->id}")->assertForbidden();
    }

    public function test_edit_and_delete_all_matters_skip_assignment_not_freeze(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $open = Matter::factory()->forFirm($firm)->create(['status' => 'open', 'name' => 'Open file']);
        $closed = Matter::factory()->forFirm($firm)->create(['status' => 'closed', 'name' => 'Shut file']);
        $editor = $this->customRoleUser($firm->id, ['view_all_matters', 'edit_all_matters']);
        $destroyer = $this->customRoleUser($firm->id, ['view_all_matters', 'delete_all_matters'], 'Destroyer');

        // Unassigned open file: editable without the base edit permission.
        $this->actingAsUser($editor)
            ->put("/matters/{$open->id}", ['name' => 'Renamed by override'])
            ->assertSessionHasNoErrors();
        $this->assertSame('Renamed by override', $open->fresh()->name);

        // Closed file: the override stops at the archive.
        $this->actingAsUser($editor)
            ->put("/matters/{$closed->id}", ['name' => 'Sneaky'])
            ->assertForbidden();

        // Delete override works on open files, never on closed ones.
        $this->actingAsUser($destroyer)->delete("/matters/{$open->id}")->assertRedirect();
        $this->assertSoftDeleted('matters', ['id' => $open->id]);
        $this->actingAsUser($destroyer)->delete("/matters/{$closed->id}")->assertForbidden();
    }

    public function test_custom_role_without_time_permission_cannot_check_in(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $matter = Matter::factory()->forFirm($firm)->create(['status' => 'open']);
        $user = $this->customRoleUser($firm->id, ['view_matters', 'view_time_entries']);
        $this->assignToMatter($user, $matter);

        $this->actingAsUser($user)
            ->postJson('/time/checkin', ['matter_id' => $matter->id])
            ->assertForbidden();
    }
}
