"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { SiteHeader } from "@/components/shell/site-header";
import { apiRequest } from "@/lib/api";
import styles from "./marketplace.module.css";

type CurrentUser = { id: number; name: string; email: string; roles: string[] };

type ServiceCard = {
  id: number;
  slug: string;
  name: string;
  icon: string;
  color: string;
  root: { slug: string; name: string };
  leaf_samples: string[];
  child_count: number;
  request_count: number;
  badge: string | null;
};

type ServiceGroup = {
  id: number;
  slug: string;
  name: string;
  icon: string;
  color: string;
  child_count: number;
  children: { id: number; slug: string; name: string; icon: string }[];
};

type Catalog = {
  data: {
    popular: ServiceCard[];
    trending: { mode: "trend" | "seasonal"; window_days: number; items: ServiceCard[] };
    groups: ServiceGroup[];
    listing_roots: { id: number; slug: string; name: string; icon: string; color: string }[];
    stats: { service_roots: number; service_headings: number; cities: number; districts: number };
  };
};

type Suggestion = { id: number; slug: string; name: string; kind: string; path: string[] };

/** Aramasiz da calissin diye gomulu hizli baslangiclar. */
const QUICK_CHIPS = [
  "Ev ve Daire Temizliği", "Evden Eve Nakliyat", "Boya, Badana ve Sıva",
  "Kombi, Doğalgaz ve Isıtma Sistemleri", "Klima Hizmetleri", "Özel Ders ve Eğitim",
];

const talepLinki = (slug: string) => `/talep-olustur?kategori=${encodeURIComponent(slug)}`;

function BrandMark() {
  return <svg aria-hidden="true" className={styles.brandMark} viewBox="0 0 30 30" fill="none"><path d="M4 10 L14 4 L14 10 Z" fill="#7C3AED" /><path d="M26 20 L16 26 L16 20 Z" fill="#06B6D4" /><path d="M14 7 H16 V23 H14 Z" fill="#4F46E5" opacity=".9" /></svg>;
}

/**
 * Anasayfa: bir talep akisi degil, bir HIZMET KATALOGU.
 *
 * Ziyaretci firma aramaz, ihtiyaci olan hizmeti secer ve talep sihirbazina
 * duser; teklifler ona gelir. Talepler saticinin panelinde, kendi kategori
 * ve bolgesine gore filtreli durur.
 */
export function MarketplaceHome() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [catalog, setCatalog] = useState<Catalog["data"] | null>(null);
  const [term, setTerm] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [openGroup, setOpenGroup] = useState<number | null>(null);
  const [extraChildren, setExtraChildren] = useState<Record<number, ServiceGroup["children"]>>({});
  const searchRef = useRef<HTMLDivElement>(null);

  const isSeller = user?.roles.includes("seller") ?? false;
  const sellerHref = isSeller ? "/satici-paneli" : "/satici-ol";
  const sellerLabel = isSeller ? "Gelen taleplere git" : "Hizmet veren ol";
  const panelHref = isSeller ? "/satici-paneli" : "/musteri-panel";
  const panelLabel = isSeller ? "Satıcı paneli" : "Alıcı paneli";

  useEffect(() => {
    let active = true;
    apiRequest<{ data: CurrentUser }>("/me")
      .then((response) => { if (active) setUser(response.data); })
      .catch(() => undefined)
      .finally(() => { if (active) setSessionReady(true); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    apiRequest<Catalog>("/service-catalog")
      .then((response) => { if (active) setCatalog(response.data); })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  // Oneri listesi: yazarken 180 ms bekler, iki karakterden kisa sorgu atmaz.
  useEffect(() => {
    const aranan = term.trim();
    if (aranan.length < 2) {
      return;
    }

    let active = true;
    const timer = window.setTimeout(() => {
      apiRequest<{ data: Suggestion[] }>(
        `/categories/search?q=${encodeURIComponent(aranan)}&kind=service&limit=8`,
      )
        .then((response) => { if (active) setSuggestions(response.data); })
        .catch(() => undefined);
    }, 180);

    return () => { active = false; window.clearTimeout(timer); };
  }, [term]);

  // Disari tiklayinca oneriler kapansin.
  useEffect(() => {
    const onDown = (event: MouseEvent) => {
      if (!searchRef.current?.contains(event.target as Node)) setSuggestions([]);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    const ilk = suggestions[0];
    if (ilk) {
      window.location.href = talepLinki(ilk.slug);
      return;
    }
    document.getElementById("hizmetler")?.scrollIntoView({ behavior: "smooth" });
  };

  /** Panelin kalan alt basliklarini ilk acilista getirir. */
  const toggleGroup = (group: ServiceGroup) => {
    const acilacak = openGroup === group.id ? null : group.id;
    setOpenGroup(acilacak);

    if (acilacak === null || extraChildren[group.id]) return;

    apiRequest<{ data: ServiceGroup["children"] }>(`/categories?parent=${group.slug}`)
      .then((response) => setExtraChildren((current) => ({ ...current, [group.id]: response.data })))
      .catch(() => undefined);
  };

  const stats = catalog?.stats ?? { service_roots: 0, service_headings: 0, cities: 0, districts: 0 };
  const trend = catalog?.trending;

  return <main className={styles.page}>
    <SiteHeader
      announce="⚡ İhtiyacını yaz, teklifler sana gelsin — alıcı için tamamen ücretsiz."
      cta={isSeller ? { label: "Gelen talepler", href: "/satici-paneli" } : { label: "Ücretsiz talep oluştur", href: "/talep-olustur" }}
      links={[
        { label: "Nasıl çalışır", href: "/#nasil-calisir" },
        { label: "Hizmet verenler için", href: "/#hizmet-veren" },
      ]}
      sessionReady={sessionReady}
      user={user}
    />

    <header className={styles.hero}>
      <div className={styles.aurora}><i className={styles.blobOne} /><i className={styles.blobTwo} /></div>
      <div className={styles.floatChips}>
        {(catalog?.popular ?? []).slice(0, 4).map((item, index) => (
          <span key={item.id} style={{ "--delay": `${index * 2}s` } as React.CSSProperties}>
            <i style={{ background: item.color }}>{item.icon}</i>{item.name}
          </span>
        ))}
      </div>

      <div className={styles.wrap}>
        <div className={styles.eyebrow}><i /> Aramak yok, beklemek yok</div>
        <h1>İhtiyacın olan hizmeti seç,<br /><em>teklifler sana gelsin.</em></h1>
        <p>İşi tarif et; uygun ustalar ve firmalar sana teklif göndersin. Alıcı için 0 ₺.</p>

        <div className={styles.searchBox} ref={searchRef}>
          <form onSubmit={submitSearch}>
            <input
              autoComplete="off"
              onChange={(event) => setTerm(event.target.value)}
              placeholder="Hangi hizmete ihtiyacın var? Örn. ev temizliği, klima montajı, İngilizce ders"
              value={term}
            />
            <button className={styles.buttonGrad} type="submit">Hizmet bul →</button>
          </form>

          {suggestions.length > 0 && (
            <ul className={styles.suggestions}>
              {suggestions.map((item) => (
                <li key={item.id}>
                  <Link href={talepLinki(item.slug)} onClick={() => setSuggestions([])}>
                    <strong>{item.name}</strong>
                    {item.path.length > 0 && <small>{item.path.join(" › ")}</small>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={styles.quickChips}>
          {(catalog?.popular ?? []).slice(0, 6).map((item) => (
            <Link href={talepLinki(item.slug)} key={item.id}>{item.icon} {item.name}</Link>
          ))}
          {!catalog && QUICK_CHIPS.map((ad) => <span className={styles.chipSkeleton} key={ad}>{ad}</span>)}
        </div>
      </div>
    </header>

    <section className={styles.statsBand}>
      <div className={styles.wrap}>
        <div><strong>{stats.service_headings}</strong><span>hizmet başlığı</span></div>
        <div><strong>{stats.service_roots}</strong><span>hizmet alanı</span></div>
        <div><strong>{stats.cities}</strong><span>ilde hizmet</span></div>
        <div><strong>0 ₺</strong><span>alıcıdan alınan ücret</span></div>
      </div>
    </section>

    <section className={styles.serviceSection} id="populer">
      <div className={styles.wrap}>
        <header className={styles.sectionHead}>
          <span>EN ÇOK ARANANLAR</span>
          <h2>Popüler hizmetler</h2>
          <p>Seç, birkaç soruyu yanıtla; teklifler gelsin.</p>
        </header>

        <div className={styles.serviceGrid}>
          {(catalog?.popular ?? []).map((item) => (
            <Link className={styles.serviceCard} href={talepLinki(item.slug)} key={item.id}>
              <span className={styles.serviceIcon} style={{ background: `${item.color}1f` }}>{item.icon}</span>
              <strong>{item.name}</strong>
              {item.leaf_samples.length > 0 && (
                <small className={styles.serviceLeaves}>{item.leaf_samples.join(" · ")}</small>
              )}
              <em>Ücretsiz teklif al →</em>
            </Link>
          ))}
          {!catalog && Array.from({ length: 12 }, (_, i) => <span className={styles.cardSkeleton} key={i} />)}
        </div>
      </div>
    </section>

    {trend && trend.items.length > 0 && (
      <section className={styles.trendSection}>
        <div className={styles.wrap}>
          <header className={styles.sectionHead}>
            <span>HAREKETLİ BAŞLIKLAR</span>
            <h2>{trend.mode === "trend" ? "Bu hafta trendde" : "Bu aralar aranan işler"}</h2>
            <p>{trend.mode === "trend"
              ? "Son iki haftada belirgin şekilde daha çok talep alan başlıklar."
              : "Mevsimine göre en çok sorulan işler."}</p>
          </header>

          <div className={styles.trendStrip}>
            {trend.items.map((item) => (
              <Link className={styles.trendCard} href={talepLinki(item.slug)} key={item.id}>
                <span style={{ background: `${item.color}1f` }}>{item.icon}</span>
                <div>
                  <strong>{item.name}</strong>
                  <small>{item.root.name}</small>
                </div>
                {item.badge && <b>{item.badge === "rising" ? "↑ bu hafta" : item.badge}</b>}
              </Link>
            ))}
          </div>
        </div>
      </section>
    )}

    <section className={styles.groupSection} id="hizmetler">
      <div className={styles.wrap}>
        <header className={styles.sectionHead}>
          <span>TÜM HİZMETLER</span>
          <h2>Aradığın her iş için bir başlık var.</h2>
          <p>{stats.service_roots} alan, {stats.service_headings} başlık. Başlığı seç, talebini oluştur.</p>
        </header>

        <div className={styles.groupGrid}>
          {(catalog?.groups ?? []).map((group) => {
            const acik = openGroup === group.id;
            const cocuklar = acik ? (extraChildren[group.id] ?? group.children) : group.children;

            return <article className={styles.groupPanel} key={group.id}>
              <header>
                <i style={{ background: `${group.color}1f` }}>{group.icon}</i>
                <div>
                  <strong>{group.name}</strong>
                  <small>{group.child_count} başlık</small>
                </div>
              </header>

              <ul>
                {cocuklar.map((child) => (
                  <li key={child.id}>
                    <Link href={talepLinki(child.slug)}>{child.icon} {child.name}</Link>
                  </li>
                ))}
              </ul>

              {group.child_count > group.children.length && (
                <button onClick={() => toggleGroup(group)} type="button">
                  {acik ? "Daha az göster" : `Tümünü gör (${group.child_count})`}
                </button>
              )}
            </article>;
          })}
          {!catalog && Array.from({ length: 6 }, (_, i) => <span className={styles.panelSkeleton} key={i} />)}
        </div>
      </div>
    </section>

    {(catalog?.listing_roots.length ?? 0) > 0 && (
      <section className={styles.listingSection}>
        <div className={styles.wrap}>
          <header className={styles.sectionHead}>
            <span>ÜRÜN VE İLAN</span>
            <h2>Hizmet değil, ürün mü arıyorsun?</h2>
          </header>
          <div className={styles.listingStrip}>
            {(catalog?.listing_roots ?? []).map((item) => (
              <Link href={talepLinki(item.slug)} key={item.id}>
                <i style={{ background: `${item.color}1f` }}>{item.icon}</i>{item.name}
              </Link>
            ))}
          </div>
        </div>
      </section>
    )}

    <section className={styles.how} id="nasil-calisir"><div className={styles.wrap}><header className={styles.sectionHead}><span>SÜREÇ</span><h2>Üç adımda teklif almaya başla.</h2></header><div className={styles.howGrid}><article><i>01</i><h3>Hizmetini seç</h3><p>İhtiyacın olan başlığı seç, birkaç soruyu yanıtla, bütçeni ve konumunu yaz. Ücretsiz.</p></article><article><i>02</i><h3>Uygun ustalar görsün</h3><p>Talebin, o kategoride ve bölgende çalışan doğrulanmış hizmet verenlere düşer.</p></article><article><i>03</i><h3>Teklifleri karşılaştır</h3><p>Fiyatı, kapsamı ve hizmet vereni tek ekrandan karşılaştırıp karar ver.</p></article></div></div></section>

    <section className={styles.sellerBand} id="hizmet-veren"><div className={styles.aurora}><i className={styles.blobOne} /><i className={styles.blobTwo} /></div><div className={styles.wrap}><div><span>HİZMET VERENLER İÇİN</span><h2>Müşteriyi arama, gelen talebe teklif ver.</h2><ul><li><i>01</i><div><strong>Ücretsiz üye ol, firmanı tanıt</strong><p>Firma bilgilerini ve hizmet verdiğin kategorileri ekle.</p></div></li><li><i>02</i><div><strong>Şehir ve ilçeni seç</strong><p>Yalnızca hizmet verdiğin bölgelerdeki talepleri görürsün; ikisi de zorunludur.</p></div></li><li><i>03</i><div><strong>Uygun talebe teklif ver</strong><p>Kontör yalnızca talebin detayını açarken düşer; teklif göndermek ek ücret istemez.</p></div></li></ul><Link className={styles.buttonGrad} href={sellerHref}>{sellerLabel} →</Link></div><aside><span>NASIL İŞLER</span>{(catalog?.groups ?? []).slice(0, 6).map((item) => <p key={item.id}><b>{item.icon} {item.name}</b><strong>{item.child_count} başlık</strong></p>)}</aside></div></section>

    <section className={styles.cta}><div className={styles.wrap}><h2>Aradığını bulmak için beklemeyi bırak.</h2><Link href={isSeller ? "/satici-paneli" : "/talep-olustur"}>{isSeller ? "Gelen talepleri aç" : "Hemen talep oluştur"}</Link></div></section>

    <footer className={styles.footer}><div className={styles.wrap}><section><Link className={styles.brand} href="/"><BrandMark />alıcam<span>.net</span></Link><p>Talep tabanlı pazaryeri. Sen iste, onlar teklif etsin.</p></section><nav><strong>Keşfet</strong><a href="#populer">Popüler hizmetler</a><a href="#hizmetler">Tüm hizmetler</a></nav><nav><strong>Hizmet veren</strong><Link href={sellerHref}>{sellerLabel}</Link><Link href="/kontor-yukle">Kontör paketleri</Link></nav><nav><strong>Hesabın</strong>{user ? <Link href={panelHref}>{panelLabel}</Link> : <Link href="/giris">Giriş yap</Link>}<Link href="/talep-olustur">Talep oluştur</Link></nav><small>© 2026 alıcam.net</small></div></footer>
  </main>;
}
