<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\City;
use App\Models\District;
use App\Models\SellerListing;
use App\Models\SellerListingImage;
use App\Models\User;
use App\Services\CategoryAttributeForm;
use App\Services\ImageShaper;
use App\Services\StockImageSearch;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Vitrinlere ornek urun koyar.
 *
 * Ozellik bos bir vitrinle denenemiyor: emlakcinin daireleri ve
 * galericinin araclari olmadan ne ilan izgarasi ne de teklife urun
 * iliktirme gorulebiliyor.
 *
 * Fotograflar StockImageSearch uzerinden internetten cekilir (kategori
 * kapaklarinda kullanilan ayni yol). Uretilen her sey ALC-DEMO-URN-
 * onekiyle isaretlenir, boylece tek komutla geri alinabilir.
 */
class DemoListingSeeder extends Seeder
{
    private const PREFIX = 'ALC-DEMO-URN-';

    private const DISK = 'local';

    /** Kategori slug'i => [baslik, fiyat, gorsel sorgusu] listesi. */
    private const BLUEPRINTS = [
        'emlak-konut' => [
            ['3+1 Geniş Balkonlu Daire, Site İçinde', 4250000, 'modern apartment living room interior'],
            ['2+1 Yeni Bina, Kombili ve Asansörlü', 2890000, 'apartment kitchen modern flat'],
            ['Eşyalı 1+1 Stüdyo, Merkezde Kiralık', 18500, 'studio apartment small furnished'],
            ['4+1 Bahçe Katı, Müstakil Girişli', 6750000, 'house garden terrace residential'],
        ],
        'vasita-otomobil' => [
            ['2023 Model Sedan, 69.000 km, Hatasız', 3290000, 'sedan car silver parked'],
            ['2019 Hatchback, Otomatik Vites, Bakımlı', 1150000, 'hatchback car compact city'],
            ['2021 SUV, 4x4, Cam Tavan', 2450000, 'suv car modern vehicle'],
        ],
        'vasita-ticari-araclar' => [
            ['2020 Panelvan, Uzun Şasi, Tek Elden', 1390000, 'delivery van commercial vehicle'],
            ['2018 Kamyonet, Açık Kasa, 3.5 Ton', 985000, 'pickup truck flatbed cargo'],
        ],
    ];

    public function run(): void
    {
        $saticilar = User::query()
            ->whereHas('sellerProfile', fn ($q) => $q->where('approval_status', 'approved'))
            ->orderBy('id')
            ->get();

        if ($saticilar->isEmpty()) {
            $this->command?->warn('Onayli satici yok; ornek ilan uretilmedi.');

            return;
        }

        $form = app(CategoryAttributeForm::class);
        $arama = app(StockImageSearch::class);
        $shaper = app(ImageShaper::class);

        $sehirler = City::query()->inRandomOrder()->limit(6)->get();
        $uretilen = 0;
        $sira = 0;

        foreach (self::BLUEPRINTS as $slug => $taslaklar) {
            $kategori = Category::query()->where('slug', $slug)->with('attributes')->first();

            if ($kategori === null) {
                $this->command?->warn("Kategori bulunamadi: {$slug}");

                continue;
            }

            foreach ($taslaklar as [$baslik, $fiyat, $sorgu]) {
                // Ilanlar saticilar arasinda sirayla dagitilir; hepsi tek
                // vitrinde toplanmasin.
                $satici = $saticilar[$sira % $saticilar->count()];
                $sira++;

                $sehir = $sehirler->get($sira % max(1, $sehirler->count()));
                $ilce = $sehir
                    ? District::query()->where('city_id', $sehir->id)->inRandomOrder()->first()
                    : null;

                $cozum = $form->resolve($kategori, $this->sampleAttributes($form, $kategori), 'listing');

                $ilan = SellerListing::query()->create([
                    'user_id' => $satici->id,
                    'category_id' => $kategori->id,
                    'city_id' => $sehir?->id,
                    'district_id' => $ilce?->id,
                    'public_reference' => self::PREFIX.Str::upper(Str::random(6)),
                    'title' => $baslik,
                    'description' => $this->description($baslik),
                    'price' => $fiyat,
                    'attributes' => $cozum['attributes'],
                    'attribute_schema_snapshot' => $cozum['snapshot'],
                    'status' => 'draft',
                ]);

                $adet = $this->attachPhotos($ilan, $sorgu, $arama, $shaper);

                // Fotografsiz ilan yayina alinamaz; kural burada da gecerli.
                if ($adet > 0) {
                    $ilan->update(['status' => 'published']);
                }

                $uretilen++;
                $this->command?->info("  {$ilan->public_reference}  {$baslik}  ({$adet} fotograf)");
            }
        }

        $this->command?->info("Ornek ilan: {$uretilen}");
    }

    /** Uretilen her seyi geri alir. */
    public static function clear(): int
    {
        $ilanlar = SellerListing::query()->where('public_reference', 'like', self::PREFIX.'%')->get();

        foreach ($ilanlar as $ilan) {
            foreach ($ilan->images as $gorsel) {
                Storage::disk(self::DISK)->delete($gorsel->path);
            }
        }

        $adet = $ilanlar->count();
        SellerListing::query()->where('public_reference', 'like', self::PREFIX.'%')->delete();

        return $adet;
    }

    /**
     * Kategorinin alanlarini makul degerlerle doldurur.
     *
     * Amaç ozellik tablosunu dolu gostermek; gercek bir ilan girisi
     * degil, ornek.
     *
     * @return array<string, mixed>
     */
    private function sampleAttributes(CategoryAttributeForm $form, Category $kategori): array
    {
        $cikti = [];

        // Ilan baglaminda sorulan alanlar; tanimsiz anahtar gonderirsek
        // dogrulama reddeder.
        foreach ($form->fields($kategori, 'listing') as $alan) {
            // Serbest metin alanlarini bos birakiyoruz: uydurma bir
            // paragraf tabloda kotu duruyor.
            if (in_array($alan->type, ['textarea'], true)) {
                continue;
            }

            $secenek = $alan->options ?? [];

            $cikti[$alan->key] = match ($alan->type) {
                'number', 'range' => 120,
                'boolean' => true,
                'date' => now()->subYear()->toDateString(),
                'select' => $secenek[0] ?? null,
                'multiselect' => array_slice($secenek, 0, 2),
                default => null,
            };

            if ($cikti[$alan->key] === null || $cikti[$alan->key] === []) {
                unset($cikti[$alan->key]);
            }
        }

        return $cikti;
    }

    private function description(string $baslik): string
    {
        return "{$baslik}. Örnek ilan metnidir; ürünün konumu, durumu ve öne çıkan "
            .'özellikleri burada anlatılır. Detaylar için mesaj gönderebilir, '
            .'talebinize özel teklif isteyebilirsiniz.';
    }

    /** Ilana internetten bulunan fotograflari ekler. */
    private function attachPhotos(
        SellerListing $ilan,
        string $sorgu,
        StockImageSearch $arama,
        ImageShaper $shaper,
    ): int {
        $aday = $arama->find($sorgu);

        if ($aday === null) {
            return 0;
        }

        $bayt = $arama->download($aday['url'], $aday['fallback_url'] ?? null);

        if ($bayt === null) {
            return 0;
        }

        $sekilli = $shaper->shape($bayt, 'listing');

        if ($sekilli === null) {
            return 0;
        }

        $yol = "listing-images/{$ilan->id}/".bin2hex(random_bytes(8)).'.jpg';
        Storage::disk(self::DISK)->put($yol, $sekilli);

        SellerListingImage::query()->create([
            'seller_listing_id' => $ilan->id,
            'path' => $yol,
            'sort_order' => 0,
        ]);

        return 1;
    }
}
