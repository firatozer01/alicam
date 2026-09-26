<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SellerListingImage;
use App\Services\StorefrontAccess;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Ilan galerisindeki fotograflari akitir.
 *
 * Vitrinin JSON kapisiyla AYNI kapiya bagli. Mevcut
 * /portfolio-images/{id} ve /service-covers/{id} rotalari hicbir
 * denetim yapmiyor ve id'ler sirayla arttigi icin, vitrin kapali olsa
 * bile fotograflari disaridan tek tek cekilebiliyor. Ilanlarda ayni
 * hatayi tekrarlamiyoruz: kapi yalnizca JSON'da durup gorsellerde
 * durmuyorsa, kapi yok demektir.
 */
class ListingImageController extends Controller
{
    private const DISK = 'local';

    public function __construct(
        private readonly StorefrontAccess $access,
    ) {}

    public function __invoke(Request $request, SellerListingImage $sellerListingImage): StreamedResponse
    {
        $ilan = $sellerListingImage->listing;

        abort_unless($ilan !== null, 404);

        $izleyen = $request->user();
        $sahibi = $izleyen !== null && $izleyen->id === $ilan->user_id;

        // Yayinda olmayan ilan yalnizca sahibinin (ve yoneticinin).
        if ($ilan->status !== 'published' && ! $sahibi) {
            abort_unless($izleyen?->hasRole('admin') === true, 404);
        }

        abort_unless($this->access->allows($izleyen, $ilan->user_id), 404);
        abort_unless(Storage::disk(self::DISK)->exists($sellerListingImage->path), 404);

        return Storage::disk(self::DISK)->response(
            $sellerListingImage->path,
            null,
            [
                // private: yanit isteyene gore degistigi icin paylasimli
                // onbellekler (CDN, vekil) saklamamali.
                'Cache-Control' => 'private, max-age=604800',
            ],
        );
    }
}
