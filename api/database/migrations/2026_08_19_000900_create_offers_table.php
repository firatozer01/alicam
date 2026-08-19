<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('offers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('request_id')->constrained('requests')->cascadeOnDelete();
            $table->foreignId('seller_id')->constrained('users')->cascadeOnDelete();
            $table->decimal('price', 12, 2);
            $table->text('message');
            $table->string('status', 24)->default('pending');
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamp('accepted_at')->nullable();
            $table->timestamps();

            $table->unique(['request_id', 'seller_id']);
            $table->index(['seller_id', 'status', 'created_at']);
            $table->index(['request_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('offers');
    }
};
