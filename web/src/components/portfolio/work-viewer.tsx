"use client";

import { useEffect, useState } from "react";
import styles from "./work-viewer.module.css";

export type WorkImage = { id: number; url: string };
export type WorkCategory = { name: string; icon: string; color: string };
export type Work = {
  id: number; title: string; description: string; location: string | null;
  duration?: string | null; area?: string | null; budget?: string | number | null;
  client_type?: string | null; highlights?: string[];
  completed_at: string | null; category: WorkCategory | null; images: WorkImage[];
};

const monthYear = (value: string) => new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric" }).format(new Date(value));
const money = (value: string | number) => new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(Number(value));

type WorkSpec = { key: string; icon: string; label: string; value: string };

/** Kunye satirlari: yalnizca doldurulmus alanlar gosterilir. */
export function workSpecs(work: Work): WorkSpec[] {
  return [
    work.duration ? { key: "duration", icon: "⏱", label: "Süre", value: work.duration } : null,
    work.area ? { key: "area", icon: "◱", label: "Alan / ölçü", value: work.area } : null,
    work.budget ? { key: "budget", icon: "◆", label: "İş bedeli", value: money(work.budget) } : null,
    work.client_type ? { key: "client", icon: "⌂", label: "Müşteri tipi", value: work.client_type } : null,
  ].filter((row): row is WorkSpec => row !== null);
}

/** Çalışma detayı: büyük görsel, küçük görsel şeridi ve künye. */
export function WorkViewer({ work, actions }: { work: Work; actions?: React.ReactNode }) {
  const [index, setIndex] = useState(0);
  const [shownWorkId, setShownWorkId] = useState(work.id);
  const total = work.images.length;
  const specs = workSpecs(work);
  const highlights = work.highlights ?? [];

  // Baska bir calisma gosterilince karusel basa doner. Efekt yerine render
  // sirasinda ayarlanir; boylece fazladan bir render turu olusmaz.
  if (shownWorkId !== work.id) {
    setShownWorkId(work.id);
    setIndex(0);
  }

  useEffect(() => {
    if (total < 2) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") setIndex((current) => (current + 1) % total);
      if (event.key === "ArrowLeft") setIndex((current) => (current - 1 + total) % total);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [total]);

  return <div className={styles.viewer}>
    {total > 0 ? <figure className={styles.stage}>
      {/* Kullanıcı yüklemesi; boyutlar bilinmediği için img kullanılır. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt={`${work.title} — görsel ${index + 1}`} src={work.images[index].url} />
      {total > 1 && <>
        <button aria-label="Önceki görsel" className={`${styles.arrow} ${styles.prev}`} onClick={() => setIndex((current) => (current - 1 + total) % total)} type="button">←</button>
        <button aria-label="Sonraki görsel" className={`${styles.arrow} ${styles.next}`} onClick={() => setIndex((current) => (current + 1) % total)} type="button">→</button>
        <figcaption>{index + 1} / {total}</figcaption>
      </>}
    </figure> : <div className={styles.noImage}>Bu çalışmaya henüz görsel eklenmemiş.</div>}

    {total > 1 && <div className={styles.strip}>
      {work.images.map((image, position) => <button
        aria-label={`Görsel ${position + 1}`}
        className={position === index ? styles.active : ""}
        key={image.id}
        onClick={() => setIndex(position)}
        type="button"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img alt="" loading="lazy" src={image.url} />
      </button>)}
    </div>}

    <div className={styles.facts}>
      {work.category && <span style={{ background: `${work.category.color}15`, color: work.category.color }}>{work.category.icon} {work.category.name}</span>}
      {work.location && <span>📍 {work.location}</span>}
      {work.completed_at && <span>🗓 {monthYear(work.completed_at)}</span>}
      <span>🖼 {total} görsel</span>
    </div>

    {specs.length > 0 && <dl className={styles.specs}>
      {specs.map((spec) => <div key={spec.key}>
        <dt>{spec.icon} {spec.label}</dt>
        <dd>{spec.value}</dd>
      </div>)}
    </dl>}

    <p className={styles.description}>{work.description}</p>

    {highlights.length > 0 && <section className={styles.highlights}>
      <h4>Bu işte yapılanlar</h4>
      <ul>{highlights.map((line, position) => <li key={position} style={{ "--i": position } as React.CSSProperties}>{line}</li>)}</ul>
    </section>}

    {actions && <div className={styles.actions}>{actions}</div>}
  </div>;
}
