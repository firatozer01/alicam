<?php

namespace App\Services;

use App\Models\BuyerRequest;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

class SellerMatchingService
{
    /**
     * Satıcının kategori ve hizmet bölgesiyle eşleşen talepler; ek yükleme
     * yapmadan yalnızca koşullar. Facet sayımları bu sorgudan türetilir.
     */
    public function baseQuery(User $seller): Builder
    {
        return BuyerRequest::query()
            ->where('requests.user_id', '!=', $seller->id)
            ->whereIn('requests.status', ['open', 'in_negotiation'])
            ->where(fn (Builder $query) => $query
                ->whereNull('requests.expires_at')
                ->orWhere('requests.expires_at', '>', now()))
            ->whereExists(fn ($query) => $query
                ->selectRaw('1')
                ->from('seller_categories')
                ->where('seller_categories.seller_id', $seller->id)
                ->whereColumn('seller_categories.category_id', 'requests.category_id'))
            ->whereExists(fn ($query) => $query
                ->selectRaw('1')
                ->from('seller_locations')
                ->where('seller_locations.seller_id', $seller->id)
                ->whereColumn('seller_locations.city_id', 'requests.city_id')
                ->whereColumn('seller_locations.district_id', 'requests.district_id'));
    }

    public function query(User $seller): Builder
    {
        return $this->baseQuery($seller)
            ->with(['category.creditCost', 'city', 'district', 'user'])
            ->withCount('offers')
            ->withExists([
                'unlocks as unlocked_by_seller' => fn ($query) => $query
                    ->where('seller_id', $seller->id),
                'favorites as favorited_by_seller' => fn ($query) => $query
                    ->where('user_id', $seller->id),
            ]);
    }
}
