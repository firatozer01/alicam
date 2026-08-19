<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('requests', function (Blueprint $table) {
            $table->id();
            $table->string('public_reference', 24)->unique();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('category_id')->constrained()->restrictOnDelete();
            $table->foreignId('city_id')->constrained()->restrictOnDelete();
            $table->foreignId('district_id')->constrained()->restrictOnDelete();
            $table->string('title', 120);
            $table->text('description');
            $table->decimal('budget_min', 12, 2);
            $table->decimal('budget_max', 12, 2);
            $table->decimal('lat', 10, 7)->nullable();
            $table->decimal('lng', 10, 7)->nullable();
            $table->string('full_address', 500)->nullable();
            $table->jsonb('attributes')->default('{}');
            $table->jsonb('attribute_schema_snapshot')->default('[]');
            $table->string('status', 32)->default('open');
            $table->timestamp('expires_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'status', 'created_at']);
            $table->index(['category_id', 'city_id', 'district_id', 'status']);
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement('CREATE INDEX requests_attributes_gin_idx ON requests USING GIN (attributes)');
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('requests');
    }
};
