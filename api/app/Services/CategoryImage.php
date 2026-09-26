<?php

namespace App\Services;

use Illuminate\Support\Facades\Storage;

/**
 * Kategori kapak fotograflarini kart olcusune indirger.
 *
 * Iki yerden cagriliyor: Commons'tan indirilen dosyalar ve yoneticinin
 * panelden yukledigi dosyalar. Ikisi de ayni boyuttan gecsin ki anasayfa
 * yukunun ne oldugu tek bir sabite baksin.
 *
 * Next.js gorsel iyilestiricisi bu dosyalara ulasamiyor: yol
 * /api/category-images/... uzerinden bir rewrite ile Laravel'e gidiyor ve
 * iyilestirici rewrite'i cozmuyor. Kucultme bu yuzden yazma aninda,
 * sunucuda yapiliyor.
 */
class CategoryImage
{
    private const DISK = 'local';

    /** Kart ekranda ~260 css px; 2x ekranlar icin bu yeterli. */
    public const WIDTH = 640;

    /** Kart 16/10; daha uzun gorseller bu orana kirpilir. */
    public const RATIO = 1.6;

    private const QUALITY = 82;

    /**
     * Ham baytlari kucultup diske yazar ve yolu doner.
     *
     * Cozulemeyen dosyada ham hali yazilir: bir kapak ugruna islemi
     * bastan bosa dusurmenin anlami yok, gorsel yine de gosterilebilir.
     */
    public function store(string $bytes, int $categoryId): string
    {
        $yol = "category-images/{$categoryId}.jpg";

        Storage::disk(self::DISK)->put($yol, $this->normalize($bytes) ?? $bytes);

        return $yol;
    }

    /**
     * Kirpip olceklendirip JPEG olarak kodlar.
     *
     * @return string|null cozulemezse null
     */
    public function normalize(string $bytes): ?string
    {
        if (! function_exists('imagecreatefromstring')) {
            return null;
        }

        $kaynak = @imagecreatefromstring($bytes);

        if ($kaynak === false) {
            return null;
        }

        try {
            $en = imagesx($kaynak);
            $boy = imagesy($kaynak);

            if ($en < 1 || $boy < 1) {
                return null;
            }

            // Once 16/10'a kirp: merkezden, yani ilgi genelde ortada.
            $hedefOran = self::RATIO;
            $oran = $en / $boy;

            if ($oran > $hedefOran) {
                $kirpEn = (int) round($boy * $hedefOran);
                $kirpBoy = $boy;
            } else {
                $kirpEn = $en;
                $kirpBoy = (int) round($en / $hedefOran);
            }

            $x = (int) round(($en - $kirpEn) / 2);
            $y = (int) round(($boy - $kirpBoy) / 2);

            // Kaynak zaten kucukse buyutmuyoruz: buyutmek dosyayi
            // sisiriyor ama goruntuyu iyilestirmiyor.
            $sonEn = min(self::WIDTH, $kirpEn);
            $sonBoy = (int) round($sonEn / $hedefOran);

            $hedef = imagecreatetruecolor($sonEn, $sonBoy);

            if ($hedef === false) {
                return null;
            }

            try {
                imagecopyresampled($hedef, $kaynak, 0, 0, $x, $y, $sonEn, $sonBoy, $kirpEn, $kirpBoy);

                ob_start();
                imagejpeg($hedef, null, self::QUALITY);

                return ob_get_clean() ?: null;
            } finally {
                imagedestroy($hedef);
            }
        } finally {
            imagedestroy($kaynak);
        }
    }
}
