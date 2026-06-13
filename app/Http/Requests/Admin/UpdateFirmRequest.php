<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class UpdateFirmRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'vat_number' => ['nullable', 'string', 'max:50'],
            'sra_number' => ['nullable', 'string', 'max:50'],
            'address_line1' => ['nullable', 'string', 'max:255'],
            'address_line2' => ['nullable', 'string', 'max:255'],
            'city' => ['nullable', 'string', 'max:100'],
            'county' => ['nullable', 'string', 'max:100'],
            'postcode' => ['nullable', 'string', 'max:10'],
            'phone' => ['nullable', 'string', 'max:50'],
            'email' => ['nullable', 'email', 'max:255'],
            'website' => ['nullable', 'url', 'max:255'],
            'timezone' => ['nullable', 'string'],
            'default_hourly_rate' => ['nullable', 'numeric', 'min:0'],
            'invoice_prefix' => ['nullable', 'string', 'max:20'],
            'vat_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'payment_terms_days' => ['nullable', 'integer', 'min:1'],
            'bank_name' => ['nullable', 'string', 'max:255'],
            'bank_sort_code' => ['nullable', 'string', 'max:10'],
            'bank_account_number' => ['nullable', 'string', 'max:30'],
            'bank_account_name' => ['nullable', 'string', 'max:255'],
            'bank_iban' => ['nullable', 'string', 'max:50'],
            'bank_swift_code' => ['nullable', 'string', 'max:20'],
            'payment_instructions' => ['nullable', 'string', 'max:2000'],
        ];
    }
}
