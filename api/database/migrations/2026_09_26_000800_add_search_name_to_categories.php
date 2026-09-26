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
            // Aramada kullanilan sadelestirilmis ad: kucuk harf + Turkce
            // harfler ASCII karsiligina katlanir.
            //
            // Gerekcesi olculdu: ILIKE '%camasir%' -> "Çamaşır Makinesi"
            // HICBIR SONUC dondurmuyor. Telefonda Turkce karakter yazmayan
            // kullanici aradigini bulamiyordu.
            $table->string('search_name', 160)->nullable()->after('slug');
            $table->index('search_name');
        });

        // Mevcut 5689 satir icin doldur. Katlama PHP tarafinda modelde de
        // yapiliyor; burada ayni donusum SQL ile bir kez uygulanir.
        // Kaynak ve hedef harf sayisi BIREBIR esit olmali; bir harf fazla
        // yazilirsa sonraki tum eslemeler kayar (ilk denemede 'ş' -> 'd'
        // oldu ve "camasir" aramasi sonucsuz kaldi).
        DB::statement("
            update categories
            set search_name = lower(
                translate(name,
                    'ÇçĞğİıÖöŞşÜüÂâÎîÛû',
                    'ccggiioossuuaaiiuu'
                )
            )
        ");
    }

    public function down(): void
    {
        Schema::table('categories', function (Blueprint $table) {
            $table->dropIndex(['search_name']);
            $table->dropColumn('search_name');
        });
    }
};
