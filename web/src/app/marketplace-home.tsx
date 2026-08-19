"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { apiRequest, firstApiError } from "@/lib/api";
import styles from "./marketplace.module.css";

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

const money = (value: string) => new Intl.NumberFormat("tr-TR", {
  style: "currency", currency: "TRY", maximumFractionDigits: 0,
}).format(Number(value));

function relativeTime(value: string) {
  const minutes = Math.max(1, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 60) return `${minutes} dk önce`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} saat önce`;
  return `${Math.round(hours / 24)} gün önce`;
}

export function MarketplaceHome() {
  const [marketplace, setMarketplace] = useState<MarketplaceResponse | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("latest");
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    apiRequest<{ data: Category[] }>("/categories")
      .then((response) => { if (active) setCategories(response.data); })
      .catch((requestError: unknown) => { if (active) setError(firstApiError(requestError)); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (search) params.set("q", search);
    params.set("sort", sort);
    params.set("page", String(page));

    apiRequest<MarketplaceResponse>(`/marketplace?${params}`)
      .then((marketplaceResponse) => {
        if (!active) return;
        setError("");
        setMarketplace(marketplaceResponse);
      })
      .catch((requestError: unknown) => { if (active) setError(firstApiError(requestError)); })
      .finally(() => { if (active) setLoading(false); });

    return () => { active = false; };
  }, [category, page, search, sort]);

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
    document.querySelector("#talepler")?.scrollIntoView({ behavior: "smooth" });
  };

  const stats = marketplace?.data.stats ?? { active_requests: 0, approved_sellers: 0, reviews: 0 };

  return <main className={styles.page}>
    <div className={styles.topline}>Yeni nesil talep pazaryeri <span>•</span> Talep oluşturmak ücretsizdir</div>
    <header className={styles.header}>
      <div className={styles.shell}>
        <Link className={styles.brand} href="/">alıcam<span>.net</span></Link>
        <nav><a href="#talepler">Talepler</a><a href="#one-cikanlar">Öne çıkanlar</a><Link href="/satici-ol">Hizmet ver</Link></nav>
        <div className={styles.headerActions}><Link className={styles.login} href="/giris">Giriş yap</Link><Link className={styles.primaryButton} href="/talep-olustur">Talep oluştur <span>→</span></Link></div>
      </div>
    </header>

    <section className={styles.hero}>
      <div className={`${styles.shell} ${styles.heroGrid}`}>
        <div className={styles.heroCopy}>
          <span className={styles.eyebrow}><i /> TÜRKİYE’NİN TALEP PAZARYERİ</span>
          <h1>İhtiyacını yayınla.<br /><em>Doğru teklif seni bulsun.</em></h1>
          <p>Aradığın hizmeti tek tek araştırmak yerine talebini paylaş. Konumuna ve ihtiyacına uygun doğrulanmış profesyoneller teklif versin.</p>
          <form className={styles.heroSearch} onSubmit={submitSearch}>
            <span>⌕</span><input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Ne hizmeti arıyorsun? Örn. ev taşıma, boya…" /><button>Ara</button>
          </form>
          <div className={styles.heroStats}>
            <div><strong>{stats.active_requests.toLocaleString("tr-TR")}+</strong><span>aktif talep</span></div>
            <div><strong>{stats.approved_sellers.toLocaleString("tr-TR")}+</strong><span>onaylı profesyonel</span></div>
            <div><strong>{stats.reviews.toLocaleString("tr-TR")}+</strong><span>gerçek değerlendirme</span></div>
          </div>
        </div>
        <div className={styles.heroBoard}>
          <div className={styles.boardHead}><span>CANLI PAZARYERİ</span><b><i /> Şimdi güncelleniyor</b></div>
          {(marketplace?.data.requests.slice(0, 3) ?? []).map((item, index) => <article className={styles.boardItem} key={item.id}>
            <span className={styles.boardIcon} style={{ color: item.category.color, background: `${item.category.color}15` }}>{item.category.icon}</span>
            <div><small>{item.category.name} · {relativeTime(item.created_at)}</small><strong>{item.title}</strong><span>⌖ {item.location.district.name}, {item.location.city.name}</span></div>
            <p><strong>{money(item.budget.min)}</strong><span>başlayan bütçe</span></p>
            <b>{index + 1}</b>
          </article>)}
          {!marketplace && <div className={styles.boardLoading}>Canlı talepler hazırlanıyor…</div>}
          <a href="#talepler">Tüm aktif talepleri keşfet <span>↓</span></a>
        </div>
      </div>
    </section>

    <section className={`${styles.shell} ${styles.categoryRail}`}>
      <button className={!category ? styles.activeCategory : ""} onClick={() => { setCategory(""); setPage(1); }}><i>⌘</i><span><strong>Tüm talepler</strong><small>{marketplace?.meta.total ?? 0} ilan</small></span></button>
      {categories.map((item) => <button className={category === item.slug ? styles.activeCategory : ""} key={item.id} onClick={() => { setCategory(item.slug); setPage(1); }}><i style={{ color: item.color, background: `${item.color}12` }}>{item.icon}</i><span><strong>{item.name}</strong><small>Hemen keşfet</small></span></button>)}
    </section>

    <section className={`${styles.shell} ${styles.market}`} id="talepler">
      <aside className={styles.filters}>
        <div><span>FİLTRELER</span><button onClick={() => { setCategory(""); setSearch(""); setSearchInput(""); setPage(1); }}>Temizle</button></div>
        <label>Kelime ara<input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { setSearch(searchInput.trim()); setPage(1); } }} placeholder="Talep başlığı…" /></label>
        <fieldset><legend>Kategori</legend><button className={!category ? styles.selectedFilter : ""} onClick={() => { setCategory(""); setPage(1); }}><span>Tümü</span><b>›</b></button>{categories.map((item) => <button className={category === item.slug ? styles.selectedFilter : ""} key={item.id} onClick={() => { setCategory(item.slug); setPage(1); }}><span>{item.icon} {item.name}</span><b>›</b></button>)}</fieldset>
        <div className={styles.filterPromo}><span>HİZMET VEREN MİSİN?</span><strong>Yeni müşterilerin seni bekliyor.</strong><p>Profilini oluştur, uygun talepleri gör ve teklif ver.</p><Link href="/satici-ol">Satıcı hesabı aç →</Link></div>
      </aside>
      <div className={styles.listing}>
        <header className={styles.listingHead}><div><span>PAZARYERİNDE ŞİMDİ</span><h2>Güncel talepler</h2><p><b>{marketplace?.meta.total ?? 0}</b> açık talep bulundu</p></div><label>Sırala<select value={sort} onChange={(event) => { setSort(event.target.value); setPage(1); }}><option value="latest">En yeni</option><option value="popular">En çok teklif alan</option><option value="budget_high">Bütçe: yüksekten</option><option value="budget_low">Bütçe: düşükten</option></select></label></header>
        {error && <p className={styles.error}>{error}</p>}
        {loading ? <div className={styles.loading}><i /><span>Talepler yükleniyor…</span></div> : <div className={styles.requestList}>
          {(marketplace?.data.requests ?? []).map((item) => <article className={styles.requestItem} key={item.id}>
            <div className={styles.requestImage} style={{ background: `linear-gradient(145deg, ${item.category.color}16, ${item.category.color}05)` }}><span style={{ color: item.category.color }}>{item.category.icon}</span><small>{item.category.name}</small></div>
            <div className={styles.requestBody}><header><span>{item.reference}</span><b className={item.status === "in_negotiation" ? styles.negotiating : ""}><i /> {item.status === "in_negotiation" ? "Teklif alıyor" : "Yeni talep"}</b></header><h3>{item.title}</h3><p>{item.summary}</p><footer><span>⌖ {item.location.district.name}, {item.location.city.name}</span><span>◷ {relativeTime(item.created_at)}</span></footer></div>
            <aside><small>TAHMİNİ BÜTÇE</small><strong>{money(item.budget.min)}<span>—</span>{money(item.budget.max)}</strong><p><b>{item.offer_count}</b> teklif verildi</p><Link href="/giris?devam=%2Fsatici-paneli">Talebi incele <span>→</span></Link></aside>
          </article>)}
          {(marketplace?.data.requests.length ?? 0) === 0 && <div className={styles.empty}><span>⌕</span><h3>Bu filtrede açık talep yok.</h3><p>Filtreleri temizleyerek diğer talepleri keşfedebilirsin.</p></div>}
        </div>}
        {(marketplace?.meta.last_page ?? 1) > 1 && <nav className={styles.pagination} aria-label="Talep sayfaları"><button disabled={page <= 1} onClick={() => { setPage((current) => Math.max(1, current - 1)); document.querySelector("#talepler")?.scrollIntoView({ behavior: "smooth" }); }}>← Önceki</button><span><b>{marketplace?.meta.current_page}</b> / {marketplace?.meta.last_page}</span><button disabled={page >= (marketplace?.meta.last_page ?? 1)} onClick={() => { setPage((current) => current + 1); document.querySelector("#talepler")?.scrollIntoView({ behavior: "smooth" }); }}>Sonraki →</button></nav>}
      </div>
    </section>

    <section className={styles.featured} id="one-cikanlar">
      <div className={styles.shell}>
        <header className={styles.sectionHead}><div><span>GÜVENLE KARAR VER</span><h2>Öne çıkan profesyoneller</h2><p>Gerçek müşteri puanları, doğrulanmış profiller ve açık hizmet kapsamları.</p></div><Link href="/satici-ol">Sen de hizmet ver <span>→</span></Link></header>
        <div className={styles.sellerGrid}>{(marketplace?.data.sellers ?? []).slice(0, 6).map((seller, index) => <article className={styles.sellerCard} key={seller.id}>
          <header><span className={styles.sellerAvatar}>{(seller.company_name || seller.name).slice(0, 2).toLocaleUpperCase("tr-TR")}</span><div><strong>{seller.company_name || seller.name}</strong><small>✓ Doğrulanmış profesyonel</small></div>{seller.is_featured && <b>ÖNE ÇIKAN</b>}</header>
          <div className={styles.rating}><strong>★ {seller.rating || "Yeni"}</strong><span>{seller.review_count} değerlendirme</span><small>#{index + 1}</small></div>
          <p>{seller.description}</p>
          <div className={styles.sellerCategories}>{seller.categories.slice(0, 3).map((item) => <span key={item.slug}>{item.icon} {item.name}</span>)}</div>
          <footer><span>{seller.services[0]?.title ?? "Profesyonel hizmet"}</span>{seller.is_featured ? <b>Kontörle sponsorlu</b> : <b>Yüksek puanlı</b>}</footer>
        </article>)}</div>
      </div>
    </section>

    <section className={`${styles.shell} ${styles.howItWorks}`}>
      <div><span>01</span><i>✎</i><strong>Talebini oluştur</strong><p>İhtiyacını birkaç net soruyla ücretsiz yayınla.</p></div>
      <div><span>02</span><i>↗</i><strong>Teklifleri karşılaştır</strong><p>Fiyatı, puanı ve hizmet kapsamını tek yerde gör.</p></div>
      <div><span>03</span><i>✓</i><strong>Güvenle karar ver</strong><p>Doğru profesyoneli seç ve deneyimini puanla.</p></div>
      <aside><h2>Aramaya değil,<br />karar vermeye vakit ayır.</h2><Link href="/talep-olustur">Ücretsiz talep oluştur →</Link></aside>
    </section>

    <footer className={styles.footer}><div className={styles.shell}><Link className={styles.brand} href="/">alıcam<span>.net</span></Link><p>Talebini yayınla, doğru teklif seni bulsun.</p><nav><Link href="/talep-olustur">Talep oluştur</Link><Link href="/satici-ol">Hizmet ver</Link><Link href="/giris">Giriş</Link></nav><small>© 2026 alıcam.net</small></div></footer>
  </main>;
}
