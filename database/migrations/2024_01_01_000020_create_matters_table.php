<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('matters', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->uuid('firm_id');
            $table->string('matter_number');
            $table->string('name');
            $table->text('description')->nullable();
            $table->enum('status', ['open', 'pending_court_date', 'awaiting_client', 'awaiting_opponent', 'on_hold', 'closed', 'archived'])->default('open');
            $table->enum('practice_area', ['conveyancing', 'family_law', 'litigation', 'employment', 'wills_probate', 'corporate', 'immigration', 'criminal', 'personal_injury', 'custom'])->default('litigation');
            $table->enum('fee_arrangement', ['hourly_rate', 'fixed_fee', 'contingency', 'retainer'])->default('hourly_rate');
            $table->uuid('responsible_user_id')->nullable();
            $table->uuid('originating_user_id')->nullable();
            $table->string('court')->nullable();
            $table->string('court_reference')->nullable();
            $table->timestamp('opened_at')->nullable();
            $table->timestamp('closed_at')->nullable();
            $table->jsonb('custom_fields')->default('{}');
            $table->timestamps();
            $table->softDeletes();

            $table->foreign('firm_id')->references('id')->on('firms')->onDelete('cascade');
            $table->foreign('responsible_user_id')->references('id')->on('users')->onDelete('set null');
            $table->foreign('originating_user_id')->references('id')->on('users')->onDelete('set null');
            $table->unique(['firm_id', 'matter_number']);
            $table->index('firm_id');
            $table->index(['firm_id', 'status']);
            $table->index(['firm_id', 'practice_area']);
        });

        Schema::create('matter_contacts', function (Blueprint $table) {
            $table->uuid('matter_id');
            $table->uuid('contact_id');
            $table->enum('role', ['client', 'opposing_party', 'witness', 'expert', 'other'])->default('client');
            $table->timestamps();

            $table->primary(['matter_id', 'contact_id']);
            $table->foreign('matter_id')->references('id')->on('matters')->onDelete('cascade');
            $table->foreign('contact_id')->references('id')->on('contacts')->onDelete('cascade');
        });

        DB::statement('ALTER TABLE matters ENABLE ROW LEVEL SECURITY');
        DB::statement("CREATE POLICY firm_isolation ON matters USING (firm_id = current_setting('app.current_firm_id', true)::uuid)");
    }

    public function down(): void
    {
        Schema::dropIfExists('matter_contacts');
        Schema::dropIfExists('matters');
    }
};
