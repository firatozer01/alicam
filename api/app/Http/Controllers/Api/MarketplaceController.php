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
            'sort' => ['sometimes', Rule::in(['latest', 'budget_high', 'budget_low', 'popular'])],
            'page' => ['sometimes', 'integer', 'min:1'],
        ]);

        $requests = BuyerRequest::query()
            ->whereIn('status', ['open', 'in_negotiation'])
            ->where(fn (Builder $query) => $query
                ->whereNull('expires_at')
                ->orWhere('expires_at', '>', now()))
            ->with(['category', 'city', 'district'])
            ->withCount('offers');

        if ($search = trim((string) ($filters['q'] ?? ''))) {
            $requests->where(fn (Builder $query) => $query
                ->where('title', 'like', "%{$search}%")
                ->orWhere('description', 'like', "%{$search}%"));
        }

        if ($category = $filters['category'] ?? null) {
            $requests->whereHas('category', fn (Builder $query) => $query->where('slug', $category));
        }

        if ($cityId = $filters['city_id'] ?? null) {
            $requests->where('city_id', $cityId);
        }

        match ($filters['sort'] ?? 'latest') {
            'budget_high' => $requests->orderByDesc('budget_max'),
            'budget_low' => $requests->orderBy('budget_min'),
            'popular' => $requests->orderByDesc('offers_count'),
            default => $requests->latest(),
        };

        $page = $requests->paginate(18);
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
            ->withCount('sellerReviews')
            ->withMax('activeSellerPromotions', 'expires_at')
            ->orderByDesc('active_seller_promotions_max_expires_at')
            ->orderByDesc('seller_reviews_avg_rating')
            ->orderByDesc('seller_reviews_count')
            ->limit(8)
            ->get();

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
                        'title' => $service->title,
                        'price_from' => $service->price_from,
                    ])->values(),
                ])->values(),
                'stats' => [
                    'active_requests' => BuyerRequest::query()->whereIn('status', ['open', 'in_negotiation'])->count(),
                    'approved_sellers' => User::query()->whereHas('sellerProfile', fn (Builder $query) => $query->where('approval_status', 'approved'))->count(),
                    'reviews' => SellerReview::query()->count(),
                ],
            ],
            'meta' => [
                'current_page' => $page->currentPage(),
                'last_page' => $page->lastPage(),
                'total' => $page->total(),
            ],
        ]);
    }
}
