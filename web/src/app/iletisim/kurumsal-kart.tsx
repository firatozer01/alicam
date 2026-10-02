import { KURUMSAL_ETIKET, type Kurumsal } from "@/components/shell/company";
import styles from "../legal.module.css";

/**
 * Kurumsal kimlik satirlari.
 *
 * Degerler SUNUCUDA okunup prop olarak geliyor (lib/company-server):
 * unvan, adres ve vergi bilgisi bu iki sayfanin asil icerigi, HTML'de
 * bulunmasi gerekiyor. Uc yalnizca DOLU alanlari donuyor, burada da
 * yalnizca donenler basiliyor; yani "Telefon: —" gibi bos bir satir hic
 * olusmuyor ve uydurma bir deger de yayinlanmiyor.
 */
const SIRA: (keyof Kurumsal)[] = ["unvan", "adres", "telefon", "eposta", "vergi_dairesi", "vergi_no", "mersis", "kep"];

function deger(alan: keyof Kurumsal, metin: string) {
  if (alan === "eposta" || alan === "kep") return <a href={`mailto:${metin}`}>{metin}</a>;
  // Telefonu aranabilir yapmak icin bosluk ve noktalama temizleniyor.
  if (alan === "telefon") return <a href={`tel:${metin.replace(/[^\d+]/g, "")}`}>{metin}</a>;

  return metin;
}

export function KurumsalKart({ kurumsal }: { kurumsal: Kurumsal }) {
  const satirlar = SIRA.filter((alan) => kurumsal[alan]);

  if (satirlar.length === 0) return null;

  return <dl className={styles.kurumsal}>
    {satirlar.map((alan) => <div key={alan}>
      <dt>{KURUMSAL_ETIKET[alan]}</dt>
      <dd>{deger(alan, kurumsal[alan] as string)}</dd>
    </div>)}
  </dl>;
}
