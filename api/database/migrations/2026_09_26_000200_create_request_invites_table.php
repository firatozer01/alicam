<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('request_invites', function (Blueprint $table) {
            // Alici bir saticinin vitrininden "teklif iste" dediginde talep
            // dogrudan o saticiya yonlendirilir. Talep yine de normal akista
            // kalir; davet edilen satici kategori ve bolge eslesmesi olmasa
            // bile talebi gorur ve panelinde ayrica isaretlenir.
            $table->id();
            $table->foreignId('request_id')->constrained('requests')->cascadeOnDelete();
            $table->foreignId('seller_id')->constrained('users')->cascadeOnDelete();
            $table->string('source', 24)->default('storefront');
            $table->timestamps();

            $table->unique(['request_id', 'seller_id']);
            $table->index(['seller_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('request_invites');
    }
};
