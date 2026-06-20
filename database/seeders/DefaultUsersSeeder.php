<?php

namespace Database\Seeders;

use App\Models\Contact;
use App\Models\Firm;
use App\Models\Matter;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DefaultUsersSeeder extends Seeder
{
    public function run(): void
    {
        // ── Super Admin (SaaS platform owner — no firm) ──
        $superAdmin = User::updateOrCreate(
            ['email' => 'superadmin@simplelaw.uk'],
            [
                'full_name'         => 'Super Admin',
                'password'          => Hash::make('password'),
                'role'              => 'super_admin',
                'email_verified_at' => now(),
                'phone'             => '+44 7700 000001',
                'is_active'         => true,
                'totp_enabled'      => false,
            ]
        );
        $superAdmin->syncRoles(['super_admin']);

        // ── Demo Firm ──
        $firm = Firm::updateOrCreate(
            ['slug' => 'demo-law-firm'],
            [
                'name'               => 'Demo Law Firm',
                'plan'               => 'professional',
                'subscription_status'=> 'active',
                'address_line1'      => '123 High Street',
                'city'               => 'London',
                'county'             => 'Greater London',
                'postcode'           => 'EC1A 1BB',
                'phone'              => '+44 20 7946 0958',
                'email'              => 'admin@demolawfirm.co.uk',
                'website'            => 'https://demolawfirm.co.uk',
                'vat_number'         => 'GB123456789',
                'sra_number'         => '12345',
                'default_hourly_rate'=> 250.00,
                'timezone'           => 'Europe/London',
                'invoice_prefix'     => 'INV',
                'invoice_sequence'   => 1,
                'vat_rate'           => 20.00,
                'payment_terms_days' => 30,
            ]
        );

        // ── Firm Admin ──
        $admin = User::updateOrCreate(
            ['firm_id' => $firm->id, 'email' => 'admin@demolawfirm.co.uk'],
            [
                'full_name'         => 'Admin User',
                'password'          => Hash::make('password'),
                'role'              => 'admin',
                'email_verified_at' => now(),
                'phone'             => '+44 7700 000002',
                'is_active'         => true,
                'totp_enabled'      => false,
            ]
        );
        $admin->syncRoles(['admin']);

        // ── Demo Contact ──
        Contact::updateOrCreate(
            ['firm_id' => $firm->id, 'name' => 'John Smith'],
            [
                'type'              => 'individual',
                'email'             => 'john.smith@example.com',
                'phone'             => '+44 7700 111222',
                'address'           => ['line1' => '45 Oak Lane', 'city' => 'London', 'postcode' => 'SW1A 1AA'],
                'lead_status'       => 'matter_opened',
                'gdpr_consent_at'   => now(),
            ]
        );

        // ── Demo Matter ──
        $contact = Contact::where('firm_id', $firm->id)->where('name', 'John Smith')->first();

        $matter = Matter::updateOrCreate(
            ['firm_id' => $firm->id, 'matter_number' => 'MAT-0001'],
            [
                'name'               => 'Smith v Jones — Property Dispute',
                'description'        => 'Boundary dispute between neighbouring properties on Oak Lane.',
                'status'             => 'open',
                'practice_area'      => 'litigation',
                'fee_arrangement'    => 'hourly_rate',
                'responsible_user_id'=> $admin->id,
                'opened_at'          => now(),
            ]
        );

        // Attach the contact to the matter if not already attached
        if ($contact && !$matter->contacts()->where('contact_id', $contact->id)->exists()) {
            $matter->contacts()->attach($contact->id, ['role' => 'client']);
        }

        // ── Demo Tasks ──
        \App\Models\Task::updateOrCreate(
            ['firm_id' => $firm->id, 'title' => 'Prepare witness statement for Smith v Jones'],
            [
                'matter_id'     => $matter->id,
                'assignee_id'   => $admin->id,
                'created_by_id' => $admin->id,
                'description'   => 'Draft the witness statement and review with client before submission.',
                'due_date'      => now()->addDays(2),
                'priority'      => 'high',
                'status'        => 'todo',
            ]
        );

        \App\Models\Task::updateOrCreate(
            ['firm_id' => $firm->id, 'title' => 'File bundle for upcoming hearing'],
            [
                'matter_id'     => $matter->id,
                'assignee_id'   => $admin->id,
                'created_by_id' => $admin->id,
                'description'   => 'Compile and index the court bundle, ensure all exhibits are paginated.',
                'due_date'      => now()->addDays(5),
                'priority'      => 'medium',
                'status'        => 'todo',
            ]
        );

        \App\Models\Task::updateOrCreate(
            ['firm_id' => $firm->id, 'title' => 'Send client care letter to John Smith'],
            [
                'matter_id'     => $matter->id,
                'assignee_id'   => $admin->id,
                'created_by_id' => $admin->id,
                'description'   => 'Send the standard client care letter with terms of engagement.',
                'due_date'      => now()->addDay(),
                'priority'      => 'low',
                'status'        => 'in_progress',
            ]
        );

        \App\Models\Task::updateOrCreate(
            ['firm_id' => $firm->id, 'title' => 'Review land registry documents'],
            [
                'matter_id'     => $matter->id,
                'assignee_id'   => $admin->id,
                'created_by_id' => $admin->id,
                'description'   => 'Review the title deeds and boundary plan from Land Registry.',
                'due_date'      => null,
                'priority'      => 'medium',
                'status'        => 'todo',
            ]
        );

        $this->command->info('');
        $this->command->info('=== Seed Complete ===');
        $this->command->info('');
        $this->command->info('  Super Admin : superadmin@simplelaw.uk / password  (no firm — SaaS owner)');
        $this->command->info('  Firm Admin  : admin@demolawfirm.co.uk / password  (Demo Law Firm)');
        $this->command->info('');
        $this->command->info('  Demo firm has 1 contact (John Smith) and 1 matter (Smith v Jones).');
    }
}
