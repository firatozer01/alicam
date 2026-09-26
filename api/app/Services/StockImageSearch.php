<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;

/**
 * Hizmet kartlari icin fotograf arar.
 *
 * Uc kaynak sirayla denenir:
 *
 *  1. Pexels — yalnizca panelden bir anahtar girildiyse. Amaca en uygun
 *     kaynak: stok fotograf kutuphanesi oldugu icin "temiz bir mutfakta
 *     calisan usta" turu gorseller burada. Anahtar ucretsiz.
 *  2. Openverse — anahtarsiz calisir, agirlikla Flickr. Ansiklopedik
 *     olmadigi icin Commons'tan belirgin sekilde daha isabetli.
 *  3. Wikimedia Commons — son care. Bir ansiklopedi/arsiv koleksiyonu
 *     oldugu icin "Mutfak Tadilati" sorgusuna kalem tutan bir portre,
 *     "Boya Badana" sorgusuna Pompeii freski donebiliyor; eleme
 *     kurallari bu yuzden en cok burada gerekiyor.
 *
 * Donen dizi: title, url, license, credit, page, source.
 */
class StockImageSearch
{
    /** Commons kurallari geregi kim oldugumuzu bildiriyoruz. */
    private const AGENT = 'alicam.net/1.0 (https://alicam.net; iletisim@alicam.net)';

    /** Kart fotografi bu genislikte yeterli; kucultme yazarken yapilir. */
    private const WIDTH = 900;

    /**
     * Basliga uymayan dosya turleri (Commons icin).
     *
     * Commons arama sonucu harita, arma, afis ve 19. yuzyil gravurleri de
     * donduruyor; bunlar "anlasilmiyor" sorununu cozmez, buyutur.
     */
    private const REJECT = [
        'logo', 'map of', ' map', 'coat of arms', 'seal of', 'flag of',
        'diagram', 'chart', 'poster', 'stamp', 'banknote', 'drawing',
        'engraving', 'lithograph', 'illustration', 'icon', 'painting',
        'plaque', 'monument', 'gravestone', 'patent', 'cover of',
        'title page', 'advertisement', 'postcard', 'sketch', 'cartoon',
        'fresco', 'mural', 'museum', 'ancient', 'century', 'sculpture',
        'statue', 'archive', 'portrait of', 'bc)', 'ad)', 'roman ',
        'wellcome', 'nara ', 'rijksmuseum', 'library of congress',
        '(loc)', 'dpla', 'met dp', 'smithsonian',
        'cathedral', 'manor', 'castle', 'palace', 'basilica', 'abbey',
        'chapel', 'temple of', 'ruins',
    ];

    /** Bu yildan eskisi bir hizmet kartinda cagdas gorunmuyor. */
    private const MIN_YEAR = 1975;

    /**
     * @return array{title: string, url: string, license: string, credit: string, page: string, source: string}|null
     */
    public function find(string $sorgu): ?array
    {
        foreach (['pexels', 'openverse', 'commons'] as $kaynak) {
            $aday = match ($kaynak) {
                'pexels' => $this->pexels($sorgu),
                'openverse' => $this->openverse($sorgu),
                default => $this->commons($sorgu),
            };

            if ($aday !== null) {
                return $aday;
            }
        }

        return null;
    }

    /** Anahtar girilmediyse sessizce atlanir. */
    private function pexels(string $sorgu): ?array
    {
        $anahtar = AppSettings::get('images.pexels_key');

        if (! $anahtar) {
            return null;
        }

        try {
            $yanit = Http::withHeaders(['Authorization' => $anahtar])
                ->timeout(25)->retry(2, 1200)
                ->get('https://api.pexels.com/v1/search', [
                    'query' => $sorgu,
                    'per_page' => 5,
                    'orientation' => 'landscape',
                ]);
        } catch (\Throwable) {
            return null;
        }

        foreach ($yanit->json('photos') ?? [] as $foto) {
            $url = $foto['src']['large'] ?? $foto['src']['medium'] ?? null;

            if (! $url) {
                continue;
            }

            return [
                'title' => (string) ($foto['alt'] ?? $sorgu),
                'url' => $url,
                // Pexels lisansi atif zorunlu kilmiyor ama fotografciyi
                // yine de kaydediyoruz: kaynagi kaybetmenin faydasi yok.
                'license' => 'Pexels',
                'credit' => (string) ($foto['photographer'] ?? ''),
                'page' => (string) ($foto['url'] ?? ''),
                'source' => 'pexels',
            ];
        }

        return null;
    }

    private function openverse(string $sorgu): ?array
    {
        try {
            $yanit = Http::withHeaders(['User-Agent' => self::AGENT, 'Accept' => 'application/json'])
                ->timeout(25)->retry(2, 1200)
                ->get('https://api.openverse.org/v1/images/', [
                    'q' => $sorgu,
                    // Ticari kullanima acik lisanslar; atif gerektirenler
                    // dahil, bilgi kayitla birlikte saklaniyor.
                    'license_type' => 'commercial',
                    'page_size' => 12,
                ]);
        } catch (\Throwable) {
            return null;
        }

        $enIyi = null;
        $enIyiPuan = 0;

        foreach ($yanit->json('results') ?? [] as $r) {
            if (! $this->usableSize((int) ($r['width'] ?? 0), (int) ($r['height'] ?? 0))) {
                continue;
            }

            $baslik = mb_strtolower((string) ($r['title'] ?? ''));

            // Openverse'in 'url' alani ORIJINALI gosteriyor; 5000 px'lik
            // bir dosyayi cozmek GD'de 128 MB'lik sinirin ustune cikip
            // toplu indirmeyi ortasinda dusurmustu. Kendi kucuk resmi
            // (~600 px) kart icin zaten yeterli.
            //
            // Kucuk resim her zaman hazir olmuyor (toplu calistirmada 15
            // baslik boyle dustu), o yuzden orijinal yedek olarak tasinir.
            $url = $r['thumbnail'] ?? $r['url'] ?? null;
            $yedek = $r['url'] ?? null;

            if (! $url || $this->rejected($baslik)) {
                continue;
            }

            // Openverse alaka siralamasi kisisel Flickr karelerini one
            // cikarabiliyor: "dog grooming salon" sorgusuna "Benni and
            // Elizabeth #2" donuyor. Sorgunun kelimelerinden hicbiri
            // BASLIKTA gecmiyorsa aday sayilmaz.
            //
            // Etiketler denendi ve ise yaramadi: Flickr etiketleri o
            // kadar genis ki yukaridaki kare de "dog" etiketiyle esiyor.
            $puan = $this->relevance($sorgu, $baslik);

            if ($puan > $enIyiPuan) {
                $lisans = trim(strtoupper((string) ($r['license'] ?? '')).' '.($r['license_version'] ?? ''));

                $enIyiPuan = $puan;
                $enIyi = [
                    'title' => (string) ($r['title'] ?? $sorgu),
                    'url' => $url,
                    'fallback_url' => $yedek !== $url ? $yedek : null,
                    'license' => $lisans !== '' ? $lisans : 'bilinmiyor',
                    'credit' => (string) ($r['creator'] ?? ''),
                    'page' => (string) ($r['foreign_landing_url'] ?? ''),
                    'source' => 'openverse',
                ];
            }
        }

        return $enIyi;
    }

    /**
     * Sorgunun kac anlamli kelimesi metinde geciyor.
     *
     * Kelimenin tamami degil ilk bes harfi aranir: "painter" sorgusu
     * "Freshly painted green room" basligini da yakalasin diye. Eslesme
     * kelime basindan baslar, boylece "scar" icindeki "car" saymaz.
     */
    private function relevance(string $sorgu, string $metin): int
    {
        $puan = 0;

        foreach (preg_split('/\s+/', mb_strtolower(trim($sorgu))) ?: [] as $kelime) {
            if (mb_strlen($kelime) < 3) {
                continue;
            }

            $kok = mb_substr($kelime, 0, 5);

            if (preg_match('/\b'.preg_quote($kok, '/').'/u', $metin) === 1) {
                $puan++;
            }
        }

        return $puan;
    }

    private function commons(string $sorgu): ?array
    {
        // Commons terimleri VE ile birlestiriyor: dort kelimelik bir sorgu
        // cogu zaman hic sonuc dondurmuyor. Bulunamazsa sondan kelime
        // atarak genisletiyoruz; sorgular en ayirt edici kelime basta
        // yazildi, bu yuzden daraltma anlami korur.
        $kelimeler = preg_split('/\s+/', trim($sorgu)) ?: [];

        for ($adet = count($kelimeler); $adet >= 2; $adet--) {
            $aday = $this->commonsOnce(implode(' ', array_slice($kelimeler, 0, $adet)));

            if ($aday !== null) {
                return $aday;
            }
        }

        return null;
    }

    private function commonsOnce(string $sorgu): ?array
    {
        try {
            $yanit = Http::withHeaders(['User-Agent' => self::AGENT])
                ->timeout(25)->retry(2, 1200)
                ->get('https://commons.wikimedia.org/w/api.php', [
                    'action' => 'query',
                    'format' => 'json',
                    'generator' => 'search',
                    'gsrsearch' => $sorgu.' filetype:bitmap',
                    'gsrnamespace' => 6,
                    'gsrlimit' => 12,
                    'prop' => 'imageinfo',
                    'iiprop' => 'url|size|mime|extmetadata',
                    'iiurlwidth' => self::WIDTH,
                ]);
        } catch (\Throwable) {
            return null;
        }

        // Dizinin anahtari sayfa id'si oldugu icin sira alakayla ilgisiz;
        // Commons'in kendi siralamasi 'index' alaninda.
        $sayfalar = collect($yanit->json('query.pages') ?? [])
            ->sortBy(fn ($s) => $s['index'] ?? 999)
            ->all();

        foreach ($sayfalar as $sayfa) {
            $bilgi = $sayfa['imageinfo'][0] ?? null;

            if (! $bilgi || ($bilgi['mime'] ?? '') !== 'image/jpeg') {
                // PNG'lerin cogu ekran goruntusu, sema ya da logo.
                continue;
            }

            if (! $this->usableSize((int) ($bilgi['width'] ?? 0), (int) ($bilgi['height'] ?? 0))) {
                continue;
            }

            $baslik = mb_strtolower((string) ($sayfa['title'] ?? ''));

            if ($this->rejected($baslik) || ! $this->modern($bilgi['extmetadata'] ?? [])) {
                continue;
            }

            // Commons'ta da alaka denetimi: "tutoring lesson" sorgusu
            // "The Garden at Kyoto Imperial Palace" dondurmustu.
            if ($this->relevance($sorgu, $baslik) === 0) {
                continue;
            }

            $meta = $bilgi['extmetadata'] ?? [];

            return [
                'title' => str_replace('File:', '', (string) ($sayfa['title'] ?? '')),
                'url' => $bilgi['thumburl'] ?? $bilgi['url'],
                'license' => $this->plain($meta['LicenseShortName']['value'] ?? 'bilinmiyor'),
                'credit' => $this->plain($meta['Artist']['value'] ?? ''),
                'page' => (string) ($bilgi['descriptionurl'] ?? ''),
                'source' => 'commons',
            ];
        }

        return null;
    }

    /** Kart yatay; cok dar ya da cok uzun gorseller kirpilinca bozuluyor. */
    private function usableSize(int $en, int $boy): bool
    {
        if ($en < 600 || $boy < 360) {
            return false;
        }

        $oran = $boy > 0 ? $en / $boy : 0;

        return $oran >= 0.8 && $oran <= 3.0;
    }

    private function rejected(string $kucukBaslik): bool
    {
        foreach (self::REJECT as $kotu) {
            if (str_contains($kucukBaslik, $kotu)) {
                return true;
            }
        }

        // Baslikta gecen yil cogu zaman tek tarih kaynagi: "Hammond Dance
        // Studio classes, 1941" dosyasinin extmetadata'sinda hic tarih yok.
        return preg_match('/\b(1[89]\d{2}|19[0-8]\d)\b/', $kucukBaslik, $es) === 1
            && (int) $es[1] < self::MIN_YEAR;
    }

    /**
     * Cekim yili okunabiliyorsa cagdas mi diye bakar.
     *
     * Tarihi bulunamayan dosya elenmiyor: yuklemelerin buyuk kismi
     * tarihsiz ve hepsini atmak havuzu gereksiz daraltiyor.
     *
     * @param  array<string, mixed>  $meta
     */
    private function modern(array $meta): bool
    {
        $ham = $this->plain((string) ($meta['DateTimeOriginal']['value'] ?? $meta['DateTime']['value'] ?? ''));

        if ($ham === '' || ! preg_match('/\b(1[89]\d{2}|20\d{2})\b/', $ham, $es)) {
            return true;
        }

        return (int) $es[1] >= self::MIN_YEAR;
    }

    /** Commons alanlari HTML tasiyor; duz metne indirger. */
    private function plain(string $deger): string
    {
        return trim(preg_replace('/\s+/u', ' ', html_entity_decode(strip_tags($deger))) ?? '');
    }

    /**
     * Secilen adayin ham baytlarini indirir.
     *
     * Birden fazla adres verilebilir; ilki basarisiz olursa sonrakine
     * gecilir (Openverse kucuk resmi her zaman hazir degil).
     */
    public function download(?string ...$adresler): ?string
    {
        foreach (array_filter($adresler) as $url) {
            try {
                $yanit = Http::withHeaders(['User-Agent' => self::AGENT])
                    ->timeout(40)->retry(2, 1500)
                    ->get($url);
            } catch (\Throwable) {
                continue;
            }

            if ($yanit->successful() && strlen($yanit->body()) >= 4000) {
                return $yanit->body();
            }
        }

        return null;
    }
}
