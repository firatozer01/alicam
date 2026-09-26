<?php

namespace App\Services;

/**
 * Yuklenen gorselleri sabit bir orana kirpip olceklendirir.
 *
 * Neden yazma aninda: Next.js gorsel iyilestiricisi bu dosyalara
 * ulasamiyor. Yollari /api/... uzerinden bir rewrite ile Laravel'e
 * gidiyor ve iyilestirici rewrite'i cozemeyip "received null" donuyor.
 * Kucultme bu yuzden sunucunun isi.
 *
 * Yeniden kodlamanin ikinci faydasi: EXIF verisi dusuyor. Telefondan
 * yuklenen bir fotograf cekildigi yerin GPS koordinatini tasiyor;
 * saticinin evinin konumu bir ilan fotografiyla disari cikmasin.
 */
class ImageShaper
{
    /**
     * Ad => [oran, genislik, kalite].
     *
     * Oran = genislik / yukseklik.
     */
    public const PRESETS = [
        // Kategori karti: anasayfadaki hizmet kartlari.
        'category' => [1.6, 640, 82],
        // Profil fotografi: her yerde yuvarlak maskeyle gosterilir.
        'avatar' => [1.0, 320, 84],
        // Vitrin kapagi: sayfa genisligini kaplar.
        'banner' => [3.0, 1600, 80],
        // Ilan galerisi: buyuk gosterim de bu dosyadan beslenir,
        // bu yuzden kart olcusunden belirgin daha genis.
        'listing' => [4 / 3, 1280, 84],
    ];

    /**
     * Cozulmeden once reddedilen piksel sayisi.
     *
     * GD cozulen goruntuyu ham tutuyor: 6000x4000'lik bir dosya yaklasik
     * 96 MB. FPM iscileri 128 MB sinirla calistigi icin buyuk bir telefon
     * fotografi tek basina istegi dusurebilir. 40 MP her gercek fotografi
     * gecirir, bellek bombasini gecirmez.
     */
    private const MAX_PIXELS = 40_000_000;

    /**
     * Ham baytlari bir presete gore sekillendirir.
     *
     * Cozulemez ya da makul olmayacak kadar buyukse null doner.
     * KULLANICI yuklemelerinde cagiran taraf bunu 422 ile karsilamali,
     * ham dosyayi saklamamali: cozulemeyen bir dosyayi oldugu gibi
     * yazmak, istedigi baytlari sunucumuzdan yayinlatmanin yolu olur.
     */
    public function shape(string $bytes, string $preset): ?string
    {
        [$oran, $genislik, $kalite] = self::PRESETS[$preset]
            ?? throw new \InvalidArgumentException("Bilinmeyen preset: {$preset}");

        if (! function_exists('imagecreatefromstring')) {
            return null;
        }

        $olcu = @getimagesizefromstring($bytes);

        if ($olcu === false || ($olcu[0] * $olcu[1]) > self::MAX_PIXELS) {
            return null;
        }

        $kaynak = @imagecreatefromstring($bytes);

        if ($kaynak === false) {
            return null;
        }

        try {
            $kaynak = $this->uprighted($kaynak, $bytes);

            $en = imagesx($kaynak);
            $boy = imagesy($kaynak);

            if ($en < 1 || $boy < 1) {
                return null;
            }

            // Once hedef orana kirp: merkezden, cunku ilgi genelde ortada.
            if ($en / $boy > $oran) {
                $kirpEn = (int) round($boy * $oran);
                $kirpBoy = $boy;
            } else {
                $kirpEn = $en;
                $kirpBoy = (int) round($en / $oran);
            }

            $x = (int) round(($en - $kirpEn) / 2);
            $y = (int) round(($boy - $kirpBoy) / 2);

            // Kaynak zaten kucukse buyutmuyoruz: buyutmek dosyayi
            // sisiriyor ama goruntuyu iyilestirmiyor.
            $sonEn = max(1, min($genislik, $kirpEn));
            $sonBoy = max(1, (int) round($sonEn / $oran));

            $hedef = imagecreatetruecolor($sonEn, $sonBoy);

            if ($hedef === false) {
                return null;
            }

            try {
                // imagecreatetruecolor SIYAH bir tuval veriyor ve cikti
                // JPEG oldugu icin saydamlik siyaha donuyor. Saydam PNG
                // tam da avatar ve firma logosunda karsimiza cikacak;
                // tuval beyaza boyaniyor.
                $beyaz = imagecolorallocate($hedef, 255, 255, 255);
                imagefilledrectangle($hedef, 0, 0, $sonEn, $sonBoy, $beyaz);

                imagecopyresampled($hedef, $kaynak, 0, 0, $x, $y, $sonEn, $sonBoy, $kirpEn, $kirpBoy);

                ob_start();
                imagejpeg($hedef, null, $kalite);

                return ob_get_clean() ?: null;
            } finally {
                imagedestroy($hedef);
            }
        } finally {
            imagedestroy($kaynak);
        }
    }

    /**
     * EXIF yon etiketini uygular.
     *
     * imagecreatefromstring bu etiketi dikkate almiyor: telefonla dikey
     * cekilmis bir fotograf yan yatmis gorunuyor. Kategori kapaklarinda
     * cikmadi cunku onlar zaten duzgun geliyordu; avatar ve ilan
     * galerisi dogrudan telefondan yukleniyor.
     *
     * @param  \GdImage  $resim
     * @return \GdImage
     */
    private function uprighted($resim, string $bytes)
    {
        if (! function_exists('exif_read_data')) {
            return $resim;
        }

        try {
            // exif_read_data bir akis istiyor; dosyayi diske yazmamak
            // icin bellekten okutuluyor.
            $veri = @exif_read_data('data://image/jpeg;base64,'.base64_encode($bytes));
        } catch (\Throwable) {
            return $resim;
        }

        $yon = (int) ($veri['Orientation'] ?? 0);

        $donmus = match ($yon) {
            3 => imagerotate($resim, 180, 0),
            6 => imagerotate($resim, -90, 0),
            8 => imagerotate($resim, 90, 0),
            default => null,
        };

        if ($donmus === null || $donmus === false) {
            return $resim;
        }

        imagedestroy($resim);

        return $donmus;
    }
}
