<?php

namespace App\Services;

use App\Models\BuyerRequest;
use App\Models\User;
use App\Support\CategoryTree;
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
            // Iki yoldan biri yeterli: normal eslesme (kategori + bolge) ya da
            // aliciin vitrinden dogrudan bu saticiya yonelttigi davet.
            ->where(fn (Builder $outer) => $outer
                ->where(fn (Builder $matched) => $matched
                    ->whereExists(fn ($query) => $query
                        ->selectRaw('1')
                        ->from('request_categories')
                        ->whereColumn('request_categories.request_id', 'requests.id')
                        ->whereIn('request_categories.category_id', $this->reachableCategoryIds($seller)))
                    ->whereExists(fn ($query) => $query
                        ->selectRaw('1')
                        ->from('seller_locations')
                        ->where('seller_locations.seller_id', $seller->id)
                        ->whereColumn('seller_locations.city_id', 'requests.city_id')
                        ->whereColumn('seller_locations.district_id', 'requests.district_id')))
                ->orWhereExists(fn ($query) => $query
                    ->selectRaw('1')
                    ->from('request_invites')
                    ->where('request_invites.seller_id', $seller->id)
                    ->whereColumn('request_invites.request_id', 'requests.id')));
    }

    /**
     * Saticinin gorebilecegi kategori id'leri: sectigi kategoriler, onlarin
     * alt kategorileri ve ust kategorileri. Boylece kok kategoriye abone bir
     * satici yaprak talepleri, uzman bir satici da genel talepleri gorur.
     *
     * @return array<int, int>
     */
    private function reachableCategoryIds(User $seller): array
    {
        $own = $seller->sellerCategories()->pluck('categories.id')->all();

        $reachable = [];
        foreach ($own as $categoryId) {
            foreach (CategoryTree::descendants((int) $categoryId) as $id) {
                $reachable[$id] = true;
            }
            foreach (CategoryTree::ancestors((int) $categoryId) as $id) {
                $reachable[$id] = true;
            }
        }

        // Bos kalirsa whereIn hicbir satir dondurmez; istenen davranis budur.
        return array_keys($reachable);
    }

    public function query(User $seller): Builder
    {
        return $this->baseQuery($seller)
            ->withExists(['invitedSellers as invited_for_seller' => fn ($query) => $query
                ->where('users.id', $seller->id)])
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
