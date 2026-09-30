<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\AppSettings;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Yoneticinin yukledigi marka gorsellerini akitir.
 *
 * Dosyalar herkese acik disk'e degil 'local' diske yaziliyor; kategori
 * kapaklarindaki (CategoryImageController) yontemin aynisi.
 *
 * Yuklenmis dosya yoksa bilerek 404 doner: arayuzde logo.png, logo-light.png
 * ve mark.png zaten gomulu duruyor ve varsayilan onlar. Bu uc yalnizca
 * "yonetici baska bir logo yukledi mi" sorusuna cevap veriyor.
 */
class BrandingController extends Controller
{
    private const DISK = 'local';

    private const DIR = 'branding';

    public function show(string $kind): StreamedResponse
    {
        abort_unless(in_array($kind, AppSettings::BRANDING_KEYS, true), 404);

        $ad = trim((string) (AppSettings::all()['branding.'.$kind] ?? ''));

        abort_if($ad === '', 404);

        $yol = self::DIR.'/'.$ad;

        abort_unless(Storage::disk(self::DISK)->exists($yol), 404);

        return Storage::disk(self::DISK)->response(
            $yol,
            null,
            [
                // Adres surum damgasi tasiyor (?v=...): yonetici logoyu
                // degistirdiginde damga arttigi icin bu adres bir daha hic
                // istenmez. O yuzden en uzun onbellek guvenli ve gerekli:
                // logo her sayfada basiliyor.
                'Cache-Control' => 'public, max-age=31536000, immutable',
            ],
        );
    }
}
