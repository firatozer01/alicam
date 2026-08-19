<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\SellerRequestResource;
use App\Models\BuyerRequest;
use App\Services\SellerCreditService;
use App\Services\SellerMatchingService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SellerRequestController extends Controller
{
    public function __construct(
        private readonly SellerCreditService $credits,
        private readonly SellerMatchingService $matching,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $data = $request->validate([
            'unlocked' => ['sometimes', 'boolean'],
        ]);
        $seller = $request->user();
        $query = $this->matching->query($seller);

        if (($data['unlocked'] ?? false) === true) {
            $query->whereHas(
                'unlocks',
                fn (Builder $unlockQuery) => $unlockQuery->where('seller_id', $seller->id),
            );
        }

        $items = $query->latest()->paginate(15);

        return response()->json([
            'data' => SellerRequestResource::collection($items->items()),
            'meta' => [
                'current_page' => $items->currentPage(),
                'last_page' => $items->lastPage(),
                'total' => $items->total(),
                'filter' => ($data['unlocked'] ?? false) ? 'unlocked' : 'all',
            ],
        ]);
    }

    public function show(Request $request, BuyerRequest $buyerRequest): JsonResponse
    {
        $item = $this->matching->query($request->user())
            ->whereKey($buyerRequest->id)
            ->firstOrFail();

        return response()->json(['data' => new SellerRequestResource($item)]);
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
