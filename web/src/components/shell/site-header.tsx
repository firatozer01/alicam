"use client";

import Link from "next/link";
import { AccountMenu } from "@/components/account-menu";
import { NavMenuBar, type NavMenuDef } from "@/components/listing/nav-menu";
import { useSession, type SessionUser } from "./use-session";
import styles from "./site-header.module.css";

export function BrandMark() {
  return <svg aria-hidden="true" className={styles.brandMark} fill="none" viewBox="0 0 30 30">
    <path d="M4 10 L14 4 L14 10 Z" fill="#7C3AED" />
    <path d="M26 20 L16 26 L16 20 Z" fill="#06B6D4" />
    <path d="M14 7 H16 V23 H14 Z" fill="#4F46E5" opacity=".9" />
  </svg>;
}

/**
 * Sayfa kendi menusunu vermediginde gosterilen ortak kesif menusu. Boylece
 * vitrin, rehber ve ayarlar sayfalarinda da cubuk bos kalmaz.
 */
export const discoverMenu: NavMenuDef = {
  key: "kesfet",
  label: "Keşfet",
  panelIcon: "🧭",
  panelTitle: "alıcam.net'te neler var?",
  panelHint: "Talepler, hizmet verenler ve işleyiş tek panelde",
  allLink: { label: "Pazaryerine git", href: "/" },
  sections: [
    {
      key: "market", title: "PAZARYERİ", icon: "🛒", color: "#7C3AED", accent: true,
      description: "Açık talepleri incele, teklif ver.",
      items: [
        { key: "talepler", label: "Güncel talepler", icon: "▤", hint: "Filtrele ve karşılaştır", href: "/#talepler" },
        { key: "kategoriler", label: "Kategoriler", icon: "🗂", hint: "Tüm hizmet alanları", href: "/#kategoriler" },
        { key: "yeni", label: "Ücretsiz talep oluştur", icon: "＋", hint: "Birkaç soru, sonra teklifler", badge: "Ücretsiz", tone: "free", href: "/talep-olustur" },
      ],
      footer: { label: "Tüm talepleri gör", href: "/#talepler" },
    },
    {
      key: "sellers", title: "HİZMET VERENLER", icon: "🏬", color: "#06B6D4",
      description: "Vitrinleri, galerileri ve puanları gör.",
      items: [
        { key: "rehber", label: "Hizmet veren rehberi", icon: "🏬", hint: "Puan, bölge ve uzmanlık filtresi", href: "/hizmet-verenler" },
        { key: "one-cikan", label: "Öne çıkanlar", icon: "★", hint: "Vitrin paketi olan firmalar", badge: "Yeni", tone: "new", href: "/hizmet-verenler?one_cikan=1" },
        { key: "satici-ol", label: "Hizmet vermeye başla", icon: "⌂", hint: "Firma bilgilerini ekle, talep al", href: "/satici-ol" },
      ],
      footer: { label: "Rehberi aç", href: "/hizmet-verenler" },
    },
  ],
  quickLinks: [
    { key: "how", label: "Nasıl çalışır", icon: "◷", href: "/#nasil-calisir" },
    { key: "sellers", label: "Hizmet verenler", icon: "🏬", href: "/hizmet-verenler" },
    { key: "new", label: "Ücretsiz talep oluştur", icon: "＋", href: "/talep-olustur", primary: true },
  ],
};

const defaultLinks = [
  { label: "Ana sayfa", href: "/" },
  { label: "Talepler", href: "/#talepler" },
  { label: "Hizmet verenler", href: "/hizmet-verenler" },
];

/**
 * Tum sayfalarin ortak ust cubugu: ayni yukseklik, ayni marka, ayni sag blok.
 * Sayfaya gore degisen tek sey mega menu icerigi ve istege bagli aksiyonlardir.
 */
export function SiteHeader({
  menus,
  activeKey = "",
  links = defaultLinks,
  user,
  sessionReady,
  displayName,
  workspace,
  credits,
  onBell,
  cta,
  announce,
}: {
  /** Sayfaya ozel mega menuler; verilmezse ortak kesif menusu kullanilir. */
  menus?: NavMenuDef[];
  activeKey?: string;
  links?: { label: string; href: string }[];
  /** Sayfa oturumu zaten okuduysa buradan gecirir; yoksa cubuk kendi okur. */
  user?: SessionUser | null;
  sessionReady?: boolean;
  displayName?: string | null;
  workspace?: "buyer" | "seller" | "admin";
  credits?: number;
  onBell?: () => void;
  cta?: { label: string; href: string };
  announce?: string;
}) {
  const session = useSession(user === undefined);
  const currentUser = user === undefined ? session.user : user;
  const ready = sessionReady === undefined ? session.ready : sessionReady;
  const isSeller = currentUser?.roles.includes("seller") ?? false;
  const action = cta ?? (isSeller
    ? { label: "Gelen talepler", href: "/satici-paneli" }
    : { label: "Ücretsiz talep oluştur", href: "/talep-olustur" });

  return <>
    {announce && <div className={styles.announce}>{announce}</div>}
    <header className={styles.bar}>
      <div className={styles.inner}>
        <Link className={styles.brand} href="/"><BrandMark />alıcam<span>.net</span></Link>

        <nav className={styles.nav}>
          <NavMenuBar activeKey={activeKey} menus={menus && menus.length > 0 ? menus : [discoverMenu]}>
            {links.map((link) => <Link href={link.href} key={link.href}>{link.label}</Link>)}
          </NavMenuBar>
        </nav>

        <div className={styles.actions}>
          {typeof credits === "number" && <Link className={styles.credit} href="/kontor-yukle">⚡ {credits} kontör</Link>}
          {onBell && <button aria-label="Bildirimler" className={styles.bell} onClick={onBell} type="button">🔔<i /></button>}
          {!ready
            ? <span className={styles.skeleton} />
            : currentUser
              ? <AccountMenu compact displayName={displayName} user={currentUser} workspace={workspace} />
              : <Link className={styles.line} href="/giris">Giriş yap</Link>}
          <Link className={styles.cta} href={action.href}>{action.label}</Link>
        </div>
      </div>
    </header>
  </>;
}
