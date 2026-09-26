<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Support\CategoryTree;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class CategoryController extends Controller
{
    /**
     * Kok kategoriler. Agac buyudugu icin iki secmeli parametre eklendi:
     *   kind=service|listing  -> hizmet talepleri / ilan talepleri ayrimi
     *   tree=1                -> alt kategorileri de gomulu dondurur
     *   demand=1              -> her satira talep sayisi ekler ve cok
     *                            talep alani one alir (anasayfa katalogu)
     */
    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'kind' => ['sometimes', Rule::in(['service', 'listing'])],
            'tree' => ['sometimes'],
            'parent' => ['sometimes', 'string', 'max:90'],
            'demand' => ['sometimes'],
        ]);

        $query = Category::query()
            ->active()
            ->with('creditCost')
            ->orderBy('sort_order')
            ->orderBy('name');

        if (isset($filters['parent'])) {
            $parent = Category::query()->active()->where('slug', $filters['parent'])->firstOrFail();
            $query->where('parent_id', $parent->id);
        } else {
            $query->whereNull('parent_id');
        }

        if (isset($filters['kind'])) {
            $query->where('kind', $filters['kind']);
        }

        if ($request->boolean('tree')) {
            // Iki seviye yeter: kok -> alt kategori -> yaprak.
            $query->with(['children' => fn ($child) => $child->where('is_active', true)
                ->with(['children' => fn ($leaf) => $leaf->where('is_active', true)])]);
        }

        $rows = $query->get();

        if ($request->boolean('demand')) {
            $counts = $this->demandByRoot();

            $rows = $rows
                ->each(fn (Category $row) => $row->setAttribute('request_count', $counts[$row->id] ?? 0))
                // Cok talep alan basa; esitlikte sitenin kendi sirasi korunur,
                // boylece hic talep yokken de liste anlamli bir duzende kalir.
                ->sortByDesc(fn (Category $row) => [$row->request_count, -$row->sort_order])
                ->values();
        }

        return response()->json(['data' => $rows]);
    }

    /**
     * Hizmet adina gore arama.
     *
     * Ayri bir uc: index'in varsayilani "yalnizca kokler" ve ayni ucun bazen
     * duz liste dondurmesi cagiran tarafi karistiriyor.
     *
     * Arama search_name uzerinden yapilir; kullanicilarin cogu telefonda
     * Turkce karakter yazmiyor ve ILIKE '%camasir%' ham ad uzerinde
     * "Çamaşır Makinesi"ni BULAMIYOR.
     */
    public function search(Request $request): JsonResponse
    {
        $data = $request->validate([
            'q' => ['required', 'string', 'min:2', 'max:60'],
            'kind' => ['sometimes', Rule::in(['service', 'listing'])],
            'limit' => ['sometimes', 'integer', 'min:1', 'max:20'],
        ]);

        $arama = Category::fold($data['q']);
        $tur = $data['kind'] ?? null;
        $adet = $data['limit'] ?? 10;

        $sonuc = Cache::remember("catsearch:".($tur ?? 'all').":{$adet}:{$arama}", 60, function () use ($arama, $tur, $adet) {
            $sorgu = Category::query()
                ->active()
                ->where('search_name', 'like', '%'.$arama.'%')
                // Adi aramayla BASLAYAN once gelsin; "boya" arayan once
                // "Boya, Badana ve Siva"yi gorsun, "Ahsap Boyama"yi sonra.
                ->orderByRaw('case when search_name like ? then 0 else 1 end', [$arama.'%'])
                ->orderByRaw('length(search_name)')
                ->limit($adet);

            if ($tur !== null) {
                $sorgu->where('kind', $tur);
            }

            return $sorgu->get(['id', 'slug', 'name', 'kind', 'parent_id']);
        });

        return response()->json([
            'data' => $sonuc->map(fn (Category $c) => [
                'id' => $c->id,
                'slug' => $c->slug,
                'name' => $c->name,
                'kind' => $c->kind,
                // Kirinti yolu: "Temizlik Hizmetleri > Tekstil Yikama".
                // ancestors() [kendisi, ebeveyn, ... , kok] doner; kendisi
                // atilip sira ters cevrilir ki yol kokten basliyor olsun.
                'path' => $this->breadcrumb($c->id),
            ])->values(),
        ]);
    }

    /**
     * Kategorinin kokten kendisine kadar olan yolu, KENDISI HARIC.
     *
     * @return array<int, string>
     */
    private function breadcrumb(int $categoryId): array
    {
        $zincir = CategoryTree::ancestors($categoryId);
        $ustler = array_reverse(array_slice($zincir, 1));

        if ($ustler === []) {
            return [];
        }

        $adlar = Category::query()->whereIn('id', $ustler)->pluck('name', 'id');

        return collect($ustler)->map(fn ($id) => $adlar[$id] ?? null)->filter()->values()->all();
    }

    /**
     * Kok kategori basina talep sayisi.
     *
     * Talep yaprak kategoriye baglanir; sayim iki seviye yukari cikarak
     * koke toplanir. Ayni talep birden cok alt dalda olabilecegi icin
     * request_id uzerinden distinct alinir.
     *
     * @return array<int, int>
     */
    private function demandByRoot(): array
    {
        $rows = DB::select('
            select coalesce(k2.id, k1.id, c.id) as kok_id,
                   count(distinct rc.request_id) as adet
            from request_categories rc
            join categories c on c.id = rc.category_id
            left join categories k1 on k1.id = c.parent_id
            left join categories k2 on k2.id = k1.parent_id
            group by 1
        ');

        return collect($rows)->pluck('adet', 'kok_id')->map(fn ($n) => (int) $n)->all();
    }

    public function attributes(Category $category): JsonResponse
    {
        abort_unless($category->is_active, 404);

        $category->load(['attributes', 'creditCost', 'parent.attributes']);

        return response()->json([
            'data' => $category,
            // Alan setleri kalitimlidir: yaprakta sorulanlar ust kategorininkini
            // de icerir, boylece form tek listeden kurulur.
            'effective_attributes' => CategoryTree::effectiveAttributes($category),
        ]);
    }
}
