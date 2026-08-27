<?php

namespace App\Http\Requests\Admin;

use App\Rules\AssignableRole;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class StoreUserRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'full_name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', Rule::unique('users', 'email')],
            'password' => ['required', 'confirmed', Password::min(12)],
            'role' => ['required', 'string', new AssignableRole($this->user())],
            'phone' => ['nullable', 'string', 'max:50'],
            'rate_per_hour' => ['nullable', 'numeric', 'min:0'],
        ];
    }
}
