<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\OfferResource;
use App\Http\Resources\SellerRequestResource;
use App\Models\BuyerRequest;
use App\Models\Offer;
use App\Services\SellerCreditService;
use App\Services\SellerMatchingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class OfferController extends Controller
{
    public function __construct(
        private readonly SellerMatchingService $matching,
        private readonly SellerCreditService $credits,
    ) {}

    public function sellerIndex(Request $request): JsonResponse
    {
        $seller = $request->user();
        $items = Offer::query()
            ->where('seller_id', $seller->id)
            ->with([
                'seller.sellerProfile',
                'buyerRequest' => fn ($query) => $query
                    ->with(['category.creditCost', 'city', 'district', 'user'])
                    ->withExists([
                        'unlocks as unlocked_by_seller' => fn ($unlock) => $unlock
                            ->where('seller_id', $seller->id),
                    ]),
            ])
            ->latest()
            ->paginate(15);

        return response()->json([
            'data' => $items->getCollection()->map(fn (Offer $offer) => [
                'offer' => (new OfferResource($offer))->resolve($request),
                'request' => (new SellerRequestResource($offer->buyerRequest))->resolve($request),
            ])->values(),
            'meta' => [
                'current_page' => $items->currentPage(),
                'last_page' => $items->lastPage(),
                'total' => $items->total(),
            ],
        ]);
    }

    public function buyerIndex(Request $request, BuyerRequest $buyerRequest): JsonResponse
    {
        abort_unless($buyerRequest->user_id === $request->user()->id, 404);
        $offers = $buyerRequest->offers()
            ->with('seller.sellerProfile')
            ->latest()
            ->get();

        return response()->json(['data' => OfferResource::collection($offers)]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'request_id' => ['required', 'integer', 'exists:requests,id'],
            'price' => ['required', 'numeric', 'min:1', 'max:9999999999'],
            'message' => ['required', 'string', 'min:20', 'max:2000'],
        ]);
        $seller = $request->user();
        $buyerRequest = $this->matching->query($seller)
            ->whereKey($data['request_id'])
            ->firstOrFail();

        if (Offer::query()->where('request_id', $buyerRequest->id)->where('seller_id', $seller->id)->exists()) {
            return response()->json([
                'message' => 'Bu talep için zaten teklifiniz var; teklifinizi güncelleyebilirsiniz.',
                'code' => 'offer_already_exists',
            ], 409);
        }

        [$offer, $unlock] = DB::transaction(function () use ($seller, $buyerRequest, $data): array {
            $unlock = $this->credits->unlock($seller, $buyerRequest);
            $offer = Offer::query()->create([
                'request_id' => $buyerRequest->id,
                'seller_id' => $seller->id,
                'price' => $data['price'],
                'message' => $data['message'],
                'status' => 'pending',
            ]);
            BuyerRequest::query()
                ->whereKey($buyerRequest->id)
                ->where('status', 'open')
                ->update(['status' => 'in_negotiation']);

            return [$offer, $unlock];
        }, 3);

        return response()->json([
            'message' => $unlock['already_unlocked']
                ? 'Teklifiniz gönderildi; talep daha önce açıldığı için kontör düşülmedi.'
                : 'Teklifiniz gönderildi ve talep açma bedeli bakiyenizden düşüldü.',
            'data' => new OfferResource($offer->load('seller.sellerProfile')),
            'balance' => $unlock['balance'],
            'credit_spent' => $unlock['already_unlocked'] ? 0 : $unlock['unlock']->credit_spent,
        ], 201);
    }

    public function update(Request $request, Offer $offer): JsonResponse
    {
        abort_unless($offer->seller_id === $request->user()->id, 404);
        abort_unless($offer->status === 'pending', 422, 'Yalnızca bekleyen teklifler güncellenebilir.');
        $data = $request->validate([
            'price' => ['required', 'numeric', 'min:1', 'max:9999999999'],
            'message' => ['required', 'string', 'min:20', 'max:2000'],
        ]);
        $offer->update($data);

        return response()->json([
            'message' => 'Teklifiniz güncellendi; ek kontör düşülmedi.',
            'data' => new OfferResource($offer->load('seller.sellerProfile')),
        ]);
    }

    public function decide(Request $request, Offer $offer): JsonResponse
    {
        $data = $request->validate([
            'decision' => ['required', Rule::in(['accepted', 'rejected'])],
        ]);

        $decidedOffer = DB::transaction(function () use ($request, $offer, $data): Offer {
            $lockedOffer = Offer::query()->whereKey($offer->id)->lockForUpdate()->firstOrFail();
            $buyerRequest = BuyerRequest::query()->whereKey($lockedOffer->request_id)->lockForUpdate()->firstOrFail();
            abort_unless($buyerRequest->user_id === $request->user()->id, 404);
            abort_unless($lockedOffer->status === 'pending', 422, 'Bu teklif daha önce sonuçlandırılmış.');
            abort_if(in_array($buyerRequest->status, ['accepted', 'cancelled'], true), 422, 'Talep artık teklif değerlendirmeye açık değil.');

            $now = now();
            if ($data['decision'] === 'accepted') {
                $lockedOffer->update(['status' => 'accepted', 'reviewed_at' => $now, 'accepted_at' => $now]);
                Offer::query()
                    ->where('request_id', $buyerRequest->id)
                    ->whereKeyNot($lockedOffer->id)
                    ->where('status', 'pending')
                    ->update(['status' => 'rejected', 'reviewed_at' => $now]);
                $buyerRequest->update(['status' => 'accepted']);
            } else {
                $lockedOffer->update(['status' => 'rejected', 'reviewed_at' => $now]);
                $hasPending = Offer::query()
                    ->where('request_id', $buyerRequest->id)
                    ->where('status', 'pending')
                    ->exists();
                $buyerRequest->update(['status' => $hasPending ? 'in_negotiation' : 'open']);
            }

            return $lockedOffer->fresh('seller.sellerProfile');
        }, 3);

        return response()->json([
            'message' => $data['decision'] === 'accepted' ? 'Teklif kabul edildi.' : 'Teklif reddedildi.',
            'data' => new OfferResource($decidedOffer),
        ]);
    }
}
