"use client";

import { KURUMSAL_ETIKET, useCompany, type Kurumsal } from "@/components/shell/company";
import styles from "../legal.module.css";

/**
 * Kurumsal kimlik satirlari. Degerler yonetim panelinden geliyor ve uc
 * yalnizca DOLU alanlari donuyor; burada da yalnizca donenler basiliyor,
 * yani "Telefon: —" gibi bos bir satir hic olusmuyor.
 */
const SIRA: (keyof Kurumsal)[] = ["unvan", "adres", "telefon", "eposta", "vergi_dairesi", "vergi_no", "mersis", "kep"];

function deger(alan: keyof Kurumsal, metin: string) {
  if (alan === "eposta") return <a href={`mailto:${metin}`}>{metin}</a>;
  // Telefonu aranabilir yapmak icin bosluk ve noktalama temizleniyor.
  if (alan === "telefon") return <a href={`tel:${metin.replace(/[^\d+]/g, "")}`}>{metin}</a>;
  if (alan === "kep") return <a href={`mailto:${metin}`}>{metin}</a>;

  return metin;
}

export function KurumsalKart() {
  const kurumsal = useCompany();
  const satirlar = SIRA.filter((alan) => kurumsal[alan]);

  if (satirlar.length === 0) return null;

  return <dl className={styles.kurumsal}>
    {satirlar.map((alan) => <div key={alan}>
      <dt>{KURUMSAL_ETIKET[alan]}</dt>
      <dd>{deger(alan, kurumsal[alan] as string)}</dd>
    </div>)}
  </dl>;
}
