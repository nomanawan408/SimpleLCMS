<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('time_entries', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('firm_id');
            $table->uuid('matter_id');
            $table->uuid('user_id');
            $table->uuid('invoice_id')->nullable();
            $table->date('date');
            $table->unsignedInteger('duration_minutes');
            $table->decimal('rate', 10, 2);
            $table->decimal('amount', 12, 2);
            $table->boolean('billable')->default(true);
            $table->boolean('billed')->default(false);
            $table->enum('activity_type', ['advising', 'drafting', 'research', 'court_attendance', 'travel', 'telephone', 'correspondence', 'meeting', 'other'])->default('other');
            $table->text('description')->nullable();
            $table->boolean('is_locked')->default(false);
            $table->timestamps();
            $table->softDeletes();

            $table->foreign('firm_id')->references('id')->on('firms')->onDelete('cascade');
            $table->foreign('matter_id')->references('id')->on('matters')->onDelete('cascade');
            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
            $table->index('firm_id');
            $table->index(['firm_id', 'matter_id']);
            $table->index(['firm_id', 'user_id']);
            $table->index(['firm_id', 'billed']);
        });

        Schema::create('expenses', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('firm_id');
            $table->uuid('matter_id');
            $table->uuid('user_id');
            $table->uuid('invoice_id')->nullable();
            $table->date('date');
            $table->string('vendor')->nullable();
            $table->decimal('amount', 12, 2);
            $table->decimal('vat_amount', 12, 2)->default(0);
            $table->enum('category', ['court_fees', 'counsel_fees', 'travel', 'disbursement', 'stamp_duty', 'search_fees', 'translation', 'other'])->default('other');
            $table->boolean('billable')->default(true);
            $table->boolean('billed')->default(false);
            $table->string('receipt_path')->nullable();
            $table->text('description')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->foreign('firm_id')->references('id')->on('firms')->onDelete('cascade');
            $table->foreign('matter_id')->references('id')->on('matters')->onDelete('cascade');
            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
            $table->index('firm_id');
            $table->index(['firm_id', 'matter_id']);
        });

        Schema::create('invoices', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('firm_id');
            $table->uuid('matter_id');
            $table->string('invoice_number');
            $table->enum('status', ['draft', 'sent', 'partial', 'paid', 'written_off'])->default('draft');
            $table->decimal('subtotal', 12, 2)->default(0);
            $table->decimal('vat_amount', 12, 2)->default(0);
            $table->decimal('vat_rate', 5, 2)->default(23.00);
            $table->decimal('total', 12, 2)->default(0);
            $table->decimal('discount_amount', 12, 2)->default(0);
            $table->text('discount_reason')->nullable();
            $table->date('due_date')->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->string('stripe_payment_intent_id')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->foreign('firm_id')->references('id')->on('firms')->onDelete('cascade');
            $table->foreign('matter_id')->references('id')->on('matters')->onDelete('cascade');
            $table->unique(['firm_id', 'invoice_number']);
            $table->index('firm_id');
            $table->index(['firm_id', 'status']);
        });

        Schema::create('invoice_line_items', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('invoice_id');
            $table->text('description');
            $table->decimal('quantity', 10, 2)->default(1);
            $table->decimal('unit_rate', 12, 2);
            $table->decimal('amount', 12, 2);
            $table->decimal('vat_amount', 12, 2)->default(0);
            $table->enum('type', ['time', 'expense', 'fixed_fee'])->default('time');
            $table->timestamps();

            $table->foreign('invoice_id')->references('id')->on('invoices')->onDelete('cascade');
        });

        Schema::create('payments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('firm_id');
            $table->uuid('invoice_id');
            $table->decimal('amount', 12, 2);
            $table->enum('method', ['stripe_card', 'stripe_sepa', 'bank_transfer', 'cash', 'cheque'])->default('stripe_card');
            $table->string('stripe_charge_id')->nullable();
            $table->timestamp('paid_at');
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->foreign('firm_id')->references('id')->on('firms')->onDelete('cascade');
            $table->foreign('invoice_id')->references('id')->on('invoices')->onDelete('cascade');
            $table->index('firm_id');
        });

        Schema::create('trust_entries', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('firm_id');
            $table->uuid('matter_id');
            $table->enum('type', ['receipt', 'disbursement', 'transfer'])->default('receipt');
            $table->decimal('amount', 12, 2);
            $table->text('description');
            $table->date('date');
            $table->string('reference')->nullable();
            $table->decimal('balance_after', 12, 2);
            $table->timestamps();

            $table->foreign('firm_id')->references('id')->on('firms')->onDelete('cascade');
            $table->foreign('matter_id')->references('id')->on('matters')->onDelete('cascade');
            $table->index('firm_id');
            $table->index(['firm_id', 'matter_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('trust_entries');
        Schema::dropIfExists('payments');
        Schema::dropIfExists('invoice_line_items');
        Schema::dropIfExists('invoices');
        Schema::dropIfExists('expenses');
        Schema::dropIfExists('time_entries');
    }
};
