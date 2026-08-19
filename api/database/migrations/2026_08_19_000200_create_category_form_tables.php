<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('categories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('parent_id')->nullable()->constrained('categories')->nullOnDelete();
            $table->string('name', 80);
            $table->string('slug', 90)->unique();
            $table->string('icon', 32)->nullable();
            $table->string('color', 16)->nullable();
            $table->unsignedInteger('schema_version')->default(1);
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::create('category_attributes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('category_id')->constrained()->cascadeOnDelete();
            $table->string('key', 80);
            $table->string('label', 120);
            $table->string('type', 32);
            $table->json('options')->nullable();
            $table->json('validation')->nullable();
            $table->string('unit', 24)->nullable();
            $table->string('help_text', 255)->nullable();
            $table->boolean('is_required')->default(false);
            $table->boolean('is_filterable')->default(false);
            $table->boolean('show_in_summary')->default(true);
            $table->boolean('is_private')->default(false);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
            $table->unique(['category_id', 'key']);
            $table->index(['category_id', 'sort_order']);
        });

        Schema::create('category_credit_costs', function (Blueprint $table) {
            $table->foreignId('category_id')->primary()->constrained()->cascadeOnDelete();
            $table->unsignedInteger('unlock_cost');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('category_credit_costs');
        Schema::dropIfExists('category_attributes');
        Schema::dropIfExists('categories');
    }
};
