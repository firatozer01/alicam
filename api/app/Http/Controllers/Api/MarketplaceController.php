<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\CategoryTree;
use App\Models\BuyerRequest;
use App\Models\SellerReview;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class MarketplaceController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'q' => ['sometimes', 'nullable', 'string', 'max:100'],
            // Birden fazla kategori secilebilir; virgulle ayrilmis liste de kabul edilir.
            'category' => ['sometimes', 'nullable'],
            'city_id' => ['sometimes', 'nullable', 'integer', 'exists:cities,id'],
            'budget_min' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'budget_max' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'sort' => ['sometimes', Rule::in(['latest', 'budget_high', 'budget_low', 'popular'])],
            'page' => ['sometimes', 'integer', 'min:1'],
        ]);

        $requests = $this->applyFilters($this->baseQuery(), $filters)
            ->with(['category', 'categories', 'city', 'district'])
            ->withCount('offers');

        match ($filters['sort'] ?? 'latest') {
            'budget_high' => $requests->orderByDesc('budget_max'),
            'budget_low' => $requests->orderBy('budget_min'),
            'popular' => $requests->orderByDesc('offers_count'),
            default => $requests->latest(),
        };

        $page = $requests->paginate(18)->withQueryString();

        return response()->json([
            'data' => [
                'requests' => $page->getCollection()->map(fn (BuyerRequest $item) => [
                    'id' => $item->id,
                    'reference' => $item->public_reference,
                    'title' => $item->title,
                    'summary' => Str::limit(strip_tags($item->description), 180),
                    'budget' => ['min' => $item->budget_min, 'max' => $item->budget_max],
                    'category' => [
                        'id' => $item->category->id,
                        'name' => $item->category->name,
                        'slug' => $item->category->slug,
                        'icon' => $item->category->icon,
                        'color' => $item->category->color,
                    ],
                    // Birincil disindaki kategoriler: talep birden fazla yerde listelenir.
                    'extra_categories' => $item->categories
                        ->where('id', '!=', $item->category_id)
                        ->map(fn ($category) => [
                            'name' => $category->name,
                            'slug' => $category->slug,
                            'icon' => $category->icon,
                            'color' => $category->color,
                        ])->values(),
                    'location' => [
                        'city' => ['id' => $item->city->id, 'name' => $item->city->name],
                        'district' => ['id' => $item->district->id, 'name' => $item->district->name],
                    ],
                    'offer_count' => (int) $item->offers_count,
                    'status' => $item->status,
                    'created_at' => $item->created_at->toIso8601String(),
                    'expires_at' => $item->expires_at?->toIso8601String(),
                ])->values(),
                'stats' => [
                    'active_requests' => BuyerRequest::query()->whereIn('status', ['open', 'in_negotiation'])->count(),
                    'approved_sellers' => User::query()->whereHas('sellerProfile', fn (Builder $query) => $query->where('approval_status', 'approved'))->count(),
                    'reviews' => SellerReview::query()->count(),
                ],
            ],
            'facets' => [
                'categories' => $this->categoryFacets($filters),
                'cities' => $this->cityFacets($filters),
                'budget' => $this->budgetBounds($filters),
            ],
            'meta' => [
                'current_page' => $page->currentPage(),
                'last_page' => $page->lastPage(),
                'per_page' => $page->perPage(),
                'total' => $page->total(),
            ],
        ]);
    }

    /** Yayında olan ve süresi dolmamış talepler. */
    private function baseQuery(): Builder
    {
        return BuyerRequest::query()
            ->whereIn('status', ['open', 'in_negotiation'])
            ->where(fn (Builder $query) => $query
                ->whereNull('expires_at')
                ->orWhere('expires_at', '>', now()));
    }

    /**
     * @param  array<string, mixed>  $filters
     * @param  string|null  $skip  Bir facet kendi boyutunu saymazken hariç tutar.
     */
    private function applyFilters(Builder $query, array $filters, ?string $skip = null): Builder
    {
        // PostgreSQL'de LIKE büyük/küçük harf duyarlıdır; arama ILIKE ile yapılır.
        if ($search = trim((string) ($filters['q'] ?? ''))) {
            $query->where(fn (Builder $inner) => $inner
                ->where('title', 'ilike', "%{$search}%")
                ->orWhere('description', 'ilike', "%{$search}%"));
        }

        if ($skip !== 'category') {
            $categoryIds = CategoryTree::idsForSlugs($filters['category'] ?? null);

            if ($categoryIds !== []) {
                // Ust kategori secildiginde altindaki tum basliklar da listelenir;
                // birden fazla secimde birlesim alinir.
                $query->whereExists(fn ($inner) => $inner
                    ->selectRaw('1')
                    ->from('request_categories')
                    ->whereColumn('request_categories.request_id', 'requests.id')
                    ->whereIn('request_categories.category_id', $categoryIds));
            }
        }

        if ($skip !== 'city' && ($cityId = $filters['city_id'] ?? null)) {
            $query->where('requests.city_id', $cityId);
        }

        if ($skip !== 'budget') {
            if (($min = $filters['budget_min'] ?? null) !== null) {
                $query->where('requests.budget_max', '>=', $min);
            }

            if (($max = $filters['budget_max'] ?? null) !== null) {
                $query->where('requests.budget_min', '<=', $max);
            }
        }

        return $query;
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return array<int, array<string, mixed>>
     */
    private function categoryFacets(array $filters): array
    {
        return $this->applyFilters($this->baseQuery(), $filters, 'category')
            ->join('request_categories', 'request_categories.request_id', '=', 'requests.id')
            ->join('categories as rc0', 'rc0.id', '=', 'request_categories.category_id')
            ->leftJoin('categories as rc1', 'rc1.id', '=', 'rc0.parent_id')
            ->leftJoin('categories as rc2', 'rc2.id', '=', 'rc1.parent_id')
            ->join(DB::raw('categories as root'), fn ($join) => $join
                ->on(DB::raw('root.id'), '=', DB::raw('coalesce(rc2.id, rc1.id, rc0.id)')))
            ->groupBy('root.id', 'root.name', 'root.slug', 'root.icon', 'root.color')
            ->orderByDesc('total')
            ->selectRaw('root.slug, root.name, root.icon, root.color, count(distinct requests.id) as total')
            ->toBase()
            ->get()
            ->map(fn ($row) => [
                'slug' => $row->slug,
                'name' => $row->name,
                'icon' => $row->icon,
                'color' => $row->color,
                'count' => (int) $row->total,
            ])
            ->all();
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return array<int, array<string, mixed>>
     */
    private function cityFacets(array $filters): array
    {
        return $this->applyFilters($this->baseQuery(), $filters, 'city')
            ->join('cities', 'cities.id', '=', 'requests.city_id')
            ->groupBy('cities.id', 'cities.name')
            ->orderByDesc('total')
            ->selectRaw('cities.id, cities.name, count(*) as total')
            ->toBase()
            ->get()
            ->map(fn ($row) => [
                'id' => (int) $row->id,
                'name' => $row->name,
                'count' => (int) $row->total,
            ])
            ->all();
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return array{min: int, max: int}
     */
    private function budgetBounds(array $filters): array
    {
        $row = $this->applyFilters($this->baseQuery(), $filters, 'budget')
            ->reorder()
            ->selectRaw('min(requests.budget_min) as low, max(requests.budget_max) as high')
            ->toBase()
            ->first();

        return [
            'min' => (int) floor((float) ($row->low ?? 0)),
            'max' => (int) ceil((float) ($row->high ?? 0)),
        ];
    }
}
