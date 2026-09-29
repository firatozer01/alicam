import type { Metadata } from "next";
import { RequestWizard, type WizardDeepLink } from "./request-wizard";

export const metadata: Metadata = {
  title: "Talep oluştur — alıcam.net",
  description: "Ne istediğini birkaç adımda anlat; ustalar, emlakçılar, galeriler ve satıcılar sana teklif versin. Ücretsiz.",
};

/**
 * Anasayfadaki bulucu buraya sorgu parametreleriyle gelir
 * (tip, hizmet/kategori, islem, oda, il, butce, marka, yil, durum, urun).
 * Hepsi sihirbaza aktarilir; gecerliligini API dogrular.
 */
type RequestPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const KEYS = ["tip", "kategori", "hizmet", "islem", "oda", "il", "butce", "marka", "yil", "durum", "urun", "satici", "taslak"] as const;

export default async function RequestPage({ searchParams }: RequestPageProps) {
  const params = await searchParams;

  const deepLink: WizardDeepLink = {};
  for (const key of KEYS) {
    const raw = params[key];
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (typeof value === "string" && value.trim() !== "") deepLink[key] = value;
  }

  return <RequestWizard deepLink={deepLink} />;
}
