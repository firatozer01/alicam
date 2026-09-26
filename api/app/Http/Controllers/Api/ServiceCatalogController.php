<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Services\AppSettings;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Anasayfanin hizmet katalogu.
 *
 * Tek cagri ile hem populer hizmetleri, hem "bu hafta trendde" seridini,
 * hem de on hizmet dikeyini doner. Alternatifi olan
 * GET /categories?tree=1 anasayfada KULLANILAMAZ: 5689 dugumun tamamini
 * tasidigi icin yaklasik 1,9 MB yanit uretiyor.
 *
 * Gosterilen birim 2. SEVIYE hizmet basligidir ("Ev ve Daire Temizligi"),
 * kok de yaprak da degil: kok cok genel, yaprak cok ince.
 */
class ServiceCatalogController extends Controller
{
    /** Trend penceresi; onceki esit pencereyle karsilastirilir. */
    private const TREND_WINDOW = 14;

    /** Bir basligin trend sayilmasi icin gereken asgari hareket. */
    private const TREND_MIN_REQUESTS = 5;

    private const TREND_MIN_BUYERS = 3;

    private const TREND_MIN_GROWTH = 1.5;

    /** Bu kadar baslik esigi gecemezse serit mevsimsel kipe duser. */
    private const TREND_MIN_ITEMS = 6;

    /** Yonetici panelinden degistirilebilen anasayfa metinleri. */
    private const COPY_KEYS = [
        'hero_title', 'hero_accent', 'hero_placeholder',
        'popular_title', 'popular_subtitle',
        'trending_title', 'trending_subtitle',
        'groups_title', 'groups_subtitle',
        'listing_title', 'listing_subtitle',
    ];

    public function __invoke(Request $request): JsonResponse
    {
        $data = $request->validate([
            'popular_limit' => ['sometimes', 'integer', 'min:1', 'max:24'],
            'trending_limit' => ['sometimes', 'integer', 'min:1', 'max:16'],
            'children_per_group' => ['sometimes', 'integer', 'min:1', 'max:12'],
        ]);

        $populerAdet = $data['popular_limit'] ?? 12;
        $trendAdet = $data['trending_limit'] ?? 12;
        $cocukAdet = $data['children_per_group'] ?? 6;

        // Yonetici metinleri ya da sabitlenen basliklari degistirince
        // onbellek kendiliginden gecersizlesir: anahtar bu degerlerin
        // ozetini tasiyor. AdminHomeController ayrica temizliyor.
        $ayar = $this->copy();
        $sabit = $this->pinned();
        // Surum sayaci gorsel degisikliklerini de kapsar; metin ve sabitleme
        // zaten ozete giriyor.
        $surum = Cache::get(AdminHomeController::VERSION_KEY, 0);
        $imza = substr(md5(json_encode([$ayar, $sabit, $surum])), 0, 8);

        $anahtar = "service-catalog:v3:{$populerAdet}:{$trendAdet}:{$cocukAdet}:{$imza}";

        $govde = Cache::remember($anahtar, 600, function () use ($populerAdet, $trendAdet, $cocukAdet, $ayar, $sabit): array {
            $basliklar = $this->headings();
            $talep = $this->demandByHeading();
            $yakin = $this->demandByHeading(self::TREND_WINDOW);
            $onceki = $this->demandByHeading(self::TREND_WINDOW * 2, self::TREND_WINDOW);
            $alici = $this->buyersByHeading(self::TREND_WINDOW);
            $ornekler = $this->leafSamples($basliklar->pluck('id')->all());
            $saticilar = $this->sellersByHeading();
            $puanlar = $this->ratingsByHeading();

            $kart = function (object $b, ?string $rozet = null) use ($talep, $ornekler, $saticilar, $puanlar) {
                $puan = $puanlar[$b->id] ?? null;

                return [
                    'id' => $b->id,
                    'slug' => $b->slug,
                    'name' => $b->name,
                    'icon' => $b->icon,
                    'color' => $b->color,
                    'image_url' => $b->image_path ? "/api/category-images/{$b->id}" : null,
                    'root' => ['slug' => $b->kok_slug, 'name' => $b->kok_name],
                    'leaf_samples' => $ornekler[$b->id] ?? [],
                    'child_count' => (int) $b->child_count,
                    'request_count' => $talep[$b->id] ?? 0,
                    // Sifirsa null doner ve kartta hic gosterilmez.
                    // "0 hizmet veren" yazan bir kart, bos oldugunu
                    // soylemekten baska bir sey yapmiyor.
                    'seller_count' => ($saticilar[$b->id] ?? 0) ?: null,
                    'rating' => $puan['rating'] ?? null,
                    'review_count' => $puan['count'] ?? null,
                    'badge' => $rozet,
                ];
            };

            // --- populer: once elle sabitlenenler (panel sirasiyla),
            // kalan yerler toplam talebe gore dolar.
            $siralanmis = $basliklar
                ->sortByDesc(fn ($b) => [$talep[$b->id] ?? 0, -$b->sort_order])
                ->values();

            $populer = $this->applyPinned($siralanmis, $sabit)
                ->take($populerAdet)
                ->map(fn ($b) => $kart($b))
                ->values()
                ->all();

            // --- trend: son pencerede gercekten hareketlenenler
            $adaylar = $basliklar->filter(function ($b) use ($yakin, $onceki, $alici) {
                $simdi = $yakin[$b->id] ?? 0;
                $evvel = $onceki[$b->id] ?? 0;

                return $simdi >= self::TREND_MIN_REQUESTS
                    && ($alici[$b->id] ?? 0) >= self::TREND_MIN_BUYERS
                    && ($simdi + 1) / ($evvel + 1) >= self::TREND_MIN_GROWTH;
            })->sortByDesc(fn ($b) => $yakin[$b->id] ?? 0);

            if ($adaylar->count() >= self::TREND_MIN_ITEMS) {
                $trend = [
                    'mode' => 'trend',
                    'window_days' => self::TREND_WINDOW,
                    'items' => $adaylar->take($trendAdet)->map(fn ($b) => $kart($b, 'rising'))->values()->all(),
                ];
            } else {
                // Yeterli sinyal yok: serit bos kalmasin diye mevsimsel
                // kurasyona duser. Hafta numarasina gore dondurulur, boylece
                // ayni oturumda ziplamaz ama her hafta tazelenir.
                $trend = [
                    'mode' => 'seasonal',
                    'window_days' => self::TREND_WINDOW,
                    'items' => $this->seasonal($basliklar, $trendAdet)
                        ->map(fn ($b) => $kart($b, now()->translatedFormat('F')))
                        ->values()->all(),
                ];
            }

            return [
                'copy' => $ayar,
                'popular' => $populer,
                'trending' => $trend,
                'groups' => $this->groups($cocukAdet),
                'listing_roots' => $this->listingRoots(),
                'stats' => [
                    'service_roots' => Category::query()->whereNull('parent_id')
                        ->where('kind', 'service')->where('is_active', true)->count(),
                    'service_headings' => $basliklar->count(),
                    'cities' => DB::table('cities')->count(),
                    'districts' => DB::table('districts')->count(),
                ],
                'ranking' => $trend['mode'] === 'trend' ? 'blended' : 'curated',
            ];
        });

        $siralama = $govde['ranking'];
        unset($govde['ranking']);

        return response()->json([
            'data' => $govde,
            'meta' => [
                'generated_at' => now()->toIso8601String(),
                'ranking' => $siralama,
                'cached_for' => 600,
            ],
        ]);
    }

    /**
     * Yonetici panelinden girilen anasayfa metinleri.
     *
     * @return array<string, string>
     */
    private function copy(): array
    {
        $out = [];

        foreach (self::COPY_KEYS as $anahtar) {
            $out[$anahtar] = AppSettings::get(
                'home.'.$anahtar,
                AppSettings::EDITABLE['home.'.$anahtar] ?? '',
            ) ?? '';
        }

        return $out;
    }

    /**
     * Elle one cikarilan baslik slug'lari.
     *
     * @return array<int, string>
     */
    private function pinned(): array
    {
        $ham = AppSettings::get('home.popular_pinned', '') ?? '';

        return array_values(array_filter(array_map('trim', explode(',', $ham))));
    }

    /**
     * Sabitlenen basliklari listenin basina alir.
     *
     * @param  \Illuminate\Support\Collection<int, object>  $basliklar
     * @param  array<int, string>  $sabit
     * @return \Illuminate\Support\Collection<int, object>
     */
    private function applyPinned($basliklar, array $sabit)
    {
        if ($sabit === []) {
            return $basliklar;
        }

        // Sabitlenenler once, kalanlar kendi sirasinda. Slug yanlis
        // yazilmissa sessizce yok sayilir: panel yuzunden anasayfa
        // bosalmasin.
        $secili = collect($sabit)
            ->map(fn (string $slug) => $basliklar->firstWhere('slug', $slug))
            ->filter();

        return $secili->concat($basliklar->reject(fn ($b) => $secili->contains('id', $b->id)))->values();
    }

    /**
     * Aktif hizmet agacinin 2. seviyesi: gosterilecek "hizmet basligi".
     *
     * @return \Illuminate\Support\Collection<int, object>
     */
    private function headings()
    {
        return collect(DB::select("
            select c.id, c.slug, c.name, c.icon, c.color, c.sort_order, c.image_path,
                   k.slug as kok_slug, k.name as kok_name,
                   (select count(*) from categories y
                     where y.parent_id = c.id and y.is_active = true) as child_count
            from categories c
            join categories k on k.id = c.parent_id
            where c.is_active = true
              and k.is_active = true
              and k.parent_id is null
              and k.kind = 'service'
            order by c.sort_order, c.name
        "));
    }

    /**
     * Baslik basina talep sayisi. Talep yaprakta durur, bir seviye yukari
     * toplanir.
     *
     * @return array<int, int>
     */
    private function demandByHeading(?int $sonGun = null, ?int $oncekiGun = null): array
    {
        $sorgu = DB::table('request_categories as rc')
            ->join('categories as y', 'y.id', '=', 'rc.category_id')
            ->join('requests as t', 't.id', '=', 'rc.request_id')
            ->selectRaw('y.parent_id as baslik_id, count(distinct rc.request_id) as adet')
            ->groupBy('y.parent_id');

        if ($sonGun !== null) {
            $sorgu->where('t.created_at', '>=', now()->subDays($sonGun));
        }
        if ($oncekiGun !== null) {
            $sorgu->where('t.created_at', '<', now()->subDays($oncekiGun));
        }

        return collect($sorgu->get())->pluck('adet', 'baslik_id')
            ->map(fn ($n) => (int) $n)->all();
    }

    /**
     * Baslik basina FARKLI alici sayisi: tek kisinin ust uste actigi
     * talepler bir basligi trend gostermesin.
     *
     * @return array<int, int>
     */
    private function buyersByHeading(int $sonGun): array
    {
        $rows = DB::table('request_categories as rc')
            ->join('categories as y', 'y.id', '=', 'rc.category_id')
            ->join('requests as t', 't.id', '=', 'rc.request_id')
            ->where('t.created_at', '>=', now()->subDays($sonGun))
            ->selectRaw('y.parent_id as baslik_id, count(distinct t.user_id) as adet')
            ->groupBy('y.parent_id')
            ->get();

        return collect($rows)->pluck('adet', 'baslik_id')->map(fn ($n) => (int) $n)->all();
    }

    /**
     * Baslik basina onayli hizmet veren sayisi.
     *
     * Satici hem basligin kendisine hem bir yapragina abone olabilir;
     * ikisi de o baslikta calistigi anlamina gelir, bu yuzden yaprak
     * abonelikleri bir seviye yukari toplanir ve satici tekillestirilir.
     *
     * @return array<int, int>
     */
    private function sellersByHeading(): array
    {
        $rows = DB::select("
            select baslik_id, count(distinct seller_id) as adet from (
                select sc.category_id as baslik_id, sc.seller_id
                from seller_categories sc
                join seller_profiles sp on sp.user_id = sc.seller_id
                where sp.approval_status = 'approved'
                union all
                select y.parent_id as baslik_id, sc.seller_id
                from seller_categories sc
                join categories y on y.id = sc.category_id
                join seller_profiles sp on sp.user_id = sc.seller_id
                where sp.approval_status = 'approved' and y.parent_id is not null
            ) t
            group by baslik_id
        ");

        return collect($rows)->pluck('adet', 'baslik_id')->map(fn ($n) => (int) $n)->all();
    }

    /**
     * Baslik basina ortalama puan ve yorum sayisi.
     *
     * Yorum saticiya yazilir, baslige degil; burada saticinin abone
     * oldugu basliklara dagitiliyor. Yaklasik bir degerdir ve yorum
     * yoksa hic gosterilmez.
     *
     * @return array<int, array{rating: float, count: int}>
     */
    private function ratingsByHeading(): array
    {
        $rows = DB::select("
            select baslik_id, round(avg(rating)::numeric, 1) as puan, count(*) as adet from (
                select coalesce(y.parent_id, sc.category_id) as baslik_id, r.rating
                from seller_reviews r
                join seller_categories sc on sc.seller_id = r.seller_id
                left join categories y on y.id = sc.category_id
            ) t
            where baslik_id is not null
            group by baslik_id
        ");

        $out = [];

        foreach ($rows as $row) {
            $out[(int) $row->baslik_id] = [
                'rating' => (float) $row->puan,
                'count' => (int) $row->adet,
            ];
        }

        return $out;
    }

    /**
     * Baslik basina ilk uc yaprak adi; kartta "bu baslik neyi kapsiyor"
     * sorusunu agaci acmadan yanitlar.
     *
     * @param  array<int, int>  $baslikIds
     * @return array<int, array<int, string>>
     */
    private function leafSamples(array $baslikIds): array
    {
        if ($baslikIds === []) {
            return [];
        }

        $rows = DB::select('
            select parent_id, name from (
                select parent_id, name,
                       row_number() over (partition by parent_id order by sort_order, name) as sira
                from categories
                where parent_id = any(?) and is_active = true
            ) t where sira <= 3
        ', ['{'.implode(',', $baslikIds).'}']);

        $sonuc = [];
        foreach ($rows as $r) {
            $sonuc[$r->parent_id][] = $r->name;
        }

        return $sonuc;
    }

    /**
     * On hizmet dikeyi, her birinde ilk N alt baslik gomulu.
     *
     * @return array<int, array<string, mixed>>
     */
    private function groups(int $cocukAdet): array
    {
        $kokler = Category::query()
            ->whereNull('parent_id')->where('kind', 'service')->where('is_active', true)
            ->orderBy('sort_order')
            ->get(['id', 'slug', 'name', 'icon', 'color', 'image_path']);

        $cocuklar = Category::query()
            ->whereIn('parent_id', $kokler->pluck('id'))
            ->where('is_active', true)
            ->orderBy('sort_order')->orderBy('name')
            ->get(['id', 'parent_id', 'slug', 'name', 'icon'])
            ->groupBy('parent_id');

        return $kokler->map(function (Category $kok) use ($cocuklar, $cocukAdet) {
            $liste = $cocuklar[$kok->id] ?? collect();

            return [
                'id' => $kok->id,
                'slug' => $kok->slug,
                'name' => $kok->name,
                'icon' => $kok->icon,
                'color' => $kok->color,
                'image_url' => $kok->image_path ? "/api/category-images/{$kok->id}" : null,
                'child_count' => $liste->count(),
                'children' => $liste->take($cocukAdet)->map(fn ($c) => [
                    'id' => $c->id,
                    'slug' => $c->slug,
                    'name' => $c->name,
                    'icon' => $c->icon,
                ])->values()->all(),
            ];
        })->values()->all();
    }

    /**
     * Urun/ilan kokleri: hizmet olmayan talepler de bir yerden girsin.
     *
     * @return array<int, array<string, mixed>>
     */
    private function listingRoots(): array
    {
        return Category::query()
            ->whereNull('parent_id')->where('kind', 'listing')->where('is_active', true)
            ->orderBy('sort_order')
            ->get(['id', 'slug', 'name', 'icon', 'color', 'image_path'])
            ->map(fn (Category $c) => [
                'id' => $c->id,
                'slug' => $c->slug,
                'name' => $c->name,
                'icon' => $c->icon,
                'color' => $c->color,
                'image_url' => $c->image_path ? "/api/category-images/{$c->id}" : null,
            ])->values()->all();
    }

    /**
     * Trend sinyali yetmediginde gosterilecek kurasyon.
     *
     * Rastgele degil: hafta numarasina gore donduruldugu icin sayfa ayni
     * oturumda ziplamaz, her hafta tazelenir.
     *
     * @param  \Illuminate\Support\Collection<int, object>  $basliklar
     */
    private function seasonal($basliklar, int $adet)
    {
        $tercih = collect(config('home.seasonal.'.now()->month, []));

        $secilen = $tercih->isEmpty()
            ? collect()
            : $basliklar->filter(fn ($b) => $tercih->contains($b->slug));

        // Mevsim listesi yetmezse kalanlar hafta numarasina gore dondurulur.
        $kalan = $basliklar->reject(fn ($b) => $secilen->contains('id', $b->id))->values();
        $kaydir = $kalan->isEmpty() ? collect() : $kalan
            ->slice((int) now()->isoWeek() % max(1, $kalan->count()))
            ->concat($kalan);

        return $secilen->concat($kaydir)->unique('id')->take($adet);
    }
}
