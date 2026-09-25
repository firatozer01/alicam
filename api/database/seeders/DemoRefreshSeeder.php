<?php

namespace Database\Seeders;

use App\Models\BuyerRequest;
use App\Models\Category;
use App\Models\City;
use App\Models\User;
use App\Support\CategoryTree;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * Demo icerigini guncel yapiya tasir.
 *
 * Ilk surumde talepler uc genel kategoriye (hizmet / nakliye / tadilat)
 * bagliydi ve o kategoriler artik pasif. Bu seeder mevcut demo taleplerini
 * yeni agactaki gercek yaprak kategorilere tasir, alan setlerini doldurur,
 * ek kategorileri baglar ve tarihleri tazeler. Teklifler ve yorumlar
 * oldugu gibi korunur; talep satirlari silinmez, yerinde guncellenir.
 */
class DemoRefreshSeeder extends Seeder
{
    /** Servis taraflarindaki demo talepler: baslik anahtari => [kok slug, aranacak adlar]. */
    private const SERVICE_MAP = [
        'boya' => ['tadilat-dekorasyon-insaat', ['Boya Badana', 'İç Cephe Boya', 'Boyacı']],
        'mutfak' => ['tadilat-dekorasyon-insaat', ['Mutfak Dolabı', 'Mutfak Dekorasyon', 'Mutfak']],
        'banyo' => ['tadilat-dekorasyon-insaat', ['Banyo Tadilat', 'Banyo Yenileme', 'Banyo']],
        'parke' => ['tadilat-dekorasyon-insaat', ['Parke Laminat Döşeme', 'Parke Döşeme', 'Parke']],
        'ev-tasima' => ['nakliyat-ve-depolama', ['Evden Eve Nakliyat', 'Ev Taşıma']],
        'ofis-tasima' => ['nakliyat-ve-depolama', ['Ofis Taşıma', 'Ofis Nakliyat', 'Şehir İçi Nakliyat']],
        'parca-esya' => ['nakliyat-ve-depolama', ['Parça Eşya Taşıma', 'Eşya Taşıma']],
        'ogrenci-evi' => ['nakliyat-ve-depolama', ['Öğrenci Evi Taşıma', 'Evden Eve Nakliyat']],
        'sosyal-medya' => ['kurumsal-ve-profesyonel-hizmetler', ['Sosyal Medya Yönetimi', 'Sosyal Medya']],
        'web-sitesi' => ['kurumsal-ve-profesyonel-hizmetler', ['Web Site Yapımı', 'Web Tasarım', 'Web Site']],
        'muhasebe' => ['kurumsal-ve-profesyonel-hizmetler', ['Ön Muhasebe', 'Muhasebe', 'Mali Müşavir']],
        'fotograf' => ['kurumsal-ve-profesyonel-hizmetler', ['Ürün Fotoğraf Çekimi', 'Fotoğrafçı', 'Fotoğraf']],
    ];

    /** Demo taleplerin sirasi seeder ile ayni: 12'lik dongu. */
    private const TITLE_ORDER = [
        'boya', 'ev-tasima', 'sosyal-medya', 'mutfak', 'ofis-tasima', 'web-sitesi',
        'banyo', 'parca-esya', 'muhasebe', 'parke', 'ogrenci-evi', 'fotograf',
    ];

    /** Ilan tarafi icin eklenen yeni talepler. */
    private const LISTING_REQUESTS = [
        ['emlak', ['Satılık Daire', 'Daire'], 'Kadıköy’de 2+1 satılık daire arıyorum', 3200000, 4500000],
        ['vasita', ['Otomobil', 'Sedan'], 'Temiz kullanılmış ikinci el otomobil arıyorum', 650000, 950000],
        ['elektronik-teknoloji', ['Dizüstü', 'Laptop'], 'Yazılım geliştirme için dizüstü bilgisayar', 35000, 60000],
        ['yasam-ve-hobi', ['Koltuk Takımı', 'Koltuk', 'Oturma Grubu'], 'Oturma odası için köşe koltuk takımı', 28000, 45000],
        ['is-makineleri-sanayi', ['Mini Ekskavatör', 'Ekskavatör'], 'Şantiye için kiralık mini ekskavatör', 40000, 70000],
        ['hayvanlar-alemi', ['Kedi', 'Yavru Kedi'], 'Sahiplenmek için yavru kedi arıyorum', 0, 2500],
    ];

    /** Eski genel kategoriler => yeni agactaki karsiliklari. */
    private const SELLER_MAP = [
        'tadilat' => 'tadilat-dekorasyon-insaat',
        'nakliye' => 'nakliyat-ve-depolama',
        'hizmet' => 'kurumsal-ve-profesyonel-hizmetler',
    ];

    public function run(): void
    {
        if (Category::query()->where('slug', 'tadilat-dekorasyon-insaat')->doesntExist()) {
            $this->command?->warn('Yeni kategori agaci yok, demo tazeleme atlandi.');

            return;
        }

        DB::transaction(function (): void {
            $this->moveSellers();
            $this->refreshRequests();
            $this->addListingRequests();
        });

        CategoryTree::forget();
        $this->command?->info('Demo icerigi guncel agaca tasindi.');
    }

    /** Saticilar yeni agactaki kok kategorilere abone edilir. */
    private function moveSellers(): void
    {
        foreach (self::SELLER_MAP as $oldSlug => $newSlug) {
            $old = Category::query()->where('slug', $oldSlug)->value('id');
            $new = Category::query()->where('slug', $newSlug)->value('id');

            if (! $old || ! $new) {
                continue;
            }

            $sellerIds = DB::table('seller_categories')->where('category_id', $old)->pluck('seller_id');

            foreach ($sellerIds as $sellerId) {
                DB::table('seller_categories')->updateOrInsert(
                    ['seller_id' => $sellerId, 'category_id' => $new],
                    ['created_at' => now(), 'updated_at' => now()],
                );
            }
        }
    }

    private function refreshRequests(): void
    {
        $requests = BuyerRequest::query()
            ->where('public_reference', 'like', 'ALC-DEMO-%')
            ->orderBy('id')
            ->get();

        foreach ($requests as $index => $request) {
            $key = self::TITLE_ORDER[$index % count(self::TITLE_ORDER)];
            [$rootSlug, $names] = self::SERVICE_MAP[$key];
            $category = $this->resolveCategory($rootSlug, $names);

            if (! $category) {
                continue;
            }

            $this->applyCategory($request, $category, $index);
        }
    }

    private function addListingRequests(): void
    {
        $istanbul = City::query()->where('code', '34')->with('districts')->first();
        $district = $istanbul?->districts->firstWhere('slug', 'kadikoy') ?? $istanbul?->districts->first();
        $buyer = User::query()->whereHas('roles', fn ($query) => $query->where('name', 'buyer'))->first();

        if (! $istanbul || ! $district || ! $buyer) {
            return;
        }

        foreach (self::LISTING_REQUESTS as $index => [$rootSlug, $names, $title, $min, $max]) {
            $category = $this->resolveCategory($rootSlug, $names);

            if (! $category) {
                continue;
            }

            $request = BuyerRequest::query()->updateOrCreate(
                ['public_reference' => sprintf('ALC-ILAN-%03d', $index + 1)],
                [
                    'user_id' => $buyer->id,
                    'category_id' => $category->id,
                    'city_id' => $istanbul->id,
                    'district_id' => $district->id,
                    'title' => $title,
                    'description' => 'Bütçeme uygun, durumu açıkça belirtilmiş seçenekler arıyorum. '
                        .'Fotoğraf ve detaylı bilgi paylaşan satıcılarla ilerlemek isterim.',
                    'budget_min' => $min,
                    'budget_max' => $max,
                    'full_address' => 'Kadıköy, İstanbul — açık adres yalnızca kontörle açılır.',
                    'status' => 'open',
                ],
            );

            $this->applyCategory($request, $category, 40 + $index);
        }
    }

    /** Talebi verilen kategoriye tasir, alanlarini doldurur, tarihleri tazeler. */
    private function applyCategory(BuyerRequest $request, Category $category, int $index): void
    {
        $effective = CategoryTree::effectiveAttributes($category);

        $request->forceFill([
            'category_id' => $category->id,
            'attributes' => $this->sampleValues($effective, $index),
            'attribute_schema_snapshot' => $effective->map(fn ($attribute) => [
                'key' => $attribute->key,
                'label' => $attribute->label,
                'type' => $attribute->type,
                'options' => $attribute->options,
                'unit' => $attribute->unit,
                'is_private' => $attribute->is_private,
                'show_in_summary' => $attribute->show_in_summary,
            ])->values()->all(),
            // Demo icerigi canli gorunsun: son iki haftaya yayilir, bir ay sonra dolar.
            'created_at' => now()->subHours(($index * 7) % 336),
            'expires_at' => now()->addDays(30 - ($index % 10)),
        ])->save();

        // Birincil kategorinin yanina iki kardes baslik: coklu kategori gorunur olsun.
        $siblings = $category->parent_id
            ? Category::query()
                ->where('parent_id', $category->parent_id)
                ->where('id', '!=', $category->id)
                ->where('is_active', true)
                ->orderBy('sort_order')
                ->take(2)
                ->pluck('id')
                ->all()
            : [];

        $pivot = [$category->id => ['is_primary' => true, 'sort_order' => 0]];
        foreach (array_values($siblings) as $position => $siblingId) {
            $pivot[$siblingId] = ['is_primary' => false, 'sort_order' => $position + 1];
        }

        $request->categories()->sync($pivot);
    }

    /**
     * Alan setine uygun ornek cevaplar. Zorunlu alanlarin tamami, istege
     * bagli olanlarin ilk ucu doldurulur; talep karti bos gorunmez.
     *
     * @param  \Illuminate\Support\Collection<int, \App\Models\CategoryAttribute>  $attributes
     * @return array<string, mixed>
     */
    private function sampleValues($attributes, int $index): array
    {
        $values = [];
        $optionalUsed = 0;

        foreach ($attributes as $attribute) {
            if (! $attribute->is_required) {
                if ($optionalUsed >= 3) {
                    continue;
                }
                $optionalUsed++;
            }

            $options = $attribute->options ?? [];

            $values[$attribute->key] = match ($attribute->type) {
                'select' => $options === [] ? 'Belirtilmedi' : $options[$index % count($options)],
                'multiselect' => $options === [] ? [] : array_slice($options, $index % max(1, count($options) - 1), 2),
                'number' => 2 + ($index % 8),
                'range' => 10 + ($index % 40),
                'boolean' => $index % 2 === 0,
                'date' => now()->addDays(10 + ($index % 20))->toDateString(),
                'textarea' => 'Yerinde keşif sonrası netleştirebiliriz; kapsamı ve takvimi birlikte planlayalım.',
                default => 'Belirtildi',
            };
        }

        return $values;
    }

    /** Kok altinda ada gore kategori arar; bulamazsa kokun kendisine duser. */
    private function resolveCategory(string $rootSlug, array $names): ?Category
    {
        $root = Category::query()->where('slug', $rootSlug)->where('is_active', true)->first();

        if (! $root) {
            return null;
        }

        $scope = CategoryTree::descendants($root->id);

        foreach ($names as $name) {
            $match = Category::query()
                ->whereIn('id', $scope)
                ->where('is_active', true)
                ->whereNotNull('parent_id')
                ->where('name', 'ilike', $name)
                ->orderByRaw('(select count(*) from categories child where child.parent_id = categories.id) asc')
                ->first();

            if ($match) {
                return $match;
            }
        }

        // Tam ad tutmazsa parcali arama.
        foreach ($names as $name) {
            $match = Category::query()
                ->whereIn('id', $scope)
                ->where('is_active', true)
                ->whereNotNull('parent_id')
                ->where('name', 'ilike', '%'.$name.'%')
                ->orderByRaw('(select count(*) from categories child where child.parent_id = categories.id) asc')
                ->first();

            if ($match) {
                return $match;
            }
        }

        return $root;
    }
}
