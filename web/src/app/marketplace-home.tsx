"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { ApiError, apiRequest, firstApiError } from "@/lib/api";
import styles from "./marketplace.module.css";

type CurrentUser = { id: number; name: string; roles: string[] };
type Category = { id: number; name: string; slug: string; icon: string; color: string };
type PublicRequest = {
  id: number; reference: string; title: string; summary: string; status: string; offer_count: number;
  budget: { min: string; max: string }; category: Category;
  location: { city: { id: number; name: string }; district: { id: number; name: string } };
  created_at: string; expires_at: string | null;
};
type PublicSeller = {
  id: number; name: string; company_name: string | null; description: string; rating: number;
  review_count: number; is_featured: boolean; categories: Omit<Category, "id">[];
  services: { title: string; price_from: string | null }[];
};
type MarketplaceResponse = {
  data: {
    requests: PublicRequest[]; sellers: PublicSeller[];
    stats: { active_requests: number; approved_sellers: number; reviews: number };
  };
  meta: { current_page: number; last_page: number; total: number };
};

const categoryPastels = ["#F3ECFE", "#ECEDFD", "#E7FAFC", "#FDECF4", "#FEF3E2", "#E9F9EE", "#F6EDFD", "#E6F7F5"];

const money = (value: string | number) => new Intl.NumberFormat("tr-TR", {
  style: "currency", currency: "TRY", maximumFractionDigits: 0,
}).format(Number(value));

function relativeTime(value: string) {
  const minutes = Math.max(1, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 60) return `${minutes} dk önce`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} saat önce`;
  return `${Math.round(hours / 24)} gün önce`;
}

function BrandMark() {
  return <svg aria-hidden="true" className={styles.brandMark} viewBox="0 0 30 30" fill="none"><path d="M4 10 L14 4 L14 10 Z" fill="#7C3AED" /><path d="M26 20 L16 26 L16 20 Z" fill="#06B6D4" /><path d="M14 7 H16 V23 H14 Z" fill="#4F46E5" opacity=".9" /></svg>;
}

export function MarketplaceHome() {
  const pageRef = useRef<HTMLElement>(null);
  const statsRef = useRef<HTMLElement>(null);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [marketplace, setMarketplace] = useState<MarketplaceResponse | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("latest");
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedOffset, setFeedOffset] = useState(0);
  const [counterStarted, setCounterStarted] = useState(false);
  const [counters, setCounters] = useState({ requests: 0, sellers: 0, cities: 0 });

  useEffect(() => {
    let active = true;
    apiRequest<{ data: Category[] }>("/categories")
      .then((response) => { if (active) setCategories(response.data); })
      .catch((requestError: unknown) => { if (active) setError(firstApiError(requestError)); });
    apiRequest<{ data: CurrentUser }>("/me")
      .then((response) => { if (active) setUser(response.data); })
      .catch((requestError: unknown) => {
        if (active && !(requestError instanceof ApiError && requestError.status === 401)) setError(firstApiError(requestError));
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({ sort, page: String(page) });
    if (category) params.set("category", category);
    if (search) params.set("q", search);
    apiRequest<MarketplaceResponse>(`/marketplace?${params}`)
      .then((response) => { if (active) { setMarketplace(response); setError(""); setFeedOffset(0); } })
      .catch((requestError: unknown) => { if (active) setError(firstApiError(requestError)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [category, page, search, sort]);

  useEffect(() => {
    const root = pageRef.current;
    if (!root) return;
    const elements = root.querySelectorAll(`.${styles.reveal}:not(.${styles.in})`);
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add(styles.in);
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12 });
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [categories, marketplace]);

  useEffect(() => {
    const element = statsRef.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) { setCounterStarted(true); observer.disconnect(); }
    }, { threshold: 0.45 });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const stats = marketplace?.data.stats ?? { active_requests: 0, approved_sellers: 0, reviews: 0 };

  useEffect(() => {
    if (!counterStarted) return;
    const target = { requests: stats.active_requests, sellers: stats.approved_sellers, cities: stats.active_requests ? 81 : 0 };
    const startedAt = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min((now - startedAt) / 1200, 1);
      const eased = 1 - ((1 - progress) ** 3);
      setCounters({ requests: Math.floor(target.requests * eased), sellers: Math.floor(target.sellers * eased), cities: Math.floor(target.cities * eased) });
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [counterStarted, stats.active_requests, stats.approved_sellers]);

  useEffect(() => {
    const count = marketplace?.data.requests.length ?? 0;
    if (count < 2) return;
    const interval = window.setInterval(() => setFeedOffset((current) => (current + 1) % count), 4500);
    return () => window.clearInterval(interval);
  }, [marketplace?.data.requests.length]);

  const isSeller = user?.roles.includes("seller") ?? false;
  const isAdmin = user?.roles.includes("admin") ?? false;
  const panelHref = isAdmin ? "/admin" : isSeller ? "/satici-paneli" : "/musteri-panel";
  const panelLabel = isAdmin ? "Admin paneli" : isSeller ? "Satıcı paneli" : "Müşteri paneli";
  const sellerHref = isSeller ? "/satici-paneli" : "/satici-ol";
  const sellerLabel = isSeller ? "Gelen taleplere git" : "Hizmet veren ol";
  const inspectHref = isSeller ? "/satici-paneli" : user ? "/satici-ol" : "/giris?devam=%2Fsatici-paneli";

  const feedItems = useMemo(() => {
    const items = marketplace?.data.requests ?? [];
    if (!items.length) return [];
    return Array.from({ length: Math.min(5, items.length) }, (_, index) => items[(feedOffset + index) % items.length]);
  }, [feedOffset, marketplace?.data.requests]);

  const chooseCategory = (slug: string) => {
    setLoading(true); setCategory(slug); setPage(1);
    document.querySelector("#talepler")?.scrollIntoView({ behavior: "smooth" });
  };

  const submitSearch = (event: FormEvent) => {
    event.preventDefault(); setLoading(true); setPage(1); setSearch(searchInput.trim());
    document.querySelector("#talepler")?.scrollIntoView({ behavior: "smooth" });
  };

  return <main className={styles.page} ref={pageRef}>
    <div className={styles.announce}>⚡ Yeni nesil talep pazaryeri — talep oluşturmak tamamen ücretsiz.</div>
    <nav className={styles.nav}>
      <div className={styles.wrap}>
        <Link className={styles.brand} href="/"><BrandMark />alıcam<span>.net</span></Link>
        <div className={styles.navLinks}>
          <div className={`${styles.navItem} ${styles.cats}`}>Kategoriler <span>⌄</span>
            <div className={styles.mega}>
              <header><i>🗂</i><div><strong>Kategoriler</strong><small>Talep oluşturabileceğin tüm alanlar</small></div><a href="#kategoriler">Tüm kategoriler →</a></header>
              <div className={styles.megaGrid}>{categories.slice(0, 8).map((item, index) => <button key={item.id} onClick={() => chooseCategory(item.slug)}><i style={{ background: item.color }}>{item.icon}</i><span><strong>{item.name}</strong><small style={{ background: categoryPastels[index % categoryPastels.length], color: item.color }}>Aktif talepleri gör</small></span></button>)}</div>
              <footer><a href="#talepler">⌕ Talep ara</a><a href="#nasil-calisir">💬 Nasıl çalışır</a><Link href={sellerHref}>🤝 {sellerLabel}</Link><a href="#one-cikanlar">★ Öne çıkanlar</a></footer>
            </div>
          </div>
          <a className={styles.navItem} href="#nasil-calisir">Nasıl çalışır</a>
          <a className={styles.navItem} href="#hizmet-veren">Hizmet verenler için</a>
        </div>
        <div className={styles.navCta}>{user ? <Link className={styles.buttonLine} href={panelHref}>{panelLabel}</Link> : <Link className={styles.buttonLine} href="/giris">Giriş yap</Link>}<Link className={styles.buttonGrad} href={isSeller ? "/satici-paneli" : "/talep-olustur"}>{isSeller ? "Gelen talepler" : "Ücretsiz talep oluştur"}</Link></div>
      </div>
    </nav>

    <header className={styles.hero}>
      <div className={styles.aurora}><i className={styles.blobOne} /><i className={styles.blobTwo} /></div>
      <div className={styles.floatChips}>{categories.slice(0, 4).map((item, index) => <span key={item.id} style={{ "--delay": `${index * 2}s` } as React.CSSProperties}><i style={{ background: item.color }}>{item.icon}</i>{item.name}</span>)}</div>
      <div className={styles.wrap}>
        <div className={styles.eyebrow}><i /> Klasik ilanın tersi</div>
        <h1>İlanı sen verme,<br /><em>teklifi onlar versin.</em></h1>
        <p>Ne aradığını söyle; uygun galeriler, emlakçılar, ustalar ve firmalar sana teklif göndersin. Aramak yok, beklemek yok.</p>
        <form className={styles.quickbar} onSubmit={submitSearch}>
          <select aria-label="Kategori" value={category} onChange={(event) => setCategory(event.target.value)}><option value="">Tüm kategoriler</option>{categories.map((item) => <option key={item.id} value={item.slug}>{item.icon} {item.name}</option>)}</select>
          <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Örn. Çankaya’da 3+1 asansörlü daire arıyorum…" />
          <button className={styles.buttonGrad}>Talep ara →</button>
        </form>
        <div className={styles.liveActivity}><div>{[0, 1, 2, 3, 4].map((item) => <i key={item} />)}</div><span>Canlı: şu anda <b>{stats.active_requests} açık talep</b> teklif bekliyor</span></div>
      </div>
    </header>

    <section className={`${styles.statsBand} ${styles.reveal}`} ref={statsRef}>
      <div className={styles.wrap}><div><strong>{counters.requests.toLocaleString("tr-TR")}+</strong><span>aktif talep</span></div><div><strong>{counters.sellers.toLocaleString("tr-TR")}+</strong><span>onaylı satıcı</span></div><div><strong>{counters.cities}</strong><span>ilde hizmet</span></div><div><strong>0 ₺</strong><span>müşteriden alınan ücret</span></div></div>
    </section>

    <section className={styles.categorySection} id="kategoriler">
      <div className={styles.wrap}><header className={`${styles.sectionHead} ${styles.reveal}`}><span>KATEGORİLER</span><h2>Aradığın her şey için tek bir talep yeter.</h2><p>Kategori seç, birkaç soruyu cevapla, talebin ilgili satıcı ağına düşsün.</p></header>
        <div className={styles.categoryGrid}>{categories.slice(0, 8).map((item, index) => <button className={styles.reveal} key={item.id} onClick={() => chooseCategory(item.slug)} style={{ background: categoryPastels[index % categoryPastels.length] }}><i style={{ background: item.color }}>{item.icon}</i><strong>{item.name}</strong><p>Uygun ve doğrulanmış hizmet verenlerden teklif al</p><footer><span style={{ color: item.color }}>{category === item.slug ? "Seçili kategori" : "Talepleri keşfet"}</span><b style={{ color: item.color }}>→</b></footer></button>)}</div>
      </div>
    </section>

    <section className={styles.how} id="nasil-calisir"><div className={styles.wrap}><header className={`${styles.sectionHead} ${styles.reveal}`}><span>SÜREÇ</span><h2>Üç adımda teklif almaya başla.</h2></header><div className={styles.howGrid}><article className={styles.reveal}><i>01</i><h3>Talebini oluştur</h3><p>Kategori seç, soruları yanıtla, bütçeni ve konumunu belirt. Tamamen ücretsiz.</p></article><article className={styles.reveal}><i>02</i><h3>Uygun satıcılar görsün</h3><p>Talebin, kategori ve bölgende hizmet veren doğrulanmış satıcılara düşer.</p></article><article className={styles.reveal}><i>03</i><h3>Teklifleri karşılaştır</h3><p>Fiyatı, kapsamı ve hizmet vereni tek ekrandan karşılaştırıp karar ver.</p></article></div></div></section>

    <section className={styles.feedSection}><div className={styles.wrap}><header className={`${styles.sectionHead} ${styles.reveal}`}><span>CANLI TALEP AKIŞI</span><h2>Şu anda platformda böyle talepler var.</h2><p>Satıcılar akışı takip eder; müşteriler tek tek hizmet veren aramak zorunda kalmaz.</p></header>
      <div className={`${styles.feedCard} ${styles.reveal}`}><header><div><i /> <strong>Canlı akış</strong></div><a href="#talepler">Tüm talepleri gör →</a></header><div>{feedItems.map((item, index) => <article className={index === 0 ? styles.feedNew : ""} key={`${feedOffset}-${item.id}`}><span style={{ background: `${item.category.color}15`, color: item.category.color }}>{item.category.icon} {item.category.name}</span><div><strong>{item.title}</strong><small>{item.location.city.name}, {item.location.district.name} · {relativeTime(item.created_at)}</small></div><b>{money(item.budget.min)} – {money(item.budget.max)}</b><em>{item.offer_count} teklif</em></article>)}</div></div>
    </div></section>

    <section className={styles.marketSection} id="talepler"><div className={styles.wrap}><header className={`${styles.marketHead} ${styles.reveal}`}><div><span>PAZARYERİNDE ŞİMDİ</span><h2>Güncel talepler</h2><p><b>{marketplace?.meta.total ?? 0}</b> açık talep bulundu</p></div><label>Sırala <select value={sort} onChange={(event) => { setLoading(true); setSort(event.target.value); setPage(1); }}><option value="latest">En yeni</option><option value="popular">En çok teklif alan</option><option value="budget_high">Bütçe: yüksekten</option><option value="budget_low">Bütçe: düşükten</option></select></label></header>
      <form className={styles.marketToolbar} onSubmit={submitSearch}><label>⌕<input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Talep başlığı, konum veya kategori ara…" /></label><button type="submit">Ara</button><button type="button" className={!category ? styles.active : ""} onClick={() => chooseCategory("")}>Tümü</button>{categories.slice(0, 6).map((item) => <button type="button" className={category === item.slug ? styles.active : ""} key={item.id} onClick={() => chooseCategory(item.slug)}>{item.icon} {item.name}</button>)}</form>
      {error && <p className={styles.error}>{error}</p>}
      {loading ? <div className={styles.loading}><i /><span>Talepler hazırlanıyor…</span></div> : <div className={styles.requestList}>{(marketplace?.data.requests ?? []).map((item) => <article className={`${styles.requestCard} ${styles.reveal}`} key={item.id}><header><span style={{ background: `${item.category.color}15`, color: item.category.color }}>{item.category.icon} {item.category.name}</span><small><i /> {relativeTime(item.created_at)}</small><em className={item.offer_count > 7 ? styles.competitionHigh : item.offer_count > 3 ? styles.competitionMid : styles.competitionLow}>{item.offer_count > 7 ? "Yoğun" : item.offer_count > 3 ? "Orta" : "Düşük"} rekabet · {item.offer_count} teklif</em></header><h3>{item.title}</h3><p>{item.summary}</p><div className={styles.requestMeta}><span>📍 {item.location.district.name}, {item.location.city.name}</span><span>№ {item.reference}</span></div><footer><div><span>TAHMİNİ BÜTÇE</span><strong>{money(item.budget.min)} – {money(item.budget.max)}</strong></div><Link href={inspectHref}>{isSeller ? "Talebi incele" : user ? "Satıcı olarak katıl" : "Giriş yap ve incele"} →</Link></footer></article>)}{(marketplace?.data.requests.length ?? 0) === 0 && <div className={styles.empty}>Bu filtrede açık talep bulunmuyor.</div>}</div>}
      {(marketplace?.meta.last_page ?? 1) > 1 && <nav className={styles.pagination}><button disabled={page <= 1} onClick={() => { setLoading(true); setPage((current) => Math.max(1, current - 1)); }}>← Önceki</button><span><b>{marketplace?.meta.current_page}</b> / {marketplace?.meta.last_page}</span><button disabled={page >= (marketplace?.meta.last_page ?? 1)} onClick={() => { setLoading(true); setPage((current) => current + 1); }}>Sonraki →</button></nav>}
    </div></section>

    <section className={styles.featured} id="one-cikanlar"><div className={styles.wrap}><header className={`${styles.marketHead} ${styles.reveal}`}><div><span>GÜVENLE KARAR VER</span><h2>Öne çıkan profesyoneller</h2><p>Gerçek müşteri puanları, doğrulanmış profiller ve açık hizmet kapsamları.</p></div><Link href={sellerHref}>{isSeller ? "Vitrinini yönet" : "Sen de hizmet ver"} →</Link></header><div className={styles.sellerGrid}>{(marketplace?.data.sellers ?? []).slice(0, 6).map((seller) => <article className={styles.reveal} key={seller.id}><header><i>{(seller.company_name || seller.name).slice(0, 2).toLocaleUpperCase("tr-TR")}</i><div><strong>{seller.company_name || seller.name}</strong><small>✓ Doğrulanmış profesyonel</small></div>{seller.is_featured && <b>ÖNE ÇIKAN</b>}</header><div className={styles.rating}>★★★★★ <strong>{seller.rating || "Yeni"}</strong><span>{seller.review_count} değerlendirme</span></div><p>{seller.description}</p><footer>{seller.categories.slice(0, 3).map((item) => <span key={item.slug}>{item.icon} {item.name}</span>)}</footer></article>)}</div></div></section>

    <section className={styles.sellerBand} id="hizmet-veren"><div className={styles.aurora}><i className={styles.blobOne} /><i className={styles.blobTwo} /></div><div className={styles.wrap}><div className={styles.reveal}><span>HİZMET VERENLER İÇİN</span><h2>Müşteriyi arama, gelen talebe teklif ver.</h2><ul><li><i>01</i><div><strong>Ücretsiz üye ol, firmanı tanıt</strong><p>Firma bilgilerini ve hizmet verdiğin kategorileri ekle.</p></div></li><li><i>02</i><div><strong>Şehir ve ilçeni seç</strong><p>Yalnızca hizmet verdiğin bölgelerdeki talepleri gör.</p></div></li><li><i>03</i><div><strong>Uygun talebe teklif ver</strong><p>Kontör yalnızca ilk teklif veya detay açma işleminde düşer.</p></div></li></ul><Link className={styles.buttonGrad} href={sellerHref}>{sellerLabel} →</Link></div><aside className={styles.reveal}><span>KONTÖR MALİYETİ · KATEGORİYE GÖRE</span>{categories.slice(0, 6).map((item, index) => <p key={item.id}><b>{item.icon} {item.name}</b><strong>{index + 1} kontör</strong></p>)}</aside></div></section>

    <section className={styles.cta}><div className={styles.wrap}><h2>Aradığını bulmak için beklemeyi bırak.</h2><Link href={isSeller ? "/satici-paneli" : "/talep-olustur"}>{isSeller ? "Gelen talepleri aç" : "Hemen talep oluştur"}</Link></div></section>
    <footer className={styles.footer}><div className={styles.wrap}><section><Link className={styles.brand} href="/"><BrandMark />alıcam<span>.net</span></Link><p>Talep tabanlı pazaryeri. Sen iste, onlar teklif etsin.</p></section><nav><strong>Keşfet</strong><a href="#kategoriler">Kategoriler</a><a href="#talepler">Güncel talepler</a><a href="#one-cikanlar">Öne çıkanlar</a></nav><nav><strong>Hizmet veren</strong><Link href={sellerHref}>{sellerLabel}</Link><Link href="/kontor-yukle">Kontör paketleri</Link></nav><nav><strong>Hesabın</strong>{user ? <Link href={panelHref}>{panelLabel}</Link> : <Link href="/giris">Giriş yap</Link>}<Link href="/talep-olustur">Talep oluştur</Link></nav><small>© 2026 alıcam.net</small></div></footer>
  </main>;
}
