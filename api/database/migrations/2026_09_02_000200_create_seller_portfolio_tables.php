<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('seller_portfolio_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('category_id')->nullable()->constrained()->nullOnDelete();
            $table->string('title', 140);
            $table->text('description');
            $table->string('location', 120)->nullable();
            $table->date('completed_at')->nullable();
            $table->boolean('is_published')->default(true);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->index(['user_id', 'is_published', 'sort_order']);
        });

        Schema::create('seller_portfolio_images', function (Blueprint $table) {
            $table->id();
            $table->foreignId('portfolio_item_id')->constrained('seller_portfolio_items')->cascadeOnDelete();
            $table->string('path', 255);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->index(['portfolio_item_id', 'sort_order']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('seller_portfolio_images');
        Schema::dropIfExists('seller_portfolio_items');
    }
};
