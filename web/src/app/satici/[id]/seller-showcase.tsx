"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Modal } from "@/components/modal/modal";
import { PageShell } from "@/components/shell/page-shell";
import { QuoteModal, type QuoteCategory } from "./quote-modal";
import { ListingDetail, placeOf, type ListingCard } from "./listing-detail";
import { WorkViewer, workSpecs } from "@/components/portfolio/work-viewer";
import { ApiError, apiRequest, firstApiError } from "@/lib/api";
import styles from "./showcase.module.css";

type MiniCategory = { name: string; slug?: string; icon: string; color: string };
type SellerCategory = QuoteCategory;
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
  // Magazanin genis kapagi, firma logosu ve kullanicinin profil resmi.
  banner_url: string | null; logo_url: string | null; avatar_url: string | null;
  categories: SellerCategory[];
  locations: { city: string | null; district: string | null }[];
  rating: { average: number; count: number; breakdown: Record<string, number> };
  services: Service[]; listings: ListingCard[]; portfolio: PortfolioItem[]; reviews: Review[];
};

type Tab = "urunler" | "hizmetler" | "isler" | "yorumlar";

const money = (value: string) => new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(Number(value));
const monthYear = (value: string) => new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric" }).format(new Date(value));
const stars = (rating: number) => "★".repeat(Math.round(rating)) + "☆".repeat(5 - Math.round(rating));

export function SellerShowcase({ sellerId }: { sellerId: string }) {
  const [seller, setSeller] = useState<Seller | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openWork, setOpenWork] = useState<PortfolioItem | null>(null);
  const [openListing, setOpenListing] = useState<ListingCard | null>(null);
  // undefined: modal kapali. Bos metin: genel istek. Dolu: o kategoriden.
  const [quoteFor, setQuoteFor] = useState<string | undefined>(undefined);
  const [workFilter, setWorkFilter] = useState("");
  const [reviewFilter, setReviewFilter] = useState(0);
  // null: ziyaretci hicbir sekmeye dokunmadi; magazanin icerigine gore secilir.
  const [tab, setTab] = useState<Tab | null>(null);
  const [messaging, setMessaging] = useState(false);
  const [messageError, setMessageError] = useState("");
  const router = useRouter();

  /**
   * Vitrinden dogrudan yazisma baslatir.
   *
   * Konusmayi acmak ucretsizdir ve tekrar tiklansa da ayni konusma doner;
   * kontoru hizmet veren, mesaji okuyup yanitlamak istediginde oder.
   */
  const startConversation = async () => {
    if (messaging || !seller) return;
    setMessaging(true);
    setMessageError("");

    try {
      const response = await apiRequest<{ data: { id: number } }>("/conversations", {
        method: "POST",
        body: JSON.stringify({ seller_id: seller.id }),
      });
      router.push(`/mesajlar?konusma=${response.data.id}`);
    } catch (requestError: unknown) {
      if (requestError instanceof ApiError && requestError.status === 401) {
        router.push(`/giris?devam=${encodeURIComponent(`/satici/${sellerId}`)}`);
        return;
      }
      setMessageError(firstApiError(requestError));
      setMessaging(false);
    }
  };

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
  if (loading) return <PageShell className={styles.page} header={{ activeKey: "rehber" }} width="full">
    <main className={styles.state}><i /><p>Vitrin hazırlanıyor…</p></main>
  </PageShell>;
  if (error || !seller) return <PageShell className={styles.page} header={{ activeKey: "rehber" }} width="full">
    <main className={styles.state}><p>{error || "Hizmet veren bulunamadı."}</p><Link href="/">Ana sayfaya dön →</Link></main>
  </PageShell>;

  const title = seller.company_name || seller.name;
  const initials = title.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toLocaleUpperCase("tr-TR");
  const workCategories = Array.from(new Map(seller.portfolio.filter((item) => item.category).map((item) => [item.category!.name, item.category!])).values());
  const visibleWorks = workFilter ? seller.portfolio.filter((item) => item.category?.name === workFilter) : seller.portfolio;
  const visibleReviews = reviewFilter ? seller.reviews.filter((item) => item.rating === reviewFilter) : seller.reviews;
  const totalWorkImages = seller.portfolio.reduce((total, item) => total + item.images.length, 0);
  const regions = Array.from(new Set(seller.locations.map((item) => item.district || item.city).filter(Boolean)));
  const accent = seller.categories[0]?.color ?? "#7C3AED";
  const cheapest = seller.services.filter((item) => item.price_from).map((item) => Number(item.price_from));
  const listings = seller.listings ?? [];
  // Magaza logosu once; yoksa kisisel profil resmi, o da yoksa bas harfler.
  const badge = seller.logo_url ?? seller.avatar_url;
  const activeTab: Tab = tab ?? (listings.length > 0 ? "urunler" : "hizmetler");

  /** Teklif istegi magazadan cikmadan modalda alinir. */
  const openQuote = (categorySlug?: string) => setQuoteFor(categorySlug ?? "");

  const goto = (next: Tab) => {
    setTab(next);
    document.getElementById(next)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // width="full": magaza kapagi ve yapiskan serit tam genislik olmali,
  // ic bloklar kendi .wrap kapsayicisini kullaniyor.
  return <PageShell className={styles.page} header={{ activeKey: "rehber" }} width="full">

    {/* Magaza kapagi: fotograf varsa genis kapak, yoksa eski degrade. */}
    <header className={seller.banner_url ? `${styles.storeCover} ${styles.hasBanner}` : styles.storeCover} style={{ "--accent": accent } as React.CSSProperties}>
      {seller.banner_url
        ? <div className={styles.banner}>
          {/* Kullanici yuklemesi; olculer bilinmedigi icin img kullanilir. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt={`${title} mağaza kapağı`} src={seller.banner_url} />
        </div>
        : <div className={styles.coverArt}><i /><i /><i /></div>}
      <div className={`${styles.wrap} ${styles.coverInner}`}>
        <span className={styles.avatar}>
          {badge
            // eslint-disable-next-line @next/next/no-img-element
            ? <img alt={title} className={styles.avatarImage} src={badge} />
            : initials || "A"}
          {seller.is_featured && <b>★</b>}
        </span>

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

        {/* Puan, sayilar ve aksiyonlar tek kartta: magaza kimligi dagilmiyor. */}
        <aside className={styles.coverSide}>
          <div className={styles.ratingBox}>
            <strong>{seller.rating.count ? seller.rating.average.toFixed(1) : "Yeni"}</strong>
            <span className={styles.starRow}>{stars(seller.rating.average)}</span>
            <small>{seller.rating.count} değerlendirme</small>
          </div>

          <div className={styles.statGrid}>
            <div><strong>{seller.services.length}</strong><span>hizmet</span></div>
            <div><strong>{seller.portfolio.length}</strong><span>tamamlanan iş</span></div>
            {/* Magazasi olan satici icin urun sayisi, is gorselinden daha anlamli. */}
            {listings.length > 0
              ? <div><strong>{listings.length}</strong><span>ürün</span></div>
              : <div><strong>{totalWorkImages}</strong><span>iş görseli</span></div>}
            <div><strong>{seller.rating.count}</strong><span>yorum</span></div>
          </div>

          {cheapest.length > 0 && (
            <p className={styles.fromPrice}><span>BAŞLANGIÇ</span><strong>{money(String(Math.min(...cheapest)))}</strong></p>
          )}

          <button className={styles.primaryCta} onClick={() => openQuote()} type="button">Teklif iste →</button>
          <button className={styles.ghostCta} disabled={messaging} onClick={() => void startConversation()} type="button">
            {messaging ? "Açılıyor…" : "Mesaj gönder"}
          </button>
          {/* Magazasi olan satici icin once urunler gosterilir. */}
          {listings.length > 0
            ? <button className={styles.ghostCta} onClick={() => goto("urunler")} type="button">Ürünleri gör</button>
            : <button className={styles.ghostCta} onClick={() => goto("hizmetler")} type="button">Hizmetleri gör</button>}
        </aside>
      </div>
    </header>

    {/* Mağaza şeridi: sayılar + sekmeler */}
    <div className={styles.storeBar}><div className={`${styles.wrap} ${styles.storeBarInner}`}>
      <p className={styles.barName}>{title}</p>
      {/* Serit tek satirda kalmali: seridin sticky konumu (top:64px) ve
          bolumlerin scroll-margin-top:132px degeri bu yuksekligi kodluyor.
          Urunler sekmesi yalnizca magazada urun varsa cikar; dort kisa
          etiket 1040px ustunde ikinci satira tasmiyor, yani serit 57px
          kaliyor ve iki sayiya dokunmak gerekmedi. */}
      <div className={styles.tabs}>
        {([
          ...(listings.length > 0 ? [["urunler", "Ürünler", listings.length] as const] : []),
          ["hizmetler", "Hizmetler", seller.services.length] as const,
          ["isler", "İşler", seller.portfolio.length] as const,
          ["yorumlar", "Yorumlar", seller.reviews.length] as const,
        ]).map(([key, label, count]) =>
          <button className={activeTab === key ? styles.tabOn : ""} key={key} onClick={() => goto(key)} type="button">{label} <b>{count}</b></button>)}
      </div>
      <button className={styles.barCta} onClick={() => openQuote()} type="button">Teklif iste →</button>
    </div></div>

    <div className={`${styles.wrap} ${styles.sections}`}>
      {/* Urunler: emlakcinin daireleri, galericinin araclari. */}
      {listings.length > 0 && <section className={styles.block} id="urunler">
        <header className={styles.blockHead}><div><span className={styles.kicker}>VİTRİN</span><h2>Ürünler</h2><p>Bu mağazanın satıştaki ilanları. Detay için bir ilana tıkla.</p></div><span className={styles.blockCount}>{listings.length} ilan</span></header>
        <div className={styles.blockBody}><div className={styles.listingGrid}>
          {listings.map((item, index) => <button
            className={styles.listingCard}
            key={item.id}
            onClick={() => setOpenListing(item)}
            style={{ "--i": index } as React.CSSProperties}
            type="button"
          >
            <span className={styles.listingCover}>
              {item.cover_url
                // eslint-disable-next-line @next/next/no-img-element
                ? <img alt={item.title} loading="lazy" src={item.cover_url} />
                : <span className={styles.coverGlyph}>{item.category?.icon ?? "▦"}</span>}
              {item.image_count > 1 && <em className={styles.shotCount}>🖼 {item.image_count}</em>}
              <span className={styles.coverHint}><b>İlanı gör</b></span>
            </span>
            <span className={styles.listingBody}>
              <strong className={styles.listingTitle}>{item.title}</strong>
              {item.price
                ? <em className={styles.listingPrice}>{money(item.price)}</em>
                : <em className={`${styles.listingPrice} ${styles.askPrice}`}>Fiyat sorunuz</em>}
            </span>
            <span className={styles.listingFoot}>
              <small className={styles.listingPlace}>📍 {placeOf(item.location) || "Konum belirtilmemiş"}</small>
              <span className={styles.listingMeta}>
                {item.category && <em className={styles.listingCat}>{item.category.icon ? `${item.category.icon} ` : ""}{item.category.name}</em>}
                <small className={styles.listingRef}>{item.reference}</small>
              </span>
            </span>
          </button>)}
        </div></div>
      </section>}

      {/* Hizmetler */}
      <section className={styles.block} id="hizmetler">
        <header className={styles.blockHead}><div><span className={styles.kicker}>MAĞAZA</span><h2>Hizmetler</h2><p>Bu mağazadan alabileceğin işler ve başlangıç fiyatları.</p></div><span className={styles.blockCount}>{seller.services.length} hizmet</span></header>
        <div className={styles.blockBody}>{seller.services.length === 0 ? <p className={styles.empty}>Hizmet kataloğu henüz paylaşılmamış.</p> : <div className={styles.serviceGrid}>
          {seller.services.map((service, index) => <article className={styles.serviceCard} key={service.id} style={{ "--i": index } as React.CSSProperties}>
            <div className={styles.serviceCover} style={!service.cover_url && service.category ? { background: `linear-gradient(135deg, ${service.category.color}26, ${service.category.color}66)` } : undefined}>
              {service.cover_url
                // eslint-disable-next-line @next/next/no-img-element
                ? <img alt={service.title} loading="lazy" src={service.cover_url} />
                : <span className={styles.coverGlyph}>{service.category?.icon ?? "▦"}</span>}
              {service.price_from && <em className={styles.coverPrice}><span>BAŞLANGIÇ</span><strong>{money(service.price_from)}</strong></em>}
              {service.category && <em className={styles.floatChip} style={{ background: `${service.category.color}18`, color: service.category.color }}>{service.category.icon} {service.category.name}</em>}
            </div>
            <div className={styles.serviceBody}>
              <h3>{service.title}</h3>
              <p>{service.description}</p>
              <footer>
                {/* Fiyati olan hizmette rozet kapakta; burada yalnizca teklife acik olanlar yazilir. */}
                {!service.price_from && <div className={styles.priceBox}><small>FİYAT</small><strong>Teklife göre</strong></div>}
                {service.delivery_time && <span className={styles.delivery}>◷ {service.delivery_time}</span>}
                <button className={styles.serviceCta} onClick={() => openQuote(service.category?.slug)} type="button">Teklif iste →</button>
              </footer>
            </div>
          </article>)}
        </div>}</div>
      </section>

      {/* İşler */}
      <section className={styles.block} id="isler">
        <header className={styles.blockHead}><div><span className={styles.kicker}>GALERİ</span><h2>Yaptığı işler</h2><p>Tamamlanan projelerin fotoğrafları ve kapsamı.</p></div><span className={styles.blockCount}>{visibleWorks.length} çalışma</span></header>

        <div className={styles.blockBody}>{workCategories.length > 1 && <div className={styles.filterRow}>
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
        </div>}</div>
      </section>

      {/* Yorumlar */}
      <section className={styles.block} id="yorumlar">
        <header className={styles.blockHead}><div><span className={styles.kicker}>GERİ BİLDİRİM</span><h2>Müşteri yorumları</h2><p>Hizmeti alan müşterilerin değerlendirmeleri.</p></div><span className={styles.blockCount}>{visibleReviews.length} yorum</span></header>

        <div className={styles.blockBody}><div className={styles.reviewLayout}>
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
        </div></div>
      </section>

      <section className={styles.cta}>
        <div><strong>Benzer bir iş mi yaptıracaksın?</strong><p>Talebini ücretsiz yayınla; {title} ve alanındaki diğer profesyoneller sana teklif göndersin.</p></div>
        <button className={styles.ctaButton} onClick={() => openQuote()} type="button">Bu mağazadan teklif iste →</button>
        <button className={styles.ctaGhost} disabled={messaging} onClick={() => void startConversation()} type="button">
          {messaging ? "Açılıyor…" : "Mesaj gönder"}
        </button>
        {messageError && <p className={styles.ctaError}>{messageError}</p>}
      </section>
    </div>

    <QuoteModal
      categories={seller.categories}
      initialCategorySlug={quoteFor || undefined}
      onClose={() => setQuoteFor(undefined)}
      open={quoteFor !== undefined}
      sellerId={seller.id}
      sellerName={title}
    />

    {/* key: baska bir ilana gecilince galeri bastan kurulur. */}
    {openListing && <ListingDetail
      key={openListing.id}
      listing={openListing}
      onClose={() => setOpenListing(null)}
      onQuote={(categorySlug) => { setOpenListing(null); openQuote(categorySlug); }}
      sellerName={title}
    />}

    {openWork && <Modal
      onClose={() => setOpenWork(null)}
      open
      size="lg"
      subtitle={[openWork.category?.name, openWork.location, openWork.completed_at ? monthYear(openWork.completed_at) : null].filter(Boolean).join(" · ")}
      title={openWork.title}
      footer={<>
        <span className={styles.modalNote}>Bu işi {title} tamamladı.</span>
        <button className={styles.modalPrimary} onClick={() => { setOpenWork(null); openQuote(openWork.category?.slug); }} type="button">Benzer iş için teklif al →</button>
      </>}
    >
      <WorkViewer work={openWork} />
    </Modal>}
  </PageShell>;
}
