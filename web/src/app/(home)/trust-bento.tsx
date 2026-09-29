"use client";

import styles from "../marketplace.module.css";
import { CatalogStats } from "./home-data";
import { useInView, useReducedMotion } from "./home-hooks";

const sayi = new Intl.NumberFormat("tr-TR");

const OLD_WAY = [
  { emoji: "🔎", text: "İlan ilan gez" },
  { emoji: "📞", text: "Herkesi tek tek ara" },
  { emoji: "🔁", text: "Aynı şeyi baştan anlat" },
  { emoji: "⏳", text: "Fiyat için dönüş bekle" },
];

const NEW_WAY = [
  { emoji: "✍️", text: "Bir kez yaz" },
  { emoji: "📨", text: "Teklifler sana gelsin" },
  { emoji: "⚖️", text: "Yan yana karşılaştır" },
  { emoji: "🤝", text: "En iyisini seç" },
];

/**
 * "Farkimiz" bento izgarasi.
 *
 * Istatistik hapi GERCEK sayilari tasir: /service-catalog stats.
 * Animasyon yalnizca kutu ekrana girdiginde ve hareket kisitli degilse
 * baslar; kisitliysa .bentoAnim hic yazilmaz, her sey yerinde durur.
 */
export function TrustBento({ stats }: { stats: CatalogStats | null }) {
  const reduced = useReducedMotion();
  const [ref, seen] = useInView<HTMLDivElement>(!reduced);
  const animated = !reduced;

  const classes = [
    styles.bento,
    animated ? styles.bentoAnim : "",
    !animated || seen ? styles.bentoPlay : "",
  ].filter(Boolean).join(" ");

  return <>
    <div className={`${styles.secHead} ${styles.secHeadRow}`}>
      <div>
        <span className={styles.eyebrow}>Farkımız</span>
        <h2 id="trust-title">
          Neden <span className={styles.brandInline}>alıcam<b>.net</b></span>&apos;i tercih etmeliyim,{" "}
          <em className={styles.hAccent}>farkınız nedir?</em>
        </h2>
        <p>
          <strong>Aramak, sormak, beklemek yok.</strong> İlan ilan gezip herkese aynı şeyi anlatmak yerine bir kez yaz.
          Uygun olanlar sana gelsin, sen de en iyisini seç.
        </p>
      </div>

      <dl className={styles.statsPill}>
        <div><dt>{stats ? `${sayi.format(stats.service_headings)}+` : "—"}</dt><dd>hizmet başlığı</dd></div>
        <div><dt>{stats ? sayi.format(stats.service_roots) : "—"}</dt><dd>hizmet alanı</dd></div>
        <div><dt>{stats ? sayi.format(stats.cities) : "—"}</dt><dd>ilde talep</dd></div>
      </dl>
    </div>

    <div className={classes} ref={ref}>
      <article className={`${styles.bx} ${styles.bxCompare}`}>
        <span className={styles.bxTag}>Farkı gör</span>
        <h3>Eskiden saatler sürerdi.<br /><em>Şimdi 2 dakika.</em></h3>
        <p className={styles.cmpLead}>
          Tek bir talep yaz; ustalar, emlakçılar, galeriler ve satıcılar sana gelsin.
          Aramak, beklemek, herkese aynı şeyi anlatmak yok.
        </p>

        <div className={styles.road}>
          <div className={`${styles.roadCol} ${styles.roadOld}`}>
            <small>Eski yol</small>
            <ol>{OLD_WAY.map((step) => <li key={step.text}><i>{step.emoji}</i>{step.text}</li>)}</ol>
          </div>
          <div aria-hidden="true" className={styles.roadArrow}><span>→</span></div>
          <div className={`${styles.roadCol} ${styles.roadNew}`}>
            <small>alıcam.net ile</small>
            <ol>{NEW_WAY.map((step) => <li key={step.text}><i>{step.emoji}</i>{step.text}</li>)}</ol>
          </div>
        </div>
      </article>

      <article className={`${styles.bx} ${styles.bxFree}`}>
        <span className={`${styles.bxTag} ${styles.tagGreen}`}>Talep eden için</span>
        <div className={styles.bigZero}><b>0</b><span>₺</span></div>
        <ul className={styles.ticks}>
          <li>Talep oluşturmak</li><li>Teklif almak</li><li>Karşılaştırmak</li>
        </ul>
      </article>

      <article className={`${styles.bx} ${styles.bxPrivacy}`}>
        <span className={styles.bxTag}>Bilgilerin korunur</span>
        <h3>Numaran sende kalır.</h3>
        <div className={styles.peek}>
          <div className={`${styles.peekRow} ${styles.peekSee}`}>
            <small>Teklif verenler görür</small>
            <span>🏠 3+1 kiralık · Kadıköy · 35–42 bin ₺</span>
          </div>
          <div className={`${styles.peekRow} ${styles.peekHide}`}>
            <small>Gizli kalır</small>
            <span>
              <b className={styles.mask}>A•••• Y••••</b>
              <b className={styles.mask}>05•• ••• •• ••</b>
              <i>🔒</i>
            </span>
          </div>
        </div>
      </article>

      <article className={`${styles.bx} ${styles.bxRadar}`}>
        <div className={styles.radarBody}>
          <div aria-hidden="true" className={styles.radar}>
            <i className={`${styles.ring} ${styles.r1}`} />
            <i className={`${styles.ring} ${styles.r2}`} />
            <i className={`${styles.ring} ${styles.r3}`} />
            <i className={styles.sweep} />
            <b className={styles.you}>📍</b>
            <b className={`${styles.pin} ${styles.p1}`}>🛠️</b>
            <b className={`${styles.pin} ${styles.p2}`}>🏠</b>
            <b className={`${styles.pin} ${styles.p3}`}>🚗</b>
            <b className={`${styles.pin} ${styles.p4}`}>🛍️</b>
          </div>
          <span className={styles.bxTag}>Sadece bölgendekiler</span>
          <h3>Talebin yakınındakilere düşer.</h3>
          <p>
            {stats
              ? `${sayi.format(stats.cities)} il ve ${sayi.format(stats.districts)} ilçe tanımlı; `
              : ""}
            ilçene hizmet veren ustalar, emlakçılar ve satıcılar görür, uzaktan boşuna teklif gelmez.
          </p>
        </div>
      </article>

      <article className={`${styles.bx} ${styles.bxTrust}`}>
        <span className={`${styles.bxTag} ${styles.tagOrangeSoft}`}>Onaylı ve puanlı</span>
        <div className={styles.vcardMini}>
          <span className={styles.vmAv}>IT<b>✓</b></span>
          <div><strong>Isı Teknik Servis</strong><small>Örnek profil · Kadıköy</small></div>
        </div>
        <ul className={styles.checks}>
          <li>Profil incelendi</li><li>Hizmet bölgesi doğrulandı</li><li>Kategori onaylandı</li>
        </ul>
        <div aria-label="5 üzerinden 4,9 puan" className={styles.stars}>
          <span className={styles.starsFill} /><b>4,9</b><small>gerçek işlerden</small>
        </div>
      </article>
    </div>
  </>;
}
