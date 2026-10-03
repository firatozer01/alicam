import type { MetadataRoute } from "next";

/**
 * Tarayici yonergesi — /robots.txt
 *
 * Kapatilan yollar ya oturum gerektiriyor ya da arama sonucunda isi yok.
 * Bunlari kapatmak sunucuyu bos gezinmeden kurtardigi gibi, tarama
 * butcesini anasayfa ve talep akisina birakir.
 *
 * Not: robots.txt gizlilik araci DEGIL, yalnizca tarama yonergesidir.
 * Panellerin asil korumasi proxy.ts'teki oturum kontrolu ve ucun
 * yetkilendirmesi.
 */
const KOK = "https://alicam.net";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        // Yonetim alani.
        "/admin",
        // Oturum gerektiren paneller (proxy.ts /giris'e yolluyor).
        "/panel",
        "/musteri-panel",
        "/satici-paneli",
        "/kredi-yukle",
        "/odeme/",
        // Misafire bos kabuk donen, icerigi oturumdan sonra gelen sayfalar.
        "/ayarlar",
        "/favorilerim",
        "/mesajlar",
        // Vitrin herkese acik degil: misafir 404 aliyor.
        "/satici/",
        // Oturum sayfasinin arama sonucunda isi yok; "devam" parametresiyle
        // sonsuz sayida adres uretiyor.
        "/giris",
      ],
    },
    sitemap: `${KOK}/sitemap.xml`,
    host: KOK,
  };
}
