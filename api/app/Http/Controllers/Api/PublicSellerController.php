<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SellerPortfolioItem;
use App\Models\SellerReview;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class PublicSellerController extends Controller
{
    /** Onaylı hizmet verenlerin filtrelenebilir vitrin listesi. */
    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'q' => ['sometimes', 'nullable', 'string', 'max:100'],
            'category' => ['sometimes', 'nullable', 'string', 'exists:categories,slug'],
            'city_id' => ['sometimes', 'nullable', 'integer', 'exists:cities,id'],
            'min_rating' => ['sometimes', 'nullable', 'numeric', 'min:0', 'max:5'],
            'sort' => ['sometimes', Rule::in(['featured', 'rating', 'reviews', 'portfolio', 'newest'])],
            'page' => ['sometimes', 'integer', 'min:1'],
        ]);
        $filters['featured'] = $request->boolean('featured');

        $query = $this->applyFilters($this->baseQuery(), $filters)
            ->with([
                'sellerProfile',
                'sellerCategories:id,name,slug,icon,color',
                'sellerServices' => fn ($service) => $service->where('is_active', true)->with('category:id,name,icon,color')->latest()->limit(3),
                'portfolioItems' => fn ($portfolio) => $portfolio
                    ->where('is_published', true)
                    ->with('images')
                    ->latest()
                    ->limit(3),
            ])
            ->withAvg('sellerReviews', 'rating')
            ->withCount(['sellerReviews', 'sellerServices', 'portfolioItems'])
            ->withMax('activeSellerPromotions', 'expires_at');

        match ($filters['sort'] ?? 'featured') {
            'rating' => $query->orderByRaw('seller_reviews_avg_rating desc nulls last')->orderByDesc('seller_reviews_count'),
            'reviews' => $query->orderByDesc('seller_reviews_count'),
            'portfolio' => $query->orderByDesc('portfolio_items_count'),
            'newest' => $query->latest('users.created_at'),
            // PostgreSQL'de DESC siralamada NULL'lar basa gelir; one cikani
            // olmayanlar one gecmesin diye NULLS LAST gerekir.
            default => $query
                ->orderByRaw('active_seller_promotions_max_expires_at desc nulls last')
                ->orderByRaw('seller_reviews_avg_rating desc nulls last')
                ->orderByDesc('seller_reviews_count'),
        };

        $page = $query->paginate(12)->withQueryString();

        return response()->json([
            'data' => collect($page->items())->map(fn (User $seller) => self::listItem($seller))->values(),
            'facets' => [
                'categories' => $this->categoryFacets($filters),
                'cities' => $this->cityFacets($filters),
                'featured' => (clone $this->applyFilters($this->baseQuery(), $filters, 'featured'))
                    ->whereHas('activeSellerPromotions')->count(),
            ],
            'meta' => [
                'current_page' => $page->currentPage(),
                'last_page' => $page->lastPage(),
                'per_page' => $page->perPage(),
                'total' => $page->total(),
            ],
        ]);
    }

    /** Tek bir hizmet verenin herkese açık vitrini: profil, galeri, yorumlar. */
    public function show(User $user): JsonResponse
    {
        $user->loadMissing(['sellerProfile', 'sellerCategories:id,name,slug,icon,color']);

        abort_unless($user->sellerProfile?->approval_status === 'approved', 404, 'Hizmet veren bulunamadı.');

        $portfolio = SellerPortfolioItem::query()
            ->where('user_id', $user->id)
            ->where('is_published', true)
            ->with(['category:id,name,slug,icon,color', 'images'])
            ->orderBy('sort_order')
            ->latest()
            ->get();

        $reviews = SellerReview::query()
            ->where('seller_id', $user->id)
            ->with(['buyer:id,name'])
            ->latest()
            ->limit(20)
            ->get();

        $services = $user->sellerServices()
            ->where('is_active', true)
            ->with('category:id,name,slug,icon,color')
            ->latest()
            ->get();

        $ratingRows = SellerReview::query()->where('seller_id', $user->id)->pluck('rating');
        $breakdown = collect(range(5, 1))
            ->mapWithKeys(fn (int $star) => [$star => $ratingRows->filter(fn ($value) => (int) $value === $star)->count()])
            ->all();

        $locations = $user->sellerLocations()->with(['city:id,name', 'district:id,name'])->get();

        return response()->json([
            'data' => [
                'id' => $user->id,
                'name' => $user->name,
                'company_name' => $user->sellerProfile?->company_name,
                'profile_type' => $user->sellerProfile?->profile_type,
                'description' => $user->sellerProfile?->description,
                'is_featured' => $user->activeSellerPromotions()->exists(),
                'member_since' => $user->created_at?->toIso8601String(),
                'categories' => $user->sellerCategories->map(fn ($category) => [
                    'name' => $category->name,
                    'slug' => $category->slug,
                    'icon' => $category->icon,
                    'color' => $category->color,
                ])->values(),
                'locations' => $locations->map(fn ($location) => [
                    'city' => $location->city?->name,
                    'district' => $location->district?->name,
                ])->values(),
                'rating' => [
                    'average' => round((float) ($ratingRows->avg() ?? 0), 1),
                    'count' => $ratingRows->count(),
                    'breakdown' => $breakdown,
                ],
                'services' => $services->map(fn ($service) => [
                    'id' => $service->id,
                    'title' => $service->title,
                    'description' => $service->description,
                    'price_from' => $service->price_from,
                    'delivery_time' => $service->delivery_time,
                    'cover_url' => $service->cover_url,
                    'category' => $service->category ? [
                        'name' => $service->category->name,
                        'icon' => $service->category->icon,
                        'color' => $service->category->color,
                    ] : null,
                ])->values(),
                'portfolio' => $portfolio->map(fn (SellerPortfolioItem $item) => SellerPortfolioController::present($item))->values(),
                'reviews' => $reviews->map(fn (SellerReview $review) => [
                    'id' => $review->id,
                    'rating' => (int) $review->rating,
                    'comment' => $review->comment,
                    'buyer_name' => self::maskName($review->buyer?->name ?? 'Müşteri'),
                    'created_at' => $review->created_at?->toIso8601String(),
                ])->values(),
            ],
        ]);
    }

    private function baseQuery(): Builder
    {
        return User::query()
            ->whereHas('sellerProfile', fn (Builder $query) => $query->where('approval_status', 'approved'));
    }

    /**
     * @param  array<string, mixed>  $filters
     * @param  string|null  $skip  Bir facet kendi boyutunu saymazken hariç tutar.
     */
    private function applyFilters(Builder $query, array $filters, ?string $skip = null): Builder
    {
        if ($search = trim((string) ($filters['q'] ?? ''))) {
            $query->where(fn (Builder $inner) => $inner
                ->where('users.name', 'ilike', "%{$search}%")
                ->orWhereHas('sellerProfile', fn (Builder $profile) => $profile
                    ->where('company_name', 'ilike', "%{$search}%")
                    ->orWhere('description', 'ilike', "%{$search}%")));
        }

        if ($skip !== 'category' && ($category = $filters['category'] ?? null)) {
            $query->whereHas('sellerCategories', fn (Builder $inner) => $inner->where('slug', $category));
        }

        if ($skip !== 'city' && ($cityId = $filters['city_id'] ?? null)) {
            $query->whereHas('sellerLocations', fn (Builder $inner) => $inner->where('city_id', $cityId));
        }

        if (($min = $filters['min_rating'] ?? null) !== null) {
            $query->whereHas('sellerReviews', fn (Builder $inner) => $inner->havingRaw('avg(rating) >= ?', [$min])->groupBy('seller_id'));
        }

        if ($skip !== 'featured' && ($filters['featured'] ?? false) === true) {
            $query->whereHas('activeSellerPromotions');
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
            ->join('seller_categories', 'seller_categories.seller_id', '=', 'users.id')
            ->join('categories', 'categories.id', '=', 'seller_categories.category_id')
            ->groupBy('categories.id', 'categories.name', 'categories.slug', 'categories.icon', 'categories.color')
            ->orderByDesc('total')
            ->selectRaw('categories.slug, categories.name, categories.icon, categories.color, count(distinct users.id) as total')
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
            ->join('seller_locations', 'seller_locations.seller_id', '=', 'users.id')
            ->join('cities', 'cities.id', '=', 'seller_locations.city_id')
            ->groupBy('cities.id', 'cities.name')
            ->orderByDesc('total')
            ->selectRaw('cities.id, cities.name, count(distinct users.id) as total')
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
     * @return array<string, mixed>
     */
    private static function listItem(User $seller): array
    {
        return [
            'id' => $seller->id,
            'name' => $seller->name,
            'company_name' => $seller->sellerProfile?->company_name,
            'profile_type' => $seller->sellerProfile?->profile_type,
            'description' => Str::limit($seller->sellerProfile?->description ?? '', 160),
            'is_featured' => $seller->active_seller_promotions_max_expires_at !== null,
            'rating' => round((float) ($seller->seller_reviews_avg_rating ?? 0), 1),
            'review_count' => (int) $seller->seller_reviews_count,
            'service_count' => (int) $seller->seller_services_count,
            'portfolio_count' => (int) $seller->portfolio_items_count,
            'services' => $seller->sellerServices->map(fn ($service) => [
                'id' => $service->id,
                'title' => $service->title,
                'price_from' => $service->price_from,
                'cover_url' => $service->cover_url,
            ])->values(),
            'categories' => $seller->sellerCategories->map(fn ($category) => [
                'name' => $category->name,
                'slug' => $category->slug,
                'icon' => $category->icon,
                'color' => $category->color,
            ])->values(),
            // Kart üzerinde gösterilecek galeri önizlemesi.
            'preview' => $seller->portfolioItems
                ->flatMap(fn (SellerPortfolioItem $item) => $item->images)
                ->take(3)
                ->map(fn ($image) => ['id' => $image->id, 'url' => "/api/portfolio-images/{$image->id}"])
                ->values(),
        ];
    }

    /** Yorum sahibinin tam adı gösterilmez: "Ayşe Yıldız" → "Ayşe Y." */
    private static function maskName(string $name): string
    {
        $parts = preg_split('/\s+/u', trim($name)) ?: [];
        $first = $parts[0] ?? 'Müşteri';

        if (count($parts) < 2) {
            return $first;
        }

        return $first.' '.mb_strtoupper(mb_substr(end($parts), 0, 1), 'UTF-8').'.';
    }
}
