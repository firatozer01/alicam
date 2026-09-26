<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('offers', function (Blueprint $table) {
            // Teklife iliktirilen urun. Satici fiyati yazarken
            // vitrinindeki bir ilani da secebiliyor.
            //
            // nullOnDelete: ilan silinse bile teklif ayakta kalmali,
            // cunku teklif alicinin gordugu ve cevapladigi bir kayit.
            $table->foreignId('seller_listing_id')->nullable()
                ->after('seller_id')->constrained()->nullOnDelete();

            // Teklif ANINDAKI urun bilgisi. Baglantinin yaninda ayrica
            // tutuluyor, cunku satici ilani sonradan degistirebilir ya da
            // silebilir: alici "3.290.000 TL'lik 2023 Volvo" teklifini
            // kabul ettiyse, ilan baska bir araca donduruldugunde teklif
            // hala kabul edilen urunu gostermeli.
            //
            // Canli baglanti gorunmeye devam eder; anlik goruntu yalnizca
            // "teklif edilen buydu" kaydidir.
            $table->jsonb('listing_snapshot')->nullable();

            // Postgres yabanci anahtarin GOSTEREN tarafini kendiliginden
            // indekslemiyor. Bu sutun iki yerde taraniyor: ilan basina
            // teklif sayimi ve bir ilan silinirken calisan SET NULL.
            $table->index('seller_listing_id');
        });
    }

    public function down(): void
    {
        Schema::table('offers', function (Blueprint $table) {
            $table->dropConstrainedForeignId('seller_listing_id');
            $table->dropColumn('listing_snapshot');
        });
    }
};
