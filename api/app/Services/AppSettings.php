<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;

/**
 * Calisma zamani ayarlari. Yonetici panelinden girilen SMTP bilgileri
 * burada saklanir ve her istekte mail yapilandirmasina uygulanir; boylece
 * e-posta baglamak icin .env duzenlemek ve konteyner yeniden baslatmak
 * gerekmez.
 *
 * SMS saglayicisi eklendiginde ayni tabloya sms.* anahtarlariyla girecek.
 */
class AppSettings
{
    private const CACHE_KEY = 'app-settings:all';

    private const CACHE_TTL = 300;

    /** Gizli alanlar sifrelenerek saklanir ve panele maskelenmis doner. */
    public const SECRET_KEYS = ['mail.password', 'sms.api_key', 'sms.password', 'assistant.gemini_key', 'images.pexels_key'];

    /** Alt bilgideki sosyal medya simgelerinin kanonik sirasi. */
    public const SOCIAL_KEYS = ['instagram', 'youtube', 'tiktok', 'x', 'facebook', 'linkedin'];

    /** Yonetilebilen marka gorselleri. */
    public const BRANDING_KEYS = ['logo', 'logo_light', 'mark'];

    /**
     * Kurumsal kimlik alanlari: iletisim sayfasi ve KVKK aydinlatma metni
     * bunlari basiyor. Hicbiri gomulu DEGIL -- uydurulmus bir adres ya da
     * MERSIS numarasi yayinlamaktansa alan bos kalir ve sayfa o satiri hic
     * gostermez.
     */
    public const COMPANY_KEYS = ['unvan', 'adres', 'telefon', 'eposta', 'mersis', 'vergi_dairesi', 'vergi_no', 'kep'];

    /** Panelden yonetilebilen alanlar ve varsayilanlari. */
    public const EDITABLE = [
        'mail.enabled' => '0',
        'mail.host' => '',
        'mail.port' => '587',
        'mail.encryption' => 'tls',
        'mail.username' => '',
        'mail.password' => '',
        'mail.from_address' => '',
        'mail.from_name' => 'alıcam.net',
        // Bos birakilirsa asistan hazir cevap modunda calisir.
        'assistant.gemini_key' => '',
        'assistant.model' => 'gemini-3.8-flash',

        // Kategori kapak fotograflari icin stok gorsel kaynagi.
        // Bos birakilirsa anahtarsiz kaynaklara (Openverse,
        // Wikimedia Commons) dusulur; sonuclar daha zayiftir.
        'images.pexels_key' => '',

        // Anasayfa metinleri. Basliklarin kendisi kategori agacindan
        // geliyor; buradakiler yalnizca cerceve yazilari, boylece
        // kampanya donemlerinde dagitim yapmadan degistirilebiliyor.
        'home.hero_title' => 'İhtiyacın olan hizmeti seç,',
        'home.hero_accent' => 'teklifler sana gelsin.',
        'home.hero_placeholder' => 'Hangi hizmete ihtiyacın var? Örn. ev temizliği, klima montajı, İngilizce ders',
        'home.popular_title' => 'Popüler hizmetler',
        'home.popular_subtitle' => 'EN ÇOK ARANAN',
        'home.trending_title' => 'Bu hafta trendde',
        'home.trending_subtitle' => 'HAREKETLENEN',
        'home.groups_title' => 'Aradığın her iş için bir başlık var.',
        'home.groups_subtitle' => 'TÜM HİZMETLER',
        'home.listing_title' => 'Hizmet değil, ürün mü arıyorsun?',
        'home.listing_subtitle' => 'İLANLAR',

        // Elle one cikarilan hizmet basliklari (slug, virgulle ayrilir).
        // Dolu ise populer seridi talep sayisi yerine bu siraya uyar;
        // bos ise otomatik siralama devam eder.
        'home.popular_pinned' => '',

        // Alt bilgide gorunen sosyal medya baglantilari. Bos birakilan
        // hesabin simgesi hic basilmaz, yani bir hesabi kaldirmanin yolu
        // alani bosaltmaktir.
        // Kurumsal kimlik. Varsayilanlar bos: yonetici doldurana kadar
        // iletisim sayfasi ve aydinlatma metni o alanlari hic basmaz.
        'company.unvan' => 'SMN LIFE İNŞAAT TİCARET LİMİTED ŞİRKETİ',
        'company.adres' => 'Küçükbakkalköy Mah. Barış Sk. No: 4-6 İç Kapı No: 8 Ataşehir / İstanbul',
        'company.telefon' => '',
        'company.eposta' => 'destek@alicam.net',
        'company.mersis' => '',
        'company.vergi_dairesi' => 'Kozyatağı',
        'company.vergi_no' => '7721513073',
        'company.kep' => '',

        'social.instagram' => 'https://www.instagram.com/alicamnet',
        'social.youtube' => 'https://www.youtube.com/@alicamnet',
        'social.tiktok' => 'https://www.tiktok.com/@alicamnet',
        'social.x' => 'https://x.com/alicamnet',
        'social.facebook' => '',
        'social.linkedin' => '',

        // Marka gorselleri. Arayuzde gomulu duran dosyalar (logo.png,
        // logo-light.png, mark.png) zaten dogru logo; buradaki alanlar
        // yalnizca yonetici baska bir gorsel yuklerse doluyor ve o zaman
        // gomulu dosyanin yerine gecer. Deger, diskteki dosyanin adi.
        'branding.logo' => '',
        'branding.logo_light' => '',
        'branding.mark' => '',
        // Adres damgasi: her yukleme/kaldirmada artar. Logo her sayfada
        // basildigi icin uzun onbellekle servis ediliyor; damga olmasa
        // yeni logo tarayicilara gunlerce ulasmazdi.
        'branding.version' => '1',
    ];

    /**
     * @return array<string, string|null>
     */
    public static function all(): array
    {
        return Cache::remember(self::CACHE_KEY, self::CACHE_TTL, function (): array {
            $rows = DB::table('app_settings')->get();
            $out = [];

            foreach ($rows as $row) {
                $out[$row->key] = $row->is_secret && $row->value
                    ? self::decrypt($row->value)
                    : $row->value;
            }

            return $out;
        });
    }

    public static function get(string $key, ?string $fallback = null): ?string
    {
        $value = self::all()[$key] ?? null;

        return ($value === null || $value === '') ? $fallback : $value;
    }

    public static function enabled(string $key): bool
    {
        return in_array(self::get($key), ['1', 'true', 'on'], true);
    }

    /**
     * @param  array<string, string|null>  $values
     */
    public static function put(array $values): void
    {
        foreach ($values as $key => $value) {
            if (! array_key_exists($key, self::EDITABLE)) {
                continue;
            }

            $secret = in_array($key, self::SECRET_KEYS, true);

            // Gizli alan bos gonderildiyse mevcut deger korunur: panel
            // maskelenmis gosterdigi icin kullanici her kayitta yeniden
            // yazmak zorunda kalmasin.
            if ($secret && ($value === null || $value === '')) {
                continue;
            }

            DB::table('app_settings')->updateOrInsert(
                ['key' => $key],
                [
                    'value' => $secret ? Crypt::encryptString((string) $value) : $value,
                    'is_secret' => $secret,
                    'updated_at' => now(),
                    'created_at' => now(),
                ],
            );
        }

        self::forget();
    }

    /**
     * Kayitli bir ayari tamamen siler.
     *
     * put() gizli bir alan bos gonderildiginde mevcut degeri korur, yoksa
     * panel maskelenmis gosterdigi icin her kayitta sifreyi yeniden yazmak
     * gerekirdi. Bunun yan etkisi olarak girilen bir anahtar bir daha
     * kaldirilamazdi; kaldirma islemi bu yuzden ayri bir yol.
     *
     * @param  array<int, string>  $keys
     */
    public static function clear(array $keys): void
    {
        $allowed = array_values(array_intersect($keys, array_keys(self::EDITABLE)));

        if ($allowed === []) {
            return;
        }

        DB::table('app_settings')->whereIn('key', $allowed)->delete();

        self::forget();
    }

    public static function forget(): void
    {
        Cache::forget(self::CACHE_KEY);
    }

    /**
     * Panelde gosterilecek hal: gizli alanlar deger yerine "dolu mu" bilgisi
     * tasir.
     *
     * @return array<string, mixed>
     */
    public static function forAdmin(): array
    {
        $all = self::all();
        $out = [];

        foreach (self::EDITABLE as $key => $default) {
            if (in_array($key, self::SECRET_KEYS, true)) {
                $out[$key] = '';
                $out[$key.'_set'] = ($all[$key] ?? '') !== '';

                continue;
            }

            $out[$key] = $all[$key] ?? $default;
        }

        return $out;
    }

    /**
     * Alt bilgide basilacak sosyal medya baglantilari, kanonik sirada.
     *
     * Burada bilerek get() kullanilmiyor: get() bos degeri varsayilana
     * dusuruyor, dolayisiyla yonetici bir hesabi silip alani bosaltinca
     * varsayilan adres geri gelirdi. Kayitli bir satir varsa degeri bos
     * olsa bile gecerlidir; anahtar hic yoksa varsayilana bakilir.
     *
     * @return array<int, array{platform: string, url: string}>
     */
    public static function socialLinks(): array
    {
        $all = self::all();
        $out = [];

        foreach (self::SOCIAL_KEYS as $platform) {
            $anahtar = 'social.'.$platform;

            $deger = array_key_exists($anahtar, $all)
                ? (string) $all[$anahtar]
                : (self::EDITABLE[$anahtar] ?? '');

            $deger = trim($deger);

            // Adres dogrudan bir <a href> icine giriyor; yonetim ucu
            // kaydederken de suzuyor ama son kapi burada.
            if ($deger === '' || ! preg_match('~^https?://~i', $deger)) {
                continue;
            }

            $out[] = ['platform' => $platform, 'url' => $deger];
        }

        return $out;
    }

    /**
     * Yoneticinin yukledigi marka gorsellerinin adresleri.
     *
     * Yuklenmemis her tur icin null doner; arayuz o zaman gomulu dosyaya
     * duser. Burada da bilerek get() kullanilmiyor: get() bos degeri
     * varsayilana dusuruyor, oysa burada bos "yuklenmis dosya yok"
     * demek ve anlamli bir cevap.
     *
     * @return array<string, string|null>
     */
    public static function branding(): array
    {
        $all = self::all();

        $surum = trim((string) ($all['branding.version'] ?? '')) ?: '1';

        $out = [];

        foreach (self::BRANDING_KEYS as $tur) {
            $anahtar = 'branding.'.$tur;

            $ad = array_key_exists($anahtar, $all)
                ? trim((string) $all[$anahtar])
                : '';

            // Damga adreste: dosya adi degisse de degismese de tarayici
            // yeni surumu yeniden ister.
            $out[$tur] = $ad === '' ? null : '/api/branding/'.$tur.'?v='.$surum;
        }

        return $out;
    }

    /**
     * Kurumsal kimlik alanlari. Yalnizca DOLU olanlar doner; cagiran taraf
     * da yalnizca donenleri basar, boylece "Adres: —" gibi bos satirlar
     * ekrana cikmaz.
     *
     * @return array<string, string>
     */
    public static function company(): array
    {
        $all = self::all();
        $out = [];

        foreach (self::COMPANY_KEYS as $alan) {
            $anahtar = 'company.'.$alan;

            $deger = trim((string) (array_key_exists($anahtar, $all)
                ? $all[$anahtar]
                : (self::EDITABLE[$anahtar] ?? '')));

            if ($deger !== '') {
                $out[$alan] = $deger;
            }
        }

        return $out;
    }

    /** Kayitli SMTP bilgisi varsa mail yapilandirmasina uygular. */
    public static function applyMailConfig(): void
    {
        if (! self::enabled('mail.enabled')) {
            return;
        }

        $host = self::get('mail.host');

        if (! $host) {
            return;
        }

        config([
            'mail.default' => 'smtp',
            'mail.mailers.smtp.host' => $host,
            'mail.mailers.smtp.port' => (int) self::get('mail.port', '587'),
            'mail.mailers.smtp.encryption' => self::get('mail.encryption', 'tls'),
            'mail.mailers.smtp.username' => self::get('mail.username'),
            'mail.mailers.smtp.password' => self::get('mail.password'),
            'mail.from.address' => self::get('mail.from_address', config('mail.from.address')),
            'mail.from.name' => self::get('mail.from_name', config('mail.from.name')),
        ]);
    }

    private static function decrypt(string $value): ?string
    {
        try {
            return Crypt::decryptString($value);
        } catch (\Throwable) {
            // APP_KEY degistiyse eski deger cozulemez; alan bos sayilir.
            return null;
        }
    }
}
