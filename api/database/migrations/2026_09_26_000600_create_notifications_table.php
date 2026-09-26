<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('notifications', function (Blueprint $table) {
            // Ust cubuktaki zilin arkasindaki tek tablo. Her satir TEK bir
            // kisiye aittir; ayni olay iki tarafi da ilgilendiriyorsa iki
            // satir yazilir. Okundu damgasi boylece kisiye ozel kalir.
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();

            // Olay anahtari: offer_received, message_locked, payment_failed...
            // Her zaman kucuk harf snake_case yazilir ve sorgularda yalnizca
            // = / in ile aranir. PostgreSQL'de LIKE buyuk-kucuk harfe duyarli
            // oldugu icin 'Offer%' gibi bir filtre sessizce bos doner.
            $table->string('type', 48);

            // Panelde okunan satir. Yazildigi anda DONDURULUR: talep sonradan
            // yeniden adlandirilsa da gecmis bildirim degismez.
            $table->string('title', 160);
            // Ikinci satir. Kilitli konusmada mesajin govdesi buraya ASLA
            // konmaz; MessageSent::broadcastWith ile ayni kural.
            $table->string('body', 320)->nullable();
            // Tiklaninca gidilecek web yolu: /musteri-panel, /mesajlar?konusma=12
            $table->string('link', 160)->nullable();

            // Olayin kaynagi. Iliski degil duz metin: kaynak satir silinse de
            // bildirim gecmiste kalmaya devam eder.
            $table->string('subject_type', 32)->nullable();
            $table->unsignedBigInteger('subject_id')->nullable();

            // Ayni seyin ust uste yazilmasini engelleyen anahtar:
            // "message:12" gibi. Bos birakilirsa satir her seferinde yenidir.
            $table->string('dedupe_key', 80)->nullable();

            // Baslik degiskenleri ve sayaclar; bildirim silinmeden yeniden
            // uretilebilsin diye tutulur (fiyat, kontor, mesaj sayisi).
            $table->jsonb('data')->nullable();

            $table->timestamp('read_at')->nullable();
            $table->timestamps();
        });

        // Panel listesi: kisinin en yeni bildirimleri. created_at ile id
        // birlikte siralanir; ayni saniyeye dusen iki satirda sira sabit kalir.
        // read_at ASLA siralama sutunu degildir: nullable oldugu icin
        // "read_at desc" okunmamislari basa degil, NULL'lari basa alir.
        DB::statement('
            create index notifications_feed_idx
            on notifications (user_id, created_at desc, id desc)
        ');

        // Rozet sayaci HER sayfa yuklemesinde okunur. Kismi index yalnizca
        // okunmamis satirlari tasir: tablo buyudukce index buyumez, sayim
        // kisinin birkac satirini tarar.
        DB::statement('
            create index notifications_unread_idx
            on notifications (user_id)
            where read_at is null
        ');

        // Ayni konusmadan gelen ikinci mesaj yeni satir acmaz, var olani
        // tazeler. Duz bir unique(user_id, dedupe_key) ise yaramazdi:
        // PostgreSQL NULL'lari birbirinden farkli saydigi icin anahtarsiz
        // satirlar yine coklanir, ustelik hepsi index'i sisirirdi. Kismi
        // unique bu satirlari index'e hic almaz.
        DB::statement('
            create unique index notifications_dedupe_unique
            on notifications (user_id, dedupe_key)
            where dedupe_key is not null
        ');
    }

    public function down(): void
    {
        Schema::dropIfExists('notifications');
    }
};
