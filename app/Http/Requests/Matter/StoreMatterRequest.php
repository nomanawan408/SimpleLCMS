<?php

namespace App\Http\Requests\Matter;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreMatterRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        $firmId = $this->user()?->firm_id;

        return [
            'name'                  => ['required', 'string', 'max:255'],
            'description'           => ['nullable', 'string'],
            'practice_area'         => ['required', 'in:conveyancing,family_law,litigation,employment,wills_probate,corporate,immigration,criminal,personal_injury,custom'],
            'fee_arrangement'       => ['required', 'in:hourly_rate,fixed_fee,contingency,retainer'],
            // Firm-scoped: a bare 'uuid' rule let a matter be pointed at a
            // user or contact belonging to another firm, which then rendered
            // on the matter page.
            'responsible_user_id'   => ['required', 'uuid', Rule::exists('users', 'id')->where(fn ($q) => $q->where('firm_id', $firmId))],
            'originating_user_id'   => ['nullable', 'uuid', Rule::exists('users', 'id')->where(fn ($q) => $q->where('firm_id', $firmId))],
            'court'                 => ['nullable', 'string', 'max:255'],
            'court_reference'       => ['nullable', 'string', 'max:100'],
            'contact_ids'           => ['required', 'array', 'min:1'],
            'contact_ids.*'         => ['uuid', Rule::exists('contacts', 'id')->where(fn ($q) => $q->where('firm_id', $firmId))],
            'custom_fields'         => ['nullable', 'array'],
            'custom_fields.hourly_rate'           => ['nullable', 'numeric', 'min:0'],
            'custom_fields.fixed_amount'          => ['nullable', 'numeric', 'min:0'],
            'custom_fields.contingency_percentage'=> ['nullable', 'numeric', 'min:0', 'max:100'],
            'custom_fields.retainer_amount'       => ['nullable', 'numeric', 'min:0'],
            'custom_fields.retainer_replenish'    => ['nullable', 'numeric', 'min:0'],
            'custom_fields.fee_notes'             => ['nullable', 'string', 'max:500'],
            'custom_fields.custom_practice_area'  => ['required_if:practice_area,custom', 'nullable', 'string', 'max:100'],
        ];
    }
}
