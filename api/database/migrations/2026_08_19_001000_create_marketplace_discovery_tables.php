<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('seller_services', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('category_id')->constrained()->restrictOnDelete();
            $table->string('title', 120);
            $table->text('description');
            $table->decimal('price_from', 12, 2)->nullable();
            $table->string('delivery_time', 80)->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['user_id', 'is_active']);
            $table->index(['category_id', 'is_active']);
        });

        Schema::create('seller_reviews', function (Blueprint $table) {
            $table->id();
            $table->foreignId('offer_id')->unique()->constrained()->cascadeOnDelete();
            $table->foreignId('buyer_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('seller_id')->constrained('users')->cascadeOnDelete();
            $table->unsignedTinyInteger('rating');
            $table->text('comment')->nullable();
            $table->timestamps();

            $table->index(['seller_id', 'rating']);
            $table->index(['buyer_id', 'created_at']);
        });

        Schema::create('seller_promotions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('seller_id')->constrained('users')->cascadeOnDelete();
            $table->unsignedInteger('credit_cost');
            $table->timestamp('starts_at');
            $table->timestamp('expires_at');
            $table->timestamps();

            $table->index(['seller_id', 'starts_at', 'expires_at']);
            $table->index('expires_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('seller_promotions');
        Schema::dropIfExists('seller_reviews');
        Schema::dropIfExists('seller_services');
    }
};
