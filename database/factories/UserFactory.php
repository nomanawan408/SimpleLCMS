<?php

namespace Database\Factories;

use App\Models\Firm;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * @extends Factory<User>
 */
class UserFactory extends Factory
{
    protected static ?string $password;

    public function definition(): array
    {
        return [
            'firm_id'           => Firm::factory(),
            'full_name'         => fake()->name(),
            'email'             => fake()->unique()->safeEmail(),
            'email_verified_at' => now(),
            'password'          => static::$password ??= Hash::make('password'),
            'role'              => 'solicitor',
            'is_active'         => true,
            'totp_enabled'      => false,
            'remember_token'    => Str::random(10),
        ];
    }

    public function firmAdmin(): static
    {
        return $this->state(fn () => ['role' => 'firm_admin']);
    }

    public function accounts(): static
    {
        return $this->state(fn () => ['role' => 'accounts']);
    }

    public function seniorSolicitor(): static
    {
        return $this->state(fn () => ['role' => 'senior_solicitor']);
    }

    public function forFirm(Firm $firm): static
    {
        return $this->state(fn () => ['firm_id' => $firm->id]);
    }

    public function unverified(): static
    {
        return $this->state(fn () => ['email_verified_at' => null]);
    }
}
