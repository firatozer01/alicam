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
