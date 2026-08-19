<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cities', function (Blueprint $table) {
            $table->id();
            $table->string('code', 2)->unique();
            $table->string('name', 80);
            $table->string('slug', 90)->unique();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('districts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('city_id')->constrained()->cascadeOnDelete();
            $table->string('name', 100);
            $table->string('slug', 110);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['city_id', 'slug']);
            $table->index(['city_id', 'is_active']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('districts');
        Schema::dropIfExists('cities');
    }
};
