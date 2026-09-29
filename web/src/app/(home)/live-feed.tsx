"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import styles from "../marketplace.module.css";
import { MarketPayload, MarketRequest, VerticalId, filterSlugs, sinceLabel, verticalOfSlug } from "./home-data";
import { useFeedColumns } from "./home-hooks";

const money = (value: string | number) =>
  new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(Number(value));

type FilterId = VerticalId | "all" | "diger";

const FILTERS: { id: FilterId; label: string }[] = [
  { id: "all", label: "Tümü" },
  { id: "hizmet", label: "🛠️ Hizmet" },
  { id: "emlak", label: "🏠 Emlak" },
  { id: "vasita", label: "🚗 Vasıta" },
  { id: "alisveris", label: "🛍️ Alışveriş" },
  { id: "diger", label: "Diğer" },
];

type Props = {
  /** Katalogtan gelen on hizmet kokunun slug'lari, virgulle. */
  serviceRootsKey: string;
  sellerHref: string;
};

function ZapIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M13.5 2 4 14h6.5L9.5 22 20 9.5h-6.8L13.5 2Z" /></svg>;
}

/** Kartin ust satirindaki etiket ve alt bilgi cipleri. */
function specsOf(item: MarketRequest): string[] {
  const out: string[] = [];

  if (item.budget.min && item.budget.max) out.push(`${money(item.budget.min)} – ${money(item.budget.max)}`);
  else if (item.budget.max) out.push(`${money(item.budget.max)}'ye kadar`);

  out.push(item.category.name);
  item.extra_categories.slice(0, 1).forEach((extra) => out.push(extra.name));

  return out;
}

/**
 * "Insanlar su an bunlari istiyor" — GERCEK acik talepler.
 *
 * GET /marketplace herkese acik bir uc ve metni sunucuda temizleniyor
 * (Text::redactContacts), bu yuzden oldugu gibi cizilebilir. Bolumun
 * amaci alici icin bir talep akisi degil: sosyal kanit ve teklif veren
 * kazanimi; butun eylem baglantilari teklif veren tarafina gider.
 */
export function LiveFeed({ serviceRootsKey, sellerHref }: Props) {
  const [filter, setFilter] = useState<FilterId>("all");
  const [items, setItems] = useState<MarketRequest[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const columns = useFeedColumns();

  useEffect(() => {
    let alive = true;
    const slugs = filterSlugs(filter, serviceRootsKey ? serviceRootsKey.split(",") : []);
    const query = new URLSearchParams({ sort: "latest" });
    if (slugs) query.set("category", slugs);

    apiRequest<MarketPayload>(`/marketplace?${query.toString()}`)
      .then((response) => {
        if (!alive) return;
        setItems(response.data.requests);
        setTotal(response.meta.total);
      })
      .catch(() => { if (alive) setItems([]); })
      .finally(() => { if (alive) setLoading(false); });

    return () => { alive = false; };
  }, [filter, serviceRootsKey]);

  const pick = (id: FilterId) => {
    if (id === filter) return;
    setLoading(true);
    setFilter(id);
  };

  // Yarim satir kalmasin: kaç sütun varsa iki tam satir gosterilir.
  const shown = items.slice(0, columns * 2);

  return <>
    {/* Baslik ve cipler AYNI satirda: mockup'ta .sec-head.row iki
        cocuk aliyor ve cipler saga yasliyor. Cipler ayri bir blokta
        birakilirsa basligin altina duser. */}
    <div className={`${styles.secHead} ${styles.secHeadRow}`}>
      <div>
        <span className={styles.eyebrow}><i className={styles.liveDot} /> Şu an açık</span>
        <h2 id="feed-title">İnsanlar şu an bunları istiyor.</h2>
        <p>Talepler anonim görünür; iletişim bilgisi hiçbir zaman burada yer almaz.</p>
      </div>

      <div aria-label="Talep türü" className={`${styles.chips} ${styles.feedFilter}`} role="toolbar">
      {FILTERS.map((item) => (
        <button
          aria-pressed={item.id === filter}
          className={styles.chip}
          key={item.id}
          onClick={() => pick(item.id)}
          type="button"
        >{item.label}</button>
      ))}
      </div>
    </div>

    <div className={styles.feed}>
      {loading && Array.from({ length: columns * 2 }, (_, index) => (
        <span className={`${styles.skel} ${styles.skelCard}`} key={index} />
      ))}

      {!loading && shown.map((item, order) => {
        const vertical = verticalOfSlug(item.category.slug);

        return <article className={styles.rq} key={item.id}>
          <div className={styles.rqTop}>
            <span className={styles.hvType} style={{ "--c": vertical.color } as React.CSSProperties}>
              {vertical.emoji} {vertical.name}
            </span>
            <span className={styles.rqTime}>{sinceLabel(item.created_at)}</span>
          </div>

          <h3>{item.title}</h3>
          <div className={styles.rqLoc}>📍 {item.location.district.name}, {item.location.city.name}</div>

          <div className={styles.rqSpecs}>
            {specsOf(item).map((spec) => <span key={spec}>{spec}</span>)}
          </div>

          <div className={styles.rqFoot}>
            <Link
              aria-label={`${item.title} talebine hemen teklif ver`}
              className={styles.rqCta}
              href={sellerHref}
              style={{ "--d": `${(order * 0.35).toFixed(2)}s` } as React.CSSProperties}
            >
              <i aria-hidden="true"><ZapIcon /></i>Hemen teklif ver<span aria-hidden="true">→</span>
            </Link>
            <span className={`${styles.rqOffers}${item.offer_count >= 8 ? ` ${styles.rqHot}` : ""}`}>
              {item.offer_count} teklif
            </span>
          </div>
        </article>;
      })}
    </div>

    {!loading && shown.length === 0 && (
      <p className={styles.feedEmpty}>Bu türde şu an açık talep yok. Başka bir başlığa bak ya da ilk talebi sen oluştur.</p>
    )}

    <div className={styles.feedMore}>
      <Link className={`${styles.btn} ${styles.btnLine}`} href={sellerHref}>
        {total === null ? "Tüm açık talepleri gör ve teklif ver →" : `${total.toLocaleString("tr-TR")} açık talebi gör ve teklif ver →`}
      </Link>
    </div>
  </>;
}
