"use client";

import Link from "next/link";
import { BrandLogo } from "@/components/shell/brand";

/**
 * Yonetim panelinin kenar cubugu.
 *
 * Bu blok bes admin sayfasinda ayri ayri kopyalanmisti ve zamanla ayristi:
 * anasayfa ve ayarlar ekranlarinda kullanici bloku hic yoktu, "Kategoriler"
 * rozetini yalnizca kategori sayfasi basiyordu, bos rozet kabugu ise sifir
 * deger geldiginde bile ciziliyordu. Tek yerden basilinca hem bu farklar
 * kapaniyor hem de yeni bir admin sayfasi eklerken menuyu bes dosyada
 * guncelleme zorunlulugu kalkiyor.
 */

/** Menude hangi satirin isaretlenecegi. Serbest metin yerine birlik kume. */
export type AdminNavKey = "genel" | "anasayfa" | "kategoriler" | "kredi-paketleri" | "satici-onaylari" | "ayarlar";

/**
 * Kullanici blokunun ihtiyaci olan asgari alanlar. Sayfalarin kendi kullanici
 * tipleri (roles vb.) bunu yapisal olarak karsilar.
 */
export type AdminSidebarUser = { name: string; email: string };

const NAV: { key: AdminNavKey; href: string; icon: string; label: string }[] = [
  { key: "genel", href: "/admin", icon: "◇", label: "Genel bakış" },
  { key: "anasayfa", href: "/admin/anasayfa", icon: "▤", label: "Anasayfa" },
  { key: "kategoriler", href: "/admin/kategoriler", icon: "▦", label: "Kategoriler" },
  { key: "kredi-paketleri", href: "/admin/kredi-paketleri", icon: "₺", label: "Kredi paketleri" },
  { key: "satici-onaylari", href: "/admin/satici-onaylari", icon: "✓", label: "Satıcı onayları" },
  { key: "ayarlar", href: "/admin/ayarlar", icon: "⚙", label: "Ayarlar" },
];

export function AdminSidebar({ active, pendingSellers, user }: {
  active: AdminNavKey;
  /** Satici onaylari rozeti. Verilmezse ya da sifirsa rozet hic cizilmez. */
  pendingSellers?: number;
  /** Oturumdaki yonetici. Sayfa veriyi henuz almadiysa null gecilebilir. */
  user?: AdminSidebarUser | null;
}) {
  return <aside className="admin-sidebar">
    <Link aria-label="alıcam.net ana sayfa" className="brand admin-brand" href="/"><BrandLogo /></Link>
    <div className="admin-product"><span>YÖNETİM MERKEZİ</span><strong>Operasyon</strong></div>
    <nav>
      {NAV.map((item) => (
        <Link className={item.key === active ? "active" : undefined} href={item.href} key={item.key}>
          <i>{item.icon}</i> {item.label}
          {item.key === "satici-onaylari" && Boolean(pendingSellers) && <b>{pendingSellers}</b>}
        </Link>
      ))}
    </nav>
    <div className="admin-account">
      <span>{user?.name.slice(0, 2).toLocaleUpperCase("tr-TR") ?? "AD"}</span>
      <p><strong>{user?.name ?? "Yönetici"}</strong><small>{user?.email ?? "Oturum doğrulanıyor"}</small></p>
    </div>
  </aside>;
}
