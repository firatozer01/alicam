"use client";

import { useEffect, useState } from "react";
import styles from "../marketplace.module.css";
import { HERO_SAMPLES, findVertical } from "./home-data";
import { useReducedMotion } from "./home-hooks";

const SWAP_AT = 7200;
const NEXT_AT = 7600;
const FIRST_OFFER = 900;
const OFFER_GAP = 1400;
const TOAST_LIFE = 1600;

/** Fiyati en dusuk teklifin sirasi; "en iyi" rozeti ona takilir. */
function cheapestIndex(prices: string[]): number {
  let best = 0;

  prices.forEach((price, index) => {
    const value = Number(price.replace(/\D/g, ""));
    if (value < Number(prices[best].replace(/\D/g, ""))) best = index;
  });

  return best;
}

/**
 * Hero'nun sag tarafindaki canlandirma.
 *
 * Bu kart ORNEKTIR; ustundeki etiket bunu soyler. Gercek talep akisi
 * "Son talepler" bolumunde ve GET /marketplace'ten gelir. Hareketi
 * kisitlanmis tarayicida tek ornek, teklifleri tamam halde durur.
 */
export function HeroVisual() {
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [cycle, setCycle] = useState(0);
  const [count, setCount] = useState(0);
  const [swap, setSwap] = useState(false);
  const [toastText, setToastText] = useState("");
  const [toastOn, setToastOn] = useState(false);

  useEffect(() => {
    if (reduced) return;
    // Sekme arka plandayken tarayici zamanlayicilari kisiyor, hatta
    // donduruyor; geri donuldugunde bekleyen teklifler topluca
    // atesleniyor ve baloncuk pesi sira yanip soniyordu. Maketteki
    // gibi durdurup ayni ornegin basindan basliyoruz.
    const onVisibility = () => {
      setCount(0);
      setToastOn(false);
      setCycle((current) => current + 1);
    };

    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [reduced]);

  useEffect(() => {
    if (reduced || document.hidden) return;

    const sample = HERO_SAMPLES[index];
    const timers: number[] = [];

    sample.offers.forEach((offer, order) => {
      const at = FIRST_OFFER + order * OFFER_GAP;
      timers.push(window.setTimeout(() => {
        setCount(order + 1);
        setToastText(`${offer.name} — ${offer.price}`);
        setToastOn(true);
      }, at));
    });

    // Baloncuk teklif basina acilip kapanmiyor: BIR KEZ aciliyor, metni
    // her yeni teklifte degisiyor, son teklifin ardindan kapaniyor.
    // Her teklife ayri kapatma zamanlayicisi verilirse (maketteki hali)
    // o zamanlayici bir sonraki teklif ekrana geldikten 200ms sonra
    // atesleniyor -- TOAST_LIFE 1600, teklif araligi 1400 -- ve
    // baloncuk gidip geliyor.
    const last = FIRST_OFFER + (sample.offers.length - 1) * OFFER_GAP;
    timers.push(window.setTimeout(() => setToastOn(false), last + TOAST_LIFE));

    timers.push(window.setTimeout(() => setSwap(true), SWAP_AT));
    timers.push(window.setTimeout(() => {
      setSwap(false);
      setCount(0);
      setIndex((current) => (current + 1) % HERO_SAMPLES.length);
    }, NEXT_AT));

    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [cycle, index, reduced]);

  const sample = HERO_SAMPLES[index];
  const vertical = findVertical(sample.vertical);
  const visible = reduced ? sample.offers.length : count;
  const best = cheapestIndex(sample.offers.map((offer) => offer.price));
  const allIn = visible === sample.offers.length;

  return <div aria-label="Örnek talep ve gelen teklifler" className={styles.heroVisual}>
    <p className={styles.hvNote}>Örnek · teklifler böyle gelir</p>

    <div className={`${styles.hvMain}${swap ? ` ${styles.hvSwap}` : ""}`}>
      <div className={styles.hvTop}>
        <span className={styles.hvType} style={{ "--c": vertical.color } as React.CSSProperties}>
          {vertical.emoji} {vertical.name} talebi
        </span>
        <span className={styles.hvLive}><i />Yayında</span>
      </div>

      <div className={styles.hvTitle}>{sample.title}</div>
      <div className={styles.hvLoc}>📍 {sample.loc}</div>

      <div className={styles.hvSpecs}>
        {sample.specs.map((spec) => <span key={spec}>{spec}</span>)}
      </div>

      <div className={styles.hvFoot}>
        <div className={styles.hvBudget}><small>BÜTÇE</small><b>{sample.budget}</b></div>
        <div className={styles.hvCount}><b>{visible}</b><small>teklif geldi</small></div>
      </div>
    </div>

    <div className={styles.hvStack}>
      {sample.offers.slice(0, visible).map((offer, order) => (
        <div
          className={`${styles.offer}${allIn && order === best ? ` ${styles.offerBest}` : ""}`}
          key={`${index}-${offer.initials}`}
        >
          <span className={styles.av} style={{ "--c": offer.color } as React.CSSProperties}>{offer.initials}</span>
          <div className={styles.offerB}>
            <strong>{offer.name}</strong>
            <small><span className={styles.star}>★</span> {offer.rating} · {offer.note}</small>
          </div>
          <b>{offer.price}</b>
        </div>
      ))}
    </div>

    {/* Metin kapanirken SILINMIYOR: silinirse 0,4 sn'lik solmanin
        tamami bos bir lacivert kutu olarak gorunuyor. */}
    <div aria-live="polite" className={`${styles.hvToast}${toastOn ? ` ${styles.hvToastShow}` : ""}`}>
      {toastText && <><i>🔔</i> Yeni teklif: {toastText}</>}
    </div>
  </div>;
}
