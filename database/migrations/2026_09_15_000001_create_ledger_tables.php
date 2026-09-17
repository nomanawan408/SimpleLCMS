<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('financial_transactions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('firm_id');
            $table->uuid('matter_id');
            $table->date('transaction_date');
            $table->string('reference')->nullable();
            $table->text('narrative');
            $table->enum('transaction_type', [
                'client_receipt',
                'client_payment',
                'client_to_office_transfer',
                'reversal',
            ]);
            $table->uuid('reversal_of_id')->nullable();
            $table->uuid('created_by');
            $table->timestamps();

            $table->foreign('firm_id')->references('id')->on('firms')->onDelete('cascade');
            $table->foreign('matter_id')->references('id')->on('matters')->onDelete('restrict');
            $table->foreign('created_by')->references('id')->on('users')->onDelete('restrict');
            $table->index(['firm_id', 'transaction_date']);
            $table->index(['firm_id', 'matter_id']);
        });

        // Self-referencing FK in its own statement: Postgres rejects it
        // inside the CREATE TABLE block.
        Schema::table('financial_transactions', function (Blueprint $table) {
            $table->foreign('reversal_of_id')->references('id')->on('financial_transactions')->onDelete('restrict');
        });

        Schema::create('ledger_postings', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('firm_id');
            $table->uuid('transaction_id');
            $table->uuid('matter_id');
            $table->enum('account_type', [
                'matter_client',
                'matter_business',
                'cash_sheet_client',
                'cash_sheet_business',
            ]);
            $table->enum('entry_type', ['debit', 'credit']);
            $table->decimal('amount', 12, 2);
            $table->date('value_date');
            $table->decimal('balance_after', 12, 2)->nullable();
            $table->timestamps();

            $table->foreign('firm_id')->references('id')->on('firms')->onDelete('cascade');
            $table->foreign('transaction_id')->references('id')->on('financial_transactions')->onDelete('cascade');
            $table->foreign('matter_id')->references('id')->on('matters')->onDelete('restrict');
            $table->index(['firm_id', 'matter_id', 'account_type']);
            $table->index(['firm_id', 'account_type', 'value_date']);
        });

        Schema::create('bank_reconciliations', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('firm_id');
            $table->date('as_at_date');
            $table->date('reconciliation_date');
            $table->decimal('paper_statement_balance', 12, 2);
            $table->decimal('system_cash_sheet_balance', 12, 2);
            $table->decimal('aggregate_client_ledger_balance', 12, 2);
            $table->decimal('discrepancy', 12, 2)->default(0.00);
            $table->enum('status', ['balanced', 'discrepancy_found']);
            $table->text('notes')->nullable();
            $table->uuid('performed_by');
            $table->timestamps();

            $table->foreign('firm_id')->references('id')->on('firms')->onDelete('cascade');
            $table->foreign('performed_by')->references('id')->on('users')->onDelete('restrict');
            $table->index(['firm_id', 'as_at_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bank_reconciliations');
        Schema::dropIfExists('ledger_postings');
        Schema::dropIfExists('financial_transactions');
    }
};
