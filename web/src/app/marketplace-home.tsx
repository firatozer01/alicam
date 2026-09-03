"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { SiteHeader } from "@/components/shell/site-header";
import { ActiveChips, ListSkeleton, Pagination, ResultBar } from "@/components/listing/listing-chrome";
import list from "@/components/listing/listing.module.css";
import { ApiError, apiRequest, firstApiError } from "@/lib/api";
import styles from "./marketplace.module.css";

type CurrentUser = { id: number; name: string; email: string; roles: string[] };
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
  services: { id: number; title: string; price_from: string | null; cover_url: string | null }[];
  portfolio_count: number;
};
type FeaturedService = {
  id: number; title: string; description: string; price_from: string | null; delivery_time: string | null;
  cover_url: string | null; is_featured: boolean; category: Omit<Category, "id"> | null; seller: { id: number; name: string };
};
type RequestFacets = {
  categories: { slug: string; name: string; icon: string; color: string; count: number }[];
  cities: { id: number; name: string; count: number }[];
  budget: { min: number; max: number };
};
type MarketplaceResponse = {
  data: {
    requests: PublicRequest[]; sellers: PublicSeller[]; featured_services: FeaturedService[];
    stats: { active_requests: number; approved_sellers: number; reviews: number };
  };
  facets: RequestFacets;
  meta: { current_page: number; last_page: number; total: number };
};

const sortOptions = [
  { value: "latest", label: "En yeni" },
  { value: "popular", label: "En çok teklif alan" },
  { value: "budget_high", label: "Bütçe: yüksekten" },
  { value: "budget_low", label: "Bütçe: düşükten" },
];

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
  const [city, setCity] = useState("");
  const [budget, setBudget] = useState({ min: "", max: "" });
  const [appliedBudget, setAppliedBudget] = useState({ min: "", max: "" });
  const [sort, setSort] = useState("latest");
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [railOpen, setRailOpen] = useState(false);
  const [detailedSearch, setDetailedSearch] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedOffset, setFeedOffset] = useState(0);
  const [sessionReady, setSessionReady] = useState(false);
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
      })
      .finally(() => { if (active) setSessionReady(true); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({ sort, page: String(page) });
    if (category) params.set("category", category);
    if (city) params.set("city_id", city);
    if (search) params.set("q", search);
    if (appliedBudget.min) params.set("budget_min", appliedBudget.min);
    if (appliedBudget.max) params.set("budget_max", appliedBudget.max);
    apiRequest<MarketplaceResponse>(`/marketplace?${params}`)
      .then((response) => { if (active) { setMarketplace(response); setError(""); setFeedOffset(0); } })
      .catch((requestError: unknown) => { if (active) setError(firstApiError(requestError)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [appliedBudget, category, city, page, search, sort]);

  // Bütçe alanları her tuşta istek atmasın.
  useEffect(() => {
    const timer = setTimeout(() => setAppliedBudget(budget), 450);
    return () => clearTimeout(timer);
  }, [budget]);

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

  const facets = useMemo(() => marketplace?.facets ?? { categories: [], cities: [], budget: { min: 0, max: 0 } }, [marketplace]);

  const activeChips = useMemo(() => {
    const chips: { key: string; label: string; onClear: () => void }[] = [];
    if (search) chips.push({ key: "q", label: `“${search}”`, onClear: () => { setLoading(true); setSearch(""); setSearchInput(""); setPage(1); } });
    if (category) chips.push({ key: "category", label: facets.categories.find((item) => item.slug === category)?.name ?? category, onClear: () => chooseCategory("") });
    if (city) chips.push({ key: "city", label: facets.cities.find((item) => String(item.id) === city)?.name ?? city, onClear: () => { setLoading(true); setCity(""); setPage(1); } });
    if (appliedBudget.min || appliedBudget.max) chips.push({ key: "budget", label: `Bütçe ${appliedBudget.min || "0"}–${appliedBudget.max || "∞"} ₺`, onClear: () => setBudget({ min: "", max: "" }) });
    return chips;
  }, [appliedBudget, category, city, facets, search]);

  const resetFilters = () => {
    setLoading(true); setSearch(""); setSearchInput(""); setCategory(""); setCity("");
    setBudget({ min: "", max: "" }); setSort("latest"); setPage(1);
  };

  return <main className={styles.page} ref={pageRef}>
    <SiteHeader
      activeKey={category}
      announce="⚡ Yeni nesil talep pazaryeri — talep oluşturmak tamamen ücretsiz."
      cta={isSeller ? { label: "Gelen talepler", href: "/satici-paneli" } : { label: "Ücretsiz talep oluştur", href: "/talep-olustur" }}
      links={[
        { label: "Hizmet verenler", href: "/hizmet-verenler" },
        { label: "Nasıl çalışır", href: "/#nasil-calisir" },
        { label: "Hizmet verenler için", href: "/#hizmet-veren" },
      ]}
      sessionReady={sessionReady}
      user={user}
      menus={[
            {
              key: "categories", label: "Kategoriler",
              panelIcon: "🗂", panelTitle: "Kategoriler", panelHint: "Talep oluşturabileceğin tüm alanlar tek çatı altında",
              meta: `${facets.categories.length} kategori · ${marketplace?.meta.total ?? 0} açık talep`,
              allLink: { label: "Tüm talepler", href: "/#talepler" },
              sections: categories.slice(0, 4).map((category, index) => {
                const facet = facets.categories.find((row) => row.slug === category.slug);
                const cityRows = facets.cities.slice(0, 3);
                return {
                  key: category.slug,
                  title: category.name.toLocaleUpperCase("tr-TR"),
                  icon: category.icon,
                  color: category.color,
                  description: `${facet?.count ?? 0} açık talep teklif bekliyor.`,
                  accent: index === 0,
                  items: [
                    { key: category.slug, label: `Tüm ${category.name} talepleri`, icon: category.icon, hint: "Filtrele ve incele", count: facet?.count ?? 0, onSelect: () => chooseCategory(category.slug) },
                    ...cityRows.map((city) => ({
                      key: `${category.slug}-${city.id}`,
                      label: city.name,
                      icon: "📍",
                      hint: `${city.name} bölgesindeki talepler`,
                      onSelect: () => { chooseCategory(category.slug); setLoading(true); setCity(String(city.id)); setPage(1); },
                    })),
                  ],
                  footer: { label: `${category.name} talepleri`, onSelect: () => chooseCategory(category.slug) },
                };
              }),
              quickLinks: [
                { key: "all", label: "Tüm talepler", icon: "▤", onSelect: () => chooseCategory("") },
                { key: "sellers", label: "Hizmet verenler", icon: "🏬", href: "/hizmet-verenler" },
                { key: "new", label: "Ücretsiz talep oluştur", icon: "＋", href: "/talep-olustur", primary: true },
              ],
            },
      ]}
    />

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

    <section className={styles.marketSection} id="talepler"><div className={styles.wrap}><header className={`${styles.marketHead} ${styles.reveal}`}><div><span>PAZARYERİNDE ŞİMDİ</span><h2>Güncel talepler</h2><p>Filtrele, karşılaştır, ilgilendiğin talebi incele.</p></div></header>
      {error && <p className={styles.error}>{error}</p>}
      <div className={list.shell}>
        <div>
          <button className={list.railToggle} onClick={() => setRailOpen(!railOpen)} type="button">☰ Kategoriler{activeChips.length ? ` (${activeChips.length})` : ""}</button>
          <div className={railOpen ? "" : list.railHidden}>
            <aside className={list.rail}>
              <div className={list.railTop}><strong>KATEGORİLER</strong><button className={list.railReset} disabled={!activeChips.length} onClick={resetFilters} type="button">Temizle</button></div>
              <div className={list.tree}>
                <button className={`${list.treeRow} ${!category ? list.treeActive : ""}`} onClick={() => chooseCategory("")} type="button">
                  <i style={{ background: "#f1eeff", color: "#4f46e5" }}>◎</i><span>Tüm talepler</span><b>{facets.categories.reduce((total, item) => total + item.count, 0)}</b>
                </button>
                {facets.categories.map((item) => <button className={`${list.treeRow} ${category === item.slug ? list.treeActive : ""}`} key={item.slug} onClick={() => chooseCategory(item.slug)} type="button">
                  <i style={{ background: `${item.color}15`, color: item.color }}>{item.icon}</i><span>{item.name}</span><b>{item.count}</b>
                </button>)}
              </div>
              <div className={list.railTop}><strong>ŞEHİR</strong></div>
              <div className={list.tree}>
                <button className={`${list.treeRow} ${!city ? list.treeActive : ""}`} onClick={() => { setLoading(true); setCity(""); setPage(1); }} type="button"><i style={{ background: "#f6f5fc" }}>◎</i><span>Tümü</span><b>{facets.cities.reduce((total, item) => total + item.count, 0)}</b></button>
                {facets.cities.map((item) => <button className={`${list.treeRow} ${city === String(item.id) ? list.treeActive : ""}`} key={item.id} onClick={() => { setLoading(true); setCity(String(item.id)); setPage(1); }} type="button"><i style={{ background: "#f6f5fc" }}>📍</i><span>{item.name}</span><b>{item.count}</b></button>)}
              </div>
            </aside>
          </div>
        </div>

        <div>
          <form className={styles.marketSearch} onSubmit={submitSearch}>
            <label>⌕<input onChange={(event) => setSearchInput(event.target.value)} placeholder="Talep başlığı, konum veya kategori ara…" value={searchInput} /></label>
            <button type="submit">Ara</button>
            <button className={detailedSearch ? styles.detailedOn : ""} onClick={() => setDetailedSearch(!detailedSearch)} type="button">Detaylı Arama {detailedSearch ? "▴" : "▾"}</button>
          </form>
          {detailedSearch && <div className={styles.detailedPanel}>
            <label>Şehir<select onChange={(event) => { setLoading(true); setCity(event.target.value); setPage(1); }} value={city}><option value="">Tümü</option>{facets.cities.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.count})</option>)}</select></label>
            <label>En az bütçe<input inputMode="numeric" onChange={(event) => setBudget({ min: event.target.value, max: budget.max })} placeholder={String(facets.budget.min)} value={budget.min} /></label>
            <label>En çok bütçe<input inputMode="numeric" onChange={(event) => setBudget({ min: budget.min, max: event.target.value })} placeholder={String(facets.budget.max)} value={budget.max} /></label>
            <button onClick={resetFilters} type="button">Temizle</button>
          </div>}

          <ResultBar noun="açık talep" onSort={(value) => { setLoading(true); setSort(value); setPage(1); }} sort={sort} sortOptions={sortOptions} total={marketplace?.meta.total ?? 0} />
          <ActiveChips chips={activeChips} />
          {loading ? <ListSkeleton /> : (marketplace?.data.requests.length ?? 0) === 0 ? <div className={list.table}><div className={list.empty}>Bu filtrede açık talep bulunmuyor.</div></div> : <div className={list.tiles}>
            {(marketplace?.data.requests ?? []).map((item, index) => <Link className={list.tile} href={inspectHref} key={item.id} style={{ animationDelay: `${Math.min(index, 12) * 24}ms` }}>
              <div className={list.tileArt} style={{ background: `${item.category.color}12`, color: item.category.color }}>{item.category.icon}</div>
              <h3 className={list.tileTitle}>{item.title}</h3>
              <span className={list.tilePrice}>{money(item.budget.min)} – {money(item.budget.max)}</span>
              <div className={list.tileMeta}><span>{item.location.district.name}</span><span>{item.offer_count} teklif</span></div>
            </Link>)}
          </div>}
          <Pagination lastPage={marketplace?.meta.last_page ?? 1} onPage={(next) => { setLoading(true); setPage(next); document.querySelector("#talepler")?.scrollIntoView({ behavior: "smooth" }); }} page={marketplace?.meta.current_page ?? 1} />
        </div>
      </div>
    </div></section>

    <section className={styles.categorySection} id="kategoriler">
      <div className={styles.wrap}><header className={`${styles.sectionHead} ${styles.reveal}`}><span>KATEGORİLER</span><h2>Aradığın her şey için tek bir talep yeter.</h2><p>Kategori seç, birkaç soruyu cevapla, talebin ilgili satıcı ağına düşsün.</p></header>
        <div className={styles.categoryGrid}>{categories.slice(0, 8).map((item, index) => <button className={styles.reveal} key={item.id} onClick={() => chooseCategory(item.slug)} style={{ background: categoryPastels[index % categoryPastels.length] }}><i style={{ background: item.color }}>{item.icon}</i><strong>{item.name}</strong><p>Uygun ve doğrulanmış hizmet verenlerden teklif al</p><footer><span style={{ color: item.color }}>{category === item.slug ? "Seçili kategori" : "Talepleri keşfet"}</span><b style={{ color: item.color }}>→</b></footer></button>)}</div>
      </div>
    </section>

    <section className={styles.how} id="nasil-calisir"><div className={styles.wrap}><header className={`${styles.sectionHead} ${styles.reveal}`}><span>SÜREÇ</span><h2>Üç adımda teklif almaya başla.</h2></header><div className={styles.howGrid}><article className={styles.reveal}><i>01</i><h3>Talebini oluştur</h3><p>Kategori seç, soruları yanıtla, bütçeni ve konumunu belirt. Tamamen ücretsiz.</p></article><article className={styles.reveal}><i>02</i><h3>Uygun satıcılar görsün</h3><p>Talebin, kategori ve bölgende hizmet veren doğrulanmış satıcılara düşer.</p></article><article className={styles.reveal}><i>03</i><h3>Teklifleri karşılaştır</h3><p>Fiyatı, kapsamı ve hizmet vereni tek ekrandan karşılaştırıp karar ver.</p></article></div></div></section>

    <section className={styles.feedSection}><div className={styles.wrap}><header className={`${styles.sectionHead} ${styles.reveal}`}><span>CANLI TALEP AKIŞI</span><h2>Şu anda platformda böyle talepler var.</h2><p>Satıcılar akışı takip eder; müşteriler tek tek hizmet veren aramak zorunda kalmaz.</p></header>
      <div className={`${styles.feedCard} ${styles.reveal}`}><header><div><i /> <strong>Canlı akış</strong></div><a href="#talepler">Tüm talepleri gör →</a></header><div>{feedItems.map((item, index) => <article className={`${styles.feedRow} ${index === 0 ? styles.feedNew : ""}`} key={`${feedOffset}-${item.id}`} style={{ animationDelay: `${index * 55}ms` }}><span style={{ background: `${item.category.color}15`, color: item.category.color }}>{item.category.icon} {item.category.name}</span><div><strong>{item.title}</strong><small>{item.location.city.name}, {item.location.district.name} · {relativeTime(item.created_at)}</small></div><b>{money(item.budget.min)} – {money(item.budget.max)}</b><em>{item.offer_count} teklif</em></article>)}</div></div>
    </div></section>

    <section className={styles.featured} id="one-cikanlar"><div className={styles.wrap}>
      <header className={`${styles.marketHead} ${styles.reveal}`}>
        <div><span>GÜVENLE KARAR VER</span><h2>Öne çıkan hizmet verenler</h2><p>Gerçek müşteri puanları, doğrulanmış profiller ve tamamlanmış işler.</p></div>
        <Link className={styles.seeAll} href="/hizmet-verenler">Tüm hizmet verenler →</Link>
      </header>
      <div className={styles.providerRow}>{(marketplace?.data.sellers ?? []).slice(0, 5).map((seller) => {
        const name = seller.company_name || seller.name;
        const initials = name.split(/\\s+/).slice(0, 2).map((part) => part[0]).join("").toLocaleUpperCase("tr-TR");
        return <article className={`${styles.provider} ${styles.reveal} ${seller.is_featured ? styles.providerFeatured : ""}`} key={seller.id}>
          {seller.is_featured && <b className={styles.sellerFlag}>★ ÖNE ÇIKAN</b>}
          <span className={styles.providerAvatar}>{initials || "A"}<i /></span>
          <strong>{name}</strong>
          <small>{seller.categories.slice(0, 2).map((item) => item.name).join(" · ") || "Hizmet veren"}</small>
          <div className={styles.sellerRating}>{seller.review_count > 0 ? <><em>★</em><b>{seller.rating.toFixed(1)}</b><span>({seller.review_count})</span></> : <span className={styles.sellerNew}>Yeni katıldı</span>}</div>
          <p className={styles.providerStat}>🖼 <b>{seller.portfolio_count}</b> tamamlanan iş · ▦ <b>{seller.services.length}</b> hizmet</p>
          <Link className={styles.providerLink} href={`/satici/${seller.id}`}>Profile git</Link>
        </article>;
      })}</div>

      <header className={`${styles.marketHead} ${styles.reveal} ${styles.headGap}`}>
        <div><span>KATALOGDAN SEÇ</span><h2>Öne çıkan hizmetler</h2><p>Hizmet verenlerin kapak görselli kartları; başlangıç fiyatını gör, profile geç, teklif iste.</p></div>
      </header>
      <div className={styles.serviceRow}>{(marketplace?.data.featured_services ?? []).map((service) => <Link className={`${styles.serviceTile} ${styles.reveal}`} href={`/satici/${service.seller.id}`} key={service.id}>
        <div className={styles.serviceTileCover} style={!service.cover_url && service.category ? { background: `linear-gradient(135deg, ${service.category.color}22, ${service.category.color}55)` } : undefined}>
          {service.cover_url
            // eslint-disable-next-line @next/next/no-img-element
            ? <img alt={service.title} loading="lazy" src={service.cover_url} />
            : <span>{service.category?.icon ?? "▦"}</span>}
          {service.is_featured && <b className={styles.sellerFlag}>★ ÖNE ÇIKAN</b>}
        </div>
        <div className={styles.serviceTileBody}>
          <small>{service.seller.name}{service.category ? ` · ${service.category.name}` : ""}</small>
          <strong>{service.title}</strong>
          <p>{service.description}</p>
          <footer><em>{service.price_from ? `${money(service.price_from)} başlangıç` : "Teklife göre"}</em>{service.delivery_time && <span>◷ {service.delivery_time}</span>}</footer>
        </div>
      </Link>)}</div>
      {(marketplace?.data.featured_services.length ?? 0) === 0 && <p className={styles.emptyNote}>Henüz yayında hizmet yok.</p>}
    </div></section>

    <section className={styles.sellerBand} id="hizmet-veren"><div className={styles.aurora}><i className={styles.blobOne} /><i className={styles.blobTwo} /></div><div className={styles.wrap}><div className={styles.reveal}><span>HİZMET VERENLER İÇİN</span><h2>Müşteriyi arama, gelen talebe teklif ver.</h2><ul><li><i>01</i><div><strong>Ücretsiz üye ol, firmanı tanıt</strong><p>Firma bilgilerini ve hizmet verdiğin kategorileri ekle.</p></div></li><li><i>02</i><div><strong>Şehir ve ilçeni seç</strong><p>Yalnızca hizmet verdiğin bölgelerdeki talepleri gör.</p></div></li><li><i>03</i><div><strong>Uygun talebe teklif ver</strong><p>Kontör yalnızca ilk teklif veya detay açma işleminde düşer.</p></div></li></ul><Link className={styles.buttonGrad} href={sellerHref}>{sellerLabel} →</Link></div><aside className={styles.reveal}><span>KONTÖR MALİYETİ · KATEGORİYE GÖRE</span>{categories.slice(0, 6).map((item, index) => <p key={item.id}><b>{item.icon} {item.name}</b><strong>{index + 1} kontör</strong></p>)}</aside></div></section>

    <section className={styles.cta}><div className={styles.wrap}><h2>Aradığını bulmak için beklemeyi bırak.</h2><Link href={isSeller ? "/satici-paneli" : "/talep-olustur"}>{isSeller ? "Gelen talepleri aç" : "Hemen talep oluştur"}</Link></div></section>
    <footer className={styles.footer}><div className={styles.wrap}><section><Link className={styles.brand} href="/"><BrandMark />alıcam<span>.net</span></Link><p>Talep tabanlı pazaryeri. Sen iste, onlar teklif etsin.</p></section><nav><strong>Keşfet</strong><a href="#kategoriler">Kategoriler</a><a href="#talepler">Güncel talepler</a><a href="#one-cikanlar">Öne çıkanlar</a></nav><nav><strong>Hizmet veren</strong><Link href={sellerHref}>{sellerLabel}</Link><Link href="/kontor-yukle">Kontör paketleri</Link></nav><nav><strong>Hesabın</strong>{user ? <Link href={panelHref}>{panelLabel}</Link> : <Link href="/giris">Giriş yap</Link>}<Link href="/talep-olustur">Talep oluştur</Link></nav><small>© 2026 alıcam.net</small></div></footer>
  </main>;
}
