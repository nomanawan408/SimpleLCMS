<?php

namespace App\Http\Requests\Matter;

use Illuminate\Foundation\Http\FormRequest;

class UpdateMatterRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'name'                => ['sometimes', 'string', 'max:255'],
            'description'         => ['nullable', 'string'],
            'status'              => ['sometimes', 'in:open,pending_court_date,awaiting_client,awaiting_opponent,on_hold,closed,archived'],
            'practice_area'       => ['sometimes', 'in:conveyancing,family_law,litigation,employment,wills_probate,corporate,immigration,criminal,personal_injury,custom'],
            'fee_arrangement'     => ['sometimes', 'in:hourly_rate,fixed_fee,contingency,retainer'],
            'responsible_user_id' => ['sometimes', 'uuid'],
            'court'               => ['nullable', 'string', 'max:255'],
            'court_reference'     => ['nullable', 'string', 'max:100'],
            'custom_fields'       => ['nullable', 'array'],
            'custom_fields.hourly_rate'           => ['nullable', 'numeric', 'min:0'],
            'custom_fields.fixed_amount'          => ['nullable', 'numeric', 'min:0'],
            'custom_fields.contingency_percentage'=> ['nullable', 'numeric', 'min:0', 'max:100'],
            'custom_fields.retainer_amount'       => ['nullable', 'numeric', 'min:0'],
            'custom_fields.retainer_replenish'    => ['nullable', 'numeric', 'min:0'],
            'custom_fields.fee_notes'             => ['nullable', 'string', 'max:500'],
        ];
    }
}
