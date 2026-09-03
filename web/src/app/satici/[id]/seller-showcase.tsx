"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Modal } from "@/components/modal/modal";
import { SiteHeader } from "@/components/shell/site-header";
import { WorkViewer, workSpecs } from "@/components/portfolio/work-viewer";
import { ApiError, apiRequest, firstApiError } from "@/lib/api";
import styles from "./showcase.module.css";

type MiniCategory = { name: string; slug?: string; icon: string; color: string };
type PortfolioImage = { id: number; url: string };
type PortfolioItem = {
  id: number; title: string; description: string; location: string | null;
  duration: string | null; area: string | null; budget: string | null;
  client_type: string | null; highlights: string[];
  completed_at: string | null; category: MiniCategory | null; images: PortfolioImage[];
};
type Review = { id: number; rating: number; comment: string | null; buyer_name: string; created_at: string };
type Service = { id: number; title: string; description: string; price_from: string | null; delivery_time: string | null; cover_url: string | null; category: MiniCategory | null };
type Seller = {
  id: number; name: string; company_name: string | null; profile_type: string | null;
  description: string | null; is_featured: boolean; member_since: string | null;
  categories: MiniCategory[];
  locations: { city: string | null; district: string | null }[];
  rating: { average: number; count: number; breakdown: Record<string, number> };
  services: Service[]; portfolio: PortfolioItem[]; reviews: Review[];
};

const money = (value: string) => new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(Number(value));
const monthYear = (value: string) => new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric" }).format(new Date(value));
const stars = (rating: number) => "★".repeat(Math.round(rating)) + "☆".repeat(5 - Math.round(rating));

export function SellerShowcase({ sellerId }: { sellerId: string }) {
  const [seller, setSeller] = useState<Seller | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openWork, setOpenWork] = useState<PortfolioItem | null>(null);
  const [workFilter, setWorkFilter] = useState("");
  const [reviewFilter, setReviewFilter] = useState(0);
  const [tab, setTab] = useState<"hizmetler" | "isler" | "yorumlar">("hizmetler");

  useEffect(() => {
    let active = true;
    apiRequest<{ data: Seller }>(`/sellers/${sellerId}`)
      .then((response) => { if (active) setSeller(response.data); })
      // 404 govdesi Laravel ic mesaji tasiyabilir; kullaniciya sade metin gosterilir.
      .catch((requestError: unknown) => {
        if (!active) return;
        const status = requestError instanceof ApiError ? requestError.status : 0;
        setError(status === 404 ? "Hizmet veren bulunamadı." : firstApiError(requestError));
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [sellerId]);

  // Yukleme ve hata durumlarinda da ortak ust cubuk korunur.
  if (loading) return <main className={styles.page}><SiteHeader activeKey="rehber" /><div className={styles.state}><i /><p>Vitrin hazırlanıyor…</p></div></main>;
  if (error || !seller) return <main className={styles.page}><SiteHeader activeKey="rehber" /><div className={styles.state}><p>{error || "Hizmet veren bulunamadı."}</p><Link href="/hizmet-verenler">Hizmet verenlere dön →</Link></div></main>;

  const title = seller.company_name || seller.name;
  const initials = title.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toLocaleUpperCase("tr-TR");
  const workCategories = Array.from(new Map(seller.portfolio.filter((item) => item.category).map((item) => [item.category!.name, item.category!])).values());
  const visibleWorks = workFilter ? seller.portfolio.filter((item) => item.category?.name === workFilter) : seller.portfolio;
  const visibleReviews = reviewFilter ? seller.reviews.filter((item) => item.rating === reviewFilter) : seller.reviews;
  const totalWorkImages = seller.portfolio.reduce((total, item) => total + item.images.length, 0);
  const regions = Array.from(new Set(seller.locations.map((item) => item.district || item.city).filter(Boolean)));
  const accent = seller.categories[0]?.color ?? "#7C3AED";
  const cheapest = seller.services.filter((item) => item.price_from).map((item) => Number(item.price_from));

  const goto = (next: typeof tab) => {
    setTab(next);
    document.getElementById(next)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return <main className={styles.page}>
    <SiteHeader activeKey="rehber" />

    {/* Mağaza kapağı */}
    <header className={styles.storeCover} style={{ "--accent": accent } as React.CSSProperties}>
      <div className={styles.coverArt}><i /><i /><i /></div>
      <div className={`${styles.wrap} ${styles.coverInner}`}>
        <span className={styles.avatar}>{initials || "A"}{seller.is_featured && <b>★</b>}</span>

        <div className={styles.identity}>
          <div className={styles.nameRow}>
            <h1>{title}</h1>
            {seller.is_featured && <b className={styles.featured}>★ ÖNE ÇIKAN</b>}
            <span className={styles.verified}>✓ Doğrulanmış</span>
          </div>
          <p className={styles.meta}>
            <span>{seller.profile_type === "company" ? "Kurumsal" : "Bireysel"}</span>
            {seller.member_since && <span>{monthYear(seller.member_since)}&apos;den beri üye</span>}
            {regions.length > 0 && <span>📍 {regions.slice(0, 4).join(", ")}{regions.length > 4 && ` +${regions.length - 4}`}</span>}
          </p>
          {seller.description && <p className={styles.about}>{seller.description}</p>}
          <div className={styles.chips}>{seller.categories.map((item) => <span key={item.name} style={{ background: `${item.color}18`, color: item.color }}>{item.icon} {item.name}</span>)}</div>
        </div>

        <aside className={styles.coverSide}>
          <div className={styles.ratingBox}>
            <strong>{seller.rating.count ? seller.rating.average.toFixed(1) : "Yeni"}</strong>
            <span className={styles.starRow}>{stars(seller.rating.average)}</span>
            <small>{seller.rating.count} değerlendirme</small>
          </div>
          <Link className={styles.primaryCta} href="/talep-olustur">Teklif iste →</Link>
          <button className={styles.ghostCta} onClick={() => goto("hizmetler")} type="button">Hizmetleri gör</button>
        </aside>
      </div>
    </header>

    {/* Mağaza şeridi: sayılar + sekmeler */}
    <div className={styles.storeBar}><div className={`${styles.wrap} ${styles.storeBarInner}`}>
      <div className={styles.counts}>
        <div><strong>{seller.services.length}</strong><span>hizmet</span></div>
        <div><strong>{seller.portfolio.length}</strong><span>tamamlanan iş</span></div>
        <div><strong>{totalWorkImages}</strong><span>iş görseli</span></div>
        <div><strong>{seller.rating.count}</strong><span>yorum</span></div>
        {cheapest.length > 0 && <div><strong>{money(String(Math.min(...cheapest)))}</strong><span>en düşük başlangıç</span></div>}
      </div>
      <div className={styles.tabs}>
        {([["hizmetler", "Hizmetler", seller.services.length], ["isler", "İşler", seller.portfolio.length], ["yorumlar", "Yorumlar", seller.reviews.length]] as const).map(([key, label, count]) =>
          <button className={tab === key ? styles.tabOn : ""} key={key} onClick={() => goto(key)} type="button">{label} <b>{count}</b></button>)}
      </div>
    </div></div>

    <div className={styles.wrap}>
      {/* Hizmetler */}
      <section className={styles.block} id="hizmetler">
        <header className={styles.blockHead}><div><h2>Hizmetler</h2><p>Bu mağazadan alabileceğin işler ve başlangıç fiyatları.</p></div><span>{seller.services.length} hizmet</span></header>
        {seller.services.length === 0 ? <p className={styles.empty}>Hizmet kataloğu henüz paylaşılmamış.</p> : <div className={styles.serviceGrid}>
          {seller.services.map((service, index) => <article className={styles.serviceCard} key={service.id} style={{ "--i": index } as React.CSSProperties}>
            <div className={styles.serviceCover} style={!service.cover_url && service.category ? { background: `linear-gradient(135deg, ${service.category.color}26, ${service.category.color}66)` } : undefined}>
              {service.cover_url
                // eslint-disable-next-line @next/next/no-img-element
                ? <img alt={service.title} loading="lazy" src={service.cover_url} />
                : <span className={styles.coverGlyph}>{service.category?.icon ?? "▦"}</span>}
              {service.category && <em className={styles.floatChip} style={{ background: `${service.category.color}18`, color: service.category.color }}>{service.category.icon} {service.category.name}</em>}
            </div>
            <div className={styles.serviceBody}>
              <h3>{service.title}</h3>
              <p>{service.description}</p>
              <footer>
                <div className={styles.priceBox}><small>BAŞLANGIÇ</small><strong>{service.price_from ? money(service.price_from) : "Teklife göre"}</strong></div>
                {service.delivery_time && <span className={styles.delivery}>◷ {service.delivery_time}</span>}
                <Link className={styles.serviceCta} href="/talep-olustur">Teklif iste →</Link>
              </footer>
            </div>
          </article>)}
        </div>}
      </section>

      {/* İşler */}
      <section className={styles.block} id="isler">
        <header className={styles.blockHead}><div><h2>Yaptığı işler</h2><p>Tamamlanan projelerin fotoğrafları ve kapsamı.</p></div><span>{visibleWorks.length} çalışma</span></header>

        {workCategories.length > 1 && <div className={styles.filterRow}>
          <button className={!workFilter ? styles.filterOn : ""} onClick={() => setWorkFilter("")} type="button">Tümü <b>{seller.portfolio.length}</b></button>
          {workCategories.map((category) => <button className={workFilter === category.name ? styles.filterOn : ""} key={category.name} onClick={() => setWorkFilter(category.name)} type="button">
            {category.icon} {category.name} <b>{seller.portfolio.filter((item) => item.category?.name === category.name).length}</b>
          </button>)}
        </div>}

        {visibleWorks.length === 0 ? <p className={styles.empty}>{seller.portfolio.length === 0 ? "Bu hizmet veren henüz galerisine çalışma eklememiş." : "Bu kategoride çalışma yok."}</p> : <div className={styles.workGrid}>
          {visibleWorks.map((item, index) => <article className={styles.workCard} key={item.id} style={{ "--i": index } as React.CSSProperties}>
            <button className={styles.workCover} onClick={() => setOpenWork(item)} type="button">
              {item.images.length > 0
                // eslint-disable-next-line @next/next/no-img-element
                ? <img alt={item.title} loading="lazy" src={item.images[0].url} />
                : <span className={styles.coverGlyph}>{item.category?.icon ?? "🖼"}</span>}
              {item.images.length > 1 && <em className={styles.shotCount}>🖼 {item.images.length}</em>}
              <span className={styles.coverHint}><b>Detayı gör</b></span>
            </button>
            <div className={styles.workInfo}>
              <div className={styles.workTop}>
                {item.category && <span className={styles.cat} style={{ background: `${item.category.color}18`, color: item.category.color }}>{item.category.icon} {item.category.name}</span>}
                {item.completed_at && <small>{monthYear(item.completed_at)}</small>}
              </div>
              <h3>{item.title}</h3>
              {item.location && <small className={styles.workPlace}>📍 {item.location}</small>}
              <p>{item.description}</p>
              {workSpecs(item).length > 0 && <ul className={styles.workSpecs}>
                {workSpecs(item).slice(0, 3).map((spec) => <li key={spec.key}><i>{spec.icon}</i>{spec.value}</li>)}
              </ul>}
              {item.highlights.length > 0 && <small className={styles.workDone}>✓ {item.highlights.slice(0, 2).join(" · ")}{item.highlights.length > 2 && ` +${item.highlights.length - 2} madde`}</small>}
              <button className={styles.workMore} onClick={() => setOpenWork(item)} type="button">Detayları ve fotoğrafları incele →</button>
            </div>
          </article>)}
        </div>}
      </section>

      {/* Yorumlar */}
      <section className={styles.block} id="yorumlar">
        <header className={styles.blockHead}><div><h2>Müşteri yorumları</h2><p>Hizmeti alan müşterilerin değerlendirmeleri.</p></div><span>{visibleReviews.length} yorum</span></header>

        <div className={styles.reviewLayout}>
          <aside className={styles.scoreCard}>
            <strong>{seller.rating.count ? seller.rating.average.toFixed(1) : "—"}</strong>
            <span className={styles.starRow}>{stars(seller.rating.average)}</span>
            <small>{seller.rating.count} değerlendirme</small>
            <div className={styles.breakdown}>{[5, 4, 3, 2, 1].map((star) => {
              const count = seller.rating.breakdown[String(star)] ?? 0;
              const share = seller.rating.count ? Math.round((count / seller.rating.count) * 100) : 0;
              return <button className={reviewFilter === star ? styles.barOn : ""} key={star} onClick={() => setReviewFilter(reviewFilter === star ? 0 : star)} type="button">
                <b>{star}★</b><i><em style={{ width: `${share}%` }} /></i><small>{count}</small>
              </button>;
            })}</div>
            {reviewFilter > 0 && <button className={styles.clearFilter} onClick={() => setReviewFilter(0)} type="button">Filtreyi temizle</button>}
          </aside>

          {visibleReviews.length === 0 ? <p className={styles.empty}>{seller.reviews.length === 0 ? "Henüz değerlendirme yok." : "Bu puanda yorum yok."}</p> : <div className={styles.reviewGrid}>
            {visibleReviews.map((review, index) => <article className={styles.review} key={review.id} style={{ "--i": index } as React.CSSProperties}>
              <header>
                <span className={styles.reviewAvatar}>{review.buyer_name.slice(0, 1).toLocaleUpperCase("tr-TR")}</span>
                <div><strong>{review.buyer_name}</strong><small>{monthYear(review.created_at)}</small></div>
                <em className={styles.starRow}>{stars(review.rating)}</em>
              </header>
              {review.comment && <p>{review.comment}</p>}
            </article>)}
          </div>}
        </div>
      </section>

      <section className={styles.cta}>
        <div><strong>Benzer bir iş mi yaptıracaksın?</strong><p>Talebini ücretsiz yayınla; {title} ve alanındaki diğer profesyoneller sana teklif göndersin.</p></div>
        <Link href="/talep-olustur">Ücretsiz talep oluştur →</Link>
      </section>
    </div>

    {openWork && <Modal
      onClose={() => setOpenWork(null)}
      open
      size="lg"
      subtitle={[openWork.category?.name, openWork.location, openWork.completed_at ? monthYear(openWork.completed_at) : null].filter(Boolean).join(" · ")}
      title={openWork.title}
      footer={<>
        <span className={styles.modalNote}>Bu işi {title} tamamladı.</span>
        <Link className={styles.modalPrimary} href="/talep-olustur">Benzer iş için teklif al →</Link>
      </>}
    >
      <WorkViewer work={openWork} />
    </Modal>}
  </main>;
}
