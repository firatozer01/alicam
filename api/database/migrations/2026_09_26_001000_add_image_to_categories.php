<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('categories', function (Blueprint $table) {
            // Anasayfa kartlarinin fotografi. Emoji isletim sistemine gore
            // farkli ciziliyor ve "Tadilat" ile "Tesisat" ayni kutuda ayni
            // gorunuyordu; baslik fotografla anlasilir hale geliyor.
            //
            // Dosya disk'te durur, sutunda yalnizca yolu tasinir. Gorsel yoksa
            // arayuz emojiye duser, yani bu alan hicbir yerde zorunlu degil.
            $table->string('image_path', 255)->nullable();

            // Kaynak ve lisans kaydi. Simdilik yalnizca demo icerigi var ama
            // atif gerektiren lisanslar (CC BY-SA) kullanildigi icin bilgi
            // gorselle birlikte saklanir: sonradan toplanamaz.
            $table->string('image_credit', 255)->nullable();
            $table->string('image_source', 500)->nullable();
        });

        // Gorseli olan kategoriler azinlik: kismi index.
        DB::statement('create index categories_image_idx on categories (id) where image_path is not null');
    }

    public function down(): void
    {
        DB::statement('drop index if exists categories_image_idx');

        Schema::table('categories', function (Blueprint $table) {
            $table->dropColumn(['image_path', 'image_credit', 'image_source']);
        });
    }
};
