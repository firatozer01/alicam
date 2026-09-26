<?php

return [
    /*
     * Trend sinyali yetersizken serit bos kalmasin diye gosterilecek
     * mevsimsel hizmet basliklari. Ay numarasi => kategori slug listesi.
     *
     * Burada olmayan aylarda ya da eslesmeyen slug'larda katalog kendi
     * sirasina duser; liste bir tercih, zorunluluk degil.
     */
    'seasonal' => [
        1 => ['kombi-ve-petek-hizmetleri', 'ic-mekan-boya-badana'],
        2 => ['kombi-ve-petek-hizmetleri', 'elektrik-tesisati'],
        3 => ['bahce-ve-peyzaj', 'genel-temizlik'],
        4 => ['bahce-ve-peyzaj', 'evden-eve-nakliyat'],
        5 => ['klima-hizmetleri', 'evden-eve-nakliyat'],
        6 => ['klima-hizmetleri', 'dugun-organizasyon'],
        7 => ['klima-hizmetleri', 'havuz-bakimi'],
        8 => ['evden-eve-nakliyat', 'ozel-ders'],
        9 => ['ozel-ders', 'evden-eve-nakliyat'],
        10 => ['kombi-ve-petek-hizmetleri', 'ic-mekan-boya-badana'],
        11 => ['kombi-ve-petek-hizmetleri', 'genel-temizlik'],
        12 => ['genel-temizlik', 'ic-mekan-boya-badana'],
    ],
];
