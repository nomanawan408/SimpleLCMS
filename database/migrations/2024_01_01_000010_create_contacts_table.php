<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('contacts', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->uuid('firm_id');
            $table->enum('type', ['individual', 'company', 'other_party'])->default('individual');
            $table->string('name');
            $table->string('email')->nullable();
            $table->string('phone')->nullable();
            $table->string('phone_secondary')->nullable();
            $table->jsonb('address')->default('{}');
            $table->text('national_insurance_number')->nullable();
            $table->text('dob')->nullable();
            $table->string('company_number')->nullable();
            $table->string('id_verification_status')->nullable();
            $table->string('source')->nullable();
            $table->jsonb('tags')->default('[]');
            $table->timestamp('gdpr_consent_at')->nullable();
            $table->string('gdpr_consent_version')->nullable();
            $table->boolean('marketing_consent')->default(false);
            $table->timestamp('conflict_check_cleared_at')->nullable();
            $table->enum('lead_status', ['enquiry', 'consultation_booked', 'engaged', 'matter_opened', 'declined'])->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->foreign('firm_id')->references('id')->on('firms')->onDelete('cascade');
            $table->index('firm_id');
            $table->index(['firm_id', 'type']);
            $table->index(['firm_id', 'name']);
        });

        DB::statement('ALTER TABLE contacts ENABLE ROW LEVEL SECURITY');
        DB::statement("CREATE POLICY firm_isolation ON contacts USING (firm_id = current_setting('app.current_firm_id', true)::uuid)");
    }

    public function down(): void
    {
        Schema::dropIfExists('contacts');
    }
};
