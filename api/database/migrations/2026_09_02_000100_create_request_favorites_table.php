<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('request_favorites', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('request_id')->constrained('requests')->cascadeOnDelete();
            $table->timestamps();

            // Aynı talep bir kullanıcı için yalnızca bir kez favorilenebilir.
            $table->unique(['user_id', 'request_id']);
            $table->index(['user_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('request_favorites');
    }
};
