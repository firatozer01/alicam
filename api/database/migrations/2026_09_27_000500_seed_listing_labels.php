<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Ilan tarafindaki alan adlari.
     *
     * Mevcut etiketler aliciya sorulan sorular olarak yazilmis:
     * "Kac oda + salon olsun?", "Hangi kasa tipini istiyorsun?". Bir
     * satici kendi dairesini girerken ve alici ilanin ozellik tablosunu
     * okurken bu dil yanlis; orada "Oda Sayisi", "Kasa Tipi" yazmali.
     *
     * Yalnizca en cok kullanilacak kategoriler dolduruluyor; kalanlarda
     * listing_label bos kalir ve label kullanilmaya devam eder. Yonetici
     * paneli bu alani duzenleyebiliyor, yani liste burada donmus degil.
     */
    public function up(): void
    {
        foreach (self::LABELS as $key => $label) {
            DB::table('category_attributes')
                ->where('key', $key)
                // Elle girilmis bir deger varsa ustune yazmiyoruz.
                ->whereNull('listing_label')
                ->update(['listing_label' => $label]);
        }
    }

    public function down(): void
    {
        DB::table('category_attributes')
            ->whereIn('key', array_keys(self::LABELS))
            ->update(['listing_label' => null]);
    }

    private const LABELS = [
        // --- Emlak koku: yalnizca ilana uyanlar. Butce, odeme sekli,
        // aciliyet, tercih edilen semtler, tapu sartlari ve emlakci
        // tercihi ALICI sorularidir; etiketsiz birakildiklari icin
        // ilan formunda hic sorulmazlar.
        'islem_turu' => 'İlan Tipi',

        // --- Vasita koku
        'arac_durumu' => 'Araç Durumu',
        'model_yili_araligi' => 'Model Yılı',
        'marka_model_tercihi' => 'Marka / Model',

        // --- Emlak > Konut
        'konut_oda_sayisi' => 'Oda Sayısı',
        'konut_brut_m2' => 'm² (Brüt)',
        'konut_bina_yasi' => 'Bina Yaşı',
        'konut_bulundugu_kat' => 'Bulunduğu Kat',
        'konut_isitma' => 'Isıtma',
        'konut_esya_durumu' => 'Eşya Durumu',
        'konut_site_tercihi' => 'Site İçinde',
        'konut_banyo_sayisi' => 'Banyo Sayısı',
        'konut_manzara' => 'Manzara',
        'konut_ozellikler' => 'Özellikler',
        'konut_evcil_hayvan' => 'Evcil Hayvan',
        'konut_ek_notlar' => 'Ek Notlar',

        // --- Vasita > Otomobil
        'oto_kasa_tipi' => 'Kasa Tipi',
        'oto_yakit_tipi' => 'Yakıt Tipi',
        'oto_vites_tipi' => 'Vites',
        'oto_kilometre' => 'KM',
        'oto_motor_hacmi' => 'Motor Hacmi',
        'oto_hasar_durumu' => 'Hasar Durumu',
        'oto_kimden' => 'Kimden',
        'oto_renk' => 'Renk',
        'oto_donanim' => 'Donanım',
        'oto_kullanim_amaci' => 'Kullanım Amacı',

        // --- Vasita > Ticari Araclar
        'tic_arac_tipi' => 'Araç Tipi',
        'tic_ust_yapi' => 'Üst Yapı',
        'tic_dingil_cekis' => 'Dingil / Çekiş',
        'tic_tonaj' => 'Tonaj',
        'tic_motor_gucu' => 'Motor Gücü',
        'tic_kilometre' => 'KM',
        'tic_emisyon_sinifi' => 'Emisyon Sınıfı',
        'tic_kabin_tipi' => 'Kabin Tipi',
        'tic_yolcu_kapasitesi' => 'Yolcu Kapasitesi',
        'tic_kullanim_amaci' => 'Kullanım Amacı',
        'tic_muayene_durumu' => 'Muayene Durumu',
        'tic_hasar_durumu' => 'Hasar Durumu',
    ];
};
