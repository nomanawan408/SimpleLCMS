<?php

namespace App\Http\Requests\Ledger;

use Illuminate\Foundation\Http\FormRequest;

class RunReconciliationRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'as_at_date'              => ['required', 'date', 'before_or_equal:today'],
            'paper_statement_balance' => ['required', 'numeric', 'min:0', 'max:999999999.99'],
            'notes'                   => ['nullable', 'string', 'max:2000'],
        ];
    }
}
