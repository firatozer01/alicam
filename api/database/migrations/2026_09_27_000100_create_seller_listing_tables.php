<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Saticinin vitrinindeki urun/ilan. Emlakci bir daireyi, galerici
        // bir araci buraya koyar; teklif verirken de birini iliktirir.
        Schema::create('seller_listings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('category_id')->constrained()->restrictOnDelete();
            $table->foreignId('city_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('district_id')->nullable()->constrained()->nullOnDelete();

            // Arayuzde "Ilan No" olarak gosterilir; id'yi disari vermemek
            // icin ayri bir referans tasiniyor (talepler de boyle).
            $table->string('public_reference', 24)->unique();

            $table->string('title', 140);
            $table->text('description');

            // Fiyat istege bagli: "fiyat sorunuz" diyen ilanlar var.
            $table->decimal('price', 12, 2)->nullable();

            // Kategoriye bagli serbest alanlar (Marka, Yil, KM, m2, Oda...).
            // Talepler de birebir bu iki sutunu tasiyor: sema sonradan
            // degistiginde eski kayit okunamaz hale gelmesin diye alan
            // tanimlari kayitla birlikte dondurulur.
            $table->jsonb('attributes')->default('{}');
            $table->jsonb('attribute_schema_snapshot')->default('[]');

            // draft: henuz yayinlanmadi, published: vitrinde,
            // sold: satildi (gecmis tekliflerde gorunmeye devam eder),
            // archived: satici kaldirdi.
            $table->string('status', 16)->default('draft');

            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            // Vitrin listesi: saticinin yayindaki ilanlari, kendi sirasiyla.
            $table->index(['user_id', 'status', 'sort_order']);
            // Teklif verirken kategoriye gore suzmek icin.
            $table->index(['user_id', 'category_id']);
        });

        Schema::create('seller_listing_images', function (Blueprint $table) {
            $table->id();
            $table->foreignId('seller_listing_id')->constrained()->cascadeOnDelete();
            $table->string('path', 255);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->index(['seller_listing_id', 'sort_order']);
        });

        // Postgres'e ozel indeksler; sqlite ile calisan testler
        // dusmesin diye surucu denetimi (requests gocu de boyle).
        if (DB::getDriverName() === 'pgsql') {
            // Ozellik suzmesi bu katalogun butun meselesi: "3+1",
            // "2020 ve uzeri", "150.000 km alti". Talepler tarafinda
            // ayni indeks zaten var.
            DB::statement('create index seller_listings_attributes_gin_idx on seller_listings using gin (attributes)');

            // Kapak: ilk siradaki gorsel. Benzersiz, cunku iki es zamanli
            // yukleme ayni sirayi alirsa kapak rastgele secilir hale
            // gelir. Ikinci yazan hata alir ve siraya gecer.
            DB::statement('create unique index seller_listing_cover_idx on seller_listing_images (seller_listing_id) where sort_order = 0');
        }
    }

    public function down(): void
    {
        DB::statement('drop index if exists seller_listing_cover_idx');
        DB::statement('drop index if exists seller_listings_attributes_gin_idx');
        Schema::dropIfExists('seller_listing_images');
        Schema::dropIfExists('seller_listings');
    }
};
