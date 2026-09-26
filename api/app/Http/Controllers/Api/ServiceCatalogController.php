<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Category;
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

    public function __invoke(Request $request): JsonResponse
    {
        $data = $request->validate([
            'popular_limit' => ['sometimes', 'integer', 'min:1', 'max:24'],
            'trending_limit' => ['sometimes', 'integer', 'min:1', 'max:16'],
            'children_per_group' => ['sometimes', 'integer', 'min:1', 'max:12'],
        ]);

        $populerAdet = $data['popular_limit'] ?? 12;
        $trendAdet = $data['trending_limit'] ?? 8;
        $cocukAdet = $data['children_per_group'] ?? 6;

        $anahtar = "service-catalog:v1:{$populerAdet}:{$trendAdet}:{$cocukAdet}";

        $govde = Cache::remember($anahtar, 600, function () use ($populerAdet, $trendAdet, $cocukAdet): array {
            $basliklar = $this->headings();
            $talep = $this->demandByHeading();
            $yakin = $this->demandByHeading(self::TREND_WINDOW);
            $onceki = $this->demandByHeading(self::TREND_WINDOW * 2, self::TREND_WINDOW);
            $alici = $this->buyersByHeading(self::TREND_WINDOW);
            $ornekler = $this->leafSamples($basliklar->pluck('id')->all());

            $kart = fn (object $b, ?string $rozet = null) => [
                'id' => $b->id,
                'slug' => $b->slug,
                'name' => $b->name,
                'icon' => $b->icon,
                'color' => $b->color,
                'root' => ['slug' => $b->kok_slug, 'name' => $b->kok_name],
                'leaf_samples' => $ornekler[$b->id] ?? [],
                'child_count' => (int) $b->child_count,
                // Ham sayi yukte durur ama arayuzde gosterilmez: esik
                // degistiginde API surumu degistirmeden acilabilsin diye.
                'request_count' => $talep[$b->id] ?? 0,
                'badge' => $rozet,
            ];

            // --- populer: toplam talebe gore, esitlikte sitenin kendi sirasi
            $populer = $basliklar
                ->sortByDesc(fn ($b) => [$talep[$b->id] ?? 0, -$b->sort_order])
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
     * Aktif hizmet agacinin 2. seviyesi: gosterilecek "hizmet basligi".
     *
     * @return \Illuminate\Support\Collection<int, object>
     */
    private function headings()
    {
        return collect(DB::select("
            select c.id, c.slug, c.name, c.icon, c.color, c.sort_order,
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
            ->get(['id', 'slug', 'name', 'icon', 'color']);

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
            ->get(['id', 'slug', 'name', 'icon', 'color'])
            ->map(fn (Category $c) => [
                'id' => $c->id,
                'slug' => $c->slug,
                'name' => $c->name,
                'icon' => $c->icon,
                'color' => $c->color,
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
