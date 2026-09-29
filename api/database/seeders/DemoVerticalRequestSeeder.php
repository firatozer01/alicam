<?php

namespace Database\Seeders;

use App\Models\BuyerRequest;
use App\Models\Category;
use App\Models\City;
use App\Models\District;
use App\Models\Offer;
use App\Models\User;
use App\Services\CategoryAttributeForm;
use App\Support\CategoryTree;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/**
 * Anasayfadaki "Insanlar su an bunlari istiyor" akisi icin ornek talep.
 *
 * Mevcut toplu demo icerigin TAMAMI hizmet kategorisinde; akista her
 * kart mavi "Hizmet" rozetiyle cikiyor ve tasarimin dikey renkleri
 * (emlak yesil, vasita turuncu, alisveris mor, makine kehribar) hic
 * gorunmuyor. Bu tohumlayici eksik dikeyleri dolduruyor.
 *
 * Uretilen her sey ALC-DEMO-V- onekiyle isaretli; clear() geri alir.
 */
class DemoVerticalRequestSeeder extends Seeder
{
    private const PREFIX = 'ALC-DEMO-V-';

    /**
     * [kategori slug, baslik, aciklama, butce min, butce max, teklif sayisi]
     *
     * Teklif sayilari bilerek degisken: sekiz ve uzeri olanlar akista
     * turuncu "hot" rozetiyle cikar, tasarimin o ayrimi gorunur olsun.
     */
    private const SAMPLES = [
        ['emlak-konut', '2+1 kiralık daire, eşyalı ve asansörlü', 'Merkeze yakın, asansörlü bir binada 2+1 eşyalı daire arıyorum. Uzun süreli oturmayı planlıyorum.', 28000, 42000, 6],
        ['emlak-konut', 'Satılık 3+1, okula yakın olsun', 'Çocuklar için okula yürüme mesafesinde, krediye uygun 3+1 bir daire arıyorum. 10 yaş altı bina tercihim.', 3200000, 4500000, 3],
        ['vasita-otomobil', 'Aile için 7 kişilik araç arıyorum', '2017 ve üzeri, dizel ve otomatik vites, bakımlı bir aile aracı arıyorum. Hasar kaydı temiz olsun.', 850000, 1400000, 4],
        ['vasita-otomobil', 'Otomatik vites, düşük kilometreli sedan', 'Şehir içi kullanım için ekonomik, otomatik vitesli bir sedan arıyorum. Servis bakımları tam olsun.', 700000, 1100000, 9],
        ['elektronik-teknoloji', 'Çamaşır makinesi, 9 kg ve A enerji', 'Sıfır, 9 kg kapasiteli ve A enerji sınıfı bir çamaşır makinesi arıyorum. Montaj dahil teklif bekliyorum.', 18000, 28000, 7],
        ['elektronik-teknoloji', 'iPhone 15 128 GB, garantili', 'Türkiye garantili, kutusu ve faturası olan bir iPhone 15 arıyorum. İkinci el de olabilir.', 45000, 62000, 5],
        ['is-makineleri-sanayi', 'Kiralık mini ekskavatör, 3 gün', 'Bahçe düzenlemesi için 1,5-3 ton arası operatörlü mini ekskavatör kiralamak istiyorum. Hafta içi uygun.', 12000, 22000, 2],
        ['yasam-ve-hobi', '3’lü koltuk takımı, açılır kanepe', 'Salon için açılır kanepeli, sağlam iskeletli bir koltuk takımı arıyorum. Kumaş rengi açık tonlarda olsun.', 25000, 48000, 8],
    ];

    public function run(): void
    {
        $aliciLar = User::query()
            ->whereDoesntHave('sellerProfile')
            ->whereHas('roles', fn ($q) => $q->where('name', 'buyer'))
            ->inRandomOrder()
            ->limit(20)
            ->get();

        if ($aliciLar->isEmpty()) {
            $this->command?->warn('Alici bulunamadi; ornek talep uretilmedi.');

            return;
        }

        $saticilar = User::query()
            ->whereHas('sellerProfile', fn ($q) => $q->where('approval_status', 'approved'))
            ->get();

        $form = app(CategoryAttributeForm::class);
        $sehirler = City::query()->inRandomOrder()->limit(12)->get();
        $uretilen = 0;

        foreach (self::SAMPLES as $i => [$slug, $baslik, $aciklama, $altBut, $ustBut, $teklifAdedi]) {
            $kategori = Category::query()->where('slug', $slug)->with('attributes')->first();

            if ($kategori === null) {
                $this->command?->warn("Kategori yok: {$slug}");

                continue;
            }

            $alici = $aliciLar[$i % $aliciLar->count()];
            $sehir = $sehirler[$i % max(1, $sehirler->count())];
            $ilce = District::query()->where('city_id', $sehir->id)->inRandomOrder()->first();

            $cozum = $form->resolve($kategori, $this->sample($form, $kategori));

            $talep = BuyerRequest::query()->create([
                'public_reference' => self::PREFIX.Str::upper(Str::random(6)),
                'user_id' => $alici->id,
                'category_id' => $kategori->id,
                'city_id' => $sehir->id,
                'district_id' => $ilce?->id ?? District::query()->first()->id,
                'title' => $baslik,
                'description' => $aciklama,
                'budget_min' => $altBut,
                'budget_max' => $ustBut,
                'attributes' => $cozum['attributes'],
                'attribute_schema_snapshot' => $cozum['snapshot'],
                // Akista "4 dk once", "1 sa once" gibi taze zamanlar
                // gorunsun diye son birkac saate yayiliyor.
                'created_at' => now()->subMinutes(4 + $i * 37),
                'timing' => ['urgent', 'this_week', 'this_month', 'flexible'][$i % 4],
                'status' => 'open',
                'is_demo' => true,
                'expires_at' => now()->addDays(30),
            ]);

            $talep->categories()->sync([$kategori->id => ['is_primary' => true, 'sort_order' => 0]]);

            // Teklif sayisi akistaki rozeti belirliyor; gercek satir
            // uretiyoruz ki sayac dogru olsun.
            foreach ($saticilar->take($teklifAdedi) as $j => $satici) {
                Offer::query()->firstOrCreate(
                    ['request_id' => $talep->id, 'seller_id' => $satici->id],
                    [
                        'price' => $altBut + (($ustBut - $altBut) / max(1, $teklifAdedi)) * $j,
                        'message' => 'Talebiniz için hazırladığımız örnek tekliftir. Detayları mesajla paylaşabiliriz.',
                        'status' => 'pending',
                    ],
                );
            }

            $uretilen++;
            $this->command?->info("  {$talep->public_reference}  {$baslik}");
        }

        $this->command?->info("Ornek dikey talebi: {$uretilen}");
    }

    public static function clear(): int
    {
        $adet = BuyerRequest::query()->where('public_reference', 'like', self::PREFIX.'%')->count();
        BuyerRequest::query()->where('public_reference', 'like', self::PREFIX.'%')->delete();

        return $adet;
    }

    /**
     * @return array<string, mixed>
     */
    private function sample(CategoryAttributeForm $form, Category $kategori): array
    {
        $cikti = [];

        foreach ($form->fields($kategori) as $alan) {
            if (! $alan->is_required) {
                continue;
            }

            $secenek = $alan->options ?? [];

            $deger = match ($alan->type) {
                'number', 'range' => 100,
                'boolean' => true,
                'date' => now()->addWeek()->toDateString(),
                'select' => $secenek[0] ?? null,
                'multiselect' => array_slice($secenek, 0, 2),
                'textarea' => 'Örnek talep; ayrıntılar teklif sonrası konuşulacak.',
                default => 'Belirtilmedi',
            };

            if ($deger !== null && $deger !== []) {
                $cikti[$alan->key] = $deger;
            }
        }

        return $cikti;
    }
}
