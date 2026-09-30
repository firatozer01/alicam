<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\AppSettings;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/**
 * Marka gorsellerinin panelden yonetilmesi.
 *
 * Uc tur var: acik zeminler icin logo, koyu zeminler icin logo_light ve
 * dar ekranlarda kullanilan mark. Hicbiri zorunlu degil; kaldirildiginda
 * arayuz gomulu dosyaya geri duser.
 */
class AdminBrandingController extends Controller
{
    private const DISK = 'local';

    private const DIR = 'branding';

    public function store(Request $request, string $kind): JsonResponse
    {
        // Tur de dogrulamaya giriyor: dosya adi ondan uretildigi ve
        // ayar anahtari ona gore secildigi icin serbest birakilamaz.
        Validator::make(
            ['kind' => $kind] + $request->all(),
            [
                'kind' => ['required', Rule::in(AppSettings::BRANDING_KEYS)],
                // SVG bilerek disarida. Logo her sayfada basiliyor ve
                // satir ici gomuldugunde bir SVG <script> tasiyabilir;
                // tek bir yuklemeyle butun site ele gecerdi.
                'file' => ['required', 'image', 'mimes:png,webp,jpg,jpeg', 'max:2048'],
            ],
        )->validate();

        $this->forget($kind);

        // Dosya adi her yuklemede degisir: eski adres bir yerde
        // onbellekte kalmis olsa bile yeni gorsele carpmasin.
        $uzanti = strtolower($request->file('file')->extension() ?: 'png');
        $ad = $kind.'-'.Str::random(8).'.'.$uzanti;

        Storage::disk(self::DISK)->putFileAs(self::DIR, $request->file('file'), $ad);

        AppSettings::put([
            'branding.'.$kind => $ad,
            'branding.version' => $this->sonrakiSurum(),
        ]);

        return response()->json([
            'message' => 'Logo güncellendi.',
            'data' => ['branding' => AppSettings::branding()],
        ]);
    }

    public function destroy(string $kind): JsonResponse
    {
        abort_unless(in_array($kind, AppSettings::BRANDING_KEYS, true), 404);

        $this->forget($kind);

        // Ayar bosaltilir, silinmez: bos deger "yuklenmis dosya yok"
        // demek ve arayuz gomulu dosyaya doner.
        AppSettings::put([
            'branding.'.$kind => '',
            'branding.version' => $this->sonrakiSurum(),
        ]);

        return response()->json([
            'message' => 'Logo kaldırıldı, varsayılana dönüldü.',
            'data' => ['branding' => AppSettings::branding()],
        ]);
    }

    /** Kayitli dosyayi diskten siler; logo degisince yer kaplamasin. */
    private function forget(string $kind): void
    {
        $ad = trim((string) (AppSettings::all()['branding.'.$kind] ?? ''));

        if ($ad === '') {
            return;
        }

        $yol = self::DIR.'/'.$ad;

        if (Storage::disk(self::DISK)->exists($yol)) {
            Storage::disk(self::DISK)->delete($yol);
        }
    }

    /**
     * Adres damgasini bir artirir.
     *
     * Gorseller uzun onbellekle servis ediliyor; damga artmazsa yonetici
     * logoyu degistirdiginde tarayicilar eskisini gostermeye devam eder.
     */
    private function sonrakiSurum(): string
    {
        return (string) ((int) (AppSettings::get('branding.version', '1') ?? '1') + 1);
    }
}
