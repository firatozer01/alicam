<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Conversation;
use App\Models\Offer;
use App\Models\RequestUnlock;
use App\Models\User;
use App\Services\ImageShaper;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Profil fotograflari.
 *
 * Herkes kendi fotografini yukler; gorme hakki ayri bir mesele ve
 * bilerek dar tutuldu.
 *
 * Neden herkese acik degil: bu pazaryerinde satici, bir talebin SAHIBINI
 * ogrenmek icin kontor oduyor. Kilit acilana kadar alicinin adi bile
 * donmuyor (SellerRequestResource). Fotograf da kimliktir; /avatars/{id}
 * herkese acik olsaydi satici kullanici id'lerini sirayla deneyerek
 * odemeden yuz gorebilirdi.
 *
 * Bu yuzden gorme hakki sistemde zaten var olan kapilara baglandi:
 * kendi fotografin, sana teklif vermis bir satici, kilidini actigin bir
 * talebin sahibi, ya da okuyabildigin bir yazismanin karsi tarafi.
 */
class AvatarController extends Controller
{
    private const DISK = 'local';

    private const MAX_KB = 4096;

    public function show(Request $request, User $user): StreamedResponse
    {
        abort_unless($user->avatar_path !== null, 404);
        abort_unless($this->mayView($request->user(), $user), 404);
        abort_unless(Storage::disk(self::DISK)->exists($user->avatar_path), 404);

        return Storage::disk(self::DISK)->response(
            $user->avatar_path,
            null,
            [
                // Ozel: paylasimli onbellekler saklamasin, cunku yanit
                // isteyen kisiye gore degisiyor.
                'Cache-Control' => 'private, max-age=86400',
            ],
        );
    }

    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'image' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:'.self::MAX_KB],
        ]);

        $user = $request->user();

        $this->forget($user->avatar_path);

        $ham = (string) file_get_contents($request->file('image')->getRealPath());
        $kare = app(ImageShaper::class)->shape($ham, 'avatar');

        if ($kare === null) {
            return response()->json(['message' => 'Görsel okunamadı. Farklı bir dosya deneyin.'], 422);
        }

        // Dosya adi her yuklemede degisir: tarayici eski fotografi
        // onbellekten gostermeye devam etmesin.
        $yol = "avatars/{$user->id}-".bin2hex(random_bytes(6)).'.jpg';
        Storage::disk(self::DISK)->put($yol, $kare);

        $user->avatar_path = $yol;
        $user->save();

        return response()->json([
            'message' => 'Profil fotoğrafı güncellendi.',
            'data' => ['avatar_url' => $user->avatar_url],
        ]);
    }

    public function destroy(Request $request): JsonResponse
    {
        $user = $request->user();

        $this->forget($user->avatar_path);

        $user->avatar_path = null;
        $user->save();

        return response()->json([
            'message' => 'Profil fotoğrafı kaldırıldı.',
            'data' => ['avatar_url' => null],
        ]);
    }

    /**
     * Gorme hakki: sistemde zaten var olan kapilarin birlesimi.
     */
    private function mayView(?User $viewer, User $target): bool
    {
        if ($viewer === null) {
            return false;
        }

        if ($viewer->id === $target->id || $viewer->hasRole('admin')) {
            return true;
        }

        // Hedef, izleyene teklif vermis bir satici mi?
        // (PublicSellerController::mayView ile ayni kapi.)
        $teklifVermis = Offer::query()
            ->where('offers.seller_id', $target->id)
            ->whereExists(fn ($q) => $q->selectRaw('1')->from('requests')
                ->whereColumn('requests.id', 'offers.request_id')
                ->where('requests.user_id', $viewer->id))
            ->exists();

        if ($teklifVermis) {
            return true;
        }

        // Izleyen, hedefin bir talebinin kilidini acti mi? Kimlik zaten
        // o anda aciliyor, fotograf da onunla birlikte.
        $kilidiAcilmis = RequestUnlock::query()
            ->where('request_unlocks.seller_id', $viewer->id)
            ->whereExists(fn ($q) => $q->selectRaw('1')->from('requests')
                ->whereColumn('requests.id', 'request_unlocks.request_id')
                ->where('requests.user_id', $target->id))
            ->exists();

        if ($kilidiAcilmis) {
            return true;
        }

        // Okunabilir bir yazismanin karsi tarafi mi?
        return Conversation::query()
            ->where(fn ($q) => $q
                ->where(fn ($p) => $p->where('buyer_id', $viewer->id)->where('seller_id', $target->id))
                ->orWhere(fn ($p) => $p->where('seller_id', $viewer->id)->where('buyer_id', $target->id)))
            ->get()
            ->contains(fn (Conversation $c) => $c->canRead($viewer->id));
    }

    private function forget(?string $yol): void
    {
        if ($yol && Storage::disk(self::DISK)->exists($yol)) {
            Storage::disk(self::DISK)->delete($yol);
        }
    }
}
