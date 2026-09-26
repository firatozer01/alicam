<?php

namespace App\Http\Controllers\Api;

use App\Models\SellerListing;
use App\Http\Controllers\Controller;
use App\Services\StorefrontAccess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Bir ilanin alicinin gordugu hali: fotograf galerisi ve ozellik
 * tablosu.
 *
 * Vitrinle ayni kapiya bagli — alicilar satici gezmiyor, bir satici
 * ancak kendisine teklif verdikten sonra goruluyor. Teklife ilan
 * iliktiren satici zaten teklif vermis oluyor, dolayisiyla kapi
 * kendiliginden aciliyor; ayri bir istisna gerekmiyor.
 */
class PublicListingController extends Controller
{
    public function __construct(
        private readonly StorefrontAccess $access,
    ) {}

    public function show(Request $request, SellerListing $sellerListing): JsonResponse
    {
        $izleyen = $request->user();
        $sahibi = $izleyen !== null && $izleyen->id === $sellerListing->user_id;

        // Yayinda olmayan ilan yalnizca sahibine gorunur. Satilmis bir
        // ilan gorunmeye devam eder: alici gecmis teklifini acabilmeli.
        if (! in_array($sellerListing->status, ['published', 'sold'], true) && ! $sahibi) {
            abort(404, 'İlan bulunamadı.');
        }

        abort_unless($this->access->allows($izleyen, $sellerListing->user_id), 404, 'İlan bulunamadı.');

        $sellerListing->load(['category', 'city', 'district', 'images', 'seller.sellerProfile']);

        $satici = $sellerListing->seller;

        return response()->json([
            'data' => SellerListingController::present($sellerListing, true, public: true) + [
                'seller' => [
                    'id' => $satici->id,
                    'name' => $satici->sellerProfile?->company_name ?: $satici->name,
                    'logo_url' => $satici->sellerProfile?->logo_url,
                ],
            ],
        ]);
    }
}
