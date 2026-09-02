"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FilterRail } from "@/components/listing/filter-rail";
import { ActiveChips, ListSkeleton, Pagination, ResultBar } from "@/components/listing/listing-chrome";
import list from "@/components/listing/listing.module.css";
import { apiRequest, firstApiError } from "@/lib/api";
import styles from "./directory.module.css";

type MiniCategory = { name: string; slug: string; icon: string; color: string };
type PreviewImage = { id: number; url: string };
type SellerCard = {
  id: number; name: string; company_name: string | null; profile_type: string | null;
  description: string; is_featured: boolean; rating: number; review_count: number;
  service_count: number; portfolio_count: number; categories: MiniCategory[]; preview: PreviewImage[];
};
type Facets = {
  categories: { slug: string; name: string; icon: string; color: string; count: number }[];
  cities: { id: number; name: string; count: number }[];
  featured: number;
};
type Response = { data: SellerCard[]; facets: Facets; meta: { current_page: number; last_page: number; total: number } };

const sortOptions = [
  { value: "featured", label: "Öne çıkanlar önce" },
  { value: "rating", label: "Puanı en yüksek" },
  { value: "reviews", label: "En çok değerlendirilen" },
  { value: "portfolio", label: "En çok işi olan" },
  { value: "newest", label: "En yeni katılan" },
];

const stars = (rating: number) => "★".repeat(Math.round(rating)) + "☆".repeat(5 - Math.round(rating));

export function SellerDirectory() {
  const [payload, setPayload] = useState<Response | null>(null);
  const [category, setCategory] = useState("");
  const [city, setCity] = useState("");
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [minRating, setMinRating] = useState("");
  const [sort, setSort] = useState("featured");
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [railOpen, setRailOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({ sort, page: String(page) });
    if (category) params.set("category", category);
    if (city) params.set("city_id", city);
    if (search) params.set("q", search);
    if (minRating) params.set("min_rating", minRating);
    if (featuredOnly) params.set("featured", "1");
    apiRequest<Response>(`/sellers?${params}`)
      .then((response) => { if (active) { setPayload(response); setError(""); } })
      .catch((requestError: unknown) => { if (active) setError(firstApiError(requestError)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [category, city, featuredOnly, minRating, page, search, sort]);

  const facets = useMemo(() => payload?.facets ?? { categories: [], cities: [], featured: 0 }, [payload]);

  const pick = (setter: (value: string) => void) => (value: string) => { setLoading(true); setter(value); setPage(1); };
  const selectCategory = pick(setCategory);
  const selectCity = pick(setCity);

  const activeChips = useMemo(() => {
    const chips: { key: string; label: string; onClear: () => void }[] = [];
    if (search) chips.push({ key: "q", label: `“${search}”`, onClear: () => { setLoading(true); setSearch(""); setSearchInput(""); setPage(1); } });
    if (category) chips.push({ key: "category", label: facets.categories.find((item) => item.slug === category)?.name ?? category, onClear: () => selectCategory("") });
    if (city) chips.push({ key: "city", label: facets.cities.find((item) => String(item.id) === city)?.name ?? city, onClear: () => selectCity("") });
    if (featuredOnly) chips.push({ key: "featured", label: "Sadece öne çıkanlar", onClear: () => { setLoading(true); setFeaturedOnly(false); setPage(1); } });
    if (minRating) chips.push({ key: "rating", label: `${minRating}★ ve üzeri`, onClear: () => { setLoading(true); setMinRating(""); setPage(1); } });
    return chips;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, city, facets, featuredOnly, minRating, search]);

  const resetFilters = () => {
    setLoading(true); setSearch(""); setSearchInput(""); setCategory(""); setCity("");
    setFeaturedOnly(false); setMinRating(""); setSort("featured"); setPage(1);
  };

  return <main className={styles.page}>
    <nav className={styles.nav}><div className={styles.wrap}><Link className={styles.brand} href="/">alıcam<span>.net</span></Link><Link className={styles.back} href="/">← Pazaryerine dön</Link></div></nav>

    <header className={styles.hero}><div className={styles.wrap}>
      <span className={styles.kicker}>DOĞRULANMIŞ HİZMET VERENLER</span>
      <h1>Öne çıkan hizmet verenler</h1>
      <p>Puanı, tamamladığı işleri ve uzmanlık alanlarını karşılaştır; profiline girip galerisini incele.</p>
    </div></header>

    <div className={`${styles.wrap} ${styles.body}`}>
      <div>
        <button className={list.railToggle} onClick={() => setRailOpen(!railOpen)} type="button">☰ Filtreler{activeChips.length ? ` (${activeChips.length})` : ""}</button>
        <div className={railOpen ? "" : list.railHidden}>
          <FilterRail
            activeCount={activeChips.length}
            groups={[
              { key: "category", title: "UZMANLIK ALANI", selected: category, onSelect: selectCategory, options: facets.categories.map((item) => ({ value: item.slug, label: item.name, count: item.count, color: item.color, icon: item.icon })) },
              { key: "city", title: "ŞEHİR", selected: city, onSelect: selectCity, options: facets.cities.map((item) => ({ value: String(item.id), label: item.name, count: item.count })) },
              { key: "rating", title: "PUAN", selected: minRating, allLabel: "Fark etmez", onSelect: (value) => { setLoading(true); setMinRating(value); setPage(1); }, options: [
                { value: "4.5", label: "4.5★ ve üzeri", count: 0 },
                { value: "4", label: "4★ ve üzeri", count: 0 },
                { value: "3", label: "3★ ve üzeri", count: 0 },
              ] },
            ]}
            onReset={resetFilters}
            search={{ value: searchInput, placeholder: "Firma adı veya uzmanlık…", onChange: setSearchInput, onSubmit: () => { setLoading(true); setSearch(searchInput.trim()); setPage(1); } }}
          />
        </div>
      </div>

      <div>
        <ResultBar noun="hizmet veren" onSort={(value) => { setLoading(true); setSort(value); setPage(1); }} sort={sort} sortOptions={sortOptions} total={payload?.meta.total ?? 0}>
          <label className={styles.featuredToggle}>
            <input checked={featuredOnly} onChange={(event) => { setLoading(true); setFeaturedOnly(event.target.checked); setPage(1); }} type="checkbox" />
            <span>★ Sadece öne çıkanlar <b>{facets.featured}</b></span>
          </label>
        </ResultBar>
        <ActiveChips chips={activeChips} />
        {error && <p className={styles.error}>{error}</p>}

        {loading ? <ListSkeleton /> : (payload?.data.length ?? 0) === 0 ? <div className={list.table}><div className={list.empty}>Bu filtrede hizmet veren bulunmuyor.</div></div> : <div className={styles.grid}>
          {(payload?.data ?? []).map((seller, index) => {
            const title = seller.company_name || seller.name;
            const initials = title.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toLocaleUpperCase("tr-TR");
            return <Link className={`${styles.card} ${seller.is_featured ? styles.featuredCard : ""}`} href={`/satici/${seller.id}`} key={seller.id} style={{ animationDelay: `${Math.min(index, 10) * 30}ms` }}>
              {seller.is_featured && <b className={styles.featuredFlag}>★ ÖNE ÇIKAN</b>}
              <header>
                <span className={styles.avatar}>{initials || "A"}</span>
                <div>
                  <strong>{title}</strong>
                  <small>{seller.profile_type === "company" ? "Kurumsal" : "Bireysel"} · ✓ doğrulanmış</small>
                </div>
              </header>

              <div className={styles.rating}>
                {seller.review_count > 0
                  ? <><em>{stars(seller.rating)}</em><b>{seller.rating.toFixed(1)}</b><span>({seller.review_count} değerlendirme)</span></>
                  : <span className={styles.newSeller}>Yeni katıldı</span>}
              </div>

              {seller.description && <p className={styles.about}>{seller.description}</p>}

              {seller.preview.length > 0 && <div className={styles.preview}>
                {seller.preview.map((image) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img alt="" key={image.id} loading="lazy" src={image.url} />
                ))}
              </div>}

              <div className={styles.chips}>{seller.categories.slice(0, 3).map((item) => <span key={item.slug} style={{ background: `${item.color}15`, color: item.color }}>{item.icon} {item.name}</span>)}{seller.categories.length > 3 && <span className={styles.moreChip}>+{seller.categories.length - 3}</span>}</div>

              <footer>
                <span>🖼 <b>{seller.portfolio_count}</b> iş</span>
                <span>▦ <b>{seller.service_count}</b> hizmet</span>
                <em>Profili gör →</em>
              </footer>
            </Link>;
          })}
        </div>}

        <Pagination lastPage={payload?.meta.last_page ?? 1} onPage={(next) => { setLoading(true); setPage(next); window.scrollTo({ top: 0, behavior: "smooth" }); }} page={payload?.meta.current_page ?? 1} />
      </div>
    </div>
  </main>;
}
