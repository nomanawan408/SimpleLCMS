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

        User::updateOrCreate(
            ['firm_id' => $firm->id, 'email' => 'superadmin@demolawfirm.co.uk'],
            [
                'full_name'          => 'Super Administrator',
                'password'           => Hash::make('password'),
                'role'               => 'administrator',
                'email_verified_at'  => now(),
                'phone'              => '+44 7700 900123',
                'is_active'          => true,
                'totp_enabled'       => false,
            ]
        );

        User::updateOrCreate(
            ['firm_id' => $firm->id, 'email' => 'admin@demolawfirm.ie'],
            [
                'full_name'          => 'Admin User',
                'password'           => Hash::make('password'),
                'role'               => 'administrator',
                'email_verified_at'  => now(),
                'phone'              => '+44 7700 900456',
                'is_active'          => true,
                'totp_enabled'       => false,
            ]
        );

        User::updateOrCreate(
            ['firm_id' => $firm->id, 'email' => 'john@demolawfirm.ie'],
            [
                'full_name'          => 'John Solicitor',
                'password'           => Hash::make('password'),
                'role'               => 'solicitor',
                'email_verified_at'  => now(),
                'phone'              => '+44 7700 900789',
                'rate_per_hour'      => 300.00,
                'is_active'          => true,
                'totp_enabled'       => false,
            ]
        );

        User::updateOrCreate(
            ['firm_id' => $firm->id, 'email' => 'mary@demolawfirm.ie'],
            [
                'full_name'          => 'Mary Clerk',
                'password'           => Hash::make('password'),
                'role'               => 'clerk',
                'email_verified_at'  => now(),
                'phone'              => '+44 7700 901234',
                'rate_per_hour'      => 120.00,
                'is_active'          => true,
                'totp_enabled'       => false,
            ]
        );

        User::updateOrCreate(
            ['firm_id' => $firm->id, 'email' => 'sarah.secretary@demolawfirm.co.uk'],
            [
                'full_name'          => 'Sarah Accounts',
                'password'           => Hash::make('password'),
                'role'               => 'accounts',
                'email_verified_at'  => now(),
                'phone'              => '+44 7700 902345',
                'rate_per_hour'      => 80.00,
                'is_active'          => true,
                'totp_enabled'       => false,
            ]
        );

        $this->command->info('Default firm and users created successfully.');
        $this->command->info('---');
        $this->command->info('Login credentials:');
        $this->command->info('Super Admin : superadmin@demolawfirm.co.uk / password  (role: administrator)');
        $this->command->info('Admin       : admin@demolawfirm.ie        / password  (role: administrator)');
        $this->command->info('Solicitor   : john@demolawfirm.ie         / password  (role: solicitor)');
        $this->command->info('Clerk       : mary@demolawfirm.ie         / password  (role: clerk)');
        $this->command->info('Accounts    : sarah.secretary@demolawfirm.co.uk / password  (role: accounts)');
    }
}
