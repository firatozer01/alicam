<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('credit_packages', function (Blueprint $table) {
            $table->id();
            $table->string('name', 80);
            $table->unsignedInteger('credit_amount');
            $table->unsignedInteger('bonus_credit')->default(0);
            $table->decimal('price', 10, 2);
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::create('payment_orders', function (Blueprint $table) {
            $table->id();
            $table->string('merchant_oid', 64)->unique();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('credit_package_id')->nullable()->constrained()->nullOnDelete();
            $table->unsignedInteger('credit_amount_snapshot');
            $table->unsignedInteger('bonus_snapshot')->default(0);
            $table->decimal('price_snapshot', 10, 2);
            $table->string('currency', 3)->default('TL');
            $table->string('status', 24)->default('pending');
            $table->string('user_ip', 45)->nullable();
            $table->boolean('test_mode')->default(false);
            $table->timestamp('paid_at')->nullable();
            $table->string('failed_reason_code', 32)->nullable();
            $table->string('failed_reason_message', 500)->nullable();
            $table->timestamps();

            $table->index(['user_id', 'created_at']);
            $table->index(['status', 'created_at']);
        });

        Schema::create('payment_callbacks', function (Blueprint $table) {
            $table->id();
            $table->string('provider', 24)->default('paytr');
            $table->string('merchant_oid', 64);
            $table->jsonb('payload');
            $table->boolean('hash_valid');
            $table->timestamp('processed_at')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['merchant_oid', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payment_callbacks');
        Schema::dropIfExists('payment_orders');
        Schema::dropIfExists('credit_packages');
    }
};
