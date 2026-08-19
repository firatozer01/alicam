<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('seller_profiles', function (Blueprint $table) {
            $table->foreignId('user_id')->primary()->constrained()->cascadeOnDelete();
            $table->string('profile_type', 16);
            $table->string('company_name', 160)->nullable();
            $table->string('tax_no', 20)->nullable();
            $table->text('description');
            $table->string('logo_path')->nullable();
            $table->string('approval_status', 24)->default('draft');
            $table->string('rejection_reason', 500)->nullable();
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['approval_status', 'submitted_at']);
        });

        Schema::create('seller_categories', function (Blueprint $table) {
            $table->foreignId('seller_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('category_id')->constrained()->cascadeOnDelete();
            $table->timestamps();

            $table->primary(['seller_id', 'category_id']);
        });

        Schema::create('seller_locations', function (Blueprint $table) {
            $table->foreignId('seller_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('city_id')->constrained()->restrictOnDelete();
            $table->foreignId('district_id')->constrained()->restrictOnDelete();
            $table->timestamps();

            $table->primary(['seller_id', 'district_id']);
            $table->index(['city_id', 'district_id']);
        });

        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('action', 80);
            $table->string('auditable_type', 120);
            $table->unsignedBigInteger('auditable_id');
            $table->jsonb('old_values')->nullable();
            $table->jsonb('new_values')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['auditable_type', 'auditable_id']);
            $table->index(['action', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('audit_logs');
        Schema::dropIfExists('seller_locations');
        Schema::dropIfExists('seller_categories');
        Schema::dropIfExists('seller_profiles');
    }
};
