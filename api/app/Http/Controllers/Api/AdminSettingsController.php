<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\AppSettings;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
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
            // PayTR magaza bilgileri. Anahtar ve salt sifrelenerek saklanir
            // ve panelde bir daha gosterilmez; silmek icin 'clear' kullanilir.
            'paytr.enabled' => ['sometimes', 'boolean'],
            'paytr.merchant_id' => ['sometimes', 'nullable', 'string', 'max:40'],
            'paytr.merchant_key' => ['sometimes', 'nullable', 'string', 'max:120'],
            'paytr.merchant_salt' => ['sometimes', 'nullable', 'string', 'max:120'],
            'paytr.test_mode' => ['sometimes', 'boolean'],
            // Sosyal adresler burada yalnizca duz metin olarak dogrulanir;
            // "url" kurali konulmadi ki asagida sema eksigini tamamlayip
            // "instagram.com/alicamnet" gibi bir girisi de kabul edebilelim.
            'social.instagram' => ['sometimes', 'nullable', 'string', 'max:255'],
            'social.youtube' => ['sometimes', 'nullable', 'string', 'max:255'],
            'social.tiktok' => ['sometimes', 'nullable', 'string', 'max:255'],
            'social.x' => ['sometimes', 'nullable', 'string', 'max:255'],
            'social.facebook' => ['sometimes', 'nullable', 'string', 'max:255'],
            'social.linkedin' => ['sometimes', 'nullable', 'string', 'max:255'],
            // Kurumsal kimlik: iletisim sayfasi ve KVKK aydinlatma metni
            // bunlari basiyor. Bos birakilan alan sayfada hic gorunmez.
            'company.unvan' => ['sometimes', 'nullable', 'string', 'max:190'],
            'company.adres' => ['sometimes', 'nullable', 'string', 'max:400'],
            'company.telefon' => ['sometimes', 'nullable', 'string', 'max:40'],
            'company.eposta' => ['sometimes', 'nullable', 'email', 'max:190'],
            'company.mersis' => ['sometimes', 'nullable', 'string', 'max:40'],
            'company.vergi_dairesi' => ['sometimes', 'nullable', 'string', 'max:120'],
            'company.vergi_no' => ['sometimes', 'nullable', 'string', 'max:40'],
            'company.kep' => ['sometimes', 'nullable', 'email', 'max:190'],
            // Kaldirilacak alanlar: gizli bir deger yalnizca boyle silinebilir.
            'clear' => ['sometimes', 'array', 'max:10'],
            // branding.* disarida: bu anahtarlar dosya adi ve surum sayaci
            // tasiyor. Surum silinirse yuklenmis logonun adresi eskiye doner
            // ve bir yil 'immutable' isaretli onbellege takilir. Marka
            // gorselleri kendi ucundan kaldirilir.
            'clear.*' => ['string', Rule::in(array_values(array_filter(
                array_keys(AppSettings::EDITABLE),
                fn (string $anahtar) => ! str_starts_with($anahtar, 'branding.'),
            )))],
        ]);

        // Normalize silmeden once: gecersiz bir adres yuzunden 422 donerken
        // clear() cagrilmis olmasin.
        foreach ($data['social'] ?? [] as $platform => $deger) {
            $data['social'][$platform] = $this->sosyalBaglanti($platform, $deger);
        }

        AppSettings::clear($data['clear'] ?? []);

        $flat = [];
        foreach (['mail', 'assistant', 'images', 'social', 'company', 'paytr'] as $group) {
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

    /**
     * PayTR baglantisini sinar.
     *
     * Gercek bir token istegi gonderilir: PayTR magaza bilgilerini ve imzayi
     * dogrulamadan token vermez, dolayisiyla "success" donmesi bilgilerin
     * CALISTIGININ kanitidir. Siparis olusturulmaz, para cekilmez; alinan
     * token kullanilmadigi icin odeme ekrani hic acilmaz.
     */
    public function paytrTest(Request $request): JsonResponse
    {
        // Kayitli deger varsa ONU dener; yoksa .env'dekine duser. Bilerek
        // applyPaytrConfig() kullanilmiyor: o, "panelden yonetiliyor"
        // kapaliyken hicbir sey yapmaz ve yonetici az once yazdigi bilgiyi
        // deneyemezdi. Test, kaydedileni sinamali.
        $kimlik = AppSettings::get('paytr.merchant_id') ?: (string) config('services.paytr.merchant_id');
        $anahtar = AppSettings::get('paytr.merchant_key') ?: (string) config('services.paytr.merchant_key');
        $tuz = AppSettings::get('paytr.merchant_salt') ?: (string) config('services.paytr.merchant_salt');
        $testKipi = AppSettings::get('paytr.merchant_id')
            ? AppSettings::enabled('paytr.test_mode')
            : (bool) config('services.paytr.test_mode');

        if (! $kimlik || ! $anahtar || ! $tuz) {
            return response()->json([
                'message' => 'Mağaza no, anahtar ve gizli anahtarın üçü de dolu olmalı. Kaydettikten sonra tekrar deneyin.',
            ], 422);
        }

        // Deneme siparisi: numarasi cakismasin diye zamanla damgalanir.
        $siparis = 'TEST'.now()->format('ymdHis');
        $sepet = base64_encode(json_encode([['alıcam.net bağlantı testi', '1.00', 1]], JSON_UNESCAPED_UNICODE));

        $alanlar = [
            'merchant_id' => $kimlik,
            'user_ip' => (string) ($request->ip() ?: '127.0.0.1'),
            'merchant_oid' => $siparis,
            'email' => (string) ($request->user()->email ?: 'destek@alicam.net'),
            // Kurus cinsinden: 1,00 TL.
            'payment_amount' => '100',
            'paytr_token' => '',
            'user_basket' => $sepet,
            'debug_on' => 1,
            'no_installment' => 0,
            'max_installment' => 0,
            'user_name' => (string) $request->user()->name,
            'user_address' => 'Belirtilmedi',
            'user_phone' => (string) ($request->user()->phone ?: '5550000000'),
            'merchant_ok_url' => rtrim((string) config('services.paytr.frontend_url'), '/').'/odeme/basarili',
            'merchant_fail_url' => rtrim((string) config('services.paytr.frontend_url'), '/').'/odeme/basarisiz',
            'timeout_limit' => 5,
            'currency' => 'TL',
            'test_mode' => (int) $testKipi,
            'lang' => 'tr',
        ];

        // Imza sirasi PayTR dokumantasyonundaki sira: merchant_id, user_ip,
        // merchant_oid, email, payment_amount, user_basket, no_installment,
        // max_installment, currency, test_mode, merchant_salt.
        $imzaGirdisi = $alanlar['merchant_id'].$alanlar['user_ip'].$alanlar['merchant_oid'].$alanlar['email']
            .$alanlar['payment_amount'].$alanlar['user_basket'].$alanlar['no_installment']
            .$alanlar['max_installment'].$alanlar['currency'].$alanlar['test_mode'].$tuz;

        $alanlar['paytr_token'] = base64_encode(hash_hmac('sha256', $imzaGirdisi, $anahtar, true));

        try {
            $cevap = Http::asForm()->acceptJson()->timeout(20)
                ->post((string) config('services.paytr.token_url'), $alanlar);
            $govde = $cevap->json();
        } catch (\Throwable $hata) {
            return response()->json([
                'message' => 'PayTR sunucusuna ulaşılamadı: '.mb_substr($hata->getMessage(), 0, 160),
            ], 422);
        }

        if (is_array($govde) && ($govde['status'] ?? null) === 'success' && ! empty($govde['token'])) {
            return response()->json([
                'message' => 'Bağlantı kuruldu. PayTR mağaza bilgilerini kabul etti'
                    .($testKipi ? ' (test kipi açık).' : ' (CANLI kip).'),
            ]);
        }

        $sebep = is_array($govde) ? (string) ($govde['reason'] ?? 'Bilinmeyen yanıt.') : 'Yanıt okunamadı.';

        return response()->json([
            'message' => 'PayTR reddetti: '.mb_substr($sebep, 0, 220),
        ], 422);
    }
}
