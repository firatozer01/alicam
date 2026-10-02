<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\OfferResource;
use App\Http\Resources\SellerRequestResource;
use App\Models\BuyerRequest;
use App\Models\Offer;
use App\Models\SellerListing;
use App\Models\User;
use App\Services\NotificationService;
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
        private readonly NotificationService $notifications,
    ) {}

    /**
     * Iliktirilecek ilani dogrular.
     *
     * exists: kurali TEK BASINA YETMEZ: satici rakibinin ilan id'sini
     * gonderip baskasinin urununu kendi teklifinde gosterebilirdi.
     * Ilan hem bu saticiya ait hem yayinda olmali.
     */
    private function ownedListing(User $seller, ?int $listingId): ?SellerListing
    {
        if ($listingId === null) {
            return null;
        }

        $listing = SellerListing::query()
            ->whereKey($listingId)
            ->where('user_id', $seller->id)
            ->published()
            ->with(['category', 'city', 'district', 'images'])
            ->first();

        abort_if($listing === null, 422, 'Seçilen ürün bulunamadı ya da yayında değil.');

        return $listing;
    }

    public function sellerIndex(Request $request): JsonResponse
    {
        $seller = $request->user();
        $items = Offer::query()
            ->where('seller_id', $seller->id)
            ->with([
                'seller.sellerProfile',
                'review',
                'listing.images',
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
            ->with(['seller.sellerProfile', 'review', 'listing.images'])
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
            // Vitrindeki bir urunu teklife iliktirmek istege bagli.
            'seller_listing_id' => ['sometimes', 'nullable', 'integer'],
        ]);
        $seller = $request->user();
        $listing = $this->ownedListing($seller, $data['seller_listing_id'] ?? null);
        $buyerRequest = $this->matching->query($seller)
            ->whereKey($data['request_id'])
            ->firstOrFail();

        if (Offer::query()->where('request_id', $buyerRequest->id)->where('seller_id', $seller->id)->exists()) {
            return response()->json([
                'message' => 'Bu talep için zaten teklifiniz var; teklifinizi güncelleyebilirsiniz.',
                'code' => 'offer_already_exists',
            ], 409);
        }

        // $listing kapanisa ACIKCA verilmeli: PHP kapanislari dis kapsamdaki
        // degiskenleri kendiliginden gormuyor. Yoksa govdedeki $listing?->id
        // "Undefined variable" veriyor ve teklif gonderme uctan uca 500
        // donuyordu -- urun iliktirilmemis olsa bile.
        [$offer, $unlock] = DB::transaction(function () use ($seller, $buyerRequest, $data, $listing): array {
            $unlock = $this->credits->unlock($seller, $buyerRequest);
            $offer = Offer::query()->create([
                'request_id' => $buyerRequest->id,
                'seller_id' => $seller->id,
                'price' => $data['price'],
                'message' => $data['message'],
                'status' => 'pending',
                'seller_listing_id' => $listing?->id,
                'listing_snapshot' => $listing ? SellerListingController::present($listing, true, public: true) : null,
            ]);
            BuyerRequest::query()
                ->whereKey($buyerRequest->id)
                ->where('status', 'open')
                ->update(['status' => 'in_negotiation']);

            return [$offer, $unlock];
        }, 3);

        // Alici talebine teklif geldigini ust cubuktaki zilden gorur.
        $this->notifications->push(
            userId: $buyerRequest->user_id,
            type: 'offer_received',
            title: 'Talebine yeni teklif geldi',
            body: $seller->name.' — '.number_format((float) $data['price'], 0, ',', '.').' TL',
            link: '/musteri-panel',
            data: ['request_id' => $buyerRequest->id, 'offer_id' => $offer->id],
            subjectType: 'offer',
            subjectId: $offer->id,
        );

        return response()->json([
            'message' => $unlock['already_unlocked']
                ? 'Teklifiniz gönderildi; talep daha önce açıldığı için kredi düşülmedi.'
                : 'Teklifiniz gönderildi ve talep açma bedeli bakiyenizden düşüldü.',
            'data' => new OfferResource($offer->load(['seller.sellerProfile', 'listing.images'])),
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
            'seller_listing_id' => ['sometimes', 'nullable', 'integer'],
        ]);

        // Alan hic gonderilmediyse mevcut iliktirme korunur; null
        // gonderildiyse kaldirilir.
        if (array_key_exists('seller_listing_id', $data)) {
            $listing = $this->ownedListing($request->user(), $data['seller_listing_id']);
            $data['seller_listing_id'] = $listing?->id;
            $data['listing_snapshot'] = $listing ? SellerListingController::present($listing, true, public: true) : null;
        }

        $offer->update($data);

        return response()->json([
            'message' => 'Teklifiniz güncellendi; ek kredi düşülmedi.',
            'data' => new OfferResource($offer->load(['seller.sellerProfile', 'listing.images'])),
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

            return $lockedOffer->fresh(['seller.sellerProfile', 'listing.images']);
        }, 3);

        // Kararin sahibi hizmet veren; kabul de ret de onun icin haberdir.
        $baslik = BuyerRequest::query()->whereKey($decidedOffer->request_id)->value('title');
        $kabul = $data['decision'] === 'accepted';

        $this->notifications->push(
            userId: $decidedOffer->seller_id,
            type: $kabul ? 'offer_accepted' : 'offer_rejected',
            title: $kabul ? 'Teklifin kabul edildi' : 'Teklifin bu kez seçilmedi',
            body: $baslik,
            link: '/satici-paneli',
            data: ['request_id' => $decidedOffer->request_id, 'offer_id' => $decidedOffer->id],
            subjectType: 'offer',
            subjectId: $decidedOffer->id,
        );

        return response()->json([
            'message' => $data['decision'] === 'accepted' ? 'Teklif kabul edildi.' : 'Teklif reddedildi.',
            'data' => new OfferResource($decidedOffer),
        ]);
    }
}
