"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import styles from "../marketplace.module.css";
import {
  Catalog, CatalogChild, CatalogGroup, ListingRoot, VERTICALS, VerticalId, talepUrl,
} from "./home-data";
import { useIsPhone } from "./home-hooks";

const sayi = new Intl.NumberFormat("tr-TR");

type Props = {
  catalog: Catalog | null;
  childrenByRoot: Record<string, CatalogChild[]>;
  requestRoot: (slug: string) => void;
};

/**
 * Kok kartinin gorseli.
 *
 * next/image BURADA KULLANILAMAZ: /api/... yolu Laravel'e giden bir Next
 * rewrite'i ve gorsel iyilestirici onu cozemiyor ("received null").
 * Kucultme sunucuda, yazma aninda yapiliyor (App\Services\CategoryImage).
 */
function Shot({ alt, className, emoji, url }: { alt: string; className: string; emoji: string; url: string | null }) {
  if (!url) return <i className={className}>{emoji}</i>;

  return <span className={className}>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img alt={alt} loading="lazy" src={url} />
  </span>;
}

/**
 * Hizmet sekmesindeki bir alan kutusu; telefonda akordeon olur.
 *
 * Ac-kapa dugmesi basligin ustune tam boy ve gorunmez oturur: boylece
 * baslik yine h3 kalir, dokunma alani buyuk olur ve ekran okuyucu
 * genisletme durumunu okuyabilir.
 */
function AreaCard({ group, open, phone, onToggle }: {
  group: CatalogGroup;
  open: boolean;
  phone: boolean;
  onToggle: (id: number, next: boolean) => void;
}) {
  const classes = [styles.area, phone ? styles.areaFold : "", phone && open ? styles.areaOpen : ""]
    .filter(Boolean).join(" ");

  return <div className={classes}>
    <div className={styles.areaHead}>
      <Shot alt="" className={group.image_url ? styles.areaShot : ""} emoji={group.icon} url={group.image_url} />
      <h3>{group.name}</h3>
      {phone && (
        <button
          aria-expanded={open}
          className={styles.areaToggle}
          onClick={() => onToggle(group.id, !open)}
          type="button"
        >
          <span className={styles.sr}>{group.name} başlıklarını {open ? "gizle" : "göster"}</span>
        </button>
      )}
    </div>

    <ul>
      {group.children.slice(0, 6).map((child) => (
        <li key={child.id}>
          <Link href={talepUrl({ tip: "hizmet", kategori: child.slug })} title={child.name}>
            <i>{child.icon ?? group.icon}</i><span>{child.name}</span><b>›</b>
          </Link>
        </li>
      ))}
    </ul>

    <Link className={styles.areaAll} href={talepUrl({ tip: "hizmet", kategori: group.slug })}>
      Tüm {group.child_count} başlığı gör <span>→</span>
    </Link>
  </div>;
}

export function CategoryPanel({ catalog, childrenByRoot, requestRoot }: Props) {
  const router = useRouter();
  const phone = useIsPhone();
  const [active, setActive] = useState<VerticalId>("hizmet");
  const [openArea, setOpenArea] = useState<number | null>(null);
  const [freeText, setFreeText] = useState("");

  const vertical = VERTICALS.find((item) => item.id === active) ?? VERTICALS[0];

  // Urun dikeylerinin alt basliklari sekme acilinca bir kez yuklenir.
  useEffect(() => {
    vertical.roots.forEach((slug) => requestRoot(slug));
  }, [vertical, requestRoot]);

  /**
   * Ust cubuktan dikey secimi.
   *
   * SiteHeader "Emlak" gibi bir baglantiya tiklandiginda sessionStorage'a
   * "alicam-v" yazip /#kategoriler'e gidiyor; statik tasarimdaki sozlesmenin
   * aynisi. Ana sayfa zaten acikken yeniden baglanma olmadigi icin tiklama
   * ve hashchange de dinleniyor. setState hep bir dinleyicinin icinden
   * cagriliyor, etki govdesinden degil.
   */
  useEffect(() => {
    const apply = () => {
      let stored: string | null = null;
      try {
        stored = window.sessionStorage.getItem("alicam-v");
        if (stored) window.sessionStorage.removeItem("alicam-v");
      } catch { /* depolama kapali */ }

      if (!stored || !VERTICALS.some((item) => item.id === stored)) return;
      setActive(stored as VerticalId);
      setOpenArea(null);
    };

    // Ilk okuma etki govdesinde degil, bir sonraki tik'te olur.
    const first = window.setTimeout(apply, 0);

    window.addEventListener("hashchange", apply);
    // Ust cubuk sessionStorage'i kendi onClick'inde yazar; bu dinleyici
    // kabarma asamasinda, yani ondan sonra calisir.
    document.addEventListener("click", apply);

    return () => {
      window.clearTimeout(first);
      window.removeEventListener("hashchange", apply);
      document.removeEventListener("click", apply);
    };
  }, []);

  const roots: ListingRoot[] = useMemo(
    () => (catalog?.listing_roots ?? []).filter((root) => vertical.roots.includes(root.slug)),
    [catalog, vertical],
  );

  const tiles = useMemo(
    () => vertical.roots.flatMap((slug) => childrenByRoot[slug] ?? []),
    [vertical, childrenByRoot],
  );

  /** Sekme seridindeki sayi: yalnizca gercekten bilindiginde yazilir. */
  const countOf = (id: VerticalId): number | null => {
    if (id === "hizmet") return catalog?.stats.service_headings ?? null;

    const item = VERTICALS.find((entry) => entry.id === id);
    if (!item) return null;

    const loaded = item.roots.every((slug) => childrenByRoot[slug]);
    return loaded ? item.roots.reduce((total, slug) => total + (childrenByRoot[slug]?.length ?? 0), 0) : null;
  };

  const onFree = (event: FormEvent) => {
    event.preventDefault();
    const text = freeText.trim();
    if (!text) return;
    router.push(talepUrl({ tip: "hizmet", hizmet: text }));
  };

  const groups = catalog?.groups ?? [];
  const popular = catalog?.popular ?? [];

  return <>
    <div aria-label="Kategori türü" className={styles.catTabs} role="tablist">
      {VERTICALS.map((item) => {
        const count = countOf(item.id);

        return <button
          aria-selected={item.id === active}
          key={item.id}
          onClick={() => { setActive(item.id); setOpenArea(null); }}
          role="tab"
          type="button"
        >
          {item.emoji} {item.name}
          {count !== null && <small>{sayi.format(count)}</small>}
        </button>;
      })}
    </div>

    <div className={styles.catPanel} key={active} role="tabpanel">
      {active === "hizmet" ? (
        <div className={styles.areas}>
          {groups.map((group) => (
            <AreaCard
              group={group}
              key={group.id}
              onToggle={(id, next) => setOpenArea(next ? id : null)}
              open={openArea === group.id}
              phone={phone}
            />
          ))}

          {groups.length === 0 && Array.from({ length: 8 }, (_, index) => (
            <span className={`${styles.skel} ${styles.skelArea}`} key={index} />
          ))}

          {groups.length > 0 && <>
            <form className={`${styles.area} ${styles.areaFree}`} onSubmit={onFree}>
              <div className={styles.areaHead}><i>✍️</i><h3>Aradığın başlık yok mu?</h3></div>
              <p>Listede olmasa da olur. Ne lazım olduğunu kendi cümlelerinle yaz, uygun ustalar sana teklif versin.</p>
              <label className={styles.afInput}>
                <span className={styles.sr}>Ne lazım?</span>
                <input
                  onChange={(event) => setFreeText(event.target.value)}
                  placeholder="Örn. akıllı ev kurulumu"
                  required
                  value={freeText}
                />
              </label>
              <button className={`${styles.btn} ${styles.btnCta}`} type="submit">Talep oluştur →</button>
            </form>

            <div className={`${styles.area} ${styles.areaTop}`}>
              <div className={styles.areaHead}><i>🔥</i><h3>En çok istenen başlıklar</h3></div>
              <ol>
                {popular.slice(0, 5).map((card, order) => (
                  <li key={card.id}>
                    <Link href={talepUrl({ tip: "hizmet", kategori: card.slug })}>
                      <b>{order + 1}</b><span>{card.name}</span><small>{sayi.format(card.request_count)} talep</small>
                    </Link>
                  </li>
                ))}
              </ol>
            </div>
          </>}
        </div>
      ) : (
        <>
          <div className={styles.rootStrip}>
            {roots.map((root) => (
              <Link
                className={styles.rootCard}
                href={talepUrl({ tip: active, kategori: root.slug })}
                key={root.id}
                style={{ "--c": vertical.color } as React.CSSProperties}
              >
                <Shot alt={root.name} className={styles.rootShot} emoji={root.icon} url={root.image_url} />
                <span className={styles.rootBody}>
                  <strong>{root.name}</strong>
                  <small>{childrenByRoot[root.slug]?.length ?? 0} başlık · talebini yaz, {vertical.who} teklif versin</small>
                  <em>Talep oluştur →</em>
                </span>
              </Link>
            ))}

            {roots.length === 0 && Array.from({ length: 1 }, (_, index) => (
              <span className={`${styles.skel} ${styles.skelRoot}`} key={index} />
            ))}
          </div>

          <div className={styles.tiles}>
            {tiles.map((child) => (
              <Link
                className={styles.tile}
                href={talepUrl({ tip: active, kategori: child.slug })}
                key={child.id}
                style={{ "--c": vertical.color } as React.CSSProperties}
                title={child.name}
              >
                <i>{child.icon ?? vertical.emoji}</i><span>{child.name}</span><b>→</b>
              </Link>
            ))}

            {tiles.length === 0 && Array.from({ length: 8 }, (_, index) => (
              <span className={`${styles.skel} ${styles.skelTile}`} key={index} />
            ))}
          </div>
        </>
      )}

      <div className={styles.panelCta}>
        <p>
          {vertical.emoji} {vertical.name} için talebini yaz, {vertical.who} sana teklif versin.
          <small>Ücretsiz, 2 dakika sürer. İletişim bilgilerin gizli kalır.</small>
        </p>
        <Link className={`${styles.btn} ${styles.btnCta}`} href={talepUrl({ tip: active })}>
          ＋ {vertical.name} talebi oluştur
        </Link>
      </div>
    </div>
  </>;
}
