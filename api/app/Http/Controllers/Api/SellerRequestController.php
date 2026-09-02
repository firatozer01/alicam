<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\SellerRequestResource;
use App\Models\BuyerRequest;
use App\Models\RequestFavorite;
use App\Models\User;
use App\Services\SellerCreditService;
use App\Services\SellerMatchingService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class SellerRequestController extends Controller
{
    public function __construct(
        private readonly SellerCreditService $credits,
        private readonly SellerMatchingService $matching,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'unlocked' => ['sometimes', 'boolean'],
            'favorite' => ['sometimes', 'boolean'],
            'q' => ['sometimes', 'nullable', 'string', 'max:100'],
            'category' => ['sometimes', 'nullable', 'string', 'exists:categories,slug'],
            'city_id' => ['sometimes', 'nullable', 'integer', 'exists:cities,id'],
            'budget_min' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'budget_max' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'sort' => ['sometimes', Rule::in(['latest', 'budget_high', 'budget_low', 'competition', 'popular'])],
            'page' => ['sometimes', 'integer', 'min:1'],
        ]);

        // validate() ham girdiyi döndürür: "1" string'i ile === true karşılaştırması
        // asla tutmaz. Boolean kapsamlar burada gerçek bool'a çevrilir.
        $filters['unlocked'] = $request->boolean('unlocked');
        $filters['favorite'] = $request->boolean('favorite');

        $seller = $request->user();
        $query = $this->applyFilters($this->matching->query($seller), $seller, $filters);

        match ($filters['sort'] ?? 'latest') {
            'budget_high' => $query->orderByDesc('requests.budget_max'),
            'budget_low' => $query->orderBy('requests.budget_min'),
            'competition' => $query->orderBy('offers_count'),
            'popular' => $query->orderByDesc('offers_count'),
            default => $query->latest('requests.created_at'),
        };

        $items = $query->paginate(15)->withQueryString();

        return response()->json([
            'data' => SellerRequestResource::collection($items->items()),
            'facets' => [
                'categories' => $this->categoryFacets($seller, $filters),
                'cities' => $this->cityFacets($seller, $filters),
                'budget' => $this->budgetBounds($seller, $filters),
            ],
            'meta' => [
                'current_page' => $items->currentPage(),
                'last_page' => $items->lastPage(),
                'per_page' => $items->perPage(),
                'total' => $items->total(),
                'filter' => $filters['favorite'] ? 'favorite' : ($filters['unlocked'] ? 'unlocked' : 'all'),
            ],
        ]);
    }

    /**
     * Liste ve facet sorgularının ortak filtre katmanı.
     *
     * @param  array<string, mixed>  $filters
     * @param  string|null  $skip  Bir facet kendi boyutunu saymazken hariç tutar.
     */
    private function applyFilters(Builder $query, User $seller, array $filters, ?string $skip = null): Builder
    {
        if (($filters['unlocked'] ?? false) === true) {
            $query->whereHas(
                'unlocks',
                fn (Builder $unlockQuery) => $unlockQuery->where('seller_id', $seller->id),
            );
        }

        if (($filters['favorite'] ?? false) === true) {
            $query->whereHas(
                'favorites',
                fn (Builder $favoriteQuery) => $favoriteQuery->where('user_id', $seller->id),
            );
        }

        // PostgreSQL'de LIKE büyük/küçük harf duyarlıdır; arama ILIKE ile yapılır.
        if ($search = trim((string) ($filters['q'] ?? ''))) {
            $query->where(fn (Builder $inner) => $inner
                ->where('requests.title', 'ilike', "%{$search}%")
                ->orWhere('requests.description', 'ilike', "%{$search}%")
                ->orWhere('requests.public_reference', 'ilike', "%{$search}%"));
        }

        if ($skip !== 'category' && ($category = $filters['category'] ?? null)) {
            $query->whereHas('category', fn (Builder $inner) => $inner->where('slug', $category));
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
    private function categoryFacets(User $seller, array $filters): array
    {
        return $this->applyFilters($this->matching->baseQuery($seller), $seller, $filters, 'category')
            ->join('categories', 'categories.id', '=', 'requests.category_id')
            ->groupBy('categories.id', 'categories.name', 'categories.slug', 'categories.icon', 'categories.color')
            ->orderByDesc('total')
            ->selectRaw('categories.slug, categories.name, categories.icon, categories.color, count(*) as total')
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
    private function cityFacets(User $seller, array $filters): array
    {
        return $this->applyFilters($this->matching->baseQuery($seller), $seller, $filters, 'city')
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
     * Bütçe filtresinin alt ve üst uçlarını mevcut sonuç kümesinden türetir.
     *
     * @param  array<string, mixed>  $filters
     * @return array{min: int, max: int}
     */
    private function budgetBounds(User $seller, array $filters): array
    {
        $row = $this->applyFilters($this->matching->baseQuery($seller), $seller, $filters, 'budget')
            ->reorder()
            ->selectRaw('min(requests.budget_min) as low, max(requests.budget_max) as high')
            ->toBase()
            ->first();

        return [
            'min' => (int) floor((float) ($row->low ?? 0)),
            'max' => (int) ceil((float) ($row->high ?? 0)),
        ];
    }

    public function show(Request $request, BuyerRequest $buyerRequest): JsonResponse
    {
        $item = $this->matching->query($request->user())
            ->whereKey($buyerRequest->id)
            ->firstOrFail();

        return response()->json(['data' => new SellerRequestResource($item)]);
    }

    /**
     * Favoriye ekler ya da zaten favorideyse çıkarır. Yalnızca satıcının
     * eşleştiği talepler favorilenebilir.
     */
    public function toggleFavorite(Request $request, BuyerRequest $buyerRequest): JsonResponse
    {
        $seller = $request->user();
        $this->matching->baseQuery($seller)->whereKey($buyerRequest->id)->firstOrFail();

        $existing = RequestFavorite::query()
            ->where('user_id', $seller->id)
            ->where('request_id', $buyerRequest->id)
            ->first();

        if ($existing) {
            $existing->delete();

            return response()->json([
                'message' => 'Talep favorilerden çıkarıldı.',
                'is_favorite' => false,
            ]);
        }

        RequestFavorite::query()->create([
            'user_id' => $seller->id,
            'request_id' => $buyerRequest->id,
        ]);

        return response()->json([
            'message' => 'Talep favorilere eklendi.',
            'is_favorite' => true,
        ]);
    }

    public function unlock(Request $request, BuyerRequest $buyerRequest): JsonResponse
    {
        $seller = $request->user();
        $item = $this->matching->query($seller)
            ->whereKey($buyerRequest->id)
            ->firstOrFail();
        $result = $this->credits->unlock($seller, $item);

        $unlockedItem = $this->matching->query($seller)
            ->whereKey($buyerRequest->id)
            ->firstOrFail();

        return response()->json([
            'message' => $result['already_unlocked']
                ? 'Bu talebin detayları daha önce açılmıştı; kontör düşülmedi.'
                : 'Talep detayları açıldı.',
            'data' => new SellerRequestResource($unlockedItem),
            'balance' => $result['balance'],
            'already_unlocked' => $result['already_unlocked'],
        ]);
    }
}
