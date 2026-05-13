<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('portal_sessions', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->uuid('firm_id');
            $table->uuid('matter_id');
            $table->uuid('contact_id');
            $table->string('token_hash');
            $table->timestamp('expires_at');
            $table->boolean('totp_verified')->default(false);
            $table->timestamp('last_accessed_at')->nullable();
            $table->timestamps();

            $table->foreign('firm_id')->references('id')->on('firms')->onDelete('cascade');
            $table->foreign('matter_id')->references('id')->on('matters')->onDelete('cascade');
            $table->foreign('contact_id')->references('id')->on('contacts')->onDelete('cascade');
            $table->index(['firm_id', 'matter_id']);
        });

        Schema::create('portal_messages', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->uuid('firm_id');
            $table->uuid('matter_id');
            $table->uuid('sender_id');
            $table->string('sender_type');
            $table->text('body');
            $table->timestamp('read_at')->nullable();
            $table->timestamps();

            $table->foreign('firm_id')->references('id')->on('firms')->onDelete('cascade');
            $table->foreign('matter_id')->references('id')->on('matters')->onDelete('cascade');
            $table->index(['firm_id', 'matter_id']);
        });

        Schema::create('conflict_checks', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->uuid('firm_id');
            $table->uuid('matter_id')->nullable();
            $table->uuid('performed_by_id');
            $table->string('search_term');
            $table->enum('result', ['clear', 'conflict_found', 'reviewed_and_cleared'])->default('clear');
            $table->text('notes')->nullable();
            $table->timestamp('performed_at');
            $table->timestamps();

            $table->foreign('firm_id')->references('id')->on('firms')->onDelete('cascade');
            $table->index('firm_id');
        });

        Schema::create('gdpr_consents', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->uuid('firm_id');
            $table->uuid('contact_id');
            $table->enum('basis', ['contractual', 'consent', 'legitimate_interest'])->default('contractual');
            $table->string('purpose');
            $table->string('version');
            $table->timestamp('given_at');
            $table->timestamp('withdrawn_at')->nullable();
            $table->timestamps();

            $table->foreign('firm_id')->references('id')->on('firms')->onDelete('cascade');
            $table->foreign('contact_id')->references('id')->on('contacts')->onDelete('cascade');
            $table->index(['firm_id', 'contact_id']);
        });

        Schema::create('dsars', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->uuid('firm_id');
            $table->uuid('contact_id');
            $table->uuid('requested_by_id');
            $table->enum('status', ['pending', 'in_progress', 'completed'])->default('pending');
            $table->timestamp('due_at');
            $table->timestamp('completed_at')->nullable();
            $table->string('export_path')->nullable();
            $table->timestamps();

            $table->foreign('firm_id')->references('id')->on('firms')->onDelete('cascade');
            $table->foreign('contact_id')->references('id')->on('contacts')->onDelete('cascade');
            $table->index('firm_id');
        });

        Schema::create('audit_logs', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->uuid('firm_id');
            $table->uuid('causer_id')->nullable();
            $table->string('causer_type')->nullable();
            $table->uuid('subject_id')->nullable();
            $table->string('subject_type')->nullable();
            $table->string('event');
            $table->jsonb('old_values')->nullable();
            $table->jsonb('new_values')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->timestamp('created_at');
        });

        DB::statement('ALTER TABLE portal_sessions ENABLE ROW LEVEL SECURITY');
        DB::statement("CREATE POLICY firm_isolation ON portal_sessions USING (firm_id = current_setting('app.current_firm_id', true)::uuid)");
        DB::statement('ALTER TABLE portal_messages ENABLE ROW LEVEL SECURITY');
        DB::statement("CREATE POLICY firm_isolation ON portal_messages USING (firm_id = current_setting('app.current_firm_id', true)::uuid)");
        DB::statement('ALTER TABLE conflict_checks ENABLE ROW LEVEL SECURITY');
        DB::statement("CREATE POLICY firm_isolation ON conflict_checks USING (firm_id = current_setting('app.current_firm_id', true)::uuid)");
        DB::statement('ALTER TABLE gdpr_consents ENABLE ROW LEVEL SECURITY');
        DB::statement("CREATE POLICY firm_isolation ON gdpr_consents USING (firm_id = current_setting('app.current_firm_id', true)::uuid)");
        DB::statement('ALTER TABLE dsars ENABLE ROW LEVEL SECURITY');
        DB::statement("CREATE POLICY firm_isolation ON dsars USING (firm_id = current_setting('app.current_firm_id', true)::uuid)");
    }

    public function down(): void
    {
        Schema::dropIfExists('audit_logs');
        Schema::dropIfExists('dsars');
        Schema::dropIfExists('gdpr_consents');
        Schema::dropIfExists('conflict_checks');
        Schema::dropIfExists('portal_messages');
        Schema::dropIfExists('portal_sessions');
    }
};
