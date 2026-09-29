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
  const [count, setCount] = useState(0);
  const [swap, setSwap] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (reduced) return;

    const sample = HERO_SAMPLES[index];
    const timers: number[] = [];

    sample.offers.forEach((offer, order) => {
      const at = FIRST_OFFER + order * OFFER_GAP;
      timers.push(window.setTimeout(() => {
        setCount(order + 1);
        setToast(`${offer.name} — ${offer.price}`);
      }, at));
      timers.push(window.setTimeout(() => setToast(""), at + TOAST_LIFE));
    });

    timers.push(window.setTimeout(() => setSwap(true), SWAP_AT));
    timers.push(window.setTimeout(() => {
      setSwap(false);
      setCount(0);
      setToast("");
      setIndex((current) => (current + 1) % HERO_SAMPLES.length);
    }, NEXT_AT));

    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [index, reduced]);

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

    <div aria-live="polite" className={`${styles.hvToast}${toast ? ` ${styles.hvToastShow}` : ""}`}>
      {toast && <><i>🔔</i> Yeni teklif: {toast}</>}
    </div>
  </div>;
}
