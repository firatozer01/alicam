"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AccountMenu } from "@/components/account-menu";
import { NavMenuBar, type NavMenuDef } from "@/components/listing/nav-menu";
import { BrandLogo } from "./brand";
import { NotificationBell } from "./notification-bell";
import { useSession, type SessionUser } from "./use-session";
import styles from "./site-header.module.css";

/**
 * Marka gorselleri ortak dosyaya tasindi: alt bilgi de ayni gorselleri
 * kullaniyor ve adresleri yonetim panelinden degisebiliyor. BrandMark
 * eskiden buradan import ediliyordu, kirilmasin diye yeniden disa aktariliyor.
 */
export { BrandMark } from "./brand";

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
      key: "market", title: "PAZARYERİ", icon: "🛒", color: "#1B5CFF", accent: true,
      description: "Açık talepleri incele, teklif ver.",
      items: [
        { key: "talepler", label: "Güncel talepler", icon: "▤", hint: "Filtrele ve karşılaştır", href: "/#talepler" },
        { key: "kategoriler", label: "Kategoriler", icon: "🗂", hint: "Tüm hizmet alanları", href: "/#kategoriler" },
        { key: "yeni", label: "Ücretsiz talep oluştur", icon: "＋", hint: "Birkaç soru, sonra teklifler", badge: "Ücretsiz", tone: "free", href: "/talep-olustur" },
      ],
      footer: { label: "Tüm talepleri gör", href: "/#talepler" },
    },
    // Hizmet veren rehberi kaldirildi: alicilar firma gezmez, yon her
    // zaman talepten teklife dogrudur. Kalan tek baslik hizmet veren
    // OLMAK isteyenler icin.
    {
      key: "sellers", title: "HİZMET VERMEK", icon: "🏬", color: "#0EA5B7",
      description: "Talep al, teklif ver, işini büyüt.",
      items: [
        { key: "satici-ol", label: "Hizmet vermeye başla", icon: "⌂", hint: "Firma bilgilerini ekle, talep al", href: "/satici-ol" },
      ],
      footer: { label: "Başvuruya git", href: "/satici-ol" },
    },
  ],
  quickLinks: [
    { key: "how", label: "Nasıl çalışır", icon: "◷", href: "/#nasil-calisir" },
    { key: "new", label: "Ücretsiz talep oluştur", icon: "＋", href: "/talep-olustur", primary: true },
  ],
};

export type HeaderLink = {
  label: string;
  href: string;
  /** Baglantinin basinda duran emoji; yeni tasarimda dikeyler simgeli. */
  icon?: string;
  /** Dikey kimligi; ana sayfa acilirken hangi sekmenin secili gelecegini belirler. */
  vertical?: string;
};

/**
 * Yeni tasarimin ust menusu: dort dikey, isleyis ve teklif veren cagrisi.
 * Hepsi ana sayfanin ilgili bolumune iner.
 */
const defaultLinks: HeaderLink[] = [
  { label: "Hizmet", href: "/#kategoriler", icon: "🛠️", vertical: "hizmet" },
  { label: "Emlak", href: "/#kategoriler", icon: "🏠", vertical: "emlak" },
  { label: "Vasıta", href: "/#kategoriler", icon: "🚗", vertical: "vasita" },
  { label: "Alışveriş", href: "/#kategoriler", icon: "🛍️", vertical: "alisveris" },
  { label: "Nasıl çalışır?", href: "/#nasil-calisir" },
  { label: "Teklif ver, kazan", href: "/#teklif-ver" },
];

/**
 * Dikey secimi ana sayfaya bu anahtar uzerinden tasinir; statik tasarimdaki
 * sozlesmenin aynisi. Gizli sekmede yazilamayabilir, sessizce gecilir.
 */
function rememberVertical(vertical?: string) {
  if (!vertical) return;
  try { window.sessionStorage.setItem("alicam-v", vertical); } catch { /* depolama kapali */ }
}

/**
 * Tum sayfalarin ortak ust cubugu: ayni yukseklik (72px), ayni marka, ayni
 * sag blok. Sayfaya gore degisen tek sey mega menu icerigi ve istege bagli
 * aksiyonlardir.
 *
 * Gorunum yeni tasarimdan gelir; davranis eskisi gibi oturuma duyarlidir:
 * oturum acmis kullanici avatarini, hesap menusunu, okunmamis rozetini ve
 * kontor sayacini gormeye devam eder. Tasarimla birebir ortusen yalnizca
 * oturumsuz hal.
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
  cta,
  announce,
  minimal,
}: {
  /** Sayfaya ozel mega menuler; verilmezse ortak kesif menusu kullanilir. */
  menus?: NavMenuDef[];
  activeKey?: string;
  links?: HeaderLink[];
  /** Sayfa oturumu zaten okuduysa buradan gecirir; yoksa cubuk kendi okur. */
  user?: SessionUser | null;
  sessionReady?: boolean;
  displayName?: string | null;
  workspace?: "buyer" | "seller" | "admin";
  credits?: number;
  cta?: { label: string; href: string };
  announce?: string;
  /** Sihirbaz ve giris gibi tek isli sayfalarda yalnizca marka ve cikis baglantisi. */
  minimal?: string;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const session = useSession(user === undefined && !minimal);
  const currentUser = user === undefined ? session.user : user;
  const ready = sessionReady === undefined ? session.ready : sessionReady;
  const isSeller = currentUser?.roles.includes("seller") ?? false;
  const action = cta ?? (isSeller
    ? { label: "Gelen talepler", href: "/satici-paneli" }
    : { label: "Talep oluştur", href: "/talep-olustur" });
  const actionPlus = action.href === "/talep-olustur";
  const drawerMenus = menus && menus.length > 0 ? menus : [discoverMenu];

  // Cekmece acikken arka plan kaymasin, Escape kapatsin.
  useEffect(() => {
    if (!drawerOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setDrawerOpen(false); };
    document.addEventListener("keydown", closeOnEscape);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  if (minimal) {
    return <header className={`${styles.bar} ${styles.barMinimal}`}>
      <div className={styles.inner}>
        <Link aria-label="alıcam.net ana sayfa" className={styles.brand} href="/">
          <BrandLogo className={styles.brandFull} />
        </Link>
        <Link className={styles.ghost} href="/">{minimal}</Link>
      </div>
    </header>;
  }

  return <>
    {announce && <div className={styles.announce}>{announce}</div>}
    <header className={styles.bar}>
      <div className={styles.inner}>
        {/* Tam logo 32px yukseklikte ~203px genisliginde ve 600px altinda
            eylem dugmesiyle hamburgerin yanina sigmiyor; orada CSS onu
            kucultuyor (bkz. --brand-h). Isarete dusulmuyor, marka yazisi
            telefonda da gorunsun. */}
        <Link aria-label="alıcam.net ana sayfa" className={styles.brand} href="/">
          <BrandLogo className={styles.brandFull} />
        </Link>

        <nav aria-label="Ana menü" className={styles.nav}>
          <NavMenuBar activeKey={activeKey} menus={drawerMenus}>
            {links.map((link) => <Link
              href={link.href}
              key={link.label}
              onClick={() => rememberVertical(link.vertical)}
            >{link.icon && <i className={styles.navIcon}>{link.icon}</i>}{link.label}</Link>)}
          </NavMenuBar>
        </nav>

        <div className={styles.actions}>
          {typeof credits === "number" && <Link className={styles.credit} href="/kontor-yukle">⚡ {credits} kontör</Link>}
          {/* Favori talepler yalnizca hizmet vereni ilgilendirir. */}
          {ready && isSeller && (
            <Link aria-label="Favori talepler" className={styles.fav} href="/favorilerim" title="Favori talepler">★</Link>
          )}

          {/* Zil yalnizca oturum acmis kullanicida; sayac kendi icinde okunur. */}
          {ready && currentUser && <NotificationBell userId={currentUser.id} />}
          {!ready
            ? <span className={styles.skeleton} />
            : currentUser
              ? <AccountMenu compact displayName={displayName} user={currentUser} workspace={workspace} />
              : <Link className={styles.line} href="/giris">Giriş yap</Link>}
          <Link className={styles.cta} href={action.href}>
            {actionPlus && <span aria-hidden="true">＋</span>}{action.label}
          </Link>

          <button
            aria-controls="site-drawer"
            aria-expanded={drawerOpen}
            aria-label={drawerOpen ? "Menüyü kapat" : "Menüyü aç"}
            className={styles.burger}
            onClick={() => setDrawerOpen((open) => !open)}
            type="button"
          ><span /><span /><span /></button>
        </div>
      </div>
    </header>

    {/* Dar ekranlarda sagdan giren cekmece. Masaustu cubugu gizlendigi icin
        buraya hem duz baglantilar hem de mega menulerin ogeleri duz liste
        olarak iner; boylece hicbir yol kaybolmaz. */}
    {drawerOpen && <button aria-hidden="true" className={styles.scrim} onClick={() => setDrawerOpen(false)} tabIndex={-1} type="button" />}
    <nav
      aria-label="Menü"
      className={`${styles.drawer} ${drawerOpen ? styles.drawerOpen : ""}`}
      id="site-drawer"
    >
      {/* Kapatma dugmesi zorunlu: cekmece ust cubugun UZERINE biniyor, yani
          onu acan hamburger altinda kaliyor. Dugme olmadan menuyu kapatmanin
          tek yolu soldaki dar perde seridine dokunmakti. */}
      <div className={styles.drawerHead}>
        <Link
          aria-label="alıcam.net ana sayfa"
          className={styles.drawerBrand}
          href="/"
          onClick={() => setDrawerOpen(false)}
        ><BrandLogo height={28} /></Link>
        <button
          aria-label="Menüyü kapat"
          className={styles.drawerClose}
          onClick={() => setDrawerOpen(false)}
          type="button"
        >×</button>
      </div>

      {links.map((link) => <Link
        className={styles.drawerLink}
        href={link.href}
        key={link.label}
        onClick={() => { rememberVertical(link.vertical); setDrawerOpen(false); }}
      >{link.icon && <i className={styles.navIcon}>{link.icon}</i>}{link.label}</Link>)}

      {drawerMenus.map((menu) => <div className={styles.drawerGroup} key={menu.key}>
        <h3>{menu.label}</h3>
        {menu.sections.flatMap((section) => section.items).map((item) => item.href
          ? <Link className={styles.drawerLink} href={item.href} key={item.key} onClick={() => setDrawerOpen(false)}>
            <i className={styles.navIcon}>{item.icon}</i>{item.label}
          </Link>
          : null)}
      </div>)}

      <div className={styles.drawerFoot}>
        {ready && !currentUser && <>
          <Link className={styles.drawerSoft} href="/giris" onClick={() => setDrawerOpen(false)}>Giriş yap</Link>
          <Link className={styles.drawerLine} href="/satici-ol" onClick={() => setDrawerOpen(false)}>Teklif veren ol</Link>
        </>}
        <Link className={styles.drawerCta} href={actionPlus ? "/talep-olustur" : action.href} onClick={() => setDrawerOpen(false)}>
          {actionPlus ? "＋ Ücretsiz talep oluştur" : action.label}
        </Link>
      </div>
    </nav>
  </>;
}
