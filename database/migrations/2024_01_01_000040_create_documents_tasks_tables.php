<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('documents', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('firm_id');
            $table->uuid('matter_id');
            $table->uuid('uploaded_by_id');
            $table->uuid('parent_id')->nullable();
            $table->string('name');
            $table->string('original_name');
            $table->text('s3_key')->nullable();
            $table->string('s3_bucket')->nullable();
            $table->string('folder')->default('general');
            $table->unsignedInteger('version')->default(1);
            $table->string('mime_type')->nullable();
            $table->unsignedBigInteger('size_bytes')->nullable();
            $table->boolean('is_client_visible')->default(false);
            $table->boolean('is_signed')->default(false);
            $table->timestamp('signed_at')->nullable();
            $table->json('signer_data')->nullable();
            $table->string('docuseal_submission_id')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->foreign('firm_id')->references('id')->on('firms')->onDelete('cascade');
            $table->foreign('matter_id')->references('id')->on('matters')->onDelete('cascade');
            $table->foreign('uploaded_by_id')->references('id')->on('users')->onDelete('cascade');
            $table->index('firm_id');
            $table->index(['firm_id', 'matter_id']);
        });

        Schema::create('document_templates', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('firm_id')->nullable();
            $table->uuid('created_by_id')->nullable();
            $table->string('name');
            $table->string('practice_area')->nullable();
            $table->longText('content');
            $table->boolean('is_system')->default(false);
            $table->timestamps();
            $table->softDeletes();

            $table->index('firm_id');
        });

        Schema::create('tasks', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('firm_id');
            $table->uuid('matter_id')->nullable();
            $table->uuid('assignee_id')->nullable();
            $table->uuid('created_by_id');
            $table->string('title');
            $table->text('description')->nullable();
            $table->date('due_date')->nullable();
            $table->enum('priority', ['high', 'medium', 'low'])->default('medium');
            $table->enum('status', ['todo', 'in_progress', 'review', 'done'])->default('todo');
            $table->string('recurrence_rule')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->foreign('firm_id')->references('id')->on('firms')->onDelete('cascade');
            $table->foreign('matter_id')->references('id')->on('matters')->onDelete('set null');
            $table->foreign('assignee_id')->references('id')->on('users')->onDelete('set null');
            $table->foreign('created_by_id')->references('id')->on('users')->onDelete('cascade');
            $table->index('firm_id');
            $table->index(['firm_id', 'matter_id']);
            $table->index(['firm_id', 'assignee_id']);
            $table->index(['firm_id', 'status']);
        });

        Schema::create('calendar_events', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('firm_id');
            $table->uuid('matter_id')->nullable();
            $table->uuid('created_by_id');
            $table->string('title');
            $table->enum('type', ['appointment', 'court_date', 'deadline', 'file_review', 'consultation', 'other'])->default('appointment');
            $table->timestamp('start_at');
            $table->timestamp('end_at');
            $table->string('location')->nullable();
            $table->string('video_url')->nullable();
            $table->json('attendees')->nullable();
            $table->string('recurrence_rule')->nullable();
            $table->unsignedInteger('reminder_minutes')->nullable();
            $table->boolean('is_court_date')->default(false);
            $table->string('google_event_id')->nullable();
            $table->string('ms_event_id')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->foreign('firm_id')->references('id')->on('firms')->onDelete('cascade');
            $table->foreign('matter_id')->references('id')->on('matters')->onDelete('set null');
            $table->foreign('created_by_id')->references('id')->on('users')->onDelete('cascade');
            $table->index('firm_id');
            $table->index(['firm_id', 'start_at']);
            $table->index(['firm_id', 'is_court_date']);
        });

        Schema::create('notes', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('firm_id');
            $table->uuid('matter_id');
            $table->uuid('user_id');
            $table->text('body');
            $table->enum('type', ['note', 'call_log', 'email_log', 'meeting_log'])->default('note');
            $table->timestamp('logged_at');
            $table->timestamps();
            $table->softDeletes();

            $table->foreign('firm_id')->references('id')->on('firms')->onDelete('cascade');
            $table->foreign('matter_id')->references('id')->on('matters')->onDelete('cascade');
            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
            $table->index('firm_id');
            $table->index(['firm_id', 'matter_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notes');
        Schema::dropIfExists('calendar_events');
        Schema::dropIfExists('tasks');
        Schema::dropIfExists('document_templates');
        Schema::dropIfExists('documents');
    }
};
