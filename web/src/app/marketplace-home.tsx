"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { SiteHeader } from "@/components/shell/site-header";
import { apiRequest } from "@/lib/api";
import { CategoryPanel } from "./(home)/category-panel";
import { FaqSection } from "./(home)/faq-section";
import { HeroFinder } from "./(home)/hero-finder";
import { HeroVisual } from "./(home)/hero-visual";
import { LiveFeed } from "./(home)/live-feed";
import { TrustBento } from "./(home)/trust-bento";
import {
  Catalog, CatalogChild, City, CurrentUser, PRO_EXAMPLES, PRO_WHO_IDS, VERTICALS, talepUrl,
} from "./(home)/home-data";
import styles from "./marketplace.module.css";

const TRUST = [
  { emoji: "🔒", title: "Numaran gizli", hint: "Sen izin vermeden kimse göremez" },
  { emoji: "✅", title: "Onaylı teklif verenler", hint: "Her hesap tek tek incelenir" },
  { emoji: "📍", title: "Sadece bölgendekiler", hint: "Talebin yakınındakilere düşer" },
  { emoji: "⚖️", title: "Tek ekranda karşılaştır", hint: "Fiyat, puan, yorum yan yana" },
];

const KONTOR = [
  { step: "1", title: "Talep özetini gör", hint: "Kategori, ilçe, bütçe ve kısa açıklama", tag: "Ücretsiz", free: true },
  { step: "2", title: "Detayı aç", hint: "Maliyet, açmadan önce gösterilir", tag: "Kontör", free: false },
  { step: "3", title: "Teklif gönder, güncelle", hint: "Aynı talebi tekrar açmak da ücretsiz", tag: "Ücretsiz", free: true },
  { step: "★", title: "Öne çık (isteğe bağlı)", hint: "7, 14 veya 30 gün vitrinde yer al", tag: "Kontör", free: false },
];

/**
 * Ana sayfa — alicam-yeni-tasarim/index.html portu.
 *
 * Tek bir istemci bileseni; katalog, il listesi ve oturum acilista bir kez
 * cekilir, geri kalan her sey bunlarin uzerine kurulur. Yuklenene kadar her
 * bolum kendi iskeletini cizer: sayfa hicbir anda bos gorunmez.
 *
 * "Son talepler" bolumu alici icin bir talep akisi DEGILDIR; sosyal kanit
 * ve teklif veren kazanimidir, butun eylem baglantilari teklif veren
 * tarafina gider.
 */
export function MarketplaceHome() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [cities, setCities] = useState<City[]>([]);
  const [childrenByRoot, setChildrenByRoot] = useState<Record<string, CatalogChild[]>>({});
  const [who, setWho] = useState("usta");
  const [stickyCta, setStickyCta] = useState(false);
  const askedRoots = useRef<Set<string>>(new Set());

  const isSeller = user?.roles.includes("seller") ?? false;
  const sellerHref = isSeller ? "/satici-paneli" : "/satici-ol";
  const sellerLabel = isSeller ? "Gelen taleplere git" : "Teklif veren ol";

  useEffect(() => {
    let alive = true;
    apiRequest<{ data: CurrentUser }>("/me")
      .then((response) => { if (alive) setUser(response.data); })
      .catch(() => undefined)
      .finally(() => { if (alive) setSessionReady(true); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    apiRequest<{ data: Catalog }>("/service-catalog")
      .then((response) => { if (alive) setCatalog(response.data); })
      .catch(() => undefined);
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    apiRequest<{ data: City[] }>("/locations")
      .then((response) => { if (alive) setCities(response.data); })
      .catch(() => undefined);
    return () => { alive = false; };
  }, []);

  // Mobil yapiskan cagri: arama karti ekrandan cikinca belirir.
  useEffect(() => {
    const onScroll = () => {
      const finder = document.getElementById("finder");
      setStickyCta(finder ? finder.getBoundingClientRect().bottom < 0 : window.scrollY > 600);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    const timer = window.setTimeout(onScroll, 0);

    return () => { window.clearTimeout(timer); window.removeEventListener("scroll", onScroll); };
  }, []);

  /**
   * Bir kokun alt basliklarini bir kez getirir.
   *
   * Katalogda urun kokleri cocuksuz geliyor; agacin tamamini indirmek
   * (GET /categories?kind=listing&tree=1) 1,1 MB. Bu yuzden sekme
   * acildikca kok basina ~7 KB cekiliyor.
   */
  const requestRoot = useCallback((slug: string) => {
    if (!slug || askedRoots.current.has(slug)) return;
    askedRoots.current.add(slug);

    apiRequest<{ data: CatalogChild[] }>(`/categories?parent=${encodeURIComponent(slug)}`)
      .then((response) => setChildrenByRoot((current) => ({ ...current, [slug]: response.data })))
      .catch(() => { askedRoots.current.delete(slug); });
  }, []);

  const serviceRootsKey = (catalog?.groups ?? []).map((group) => group.slug).join(",");
  const example = PRO_EXAMPLES[who];

  return <main className={styles.page}>
    <a className={styles.skip} href="#icerik">İçeriğe geç</a>

    <SiteHeader
      announce="⚡ İhtiyacını yaz, teklifler sana gelsin — talep eden için tamamen ücretsiz."
      cta={isSeller ? { label: "Gelen talepler", href: "/satici-paneli" } : { label: "Ücretsiz talep oluştur", href: "/talep-olustur" }}
      sessionReady={sessionReady}
      user={user}
    />

    <div id="icerik">
      {/* ================= HERO ================= */}
      <section className={styles.hero}>
        <div aria-hidden="true" className={styles.heroBg} />

        <div className={`${styles.wrap} ${styles.heroIn}`}>
          <div className={styles.heroCopy}>
            <span className={styles.heroBadge}><b>0 ₺</b> Talep oluşturmak her zaman ücretsiz</span>
            <h1>Ne istiyorsan yaz,<br /><span className={styles.hl}>teklifler sana gelsin.</span></h1>
            <p className={styles.heroLead}>
              Usta, kiralık daire, ikinci el araç ya da yeni bir telefon… İhtiyacını bir kez anlat;{" "}
              <strong>ustalar, emlakçılar, galeriler ve satıcılar</strong> sana teklif versin. Sen sadece karşılaştır ve seç.
            </p>

            <HeroFinder catalog={catalog} childrenByRoot={childrenByRoot} cities={cities} requestRoot={requestRoot} />
          </div>

          <HeroVisual />
        </div>

        <div className={styles.wrap}>
          <ul className={styles.trustRow}>
            {TRUST.map((item) => (
              <li key={item.title}>
                <i>{item.emoji}</i>
                <span><strong>{item.title}</strong>{item.hint}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ================= DİKEYLER ================= */}
      <section aria-labelledby="verticals-title" className={`${styles.section} ${styles.sectionTight}`}>
        <div className={styles.wrap}>
          <div className={`${styles.secHead} ${styles.secHeadRow}`}>
            <div>
              <span className={styles.eyebrow}>Her şey için</span>
              <h2 id="verticals-title">Sadece hizmet değil. Ne istersen iste.</h2>
            </div>
            <a className={styles.linkArrow} href="#kategoriler">Tüm kategoriler →</a>
          </div>

          <div className={styles.verticals}>
            {VERTICALS.map((item) => (
              <Link
                className={styles.vcard}
                href={talepUrl({ tip: item.id })}
                key={item.id}
                style={{ "--c": item.color } as React.CSSProperties}
              >
                <span className={styles.vIco}>{item.emoji}</span>
                <strong>{item.name}</strong>
                <small>{item.desc}</small>
                <span className={styles.vGo}>Talep oluştur →</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ================= SON TALEPLER ================= */}
      <section aria-labelledby="feed-title" className={`${styles.section} ${styles.sectionWhite}`} id="son-talepler">
        <div className={styles.wrap}>
          <LiveFeed sellerHref={sellerHref} serviceRootsKey={serviceRootsKey} />
        </div>
      </section>

      {/* ================= NASIL ÇALIŞIR ================= */}
      <section aria-labelledby="how-title" className={styles.section} id="nasil-calisir">
        <div className={styles.wrap}>
          <div className={`${styles.secHead} ${styles.secHeadCenter}`}>
            <span className={styles.eyebrow}>Süreç</span>
            <h2 id="how-title"><span className={styles.brandInline}>alıcam<b>.net</b></span> nasıl çalışır?</h2>
            <p><strong>İki taraf için de basit.</strong> Talep eden ücretsiz ister, teklif veren sadece ilgilendiği iş için öder.</p>
          </div>

          <div className={styles.how}>
            <article className={styles.howCol}>
              <header>
                <span className={`${styles.howTag} ${styles.tagBlue}`}>Talep ediyorum</span>
                <h3>İstediğini yaz, gelen teklifleri seç.</h3>
              </header>
              <ol className={styles.howSteps}>
                <li><b>1</b><div><strong>Ne istediğini seç</strong><p>Hizmet, daire, araç, ürün… Birkaç kısa soruyu yanıtla. 2 dakika sürer.</p></div></li>
                <li><b>2</b><div><strong>Bütçeni ve konumunu yaz</strong><p>Talebin, bölgendeki uygun ustalara, emlakçılara, galerilere ve satıcılara ulaşır.</p></div></li>
                <li><b>3</b><div><strong>Teklifleri karşılaştır</strong><p>Fiyat, puan ve yorumları yan yana gör. Beğendiğini kabul et; hiçbir teklif seni bağlamaz.</p></div></li>
              </ol>
              <Link className={`${styles.btn} ${styles.btnCta}`} href="/talep-olustur">＋ Ücretsiz talep oluştur</Link>
            </article>

            <article className={`${styles.howCol} ${styles.howColDark}`}>
              <header>
                <span className={`${styles.howTag} ${styles.tagOrange}`}>Teklif veriyorum</span>
                <h3>Müşteri arama, müşteri seni bulsun.</h3>
              </header>
              <ol className={styles.howSteps}>
                <li><b>1</b><div><strong>Ücretsiz profil oluştur</strong><p>Usta, emlakçı, galeri ya da mağaza; ne sattığını ve nerede çalıştığını seç.</p></div></li>
                <li><b>2</b><div><strong>Uygun talepleri gör</strong><p>Yalnızca kategorine ve bölgene uyan talepler önüne düşer. Özetler ücretsiz.</p></div></li>
                <li><b>3</b><div><strong>Detayı aç, teklif ver</strong><p>İlgilendiğin talebin detayını kontörle aç. Teklif göndermek ek ücret istemez.</p></div></li>
              </ol>
              <Link className={`${styles.btn} ${styles.btnWhite}`} href={sellerHref}>{sellerLabel} →</Link>
            </article>
          </div>
        </div>
      </section>

      {/* ================= KATEGORİLER ================= */}
      <section aria-labelledby="cat-title" className={`${styles.section} ${styles.sectionWhite}`} id="kategoriler">
        <div className={styles.wrap}>
          <div className={styles.secHead}>
            <span className={styles.eyebrow}>Kategoriler</span>
            <h2 id="cat-title">
              <span className={styles.brandInline}>alıcam<b>.net</b></span>&apos;te aradığın her şey için bir başlık var.
            </h2>
          </div>

          <CategoryPanel catalog={catalog} childrenByRoot={childrenByRoot} requestRoot={requestRoot} />
        </div>
      </section>

      {/* ================= GÜVEN ================= */}
      <section aria-labelledby="trust-title" className={styles.section} id="guven">
        <div className={styles.wrap}>
          <TrustBento stats={catalog?.stats ?? null} />
        </div>
      </section>

      {/* ================= TEKLİF VERENLER ================= */}
      <section aria-labelledby="pro-title" className={styles.pro} id="teklif-ver">
        <div className={`${styles.wrap} ${styles.proIn}`}>
          <div className={styles.proCopy}>
            <span className={`${styles.eyebrow} ${styles.eyebrowLight}`}>Teklif verenler için</span>
            <h2 id="pro-title">Hazır müşteri seni bekliyor.</h2>
            <p>Bölgendeki gerçek taleplere ulaş. Reklama para dökmeden, sadece ilgilendiğin talep için öde.</p>

            <div aria-label="Kimsin?" className={styles.proWho} role="tablist">
              {PRO_WHO_IDS.map((id) => (
                <button
                  aria-selected={who === id}
                  key={id}
                  onClick={() => setWho(id)}
                  role="tab"
                  type="button"
                >{PRO_EXAMPLES[id].label}</button>
              ))}
            </div>

            <p className={styles.proExample}>{example.lead}<b>{example.bold}</b>{example.tail}</p>

            <div className={styles.proActions}>
              <Link className={`${styles.btn} ${styles.btnCta} ${styles.btnLg}`} href={sellerHref}>
                {isSeller ? "Gelen taleplere git" : "Ücretsiz teklif veren ol"} →
              </Link>
              <a className={`${styles.btn} ${styles.btnGhostLight} ${styles.btnLg}`} href="#sss">Kontör nasıl işler?</a>
            </div>
          </div>

          <div className={styles.kontor}>
            <div className={styles.kontorHead}><strong>Ne zaman ödersin?</strong><span>Sadece ilgilendiğinde.</span></div>
            {KONTOR.map((row) => (
              <div className={styles.kRow} key={row.title}>
                <i>{row.step}</i>
                <div><strong>{row.title}</strong><small>{row.hint}</small></div>
                <b className={row.free ? styles.kFree : styles.kCost}>{row.tag}</b>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= SSS ================= */}
      <section aria-labelledby="faq-title" className={`${styles.section} ${styles.sectionWhite}`} id="sss">
        <div className={styles.wrap}><FaqSection /></div>
      </section>

      {/* ================= SON ÇAĞRI ================= */}
      <section className={styles.final}>
        <div className={styles.wrap}>
          <div className={styles.finalIn}>
            <div className={styles.finalCopy}>
              <span className={styles.finalKicker}><i className={styles.liveDot} /> Hazır mısın?</span>
              <h2>Aradığını bulmak için <em>beklemeyi bırak.</em></h2>
              <p>Şimdi yaz, teklifler bugün gelmeye başlasın.</p>
            </div>

            <div className={styles.finalSide}>
              <div className={styles.finalActions}>
                <Link className={`${styles.btn} ${styles.btnCta} ${styles.btnLg}`} href="/talep-olustur">
                  ＋ Ücretsiz talep oluştur
                </Link>
                <Link className={`${styles.btn} ${styles.btnGhostLight} ${styles.btnLg}`} href={sellerHref}>
                  {sellerLabel}
                </Link>
              </div>

              <div className={styles.finalWho}>
                <span aria-hidden="true" className={styles.stack}>
                  <i style={{ "--c": "var(--v-hizmet)" } as React.CSSProperties}>🛠️</i>
                  <i style={{ "--c": "var(--v-emlak)" } as React.CSSProperties}>🏠</i>
                  <i style={{ "--c": "var(--v-vasita)" } as React.CSSProperties}>🚗</i>
                  <i style={{ "--c": "var(--v-alisveris)" } as React.CSSProperties}>🛍️</i>
                </span>
                <small>Ustalar, emlakçılar, galeriler ve satıcılar talebini bekliyor.</small>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>

    <Link className={`${styles.mobileCta}${stickyCta ? ` ${styles.mobileCtaShow}` : ""}`} href="/talep-olustur">
      ＋ Ücretsiz talep oluştur
    </Link>
  </main>;
}
