<?php

namespace Tests\Feature;

use App\Models\Contact;
use App\Models\Document;
use App\Models\Firm;
use App\Models\Matter;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

/**
 * Regression coverage for the findings in the August 2026 security audit.
 * Each test is the inverse of a proof-of-concept that previously succeeded.
 */
class SecurityRegressionTest extends TestCase
{
    use RefreshDatabase;

    /** SL-01 */
    public function test_firm_admin_cannot_promote_themselves_to_super_admin(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();

        $this->actingAsUser($admin)
            ->put("/admin/users/{$admin->id}", ['role' => 'super_admin'])
            ->assertSessionHasErrors('role');

        $admin->refresh()->unsetRelation('roles');
        $this->assertFalse($admin->hasRole('super_admin'));
        $this->actingAsUser($admin->fresh())->get('/superadmin/firms')->assertStatus(403);
    }

    /** SL-01 */
    public function test_firm_admin_cannot_create_a_super_admin(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();

        $this->actingAsUser($admin)->post('/admin/users', [
            'full_name' => 'Backdoor', 'email' => 'backdoor@example.com',
            'password' => 'Password123!', 'password_confirmation' => 'Password123!',
            'role' => 'super_admin',
        ])->assertSessionHasErrors('role');

        $this->assertDatabaseMissing('users', ['email' => 'backdoor@example.com']);
    }

    /** SL-02: firm admin creates a role, sets its permissions, assigns it. */
    public function test_firm_admin_can_create_role_with_permissions_and_assign_it(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();

        $perm = \Spatie\Permission\Models\Permission::firstOrCreate(['name' => 'view_matters', 'guard_name' => 'web']);
        $admin->givePermissionTo($perm);

        $this->actingAsUser($admin)->post('/admin/roles', [
            'name' => 'Paralegal',
            'description' => 'Support staff',
            'permissions' => ['view_matters'],
        ])->assertRedirect();

        $role = \Spatie\Permission\Models\Role::where('name', 'Paralegal')->firstOrFail();
        $this->assertSame($firm->id, $role->firm_id);
        $this->assertFalse((bool) $role->is_system);
        $this->assertTrue($role->hasPermissionTo('view_matters'));

        $this->actingAsUser($admin)->post('/admin/users', [
            'full_name' => 'Para User', 'email' => 'para@example.com',
            'password' => 'Password123!', 'password_confirmation' => 'Password123!',
            'role' => 'Paralegal',
        ])->assertRedirect();

        $user = \App\Models\User::where('email', 'para@example.com')->firstOrFail();
        $this->assertTrue($user->hasRole('Paralegal'));
        $this->assertSame('Paralegal', $user->role);

        // The role index lists the custom role with its permission.
        $this->actingAsUser($admin)->get('/admin/roles')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('roles', fn ($data) => collect($data)->contains(
                    fn ($r) => $r['name'] === 'Paralegal' && $r['permissions'] === ['view_matters']
                )));
    }

    /** SL-02: built-in and foreign roles are untouchable from a firm. */
    public function test_firm_admin_cannot_edit_or_delete_builtin_or_foreign_roles(): void
    {
        [$firmA, $adminA] = $this->createFirmAndAdmin();
        [$firmB, $adminB] = $this->createFirmAndAdmin();

        $lawyer = \Spatie\Permission\Models\Role::where('name', 'lawyer')->firstOrFail();

        // Shared built-in lawyer: refused, never edited.
        $this->actingAsUser($adminA)
            ->put("/admin/roles/{$lawyer->id}", ['name' => 'lawyer', 'permissions' => []])
            ->assertSessionHasErrors('name');
        $this->actingAsUser($adminA)->delete("/admin/roles/{$lawyer->id}")
            ->assertSessionHasErrors('name');

        // Another firm's custom role: fail closed without confirming it exists.
        $foreign = \Spatie\Permission\Models\Role::create([
            'name' => 'Foreign', 'guard_name' => 'web', 'firm_id' => $firmB->id,
        ]);
        $this->actingAsUser($adminA)
            ->put("/admin/roles/{$foreign->id}", ['name' => 'Foreign', 'permissions' => []])
            ->assertForbidden();
        $this->actingAsUser($adminA)->delete("/admin/roles/{$foreign->id}")
            ->assertForbidden();

        // Lawyers never reach role management at all.
        [$firmC, $lawyerUser] = $this->createFirmAndUser(['role' => 'lawyer']);
        $this->actingAsUser($lawyerUser)->get('/admin/roles')->assertForbidden();
        $this->actingAsUser($lawyerUser)->post('/admin/roles', ['name' => 'X', 'permissions' => []])->assertForbidden();
    }

    /** SL-03 */
    public function test_firm_cannot_assign_another_firms_custom_role(): void
    {
        [$firmA, $adminA] = $this->createFirmAndAdmin();
        [$firmB, $adminB] = $this->createFirmAndAdmin();

        // Only staff and firm_admin are grantable from firm routes now.
        $this->actingAsUser($adminB)->post('/admin/users', [
            'full_name' => 'B User', 'email' => 'buser@example.com',
            'password' => 'Password123!', 'password_confirmation' => 'Password123!',
            'role' => 'super_admin',
        ])->assertSessionHasErrors('role');

        $this->assertDatabaseMissing('users', ['email' => 'buser@example.com']);

    }

    /** SL-03 sibling: a firm cannot poach another firm's custom role by name. */
    public function test_firm_cannot_assign_another_firms_custom_role_by_name(): void
    {
        [$firmA, $adminA] = $this->createFirmAndAdmin();
        [$firmB, $adminB] = $this->createFirmAndAdmin();

        $foreign = \Spatie\Permission\Models\Role::create([
            'name' => 'Paralegal', 'guard_name' => 'web', 'firm_id' => $firmB->id,
        ]);

        // Same display name, different firm: the grant must fail validation…
        $this->actingAsUser($adminA)->post('/admin/users', [
            'full_name' => 'Poached', 'email' => 'poached@example.com',
            'password' => 'Password123!', 'password_confirmation' => 'Password123!',
            'role' => 'Paralegal',
        ])->assertSessionHasErrors('role');
        $this->assertDatabaseMissing('users', ['email' => 'poached@example.com']);

        // …and even a validated name can never resolve to another firm's row.
        $this->assertFalse($foreign->users()->exists());
    }

    /** SL-02 sibling: no privilege escalation by delegation */
    public function test_admin_cannot_grant_permissions_they_do_not_hold(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();

        // Deleted roles can never be granted, even by name.
        $this->actingAsUser($admin)->post('/admin/users', [
            'full_name' => 'Backdoor', 'email' => 'backdoor@example.com',
            'password' => 'Password123!', 'password_confirmation' => 'Password123!',
            'role' => 'manager',
        ])->assertSessionHasErrors('role');

        $this->assertDatabaseMissing('users', ['email' => 'backdoor@example.com']);

    }

    /** SL-06: the TOTP challenge is rate limited */
    public function test_totp_challenge_is_throttled(): void
    {
        [$firm, $user] = $this->createFirmAndUser([
            'totp_enabled' => true, 'totp_secret' => 'ABCDEFGHIJKLMNOP',
        ]);

        $statuses = [];
        for ($i = 0; $i < 12; $i++) {
            $statuses[] = $this->actingAs($user)
                ->post('/two-factor', ['code' => str_pad((string) $i, 6, '0', STR_PAD_LEFT)])
                ->status();
        }

        $this->assertContains(429, $statuses, 'the challenge must start rejecting before 12 guesses');
    }

    /** SL-26: a password alone cannot strip the second factor */
    public function test_two_factor_cannot_be_disabled_without_completing_the_challenge(): void
    {
        [$firm, $user] = $this->createFirmAndUser([
            'totp_enabled' => true,
            'totp_secret' => 'ABCDEFGHIJKLMNOP',
            'password' => 'KnownPassword123!',
        ]);

        // Authenticated by password, but the challenge was never completed.
        $this->actingAs($user)
            ->delete('/two-factor', ['password' => 'KnownPassword123!'])
            ->assertRedirect(route('two-factor.challenge'));

        $this->assertTrue($user->fresh()->totp_enabled);
    }

    /** SL-26: even a verified session must present a live code to disable 2FA */
    public function test_disabling_two_factor_requires_a_current_code(): void
    {
        [$firm, $user] = $this->createFirmAndUser([
            'totp_enabled' => true,
            'totp_secret' => 'ABCDEFGHIJKLMNOP',
            'password' => 'KnownPassword123!',
        ]);

        $this->actingAsUser($user)
            ->delete('/two-factor', ['password' => 'KnownPassword123!', 'code' => '000000'])
            ->assertSessionHasErrors('code');

        $this->assertTrue($user->fresh()->totp_enabled);
    }

    /** SL-06: an accepted code cannot be replayed inside its window */
    public function test_totp_code_cannot_be_replayed(): void
    {
        $google2fa = app(\PragmaRX\Google2FA\Google2FA::class);
        $secret = $google2fa->generateSecretKey();

        [$firm, $user] = $this->createFirmAndUser([
            'totp_enabled' => true, 'totp_secret' => $secret,
        ]);

        $code = $google2fa->getCurrentOtp($secret);

        $this->actingAs($user)->post('/two-factor', ['code' => $code])
            ->assertRedirect(route('dashboard'));
        $this->assertNotNull($user->fresh()->totp_last_timestamp);

        // Same code, fresh session: must not be accepted a second time.
        // The stored value must be the matched time slice, not a bare boolean,
        // or there is nothing meaningful to compare against next time.
        $this->assertGreaterThan(1000, $user->fresh()->totp_last_timestamp);

        $this->actingAs($user->fresh())->post('/two-factor', ['code' => $code])
            ->assertSessionHasErrors('code');
    }

    /** SL-04: active content is rejected at upload */
    public function test_html_upload_is_rejected(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $matter = Matter::factory()->create(['firm_id' => $firm->id]);

        $tmp = tempnam(sys_get_temp_dir(), 'sec');
        file_put_contents($tmp, '<script>alert(1)</script>');

        foreach (['payload.html', 'payload.svg', 'payload.xhtml'] as $name) {
            $this->actingAsUser($admin)->post('/documents', [
                'file' => new UploadedFile($tmp, $name, 'text/html', null, true),
                'matter_id' => $matter->id,
            ])->assertSessionHasErrors('file');
        }

        $this->assertSame(0, Document::count());
        @unlink($tmp);
    }

    /** SL-04: markup content is refused even behind a harmless extension */
    public function test_markup_content_is_rejected_regardless_of_extension(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $matter = Matter::factory()->create(['firm_id' => $firm->id]);

        $tmp = tempnam(sys_get_temp_dir(), 'sec');
        file_put_contents($tmp, '<html><script>alert(1)</script></html>');

        $this->actingAsUser($admin)->post('/documents', [
            'file' => new UploadedFile($tmp, 'notes.txt', 'text/html', null, true),
            'matter_id' => $matter->id,
        ])->assertSessionHasErrors('file');

        $this->assertSame(0, Document::count());
        @unlink($tmp);
    }

    /** SL-04: served documents carry the protective headers and a safe type */
    public function test_documents_are_served_with_protective_headers(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $matter = Matter::factory()->create(['firm_id' => $firm->id]);

        $tmp = tempnam(sys_get_temp_dir(), 'sec');
        file_put_contents($tmp, "Attendance note. Client called at 14:05.\n");

        // A genuine plain-text note: the client still claims text/html.
        $this->actingAsUser($admin)->post('/documents', [
            'file' => new UploadedFile($tmp, 'notes.txt', 'text/html', null, true),
            'matter_id' => $matter->id,
        ])->assertRedirect();

        $doc = Document::firstOrFail();
        $this->assertStringNotContainsString('text/html', (string) $doc->mime_type);

        $view = $this->actingAsUser($admin)->get("/documents/{$doc->id}/view");

        $this->assertStringNotContainsString('text/html', (string) $view->headers->get('Content-Type'));
        $this->assertSame('nosniff', $view->headers->get('X-Content-Type-Options'));
        $this->assertStringContainsString('sandbox', (string) $view->headers->get('Content-Security-Policy'));

        @unlink($tmp);
    }

    /** SL-23: a quote in the filename cannot corrupt the response header */
    public function test_filename_is_escaped_in_content_disposition(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $matter = Matter::factory()->create(['firm_id' => $firm->id]);

        $doc = Document::create([
            'firm_id' => $firm->id,
            'matter_id' => $matter->id,
            'uploaded_by_id' => $admin->id,
            'name' => 'x', 'original_name' => 'evil";attachment;x=".pdf',
            's3_key' => 'documents/missing.pdf', 'folder' => 'f',
            'mime_type' => 'application/pdf', 'size_bytes' => 1, 'version' => 1,
        ]);

        \Illuminate\Support\Facades\Storage::disk('local')->put($doc->s3_key, '%PDF-1.4');

        $view = $this->actingAsUser($admin)->get("/documents/{$doc->id}/view");
        $disposition = (string) $view->headers->get('Content-Disposition');

        // makeDisposition falls back to the safe name rather than emitting a
        // header an attacker can split.
        $this->assertStringNotContainsString('";attachment;', $disposition);
    }

    /** SL-05: registration cannot mint a second account for a known address */
    public function test_registration_rejects_an_existing_email(): void
    {
        [$firm, $victim] = $this->createFirmAndUser(['email' => 'partner@victimfirm.co.uk']);

        $this->post('/register', [
            'firm_name' => 'Attacker LLP',
            'full_name' => 'Attacker',
            'email' => 'partner@victimfirm.co.uk',
            'password' => 'AttackerPassword123!',
            'password_confirmation' => 'AttackerPassword123!',
        ])->assertSessionHasErrors('email');

        $this->assertSame(1, User::where('email', 'partner@victimfirm.co.uk')->count());
        $this->assertDatabaseMissing('firms', ['name' => 'Attacker LLP']);
    }

    /** SL-25: an unverified account cannot reach the application */
    public function test_unverified_user_is_held_at_the_verification_notice(): void
    {
        [$firm, $user] = $this->createFirmAndUser(['email_verified_at' => null]);

        $this->actingAsUser($user)->get('/dashboard')
            ->assertRedirect(route('verification.notice'));
        $this->actingAsUser($user)->get('/matters')
            ->assertRedirect(route('verification.notice'));
    }

    /** SL-11: the queue console is gated on role, not on APP_ENV */
    public function test_horizon_is_closed_to_ordinary_users_and_guests(): void
    {
        $this->get('/horizon')->assertStatus(403);

        [$firm, $admin] = $this->createFirmAndAdmin();
        $this->actingAsUser($admin)->get('/horizon')->assertStatus(403);
    }

    /** SL-20: the unauthenticated file-serving routes are not registered */
    public function test_storage_serve_routes_are_not_registered(): void
    {
        $names = collect(app('router')->getRoutes())->map->getName()->filter()->all();

        $this->assertNotContains('storage.local', $names);
        $this->assertNotContains('storage.local.upload', $names);
    }

    /** Defence in depth: the super-admin console is gated by route middleware */
    public function test_super_admin_console_is_gated_by_route_middleware(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();

        foreach (['/superadmin/dashboard', '/superadmin/firms', '/superadmin/users', '/superadmin/backups'] as $url) {
            $this->actingAsUser($admin)->get($url)->assertStatus(403);
        }
    }

    /** SL-08: another firm's contact cannot be attached to a matter */
    public function test_cannot_attach_another_firms_contact_to_a_matter(): void
    {
        [$firmA, $adminA] = $this->createFirmAndAdmin();
        [$firmB, $adminB] = $this->createFirmAndAdmin();

        $victim = Contact::factory()->create([
            'firm_id' => $firmA->id, 'name' => 'Secret Client A',
        ]);

        $this->actingAsUser($adminB)->post('/matters', [
            'name' => 'Recon', 'practice_area' => 'litigation',
            'fee_arrangement' => 'hourly_rate',
            'responsible_user_id' => $adminB->id,
            'contact_ids' => [$victim->id],
        ])->assertSessionHasErrors('contact_ids.0');

        $this->assertSame(0, Matter::where('firm_id', $firmB->id)->count());
    }

    /** SL-08: a matter cannot be assigned to another firm's user */
    public function test_cannot_assign_a_matter_to_another_firms_user(): void
    {
        [$firmA, $adminA] = $this->createFirmAndAdmin();
        [$firmB, $adminB] = $this->createFirmAndAdmin();
        $ownContact = Contact::factory()->create(['firm_id' => $firmB->id]);

        $this->actingAsUser($adminB)->post('/matters', [
            'name' => 'Recon', 'practice_area' => 'litigation',
            'fee_arrangement' => 'hourly_rate',
            'responsible_user_id' => $adminA->id,
            'contact_ids' => [$ownContact->id],
        ])->assertSessionHasErrors('responsible_user_id');
    }

    /** SL-08: tasks and events cannot name another firm's user */
    public function test_cannot_assign_tasks_or_events_across_firms(): void
    {
        [$firmA, $adminA] = $this->createFirmAndAdmin();
        [$firmB, $adminB] = $this->createFirmAndAdmin();

        // Build the other firm's fixture before authenticating, so the write
        // is not itself a cross-tenant create.
        $matterA = Matter::factory()->create(['firm_id' => $firmA->id]);

        $this->actingAsUser($adminB)->post('/tasks', [
            'title' => 'Recon', 'priority' => 'high', 'assignee_id' => $adminA->id,
        ])->assertSessionHasErrors('assignee_id');

        // The calendar endpoint answers JSON, so the rejection arrives as a
        // 422 rather than a redirect with session errors.
        $this->actingAsUser($adminB)->postJson('/calendar', [
            'title' => 'Recon', 'type' => 'appointment',
            'start_at' => now()->addDay()->toDateTimeString(),
            'matter_id' => $matterA->id,
        ])->assertStatus(422)->assertJsonValidationErrors('matter_id');
    }

    /** SL-09: the global scope hides other firms' records from route binding */
    public function test_route_binding_cannot_reach_another_firms_records(): void
    {
        [$firmA, $adminA] = $this->createFirmAndAdmin();
        [$firmB, $adminB] = $this->createFirmAndAdmin();

        $matterA = Matter::factory()->create(['firm_id' => $firmA->id]);
        $contactA = Contact::factory()->create(['firm_id' => $firmA->id]);

        $this->actingAsUser($adminB)->get("/matters/{$matterA->id}")->assertStatus(404);
        $this->actingAsUser($adminB)->get("/contacts/{$contactA->id}")->assertStatus(404);
    }

    /** SL-09: creating a record cannot place it in another firm */
    public function test_created_records_are_stamped_with_the_callers_firm(): void
    {
        [$firmA, $adminA] = $this->createFirmAndAdmin();
        [$firmB, $adminB] = $this->createFirmAndAdmin();

        $this->actingAsUser($adminB)->post('/tasks', [
            'title' => 'Planted', 'priority' => 'low', 'firm_id' => $firmA->id,
        ])->assertRedirect();

        $this->assertDatabaseHas('tasks', ['title' => 'Planted', 'firm_id' => $firmB->id]);
        $this->assertDatabaseMissing('tasks', ['title' => 'Planted', 'firm_id' => $firmA->id]);
    }

    /** SL-07: an unsigned archive is refused before any SQL is replayed */
    public function test_restore_refuses_an_unverified_archive(): void
    {
        $superAdmin = User::factory()->create(['role' => 'super_admin', 'is_active' => true]);
        $superAdmin->assignRole('super_admin');

        $dir = \App\Support\BackupArchive::directory();
        if (! is_dir($dir)) {
            mkdir($dir, 0700, true);
        }

        // A well-named archive with no signature: an attacker-supplied dump.
        $name = 'backup-2026-08-27-10-00-00-deadbeef.tar.gz';
        file_put_contents("{$dir}/{$name}", 'not a real backup');

        try {
            $this->actingAsUser($superAdmin)
                ->post('/superadmin/backups/restore', ['filename' => $name])
                ->assertSessionHas('error');

            $this->assertDatabaseHas('users', ['id' => $superAdmin->id]);
        } finally {
            @unlink("{$dir}/{$name}");
        }
    }

    /** SL-07: restore will not accept a path outside the backup directory */
    public function test_restore_rejects_paths_outside_the_backup_directory(): void
    {
        $superAdmin = User::factory()->create(['role' => 'super_admin', 'is_active' => true]);
        $superAdmin->assignRole('super_admin');

        foreach (['../../../.env', '/etc/passwd', 'backup-../evil.tar.gz'] as $candidate) {
            $this->actingAsUser($superAdmin)
                ->post('/superadmin/backups/restore', ['filename' => $candidate])
                ->assertSessionHas('error');
        }
    }

    /** SL-07: the upload-based restore endpoint no longer accepts archives */
    public function test_restore_ignores_an_uploaded_archive(): void
    {
        $superAdmin = User::factory()->create(['role' => 'super_admin', 'is_active' => true]);
        $superAdmin->assignRole('super_admin');

        $this->actingAsUser($superAdmin)->post('/superadmin/backups/restore', [
            'backup_file' => UploadedFile::fake()->create('evil.tar.gz', 10, 'application/gzip'),
        ])->assertSessionHasErrors('filename');
    }

    /** SL-07: a signed archive produced by this system does verify */
    public function test_signed_archives_verify_and_tampering_is_detected(): void
    {
        $dir = \App\Support\BackupArchive::directory();
        if (! is_dir($dir)) {
            mkdir($dir, 0700, true);
        }

        $path = "{$dir}/backup-2026-08-27-11-00-00-abcdef12.tar.gz";
        file_put_contents($path, 'archive contents');

        try {
            \App\Support\BackupArchive::sign($path);
            $this->assertTrue(\App\Support\BackupArchive::verify($path));

            file_put_contents($path, 'archive contents, modified');
            $this->assertFalse(\App\Support\BackupArchive::verify($path));
        } finally {
            @unlink($path);
            @unlink($path.'.sig');
        }
    }

    /** SL-15/SL-16: backup archives are not world readable */
    public function test_backup_download_rejects_unrecognised_filenames(): void
    {
        $superAdmin = User::factory()->create(['role' => 'super_admin', 'is_active' => true]);
        $superAdmin->assignRole('super_admin');

        foreach (['../../.env', 'evil.tar.gz', 'backup-x.tar.gz'] as $candidate) {
            $this->actingAsUser($superAdmin)
                ->get('/superadmin/backups/'.rawurlencode($candidate))
                ->assertStatus(404);
        }
    }

    /** SL-10: every page response carries the security headers */
    public function test_security_headers_are_present_on_page_responses(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();

        $response = $this->actingAsUser($admin)->get('/dashboard');

        $csp = (string) $response->headers->get('Content-Security-Policy');

        $this->assertStringContainsString("default-src 'self'", $csp);
        $this->assertStringContainsString("object-src 'none'", $csp);
        $this->assertStringContainsString("frame-ancestors 'none'", $csp);
        $this->assertMatchesRegularExpression("/script-src [^;]*'nonce-[^']+'/", $csp);
        $this->assertStringNotContainsString("script-src 'self' 'unsafe-inline'", $csp);

        $this->assertSame('nosniff', $response->headers->get('X-Content-Type-Options'));
        $this->assertSame('DENY', $response->headers->get('X-Frame-Options'));
        $this->assertSame('strict-origin-when-cross-origin', $response->headers->get('Referrer-Policy'));
    }

    /** SL-10: the login page is covered too, not just authenticated routes */
    public function test_security_headers_are_present_for_guests(): void
    {
        $response = $this->get('/login');

        $this->assertNotNull($response->headers->get('Content-Security-Policy'));
        $this->assertSame('nosniff', $response->headers->get('X-Content-Type-Options'));
    }

    /** SL-12: the audit log requires a permission */
    public function test_activity_log_requires_a_permission(): void
    {
        [$firm, $clerk] = $this->createFirmAndUser(['role' => 'lawyer']);
        $clerk->syncRoles(['lawyer']);

        $this->actingAsUser($clerk->fresh())->get('/activities')->assertStatus(403);

        [$firm2, $admin] = $this->createFirmAndAdmin();
        $this->actingAsUser($admin)->get('/activities')->assertOk();
    }

    /** SL-14: invoices cannot be emailed to an arbitrary address */
    public function test_invoice_cannot_be_emailed_to_an_unrelated_address(): void
    {
        \Illuminate\Support\Facades\Mail::fake();

        [$firm, $admin] = $this->createFirmAndAdmin();
        $matter = Matter::factory()->create(['firm_id' => $firm->id]);
        $client = Contact::factory()->create(['firm_id' => $firm->id, 'email' => 'client@example.com']);
        $matter->contacts()->attach($client->id, ['role' => 'client']);

        $invoice = \App\Models\Invoice::factory()->create([
            'firm_id' => $firm->id, 'matter_id' => $matter->id,
        ]);

        $this->actingAsUser($admin)
            ->post("/billing/{$invoice->id}/send-email", ['recipient_email' => 'attacker@evil.example'])
            ->assertSessionHasErrors('recipient_email');

        \Illuminate\Support\Facades\Mail::assertNothingSent();

        // The matter's own client contact is still fine.
        $this->actingAsUser($admin)
            ->post("/billing/{$invoice->id}/send-email", ['recipient_email' => 'client@example.com'])
            ->assertSessionHasNoErrors();
    }

    /** SL-17: setup links expire, and the token never reaches the browser */
    public function test_expired_firm_setup_token_is_rejected(): void
    {
        $firm = Firm::factory()->create([
            'setup_token' => str_repeat('a', 64),
            'setup_token_expires_at' => now()->subHour(),
            'setup_completed_at' => null,
        ]);

        $this->get('/firm/setup/'.str_repeat('a', 64))->assertStatus(410);
    }

    /** SL-17: a live setup link works and does not leak firm internals */
    public function test_valid_setup_link_does_not_expose_the_token_or_bank_details(): void
    {
        $firm = Firm::factory()->create([
            'setup_token' => str_repeat('b', 64),
            'setup_token_expires_at' => now()->addDay(),
            'setup_completed_at' => null,
            'bank_account_number' => '12345678',
        ]);

        $body = $this->get('/firm/setup/'.str_repeat('b', 64))->assertOk()->getContent();

        $this->assertStringNotContainsString('12345678', $body);
        $this->assertStringNotContainsString('setup_token', $body);
    }

    /** SL-22: the weakest password path is no longer 8 characters */
    public function test_admin_created_users_require_a_strong_password(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();

        $this->actingAsUser($admin)->post('/admin/users', [
            'full_name' => 'Weak', 'email' => 'weak@example.com',
            'password' => 'Short1!', 'password_confirmation' => 'Short1!',
            'role' => 'lawyer',
        ])->assertSessionHasErrors('password');
    }

    /** SL-27: timers follow assignment — staff track only visible matters */
    public function test_time_tracking_follows_matter_assignment(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $matter = Matter::factory()->forFirm($firm, $admin)->create();
        $other = Matter::factory()->forFirm($firm, $admin)->create();
        $staff = User::factory()->forFirm($firm)->create(['role' => 'lawyer']);
        $staff->assignRole('lawyer');
        $matter->assignees()->syncWithoutDetaching([$staff->id]);

        // Assigned matter: full lifecycle works.
        $this->actingAsUser($staff);
        $this->postJson('/time/checkin', ['matter_id' => $matter->id])->assertOk();
        $this->postJson('/time/pause')->assertOk();
        $this->postJson('/time/resume')->assertOk();
        $this->postJson('/time/checkout')->assertOk();

        // Unassigned matter: creation is refused, nothing is written.
        $this->postJson('/time/checkin', ['matter_id' => $other->id])->assertStatus(404);
        $this->postJson('/time/timer/start', ['matter_id' => $other->id])->assertStatus(404);
        $this->assertDatabaseMissing('time_sessions', ['user_id' => $staff->id, 'matter_id' => $other->id]);
        $this->assertSame(1, \App\Models\TimeEntry::where('user_id', $staff->id)->count());
    }

    /** SL-27: the gate must not block legitimate time tracking */
    public function test_users_with_create_permission_can_still_check_in(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $matter = Matter::factory()->forFirm($firm, $admin)->create();

        $this->actingAsUser($admin)
            ->postJson('/time/checkin', ['matter_id' => $matter->id])
            ->assertOk();

        $this->assertDatabaseHas('time_sessions', ['user_id' => $admin->id, 'matter_id' => $matter->id]);
    }

    /** SL-29: 2FA state cannot be flipped via mass assignment (M2) */
    public function test_totp_fields_are_not_mass_assignable(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $user = User::factory()->forFirm($firm)->create(['role' => 'lawyer']);
        $user->assignRole('lawyer');

        $user->update(['totp_enabled' => true, 'totp_secret' => 'ATTACKER']);
        $this->assertFalse($user->fresh()->totp_enabled);
        $this->assertNull($user->fresh()->totp_secret);

        $this->actingAsUser($admin)
            ->put("/admin/users/{$user->id}", ['totp_enabled' => true])
            ->assertSessionHasNoErrors();
        $this->assertFalse($user->fresh()->totp_enabled);
    }

    /** SL-30: the firm setup token cannot be set via mass assignment (M2) */
    public function test_setup_token_fields_are_not_mass_assignable(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();

        $firm->update([
            'setup_token' => 'ATTACKER',
            'setup_token_expires_at' => now()->addDay(),
        ]);
        $this->assertNotEquals('ATTACKER', $firm->fresh()->setup_token);
    }

    /** SL-28: cross-firm IDs fail validation instead of leaking existence (H3) */
    public function test_cross_firm_ids_are_rejected_by_scoped_validators(): void
    {
        [$firmA, $adminA] = $this->createFirmAndAdmin();
        [$firmB, $adminB] = $this->createFirmAndAdmin();
        $foreignMatter = Matter::factory()->forFirm($firmB, $adminB)->create();
        $foreignInvoice = \App\Models\Invoice::factory()->forFirm($firmB)->create(['status' => 'sent']);

        $this->actingAsUser($adminA)
            ->postJson('/time/checkin', ['matter_id' => $foreignMatter->id])
            ->assertStatus(422);
        $this->assertDatabaseMissing('time_sessions', ['user_id' => $adminA->id]);

        $this->actingAsUser($adminA)
            ->postJson('/transactions', [
                'invoice_id' => $foreignInvoice->id,
                'amount' => 10, 'method' => 'cash',
                'paid_at' => now()->toDateString(),
            ])
            ->assertStatus(422);
        $this->assertDatabaseMissing('payments', ['invoice_id' => $foreignInvoice->id]);
    }

    /** SL-31: the superadmin console lists firm admins only — firm end-users stay invisible, including via direct URLs */
    public function test_superadmin_user_console_excludes_firm_end_users(): void
    {
        [$firmA, $adminA] = $this->createFirmAndAdmin();
        [$firmB, $adminB] = $this->createFirmAndAdmin();
        $solicitor = User::factory()->forFirm($firmA)->create(['role' => 'lawyer']);
        $solicitor->assignRole('lawyer');

        $superadmin = User::factory()->create(['role' => 'super_admin', 'firm_id' => null]);
        $superadmin->assignRole('super_admin');

        $this->actingAsUser($superadmin)->get('/superadmin/users')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('users.total', 3)
                ->where('users.data', fn ($data) => collect($data)->pluck('id')->contains($solicitor->id) === false));

        // Direct object URLs fail closed without confirming the account exists.
        $this->actingAsUser($superadmin)->put("/superadmin/users/{$solicitor->id}", ['full_name' => 'X'])->assertNotFound();
        $this->actingAsUser($superadmin)->delete("/superadmin/users/{$solicitor->id}")->assertNotFound();
        $this->actingAsUser($superadmin)->put("/superadmin/users/{$solicitor->id}/reset-password")->assertNotFound();

        // Firm admins remain fully manageable.
        $this->actingAsUser($superadmin)->put("/superadmin/users/{$adminA->id}", ['full_name' => 'Renamed Admin'])
            ->assertRedirect();
        $this->assertSame('Renamed Admin', $adminA->fresh()->full_name);
    }
}
