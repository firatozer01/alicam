<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BuyerRequest;
use App\Models\SellerReview;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class MarketplaceController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'q' => ['sometimes', 'nullable', 'string', 'max:100'],
            'category' => ['sometimes', 'nullable', 'string', 'exists:categories,slug'],
            'city_id' => ['sometimes', 'nullable', 'integer', 'exists:cities,id'],
            'budget_min' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'budget_max' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'sort' => ['sometimes', Rule::in(['latest', 'budget_high', 'budget_low', 'popular'])],
            'page' => ['sometimes', 'integer', 'min:1'],
        ]);

        $requests = $this->applyFilters($this->baseQuery(), $filters)
            ->with(['category', 'city', 'district'])
            ->withCount('offers');

        match ($filters['sort'] ?? 'latest') {
            'budget_high' => $requests->orderByDesc('budget_max'),
            'budget_low' => $requests->orderBy('budget_min'),
            'popular' => $requests->orderByDesc('offers_count'),
            default => $requests->latest(),
        };

        $page = $requests->paginate(18)->withQueryString();
        $sellers = User::query()
            ->whereHas('sellerProfile', fn (Builder $query) => $query->where('approval_status', 'approved'))
            ->with([
                'sellerProfile',
                'sellerCategories:id,name,slug,icon,color',
                'sellerServices' => fn ($query) => $query
                    ->where('is_active', true)
                    ->latest()
                    ->limit(3),
            ])
            ->withAvg('sellerReviews', 'rating')
            ->withCount(['sellerReviews', 'portfolioItems'])
            ->withMax('activeSellerPromotions', 'expires_at')
            ->orderByRaw('active_seller_promotions_max_expires_at desc nulls last')
            ->orderByRaw('seller_reviews_avg_rating desc nulls last')
            ->orderByDesc('seller_reviews_count')
            ->limit(8)
            ->get();

        $featuredServices = \App\Models\SellerService::query()
            ->where('is_active', true)
            ->whereHas('seller.sellerProfile', fn (Builder $query) => $query->where('approval_status', 'approved'))
            ->with(['category:id,name,slug,icon,color', 'seller.sellerProfile'])
            ->withExists(['seller as seller_featured' => fn ($query) => $query->whereHas('activeSellerPromotions')])
            ->orderByDesc('seller_featured')
            ->orderByRaw('cover_path is null')
            ->latest()
            ->limit(8)
            ->get();

        return response()->json([
            'data' => [
                'featured_services' => $featuredServices->map(fn ($service) => [
                    'id' => $service->id,
                    'title' => $service->title,
                    'description' => Str::limit($service->description, 110),
                    'price_from' => $service->price_from,
                    'delivery_time' => $service->delivery_time,
                    'cover_url' => $service->cover_url,
                    'is_featured' => (bool) $service->seller_featured,
                    'category' => $service->category ? [
                        'name' => $service->category->name,
                        'slug' => $service->category->slug,
                        'icon' => $service->category->icon,
                        'color' => $service->category->color,
                    ] : null,
                    'seller' => [
                        'id' => $service->seller->id,
                        'name' => $service->seller->sellerProfile?->company_name ?: $service->seller->name,
                    ],
                ])->values(),
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
                    'location' => [
                        'city' => ['id' => $item->city->id, 'name' => $item->city->name],
                        'district' => ['id' => $item->district->id, 'name' => $item->district->name],
                    ],
                    'offer_count' => (int) $item->offers_count,
                    'status' => $item->status,
                    'created_at' => $item->created_at->toIso8601String(),
                    'expires_at' => $item->expires_at?->toIso8601String(),
                ])->values(),
                'sellers' => $sellers->map(fn (User $seller) => [
                    'id' => $seller->id,
                    'name' => $seller->name,
                    'company_name' => $seller->sellerProfile?->company_name,
                    'description' => Str::limit($seller->sellerProfile?->description ?? '', 150),
                    'rating' => round((float) ($seller->seller_reviews_avg_rating ?? 0), 1),
                    'review_count' => (int) $seller->seller_reviews_count,
                    'is_featured' => $seller->active_seller_promotions_max_expires_at !== null,
                    'featured_until' => $seller->active_seller_promotions_max_expires_at,
                    'categories' => $seller->sellerCategories->map(fn ($category) => [
                        'name' => $category->name,
                        'slug' => $category->slug,
                        'icon' => $category->icon,
                        'color' => $category->color,
                    ])->values(),
                    'services' => $seller->sellerServices->map(fn ($service) => [
                        'id' => $service->id,
                        'title' => $service->title,
                        'price_from' => $service->price_from,
                        'cover_url' => $service->cover_url,
                    ])->values(),
                    'portfolio_count' => (int) $seller->portfolio_items_count,
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
    private function categoryFacets(array $filters): array
    {
        return $this->applyFilters($this->baseQuery(), $filters, 'category')
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
