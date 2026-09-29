"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { SiteHeader } from "@/components/shell/site-header";
import styles from "../legal.module.css";

export type LegalTocItem = { id: string; label: string };

type LegalShellProps = {
  /** Hero seridin ust kelimesi, orn. "Veri ve gizlilik". */
  eyebrow: string;
  title: string;
  lead: string;
  /** Hero rozetleri: son guncelleme, okuma suresi. */
  meta: string[];
  /** Icindekiler; sirasi makaledeki bolum sirasiyla ayni olmali. */
  toc: LegalTocItem[];
  /** Sag surundeki yardimci kartlar. */
  aside: ReactNode;
  /** Makale govdesi: ozet kutusu ve numarali bolumler. */
  children: ReactNode;
};

/**
 * Yasal sayfalarin ortak iskeleti — alicam-yeni-tasarim/gizlilik.html ve
 * kullanim-kosullari.html portu.
 *
 * Hero serit, yapiskan icindekiler ve makale. Icindekiler okunan bolumu
 * isaretler: tasarimdaki site.js ile ayni pencere kullanilir, ekranin ust
 * %20'si ve alt %70'i disarida kalir. Dar ekranda icindekiler yatay bir
 * serit olur ve aktif baglantiyi kendiliginden gorunur hale getirir.
 */
export function LegalShell({ eyebrow, title, lead, meta, toc, aside, children }: LegalShellProps) {
  const [activeId, setActiveId] = useState<string>(() => toc[0]?.id ?? "");
  const tocRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;

    let active = true;
    const observer = new IntersectionObserver((entries) => {
      if (!active) return;
      for (const entry of entries) {
        if (entry.isIntersecting) setActiveId(entry.target.id);
      }
    }, { rootMargin: "-20% 0px -70% 0px" });

    for (const item of toc) {
      const section = document.getElementById(item.id);
      if (section) observer.observe(section);
    }

    return () => {
      active = false;
      observer.disconnect();
    };
  }, [toc]);

  // Yatay seritte aktif baglantiyi gorunur tut; hareket azaltma acikken kaydirma ani olur.
  useEffect(() => {
    const nav = tocRef.current;
    if (!nav || !activeId || nav.scrollWidth <= nav.clientWidth) return;

    const link = nav.querySelector<HTMLElement>(`[data-toc="${activeId}"]`);
    if (!link) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    nav.scrollTo({ left: Math.max(0, link.offsetLeft - 16), behavior: reduced ? "auto" : "smooth" });
  }, [activeId]);

  return <>
    <a className={styles.skip} href="#icerik">İçeriğe geç</a>

    <SiteHeader />

    <main id="icerik">
      <section className={styles.hero}>
        <div className={styles.wrap}>
          <span className={styles.eyebrow}>{eyebrow}</span>
          <h1>{title}</h1>
          <p>{lead}</p>
          <div className={styles.meta}>{meta.map((item) => <span className={styles.badge} key={item}>{item}</span>)}</div>
        </div>
      </section>

      <div className={`${styles.wrap} ${styles.legal}`}>
        <nav aria-label="İçindekiler" className={styles.toc} ref={tocRef}>
          <h4 className={styles.tocTitle}>İçindekiler</h4>
          {toc.map((item) => <a
            aria-current={item.id === activeId ? "location" : undefined}
            className={item.id === activeId ? `${styles.tocLink} ${styles.active}` : styles.tocLink}
            data-toc={item.id}
            href={`#${item.id}`}
            key={item.id}
          >{item.label}</a>)}
        </nav>

        <article className={styles.body}>{children}</article>

        <aside className={styles.aside}>{aside}</aside>
      </div>
    </main>
  </>;
}
