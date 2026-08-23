<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('time_sessions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('firm_id');
            $table->uuid('user_id');
            $table->uuid('matter_id');
            $table->string('matter_name');
            $table->string('matter_number')->nullable();
            $table->string('activity_type')->default('other');
            $table->text('description')->nullable();
            $table->decimal('rate', 12, 2)->default(0);
            $table->timestamp('started_at');
            $table->timestamp('paused_at')->nullable();
            $table->unsignedInteger('total_paused_seconds')->default(0);
            $table->enum('status', ['active', 'paused'])->default('active');

            $table->timestamps();

            // One live session per user
            $table->unique('user_id');
            $table->foreign('firm_id')->references('id')->on('firms')->onDelete('cascade');
            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
            $table->foreign('matter_id')->references('id')->on('matters')->onDelete('cascade');
            $table->index(['firm_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('time_sessions');
    }
};