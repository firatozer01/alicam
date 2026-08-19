<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('seller_credits', function (Blueprint $table) {
            $table->foreignId('user_id')->primary()->constrained()->cascadeOnDelete();
            $table->unsignedInteger('balance')->default(0);
            $table->timestamps();
        });

        Schema::create('request_unlocks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('seller_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('request_id')->constrained('requests')->cascadeOnDelete();
            $table->unsignedInteger('credit_spent');
            $table->timestamp('unlocked_at')->useCurrent();

            $table->unique(['seller_id', 'request_id']);
            $table->index(['request_id', 'unlocked_at']);
        });

        Schema::create('credit_transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('type', 24);
            $table->integer('amount');
            $table->string('reference_type', 64)->nullable();
            $table->unsignedBigInteger('reference_id')->nullable();
            $table->unsignedInteger('balance_after');
            $table->jsonb('metadata')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'created_at']);
            $table->index(['reference_type', 'reference_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('credit_transactions');
        Schema::dropIfExists('request_unlocks');
        Schema::dropIfExists('seller_credits');
    }
};
