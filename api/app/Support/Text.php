<?php

namespace App\Support;

class Text
{
    /**
     * Kullanicinin girdigi adi gosterime hazirlar.
     *
     * Ad serbest metindir ve hem arayuzde hem e-posta KONU satirinda
     * kullaniliyor. Satir sonlari her durumda atilir (konu satirina satir
     * sonu koymak baslik enjeksiyonu yuzeyidir); kilitli baglamda ayrica
     * kisaltilir, yoksa mesajin kendisi adin icine yazilip odenmeden
     * ulastirilabilir.
     */
    /**
     * Serbest metinden iletisim kanallarini temizler.
     *
     * Talep basligi ve aciklamasi alicinin yazdigi metindir ve oraya
     * telefon, e-posta ya da bir baglanti yazilabiliyor. Bu metin iki
     * yerde disari cikiyor: kontor odemis saticiya ve HERKESE ACIK
     * pazaryeri akisina. Ikisinde de ayni temizlikten gecmeli; aksi
     * halde satici odeyip gizlenmis halini gorurken ayni numara
     * anasayfada yayinda olur.
     */
    public static function redactContacts(string $deger): string
    {
        $duz = trim(strip_tags($deger));

        $duz = preg_replace('/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/u', '[e-posta gizlendi]', $duz) ?? $duz;
        $duz = preg_replace('/(?:https?:\/\/|www\.)\S+/iu', '[bağlantı gizlendi]', $duz) ?? $duz;

        return preg_replace(
            '/(?<!\d)(?:(?:\+?90|0)[\s().-]*)?[2-5]\d{2}(?:[\s().-]*\d){7}(?!\d)/u',
            '[telefon gizlendi]',
            $duz,
        ) ?? $duz;
    }

    public static function safeName(?string $name, bool $full = true): string
    {
        $temiz = trim(preg_replace('/\s+/u', ' ', (string) $name) ?? '');

        if ($temiz === '') {
            return 'Hesap';
        }

        if ($full) {
            return $temiz;
        }

        // Kilitli baglamda ad "Ahmet Y." bicimine indirilir. Duz kisaltma
        // yetmiyordu: yirmi dort karaktere bir telefon numarasi rahat sigar
        // ve ad, odenmeden mesaj ulastirmanin kanali haline gelirdi.
        $parcalar = explode(' ', $temiz);
        $ilk = mb_substr($parcalar[0], 0, 16);

        return count($parcalar) > 1
            ? $ilk.' '.mb_strtoupper(mb_substr($parcalar[1], 0, 1), 'UTF-8').'.'
            : $ilk;
    }
}
