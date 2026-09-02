"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Modal } from "@/components/modal/modal";
import { WorkViewer } from "@/components/portfolio/work-viewer";
import { apiRequest, firstApiError } from "@/lib/api";
import styles from "./showcase.module.css";

type MiniCategory = { name: string; slug?: string; icon: string; color: string };
type PortfolioImage = { id: number; url: string };
type PortfolioItem = {
  id: number; title: string; description: string; location: string | null;
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

  useEffect(() => {
    let active = true;
    apiRequest<{ data: Seller }>(`/sellers/${sellerId}`)
      .then((response) => { if (active) setSeller(response.data); })
      .catch((requestError: unknown) => { if (active) setError(firstApiError(requestError)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [sellerId]);


  if (loading) return <main className={styles.state}><i /><p>Vitrin hazırlanıyor…</p></main>;
  if (error || !seller) return <main className={styles.state}><p>{error || "Hizmet veren bulunamadı."}</p><Link href="/">Pazaryerine dön →</Link></main>;

  const workCategories = Array.from(new Map(seller.portfolio.filter((item) => item.category).map((item) => [item.category!.name, item.category!])).values());
  const visibleWorks = workFilter ? seller.portfolio.filter((item) => item.category?.name === workFilter) : seller.portfolio;
  const visibleReviews = reviewFilter ? seller.reviews.filter((item) => item.rating === reviewFilter) : seller.reviews;
  const totalWorkImages = seller.portfolio.reduce((total, item) => total + item.images.length, 0);

  const title = seller.company_name || seller.name;
  const initials = title.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toLocaleUpperCase("tr-TR");

  return <main className={styles.page}>
    <nav className={styles.nav}><div className={styles.wrap}><Link className={styles.brand} href="/">alıcam<span>.net</span></Link><Link className={styles.back} href="/">← Pazaryerine dön</Link></div></nav>

    <header className={styles.hero}><div className={styles.wrap}>
      <div className={styles.identity}>
        <span className={styles.avatar}>{initials || "A"}</span>
        <div>
          <div className={styles.nameRow}><h1>{title}</h1>{seller.is_featured && <b className={styles.featured}>★ ÖNE ÇIKAN</b>}</div>
          <p className={styles.meta}>
            <span className={styles.verified}>✓ Doğrulanmış hizmet veren</span>
            {seller.profile_type === "company" && <span>Kurumsal</span>}
            {seller.member_since && <span>{monthYear(seller.member_since)}&apos;den beri üye</span>}
          </p>
          {seller.description && <p className={styles.about}>{seller.description}</p>}
          <div className={styles.chips}>{seller.categories.map((item) => <span key={item.name} style={{ background: `${item.color}15`, color: item.color }}>{item.icon} {item.name}</span>)}</div>
          {seller.locations.length > 0 && <p className={styles.regions}>📍 Hizmet bölgeleri: {Array.from(new Set(seller.locations.map((item) => item.district ? `${item.district}` : item.city).filter(Boolean))).slice(0, 8).join(", ")}{seller.locations.length > 8 && ` +${seller.locations.length - 8}`}</p>}
        </div>
      </div>

      <aside className={styles.ratingCard}>
        <strong>{seller.rating.count ? seller.rating.average.toFixed(1) : "Yeni"}</strong>
        <span className={styles.starRow}>{stars(seller.rating.average)}</span>
        <small>{seller.rating.count} değerlendirme</small>
        <div className={styles.breakdown}>{[5, 4, 3, 2, 1].map((star) => {
          const count = seller.rating.breakdown[String(star)] ?? 0;
          const share = seller.rating.count ? Math.round((count / seller.rating.count) * 100) : 0;
          return <p key={star}><b>{star}★</b><i><em style={{ width: `${share}%` }} /></i><small>{count}</small></p>;
        })}</div>
      </aside>
    </div></header>

    <div className={styles.wrap}>
      <div className={styles.quickStats}>
        <div><strong>{seller.portfolio.length}</strong><span>tamamlanan iş</span></div>
        <div><strong>{totalWorkImages}</strong><span>iş görseli</span></div>
        <div><strong>{seller.rating.count}</strong><span>değerlendirme</span></div>
        <div><strong>{seller.services.length}</strong><span>hizmet</span></div>
        <div><strong>{seller.categories.length}</strong><span>uzmanlık alanı</span></div>
      </div>
    </div>

    <div className={`${styles.wrap} ${styles.body}`}>
      <section className={styles.column}>
        <header className={styles.sectionHead}><h2>Verdiği hizmetler</h2><span>{seller.services.length} hizmet</span></header>
        {seller.services.length === 0 ? <p className={styles.empty}>Hizmet kataloğu paylaşılmamış.</p> : <div className={styles.serviceGrid}>
          {seller.services.map((service) => <article className={styles.serviceCard} key={service.id}>
            <div className={styles.serviceCover} style={!service.cover_url && service.category ? { background: `linear-gradient(135deg, ${service.category.color}22, ${service.category.color}55)` } : undefined}>
              {service.cover_url
                // eslint-disable-next-line @next/next/no-img-element
                ? <img alt={service.title} loading="lazy" src={service.cover_url} />
                : <span>{service.category?.icon ?? "▦"}</span>}
              {service.category && <em className={styles.cat} style={{ background: `${service.category.color}15`, color: service.category.color }}>{service.category.icon} {service.category.name}</em>}
            </div>
            <div className={styles.serviceBody}>
              <h3>{service.title}</h3>
              <p>{service.description}</p>
              <footer>
                <div><small>BAŞLANGIÇ</small><strong>{service.price_from ? money(service.price_from) : "Teklife göre"}</strong></div>
                {service.delivery_time && <span>◷ {service.delivery_time}</span>}
                <Link href="/talep-olustur">Teklif iste →</Link>
              </footer>
            </div>
          </article>)}
        </div>}

        <header className={`${styles.sectionHead} ${styles.sectionGap}`}><h2>Yaptığı işler</h2><span>{visibleWorks.length} çalışma</span></header>

        {workCategories.length > 1 && <div className={styles.workFilter}>
          <button className={!workFilter ? styles.filterOn : ""} onClick={() => setWorkFilter("")} type="button">Tümü <b>{seller.portfolio.length}</b></button>
          {workCategories.map((category) => <button className={workFilter === category.name ? styles.filterOn : ""} key={category.name} onClick={() => setWorkFilter(category.name)} type="button">
            {category.icon} {category.name} <b>{seller.portfolio.filter((item) => item.category?.name === category.name).length}</b>
          </button>)}
        </div>}

        {visibleWorks.length === 0 ? <p className={styles.empty}>{seller.portfolio.length === 0 ? "Bu hizmet veren henüz galerisine çalışma eklememiş." : "Bu kategoride çalışma yok."}</p> : <div className={styles.workGrid}>
          {visibleWorks.map((item) => <article className={styles.workCard} key={item.id}>
            <button className={styles.workCover} onClick={() => setOpenWork(item)} type="button">
              {item.images.length > 0
                // eslint-disable-next-line @next/next/no-img-element
                ? <img alt={item.title} loading="lazy" src={item.images[0].url} />
                : <span className={styles.noCover}>Görsel yok</span>}
              {item.images.length > 1 && <em>🖼 {item.images.length}</em>}
              <span className={styles.coverHint}>Detayı gör</span>
            </button>
            <div className={styles.workInfo}>
              <div className={styles.workTop}>
                {item.category && <span className={styles.cat} style={{ background: `${item.category.color}15`, color: item.category.color }}>{item.category.icon} {item.category.name}</span>}
                {item.completed_at && <small>{monthYear(item.completed_at)}</small>}
              </div>
              <h3>{item.title}</h3>
              {item.location && <small className={styles.workPlace}>📍 {item.location}</small>}
              <p>{item.description}</p>
              <button className={styles.workMore} onClick={() => setOpenWork(item)} type="button">Detayı gör →</button>
            </div>
          </article>)}
        </div>}
      </section>

      <aside className={styles.side}>
        <section className={styles.panel}>
          <header><h2>Müşteri yorumları</h2><span>{visibleReviews.length}</span></header>
          {seller.rating.count > 0 && <div className={styles.reviewFilter}>
            <button className={!reviewFilter ? styles.filterOn : ""} onClick={() => setReviewFilter(0)} type="button">Tümü</button>
            {[5, 4, 3, 2, 1].filter((star) => (seller.rating.breakdown[String(star)] ?? 0) > 0).map((star) => <button className={reviewFilter === star ? styles.filterOn : ""} key={star} onClick={() => setReviewFilter(star)} type="button">{star}★ <b>{seller.rating.breakdown[String(star)]}</b></button>)}
          </div>}
          {visibleReviews.length === 0 ? <p className={styles.empty}>{seller.reviews.length === 0 ? "Henüz değerlendirme yok." : "Bu puanda yorum yok."}</p> : <div className={styles.reviews}>
            {visibleReviews.map((review) => <article key={review.id}>
              <header><strong>{review.buyer_name}</strong><span className={styles.starRow}>{stars(review.rating)}</span></header>
              {review.comment && <p>{review.comment}</p>}
              <small>{monthYear(review.created_at)}</small>
            </article>)}
          </div>}
        </section>

        <section className={styles.cta}>
          <strong>Bu işi yaptırmak mı istiyorsun?</strong>
          <p>Talebini ücretsiz yayınla; bu hizmet veren ve benzerleri sana teklif göndersin.</p>
          <Link href="/talep-olustur">Ücretsiz talep oluştur →</Link>
        </section>
      </aside>
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
