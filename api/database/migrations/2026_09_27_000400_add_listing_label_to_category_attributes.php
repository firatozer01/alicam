<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('category_attributes', function (Blueprint $table) {
            // Ayni alanin ILAN tarafindaki adi.
            //
            // Mevcut etiketler aliciya sorulan sorular: "Kac oda + salon
            // olsun?", "Isitma nasil olsun?". Satici kendi dairesini
            // girerken ve alici ilanin ozellik tablosunu okurken bu dil
            // yanlis; orada "Oda Sayisi", "Isitma" yazmasi gerekiyor.
            //
            // Bos birakilirsa label kullanilir, yani hicbir kategori
            // bunu doldurmak zorunda degil.
            $table->string('listing_label', 120)->nullable()->after('label');
        });
    }

    public function down(): void
    {
        Schema::table('category_attributes', function (Blueprint $table) {
            $table->dropColumn('listing_label');
        });
    }
};
