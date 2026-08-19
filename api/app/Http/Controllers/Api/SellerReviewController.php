<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Offer;
use App\Models\SellerReview;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SellerReviewController extends Controller
{
    public function store(Request $request, Offer $offer): JsonResponse
    {
        $data = $request->validate([
            'rating' => ['required', 'integer', 'between:1,5'],
            'comment' => ['nullable', 'string', 'min:10', 'max:1000'],
        ]);

        $offer->load('buyerRequest');
        abort_unless($offer->buyerRequest->user_id === $request->user()->id, 404);
        abort_unless($offer->status === 'accepted', 422, 'Yalnızca kabul edilmiş hizmetler değerlendirilebilir.');

        $review = DB::transaction(function () use ($request, $offer, $data): SellerReview {
            abort_if(SellerReview::query()->where('offer_id', $offer->id)->exists(), 422, 'Bu hizmet daha önce değerlendirildi.');

            return SellerReview::query()->create([
                'offer_id' => $offer->id,
                'buyer_id' => $request->user()->id,
                'seller_id' => $offer->seller_id,
                ...$data,
            ]);
        });

        return response()->json([
            'message' => 'Değerlendirmeniz yayınlandı.',
            'data' => $review,
        ], 201);
    }
}
