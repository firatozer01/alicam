<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Category;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Kategori kapak fotograflarini uygulama uzerinden akitir.
 *
 * Dosyalar herkese acik disk'e degil 'local' diske yaziliyor; boylece
 * depolama dizini web kokune baglanmak zorunda kalmiyor ve silinen bir
 * gorsel aninda erisilemez oluyor. Ayni yontem satici hizmet kapaklarinda
 * da kullaniliyor (SellerServiceController::showCover).
 */
class CategoryImageController extends Controller
{
    private const DISK = 'local';

    public function __invoke(Category $category): StreamedResponse
    {
        abort_unless(
            $category->image_path && Storage::disk(self::DISK)->exists($category->image_path),
            404,
        );

        return Storage::disk(self::DISK)->response(
            $category->image_path,
            null,
            [
                // Icerik yonetici degistirince yol da degistigi icin uzun
                // onbellek guvenli: eski yol artik istenmez.
                'Cache-Control' => 'public, max-age=604800',
            ],
        );
    }
}
