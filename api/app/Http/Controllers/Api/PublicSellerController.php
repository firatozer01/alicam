<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SellerListing;
use App\Models\SellerPortfolioItem;
use App\Models\SellerReview;
use App\Models\User;
use App\Services\StorefrontAccess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class PublicSellerController extends Controller
{
    public function __construct(
        private readonly StorefrontAccess $access,
    ) {}

    /** Onaylı hizmet verenlerin filtrelenebilir vitrin listesi. */
    /**
     * Vitrin. Alici bir hizmet vereni ancak O HIZMET VEREN KENDISINE TEKLIF
     * VERDIYSE gorebilir; pazaryerinde gezinip firma secme diye bir akis yok,
     * yon her zaman talepten teklife dogrudur.
     *
     * Kendi vitrinini herkes gorebilir, yonetici de gorebilir.
     */
    public function show(Request $request, User $user): JsonResponse
    {
        abort_unless($this->access->allows($request->user(), $user), 404, 'Hizmet veren bulunamadı.');

        // Modal icin iki seviye alt kategori de yuklenir.
        $user->loadMissing([
            'sellerProfile',
            'sellerCategories:id,name,slug,icon,color,parent_id,is_active',
            'sellerCategories.children:id,parent_id,name,slug,icon,is_active',
            'sellerCategories.children.children:id,parent_id,name,slug,icon,is_active',
        ]);

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

        // Vitrindeki urunler: emlakcinin daireleri, galericinin araclari.
        // Yalnizca yayindakiler ve satilanlar; taslak ve arsiv disarida.
        $listings = SellerListing::query()
            ->where('user_id', $user->id)
            ->whereIn('status', ['published', 'sold'])
            ->with(['category:id,name,slug,icon', 'city:id,name', 'district:id,name', 'images'])
            ->orderBy('sort_order')
            ->latest('id')
            ->limit(48)
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
                // Vitrinin ustundeki genis kapak ve firma logosu.
                'banner_url' => $user->sellerProfile?->banner_url,
                'logo_url' => $user->sellerProfile?->logo_url,
                'avatar_url' => $user->avatar_url,
                'member_since' => $user->created_at?->toIso8601String(),
                // Vitrindeki teklif modali bu agaci gosterir: saticinin
                // calistigi kategoriler ve altindaki basliklar.
                'categories' => $user->sellerCategories->where('is_active', true)->map(fn ($category) => [
                    'id' => $category->id,
                    'name' => $category->name,
                    'slug' => $category->slug,
                    'icon' => $category->icon,
                    'color' => $category->color,
                    'children' => $category->children
                        ->where('is_active', true)
                        ->map(fn ($child) => [
                            'id' => $child->id,
                            'name' => $child->name,
                            'slug' => $child->slug,
                            'icon' => $child->icon ?? $category->icon,
                            'color' => $category->color,
                            'children' => $child->children
                                ->where('is_active', true)
                                ->map(fn ($leaf) => [
                                    'id' => $leaf->id,
                                    'name' => $leaf->name,
                                    'slug' => $leaf->slug,
                                    'icon' => $leaf->icon ?? $category->icon,
                                    'color' => $category->color,
                                ])->values(),
                        ])->values(),
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
                // public: yonetim alanlari (durum, teklif sayisi) dusuyor.
                'listings' => $listings->map(
                    fn (SellerListing $listing) => SellerListingController::present($listing, public: true),
                )->values(),
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
