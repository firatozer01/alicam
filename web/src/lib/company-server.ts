import type { Kurumsal } from "@/components/shell/company";

/**
 * Kurumsal kimlik alanlarini SUNUCUDA okur.
 *
 * Iletisim sayfasi ve KVKK aydinlatma metni icin bu onemli: unvan, adres
 * ve vergi bilgisi sayfanin ASIL icerigi. Istemciden cekilirse HTML'de
 * bulunmaz, yani arama motoru ve metni kaydeden/yazdiran kullanici boş
 * bir blok gorur.
 *
 * Tarayici /api/... adresini next.config'teki rewrite ile cozuyor; sunucu
 * tarafinda o rewrite yok, bu yuzden ucun kendisine gidiliyor.
 */
const UC = process.env.API_PROXY_TARGET ?? "http://127.0.0.1:8091";

export async function kurumsalOku(): Promise<Kurumsal> {
  try {
    const cevap = await fetch(`${UC}/api/site-settings`, {
      headers: { Accept: "application/json" },
      // Ayarlar panelden degisiyor; bir dakikalik tazelik yeterli ve
      // her istekte uca gitmeyi engelliyor.
      next: { revalidate: 60 },
    });

    if (!cevap.ok) return {};

    const govde = await cevap.json() as { data?: { company?: Kurumsal } };

    return govde.data?.company ?? {};
  } catch {
    // Uc cevap vermezse sayfa kurumsal bloku basmaz ama geri kalani
    // okunur kalir; yasal metnin kendisi sayfanin icinde zaten duruyor.
    return {};
  }
}
