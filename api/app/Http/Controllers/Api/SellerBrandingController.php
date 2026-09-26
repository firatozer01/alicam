<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SellerProfile;
use App\Models\User;
use App\Services\ImageShaper;
use App\Services\StorefrontAccess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Vitrin gorselleri: genis kapak (banner) ve firma logosu.
 *
 * Ikisi de vitrinin parcasi, bu yuzden gorunurlugu vitrinle ayni
 * kapiya bagli: yalnizca o saticinin teklif verdigi alici, saticinin
 * kendisi ve yonetici gorur.
 */
class SellerBrandingController extends Controller
{
    private const DISK = 'local';

    /** Alan adi => ImageShaper preset'i. */
    private const KINDS = ['banner' => 'banner', 'logo' => 'avatar'];

    public function __construct(
        private readonly ImageShaper $shaper,
        private readonly StorefrontAccess $access,
    ) {}

    public function store(Request $request, string $kind): JsonResponse
    {
        abort_unless(array_key_exists($kind, self::KINDS), 404);

        $request->validate([
            'image' => ['required', 'image', 'mimes:jpeg,jpg,png,webp', 'max:8192'],
        ]);

        $profil = $request->user()->sellerProfile;
        abort_unless($profil !== null, 404, 'Önce hizmet veren başvurusu oluşturun.');

        $sutun = $kind.'_path';

        $this->forget($profil->{$sutun});

        $ham = (string) file_get_contents($request->file('image')->getRealPath());
        $sekilli = $this->shaper->shape($ham, self::KINDS[$kind]);

        if ($sekilli === null) {
            return response()->json(['message' => 'Görsel okunamadı. Farklı bir dosya deneyin.'], 422);
        }

        // Dosya adi her yuklemede degisir; adres damgasi da profilin
        // updated_at'inden geldigi icin tarayici eskisinde takilmaz.
        $yol = "seller-branding/{$profil->user_id}/{$kind}-".bin2hex(random_bytes(6)).'.jpg';
        Storage::disk(self::DISK)->put($yol, $sekilli);

        $profil->{$sutun} = $yol;
        $profil->save();

        return response()->json([
            'message' => $kind === 'banner' ? 'Kapak görseli güncellendi.' : 'Logo güncellendi.',
            'data' => ['banner_url' => $profil->banner_url, 'logo_url' => $profil->logo_url],
        ]);
    }

    public function destroy(Request $request, string $kind): JsonResponse
    {
        abort_unless(array_key_exists($kind, self::KINDS), 404);

        $profil = $request->user()->sellerProfile;
        abort_unless($profil !== null, 404);

        $sutun = $kind.'_path';

        $this->forget($profil->{$sutun});
        $profil->{$sutun} = null;
        $profil->save();

        return response()->json([
            'message' => 'Görsel kaldırıldı.',
            'data' => ['banner_url' => $profil->banner_url, 'logo_url' => $profil->logo_url],
        ]);
    }

    public function show(Request $request, User $user, string $kind): StreamedResponse
    {
        abort_unless(array_key_exists($kind, self::KINDS), 404);
        abort_unless($this->access->allows($request->user(), $user), 404);

        $profil = $user->sellerProfile;
        $yol = $profil?->{$kind.'_path'};

        abort_unless($yol !== null && Storage::disk(self::DISK)->exists($yol), 404);

        return Storage::disk(self::DISK)->response(
            $yol,
            null,
            ['Cache-Control' => 'private, max-age=604800'],
        );
    }

    private function forget(?string $yol): void
    {
        if ($yol && Storage::disk(self::DISK)->exists($yol)) {
            Storage::disk(self::DISK)->delete($yol);
        }
    }
}
