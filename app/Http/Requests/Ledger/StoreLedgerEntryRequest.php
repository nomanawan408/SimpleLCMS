<?php

namespace App\Http\Requests\Ledger;

use App\Models\FinancialTransaction;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreLedgerEntryRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        $firmId = $this->user()?->firm_id;

        return [
            'matter_id' => [
                'required', 'uuid',
                Rule::exists('matters', 'id')->where(fn ($q) => $q->where('firm_id', $firmId)),
            ],
            'transaction_type' => ['required', Rule::in(['client_receipt', 'client_payment', 'client_to_office_transfer'])],
            'transaction_date' => ['required', 'date', 'before_or_equal:today'],
            'narrative'        => ['required', 'string', 'max:2000'],
            'reference'        => ['nullable', 'string', 'max:100', 'required_if:transaction_type,client_to_office_transfer'],
            'amount'           => ['required', 'numeric', 'min:0.01', 'max:999999999.99'],
        ];
    }

    /** Permission for the requested entry kind (checked by the controller). */
    public function requiredPermission(): string
    {
        return $this->input('transaction_type') === 'client_to_office_transfer'
            ? 'transfer_client_funds'
            : 'post_ledger';
    }
}
