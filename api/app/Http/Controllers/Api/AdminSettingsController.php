<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\AppSettings;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Yonetim panelinden e-posta (SMTP) baglantisi. SMS saglayicisi
 * secildiginde ayni ucla yonetilecek.
 */
class AdminSettingsController extends Controller
{
    /** Hata mesaji hangi hesabi kastettigini soylesin diye okunur adlar. */
    private const SOSYAL_ADLAR = [
        'instagram' => 'Instagram',
        'youtube' => 'YouTube',
        'tiktok' => 'TikTok',
        'x' => 'X',
        'facebook' => 'Facebook',
        'linkedin' => 'LinkedIn',
    ];

    public function show(): JsonResponse
    {
        return response()->json([
            'data' => AppSettings::forAdmin(),
            'meta' => [
                // Panelde "su an hangi surucu kullaniliyor" bilgisi gosterilir.
                'active_mailer' => config('mail.default'),
                'sms_ready' => false,
                // Anahtar girilmediyse asistan hazir cevap modunda calisir.
                'assistant_mode' => AppSettings::get('assistant.gemini_key') ? 'ai' : 'knowledge',
                // Anahtar yoksa gorsel arama anahtarsiz kaynaklara duser.
                'image_source' => AppSettings::get('images.pexels_key') ? 'pexels' : 'acik-kaynak',
            ],
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'mail.enabled' => ['sometimes', 'boolean'],
            'mail.host' => ['sometimes', 'nullable', 'string', 'max:190'],
            'mail.port' => ['sometimes', 'nullable', 'integer', 'min:1', 'max:65535'],
            'mail.encryption' => ['sometimes', 'nullable', Rule::in(['tls', 'ssl', 'none'])],
            'mail.username' => ['sometimes', 'nullable', 'string', 'max:190'],
            'mail.password' => ['sometimes', 'nullable', 'string', 'max:190'],
            'mail.from_address' => ['sometimes', 'nullable', 'email', 'max:190'],
            'mail.from_name' => ['sometimes', 'nullable', 'string', 'max:120'],
            'assistant.gemini_key' => ['sometimes', 'nullable', 'string', 'max:200'],
            'assistant.model' => ['sometimes', 'nullable', 'string', 'max:60'],
            'images.pexels_key' => ['sometimes', 'nullable', 'string', 'max:200'],
            // Sosyal adresler burada yalnizca duz metin olarak dogrulanir;
            // "url" kurali konulmadi ki asagida sema eksigini tamamlayip
            // "instagram.com/alicamnet" gibi bir girisi de kabul edebilelim.
            'social.instagram' => ['sometimes', 'nullable', 'string', 'max:255'],
            'social.youtube' => ['sometimes', 'nullable', 'string', 'max:255'],
            'social.tiktok' => ['sometimes', 'nullable', 'string', 'max:255'],
            'social.x' => ['sometimes', 'nullable', 'string', 'max:255'],
            'social.facebook' => ['sometimes', 'nullable', 'string', 'max:255'],
            'social.linkedin' => ['sometimes', 'nullable', 'string', 'max:255'],
            // Kaldirilacak alanlar: gizli bir deger yalnizca boyle silinebilir.
            'clear' => ['sometimes', 'array', 'max:10'],
            'clear.*' => ['string', Rule::in(array_keys(AppSettings::EDITABLE))],
        ]);

        // Normalize silmeden once: gecersiz bir adres yuzunden 422 donerken
        // clear() cagrilmis olmasin.
        foreach ($data['social'] ?? [] as $platform => $deger) {
            $data['social'][$platform] = $this->sosyalBaglanti($platform, $deger);
        }

        AppSettings::clear($data['clear'] ?? []);

        $flat = [];
        foreach (['mail', 'assistant', 'images', 'social'] as $group) {
            foreach ($data[$group] ?? [] as $key => $value) {
                $flat[$group.'.'.$key] = is_bool($value) ? ($value ? '1' : '0') : (string) ($value ?? '');
            }
        }

        // Baglanti acilacaksa asgari alanlar dolu olmali.
        if (($flat['mail.enabled'] ?? null) === '1') {
            $host = $flat['mail.host'] ?? AppSettings::get('mail.host');
            $from = $flat['mail.from_address'] ?? AppSettings::get('mail.from_address');

            if (! $host || ! $from) {
                return response()->json([
                    'message' => 'E-posta gönderimini açmak için sunucu adresi ve gönderen e-posta zorunludur.',
                ], 422);
            }
        }

        AppSettings::put($flat);

        return response()->json([
            'message' => 'Ayarlar kaydedildi.',
            'data' => AppSettings::forAdmin(),
        ]);
    }

    /**
     * Sosyal medya adresini kayda hazirlar.
     *
     * Bos deger "bu hesabi gosterme" demek; ConvertEmptyStringsToNull bos
     * alani null'a cevirdigi icin ikisi ayni sayilir. Deger alt bilgide
     * dogrudan bir <a href> icine girdiginden javascript: ve data: gibi
     * semalar buradan gecemez.
     */
    private function sosyalBaglanti(string $platform, ?string $deger): string
    {
        $deger = trim((string) $deger);

        if ($deger === '') {
            return '';
        }

        // Sema hic yazilmamissa tamamlanir; yanlis yazilmissa dokunulmaz ki
        // asagidaki suzgece takilsin.
        if (! preg_match('~^[a-z][a-z0-9+.-]*:~i', $deger)) {
            $deger = 'https://'.$deger;
        }

        // Nokta sarti gerekli: filter_var "https://alicamnet" adresini gecerli
        // sayiyor, yani hesap adresi yerine yalnizca kullanici adini yazan
        // yonetici sessizce cozulemeyen bir baglanti yayinliyordu.
        $sunucu = parse_url($deger, PHP_URL_HOST);

        if (! preg_match('~^https?://~i', $deger)
            || ! filter_var($deger, FILTER_VALIDATE_URL)
            || ! is_string($sunucu)
            || ! str_contains(trim($sunucu, '.'), '.')) {
            $ad = self::SOSYAL_ADLAR[$platform] ?? $platform;

            throw ValidationException::withMessages([
                'social.'.$platform => $ad.' bağlantısı https:// ile başlayan geçerli bir adres olmalı.',
            ]);
        }

        return $deger;
    }

    /** Kayitli ayarlarla tek bir deneme e-postasi gonderir. */
    public function test(Request $request): JsonResponse
    {
        $data = $request->validate([
            'to' => ['required', 'email', 'max:190'],
        ]);

        AppSettings::applyMailConfig();

        if (config('mail.default') !== 'smtp') {
            return response()->json([
                'message' => 'E-posta gönderimi kapalı. Önce SMTP bilgilerini kaydedip gönderimi açın.',
            ], 422);
        }

        try {
            Mail::raw(
                "alıcam.net e-posta ayarları çalışıyor.\n\nBu ileti yönetim panelindeki test düğmesiyle gönderildi.",
                fn ($message) => $message->to($data['to'])->subject('alıcam.net SMTP testi'),
            );
        } catch (\Throwable $error) {
            return response()->json([
                'message' => 'Gönderilemedi: '.mb_substr($error->getMessage(), 0, 180),
            ], 422);
        }

        return response()->json(['message' => $data['to'].' adresine deneme e-postası gönderildi.']);
    }
}
