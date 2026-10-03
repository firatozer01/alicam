import type { MetadataRoute } from "next";

/**
 * Site haritasi — /sitemap.xml
 *
 * Yalnizca MISAFIRIN gercekten icerik gordugu sayfalar listeleniyor.
 * Arama motoruna girip bos kabuk ya da yonlendirme bulacagi bir adres
 * vermek, haritanin tamamina olan guveni dusurur.
 *
 * Bilerek DISARIDA birakilanlar:
 *  - /satici/[id]  Vitrin herkese acik DEGIL; misafir 404 aliyor
 *                  (api/routes/api.php, /sellers/{user} yorumuna bak).
 *  - /panel, /musteri-panel, /satici-paneli, /kredi-yukle, /odeme/*
 *                  proxy.ts bunlari oturumsuz girişte /giris'e yolluyor.
 *  - /admin/*      yonetim alani.
 *  - /ayarlar, /favorilerim, /mesajlar
 *                  200 donuyorlar ama misafire bos kabuk; iceriklerini
 *                  oturum acildiktan sonra istemci getiriyor.
 *  - /giris        oturum sayfasinin arama sonucunda isi yok.
 */
const KOK = "https://alicam.net";

/**
 * Yasal ve kurumsal metinlerin son degistigi tarih.
 *
 * Her uretimde new Date() yazmak "bugun degisti" demek olurdu; metin
 * yillarca ayni kalacagi icin bu, lastmod bilgisini anlamsizlastirir ve
 * arama motoru bir sure sonra alani dikkate almayi birakir. Metinleri
 * guncelleyen bu tarihi de elle ilerletsin.
 */
const METIN_TARIHI = new Date("2026-10-02");

export default function sitemap(): MetadataRoute.Sitemap {
  // Anasayfa gercekten her gun degisiyor: yeni talepler, populer ve
  // trend seritleri kategori hareketine gore yeniden siralaniyor.
  const bugun = new Date();

  return [
    {
      url: KOK,
      lastModified: bugun,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      // Urunun asil islevi: alici talebini buradan aciyor.
      url: `${KOK}/talep-olustur`,
      lastModified: bugun,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      // Hizmet veren kazanimi.
      url: `${KOK}/satici-ol`,
      lastModified: bugun,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${KOK}/iletisim`,
      lastModified: METIN_TARIHI,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${KOK}/kullanim-kosullari`,
      lastModified: METIN_TARIHI,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${KOK}/gizlilik`,
      lastModified: METIN_TARIHI,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${KOK}/kvkk`,
      lastModified: METIN_TARIHI,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
