<?php

namespace Database\Seeders;

use App\Models\Firm;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DefaultUsersSeeder extends Seeder
{
    public function run(): void
    {
        $firm = Firm::updateOrCreate(
            ['slug' => 'demo-law-firm'],
            [
                'name' => 'Demo Law Firm',
                'plan' => 'professional',
                'address_line1' => '123 High Street',
                'city' => 'London',
                'county' => 'Greater London',
                'postcode' => 'EC1A 1BB',
                'phone' => '+44 20 7946 0958',
                'email' => 'admin@demolawfirm.co.uk',
                'website' => 'https://demolawfirm.co.uk',
                'vat_number' => 'GB123456789',
                'sra_number' => '12345',
                'default_hourly_rate' => 250.00,
                'timezone' => 'Europe/London',
                'invoice_prefix' => 'INV',
                'invoice_sequence' => 1,
                'vat_rate' => 20.00,
                'payment_terms_days' => 30,
            ]
        );

        $superAdmin = User::updateOrCreate(
            ['firm_id' => $firm->id, 'email' => 'superadmin@demolawfirm.co.uk'],
            [
                'full_name' => 'Super Administrator',
                'password' => Hash::make('password'),
                'role' => 'firm_admin',
                'email_verified_at' => now(),
                'phone' => '+44 7700 900123',
                'is_active' => true,
                'totp_enabled' => false,
            ]
        );
        $superAdmin->assignRole('super_admin');

        $admin = User::updateOrCreate(
            ['firm_id' => $firm->id, 'email' => 'admin@demolawfirm.ie'],
            [
                'full_name' => 'Admin User',
                'password' => Hash::make('password'),
                'role' => 'firm_admin',
                'email_verified_at' => now(),
                'phone' => '+44 7700 900456',
                'is_active' => true,
                'totp_enabled' => false,
            ]
        );
        $admin->assignRole('admin');

        $solicitor = User::updateOrCreate(
            ['firm_id' => $firm->id, 'email' => 'john@demolawfirm.ie'],
            [
                'full_name' => 'John Solicitor',
                'password' => Hash::make('password'),
                'role' => 'senior_solicitor',
                'email_verified_at' => now(),
                'phone' => '+44 7700 900789',
                'rate_per_hour' => 300.00,
                'is_active' => true,
                'totp_enabled' => false,
            ]
        );
        $solicitor->assignRole('solicitor');

        $paralegal = User::updateOrCreate(
            ['firm_id' => $firm->id, 'email' => 'mary@demolawfirm.ie'],
            [
                'full_name' => 'Mary Paralegal',
                'password' => Hash::make('password'),
                'role' => 'paralegal',
                'email_verified_at' => now(),
                'phone' => '+44 7700 901234',
                'rate_per_hour' => 120.00,
                'is_active' => true,
                'totp_enabled' => false,
            ]
        );
        $paralegal->assignRole('paralegal');

        $secretary = User::updateOrCreate(
            ['firm_id' => $firm->id, 'email' => 'sarah.secretary@demolawfirm.co.uk'],
            [
                'full_name' => 'Sarah Secretary',
                'password' => Hash::make('password'),
                'role' => 'accounts',
                'email_verified_at' => now(),
                'phone' => '+44 7700 902345',
                'rate_per_hour' => 80.00,
                'is_active' => true,
                'totp_enabled' => false,
            ]
        );
        $secretary->assignRole('secretary');

        $this->command->info('Default firm and users created successfully.');
        $this->command->info('---');
        $this->command->info('Login credentials:');
        $this->command->info('Super Admin: superadmin@demolawfirm.co.uk / password');
        $this->command->info('Admin: admin@demolawfirm.co.uk / password');
        $this->command->info('Solicitor: john.solicitor@demolawfirm.co.uk / password');
        $this->command->info('Paralegal: mary.paralegal@demolawfirm.co.uk / password');
        $this->command->info('Secretary: sarah.secretary@demolawfirm.co.uk / password');
    }
}
