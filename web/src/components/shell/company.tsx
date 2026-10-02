"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";

/**
 * Kurumsal kimlik alanlari. Yonetim panelinden degistirilebildigi icin
 * sabit degil; uc yalnizca DOLU alanlari donuyor, yani burada eksik bir
 * anahtar "yonetici doldurmadi" demek ve o satir hic basilmiyor.
 *
 * Uydurma adres/vergi numarasi yayinlamamak icin bilerek boyle: eksikse
 * yanlis bir sey gostermektense hic gostermiyoruz.
 */
export type Kurumsal = Partial<Record<
  "unvan" | "adres" | "telefon" | "eposta" | "mersis" | "vergi_dairesi" | "vergi_no" | "kep",
  string
>>;

type SiteSettingsResponse = { data: { company?: Kurumsal } };

/**
 * Ayni cizimde birden fazla yerde kullanilabiliyor (iletisim sayfasi,
 * aydinlatma metni). Istek ve sonuc modul duzeyinde paylasiliyor ki her
 * biri ayri ayri /site-settings okumasin.
 */
let onbellek: Kurumsal | null = null;
let ucusan: Promise<Kurumsal> | null = null;

function yukle(): Promise<Kurumsal> {
  if (!ucusan) {
    ucusan = apiRequest<SiteSettingsResponse>("/site-settings")
      .then((response) => {
        onbellek = response.data.company ?? {};
        return onbellek;
      })
      .catch(() => {
        // Uc cevap vermezse bos donuyoruz; sayfa kurumsal bloku basmaz
        // ama geri kalani okunur kalir. Onbellege yazilmiyor ki sonraki
        // cizim tekrar denesin.
        ucusan = null;
        return {};
      });
  }

  return ucusan;
}

export function useCompany(): Kurumsal {
  const [kurumsal, setKurumsal] = useState<Kurumsal>(() => onbellek ?? {});

  useEffect(() => {
    if (onbellek) return;
    let acik = true;
    yukle().then((gelen) => { if (acik) setKurumsal(gelen); }).catch(() => undefined);

    return () => { acik = false; };
  }, []);

  return kurumsal;
}

/** Alan adlarinin ekranda gorunen karsiliklari. */
export const KURUMSAL_ETIKET: Record<keyof Kurumsal, string> = {
  unvan: "Unvan",
  adres: "Adres",
  telefon: "Telefon",
  eposta: "E-posta",
  mersis: "MERSİS no",
  vergi_dairesi: "Vergi dairesi",
  vergi_no: "Vergi no",
  kep: "KEP adresi",
};
