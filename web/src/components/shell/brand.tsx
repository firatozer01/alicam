"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";

/**
 * Logonun uzerine bindigi ZEMININ tonu. Aydinlik zeminde lacivert yazili
 * dosya, koyu zeminde (alt bilgi) beyaz yazili dosya basilir.
 */
export type BrandTone = "light" | "dark";

type Branding = { logo: string; logoLight: string; mark: string };

type SiteSettingsResponse = {
  data: {
    /** Yonetim ucu henuz bu alani gondermeyebilir; gomulu dosyalara dusulur. */
    branding?: { logo: string | null; logo_light: string | null; mark: string | null };
  };
};

/**
 * Gomulu varsayilanlar. Yonetici bir gorsel yuklemediyse site bunlarla
 * calisir. Kanca ILK CIZIMDE de bunlari dondugu icin logo hicbir zaman
 * "uc cevap verene kadar bos" kalmaz; yukleme sonrasi yalnizca adres degisir.
 */
const embedded: Branding = { logo: "/logo.png", logoLight: "/logo-light.png", mark: "/mark.png" };

/** Gomulu tam logonun en-boy orani (939x148). */
const logoRatio = 939 / 148;

/**
 * Marka adresleri modul duzeyinde saklanir: ust cubuk ve alt bilgi her
 * sayfada duruyor, her gezinmede yeniden istek atmasinin anlami yok.
 */
let brandingCache: Branding | null = null;

/**
 * Ayni cizimde kanca birden fazla yerde calisiyor (ust cubuk + alt bilgi).
 * Istek modul duzeyinde paylasilmazsa her biri ayri ayri /site-settings
 * okurdu; bu yuzden ucusan istek de saklaniyor.
 */
let brandingPending: Promise<Branding> | null = null;

/** Adresler degisince haberdar edilecek kancalar. */
const dinleyiciler = new Set<(next: Branding) => void>();

function loadBranding(): Promise<Branding> {
  if (!brandingPending) {
    brandingPending = apiRequest<SiteSettingsResponse>("/site-settings")
      .then((response) => {
        const uploaded = response.data.branding;
        // Yalnizca DOLU alanlar varsayilanin yerine gecer: bos ya da null
        // alan "yonetici o gorseli yuklemedi" demek, gomulu dosya kalir.
        const next: Branding = {
          logo: uploaded?.logo || embedded.logo,
          logoLight: uploaded?.logo_light || embedded.logoLight,
          mark: uploaded?.mark || embedded.mark,
        };
        brandingCache = next;
        return next;
      })
      .catch(() => {
        // Uc cevap vermezse gomulu dosyalarla devam edilir. Onbellege
        // yazilmaz ve ucusan istek temizlenir ki sonraki cizim tekrar denesin.
        brandingPending = null;
        return embedded;
      });
  }

  return brandingPending;
}

/**
 * Sitenin marka gorsellerinin adresleri. Yonetim panelinden degistirilebildigi
 * icin sabit degil; gomulu dosyalar yalnizca varsayilan.
 */
export function useBranding(): Branding {
  const [branding, setBranding] = useState<Branding>(() => brandingCache ?? embedded);

  useEffect(() => {
    // Onbellek dolu olsa bile dinleyici baglanir: yonetici panelde bir
    // gorsel degistirdiginde ayni ekrandaki kenar cubugu logosu da yenilensin.
    dinleyiciler.add(setBranding);
    if (!brandingCache) {
      loadBranding().then(setBranding).catch(() => undefined);
    }

    return () => { dinleyiciler.delete(setBranding); };
  }, []);

  return branding;
}

/**
 * Yonetim paneli bir gorsel yukleyip kaldirdiginda cagirir.
 *
 * Onbellek modul duzeyinde oldugu icin yalnizca panelin kendi onizlemesi
 * tazelenir, sayfadaki obur logolar tam yenileme yapilana kadar eski
 * adreste kalirdi: yonetici degisikligin yarim islediğini sanardi.
 */
export function applyBranding(uploaded: { logo: string | null; logo_light: string | null; mark: string | null }): void {
  brandingCache = {
    logo: uploaded.logo || embedded.logo,
    logoLight: uploaded.logo_light || embedded.logoLight,
    mark: uploaded.mark || embedded.mark,
  };

  brandingPending = Promise.resolve(brandingCache);
  dinleyiciler.forEach((bildir) => bildir(brandingCache as Branding));
}

/**
 * Yalnizca el sikisma isareti. Tam logonun sigmadigi dar ekran ve kompakt
 * yerlerde onun yerine basilir; kendi renkleri oldugu icin hem acik hem
 * koyu zeminde calisir. Yazi tasimadigi icin ekran okuyucudan gizlenir.
 */
export function BrandMark({ size = 30 }: { size?: number }) {
  const { mark } = useBranding();

  // next/image kullanilmiyor: yuklenen gorsel /api/... altindan geliyor ve
  // iyilestirici bu yolu cozemiyor (uc "received null" veriyor).
  // eslint-disable-next-line @next/next/no-img-element
  return <img alt="" aria-hidden="true" height={size} src={mark} width={size} />;
}

/**
 * Tam logo: isaret + "alıcam.net" yazisi tek gorselde. Yaziyi gorselin
 * kendisi tasidigi icin yaninda ayrica metin basilmaz, ad alt metninden gelir.
 *
 * Genislik olcuyu gomulu oranla tahmin edilir: dosya inmeden once de yer
 * ayrilsin, cubuk oynamasin. Gercek genislik yuklenince CSS'ten (width: auto)
 * gelir, yani yonetici baska oranda bir logo yuklerse de bozulmaz.
 */
export function BrandLogo({ tone = "light", height = 32, className }: {
  tone?: BrandTone;
  height?: number;
  className?: string;
}) {
  const { logo, logoLight } = useBranding();

  // Olcuyu YUKSEKLIK belirler, genislik oranindan gelir. width/height
  // oznitelikleri yalnizca dosya inmeden once yer ayirmak icin duruyor;
  // stil onlari ezmezse yonetici baska oranda bir logo yukledigi anda
  // gorsel sikisir -- markayi yonetim panelinden degistirebilmenin butun
  // amaci da buydu. Stil satir ici, cunku logo sekiz ayri CSS dosyasindan
  // olceklenen yerlerde basiliyor.
  // eslint-disable-next-line @next/next/no-img-element
  return <img
    alt="alıcam.net"
    className={className}
    height={height}
    src={tone === "dark" ? logoLight : logo}
    // Yukseklik --brand-h'ten okunur, height prop'u YALNIZCA yedek deger.
    // Degisken satir ici TANIMLANAMAZ: satir ici stil, modul CSS'indeki
    // tanimi ezer ve kirilimlar hic islemezdi. Boyle yazilinca CSS degiskeni
    // tanimladiginda o kazanir, tanimlamadiginda prop gecerli kalir.
    // Genislik her zaman auto: logo orani hicbir olcude bozulmaz.
    style={{ height: `var(--brand-h, ${height}px)`, width: "auto" }}
    width={Math.round(height * logoRatio)}
  />;
}
