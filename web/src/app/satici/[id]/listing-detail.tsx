"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/modal/modal";
import { ApiError, apiRequest, firstApiError } from "@/lib/api";
import styles from "./listing-detail.module.css";

export type ListingCategory = { id: number; name: string; slug: string; icon: string | null };
export type ListingLocation = { city: string | null; district: string | null };

/**
 * Vitrindeki urun karti.
 *
 * Alici tarafindaki govdede "status" ve "offer_count" YOK: ilanin
 * taslak mi oldugu ya da kac teklifte kullanildigi saticinin kendi
 * ekranina ait. Bu tipte de bilerek yer almiyorlar.
 */
export type ListingCard = {
  id: number;
  reference: string;
  title: string;
  price: string | null;
  cover_url: string | null;
  category: ListingCategory | null;
  location: ListingLocation;
  image_count: number;
  created_at: string | null;
};

type ListingImage = { id: number; url: string };
/** Ozellik tablosunun bir satiri; deger sematik oldugu icin serbest tipte. */
type ListingAttribute = { key: string; label: string; value: unknown; unit: string | null };

type ListingFull = ListingCard & {
  description: string;
  images: ListingImage[];
  attributes: ListingAttribute[];
  seller: { id: number; name: string; logo_url: string | null };
};

const money = (value: string) => new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(Number(value));
const dayMonthYear = (value: string) => new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(value));

/** "Istanbul / Kadikoy" bicimi; ikisinden biri eksikse tek parca yazilir. */
export const placeOf = (location: ListingLocation) =>
  [location.city, location.district].filter(Boolean).join(" / ");

/** Sema degeri metne cevrilir: dizi, evet/hayir ve sayi ayri ele alinir. */
const attributeText = (row: ListingAttribute): string => {
  const raw = row.value;
  let text: string;

  if (Array.isArray(raw)) text = raw.map((item) => String(item)).join(", ");
  else if (typeof raw === "boolean") text = raw ? "Evet" : "Hayır";
  else if (typeof raw === "number") text = new Intl.NumberFormat("tr-TR").format(raw);
  else text = String(raw ?? "");

  return row.unit ? `${text} ${row.unit}` : text;
};

/** Logosu olmayan magaza icin bas harf rozeti. */
const initialOf = (name: string) => (name.trim().charAt(0) || "M").toLocaleUpperCase("tr-TR");

/**
 * Ilan detayi. Her mantiksal grup kendi kenarlikli blogu: fotograf,
 * fiyat + ilan kunyesi, magaza, ilan bilgileri ve aciklama. Okuyan
 * kisi ayristirmak yerine tarasin diye bloklar bitisik degil, aralikli.
 *
 * Masaustunde iki kolon: solda genis kolonda fotograf, ozellik tablosu
 * ve aciklama; sagda dar ve yapiskan kolonda fiyat ile magaza. Tablet ve
 * telefonda kolonlar alt alta gelir ve fiyat, ozellik tablosundan once
 * okunur; hicbir sey yapiskan kalmaz.
 *
 * Vitrinden ayrilmadan acilsin diye katman (modal) secildi: sayfa zaten
 * tek bir /sellers/{id} cagrisiyla dolan bir istemci bileseni ve calisma
 * detayi da ayni sekilde katmanda aciliyor. Ayri bir rota olsaydi geri
 * donuste butun vitrin yeniden yuklenir, kaydirma yeri kaybolurdu.
 */
export function ListingDetail({ listing, sellerName, onClose, onQuote }: {
  listing: ListingCard;
  sellerName: string;
  onClose: () => void;
  onQuote: (categorySlug?: string) => void;
}) {
  const [detail, setDetail] = useState<ListingFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [index, setIndex] = useState(0);

  useEffect(() => {
    let active = true;
    apiRequest<{ data: ListingFull }>(`/listings/${listing.id}`)
      .then((response) => { if (active) setDetail(response.data); })
      // 404 govdesi Laravel ic mesaji tasiyabilir; kullaniciya sade metin gosterilir.
      .catch((requestError: unknown) => {
        if (!active) return;
        const status = requestError instanceof ApiError ? requestError.status : 0;
        setError(status === 404 ? "İlan bulunamadı ya da artık yayında değil." : firstApiError(requestError));
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [listing.id]);

  const images = detail?.images ?? [];
  const total = images.length;

  // Klavye oklari fotograflar arasinda gezdirir; tek fotografta baglanmaz.
  useEffect(() => {
    if (total < 2) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") setIndex((current) => (current + 1) % total);
      if (event.key === "ArrowLeft") setIndex((current) => (current - 1 + total) % total);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [total]);

  // Fotograf silinmis olabilir: dizin her zaman var olan bir kareyi gostermeli.
  const shown = total > 0 ? Math.min(index, total - 1) : 0;
  const place = placeOf(listing.location);
  const category = detail?.category ?? listing.category;
  const price = detail?.price ?? listing.price;
  const createdAt = detail?.created_at ?? listing.created_at;
  const subtitle = [category?.name, place, `İlan No: ${listing.reference}`].filter(Boolean).join(" · ");
  const storeName = detail?.seller.name ?? sellerName;
  const storeLogo = detail?.seller.logo_url ?? null;

  return <Modal
    onClose={onClose}
    open
    size="xl"
    subtitle={subtitle}
    title={detail?.title ?? listing.title}
  >
    {error ? <p className={styles.state}>{error}</p> : <div className={styles.detail}>

      {/* ---- Fotograf blogu: buyuk kare ve altinda ayni kartta serit ---- */}
      <section className={`${styles.block} ${styles.photoBlock}`}>
        {total > 0 ? <>
          <figure className={styles.stage}>
            {/* Kullanici yuklemesi; olculer bilinmedigi icin img kullanilir. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt={`${listing.title} — fotoğraf ${shown + 1}`} src={images[shown].url} />
            {total > 1 && <>
              <button aria-label="Önceki fotoğraf" className={`${styles.arrow} ${styles.prev}`} onClick={() => setIndex((current) => (current - 1 + total) % total)} type="button">←</button>
              <button aria-label="Sonraki fotoğraf" className={`${styles.arrow} ${styles.next}`} onClick={() => setIndex((current) => (current + 1) % total)} type="button">→</button>
            </>}
            <figcaption>{shown + 1}/{total} Fotoğraf</figcaption>
          </figure>

          {total > 1 && <div className={styles.strip}>
            {images.map((image, position) => <button
              aria-label={`Fotoğraf ${position + 1}`}
              className={position === shown ? `${styles.thumb} ${styles.thumbOn}` : styles.thumb}
              key={image.id}
              onClick={() => setIndex(position)}
              type="button"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt="" loading="lazy" src={image.url} />
            </button>)}
          </div>}
        </> : <div className={styles.noImage}>
          {loading ? <i /> : <span>{category?.icon ?? "▦"}</span>}
          <p>{loading ? "İlan yükleniyor…" : "Bu ilana fotoğraf eklenmemiş."}</p>
        </div>}
      </section>

      {/* ---- Sag kolon: fiyat ve magaza; masaustunde yapiskan ---- */}
      <aside className={styles.side}>
        <div className={styles.sideInner}>
          <section className={`${styles.block} ${styles.priceBlock}`}>
            <p className={styles.blockLabel}>Fiyat</p>
            {price
              ? <strong>{money(price)}</strong>
              : <strong className={styles.askPrice}>Fiyat sorunuz</strong>}
            {place && <span className={styles.place}>📍 {place}</span>}

            <dl className={styles.rows}>
              <div><dt>İlan No</dt><dd className={styles.mono}>{listing.reference}</dd></div>
              {createdAt && <div><dt>İlan Tarihi</dt><dd>{dayMonthYear(createdAt)}</dd></div>}
              {category && <div><dt>Kategori</dt><dd>{category.icon ? `${category.icon} ` : ""}{category.name}</dd></div>}
              {listing.location.city && <div><dt>Şehir</dt><dd>{listing.location.city}</dd></div>}
              {listing.location.district && <div><dt>İlçe</dt><dd>{listing.location.district}</dd></div>}
            </dl>
          </section>

          <section className={`${styles.block} ${styles.sellerBlock}`}>
            <p className={styles.blockLabel}>Mağaza</p>
            <div className={styles.sellerRow}>
              {storeLogo
                // eslint-disable-next-line @next/next/no-img-element
                ? <img alt="" loading="lazy" src={storeLogo} />
                : <i>{initialOf(storeName)}</i>}
              <div>
                <strong>{storeName}</strong>
                <span>Bu ilanın satıcısı</span>
              </div>
            </div>
            <button className={styles.cta} onClick={() => onQuote(category?.slug)} type="button">Bu ürün için teklif iste →</button>
          </section>
        </div>
      </aside>

      {/* ---- Sol kolonun alti: ozellik tablosu ve aciklama ---- */}
      <div className={styles.info}>
        <section className={styles.block}>
          <p className={styles.blockLabel}>İlan Bilgileri</p>
          {loading && detail === null
            ? <p className={styles.specEmpty}>Özellikler yükleniyor…</p>
            : (detail?.attributes.length ?? 0) === 0
              ? <p className={styles.specEmpty}>Bu ilan için özellik girilmemiş.</p>
              : <dl className={styles.rows}>
                {detail?.attributes.map((row) => <div key={row.key}>
                  <dt>{row.label}</dt>
                  <dd>{attributeText(row)}</dd>
                </div>)}
              </dl>}
        </section>

        {detail?.description && <section className={styles.block}>
          <p className={styles.blockLabel}>Açıklama</p>
          <p className={styles.descText}>{detail.description}</p>
        </section>}
      </div>
    </div>}
  </Modal>;
}
