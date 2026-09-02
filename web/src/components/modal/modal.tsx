"use client";

import { useEffect, useRef } from "react";
import styles from "./modal.module.css";

/**
 * Sayfa akışını itmeyen katman. Esc ve dışarı tıklamayla kapanır, açıkken
 * arka plan kaydırması kilitlenir ve odak katmanın içinde tutulur.
 */
export function Modal({ open, onClose, title, subtitle, size = "md", footer, children }: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  size?: "md" | "lg" | "xl";
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { onClose(); return; }
      if (event.key !== "Tab") return;

      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };

    // Kaydırma çubuğu kaybolunca sayfa yana kaymasın diye genişliği telafi et.
    const gap = window.innerWidth - document.documentElement.clientWidth;
    const previousOverflow = document.body.style.overflow;
    const previousPadding = document.body.style.paddingRight;
    document.body.style.overflow = "hidden";
    if (gap > 0) document.body.style.paddingRight = `${gap}px`;

    document.addEventListener("keydown", onKey);
    window.setTimeout(() => panelRef.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus(), 40);

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPadding;
    };
  }, [open, onClose]);

  if (!open) return null;

  return <div className={styles.overlay} onPointerDown={(event) => { if (event.target === event.currentTarget) onClose(); }} role="presentation">
    <div aria-labelledby="modal-title" aria-modal="true" className={`${styles.panel} ${styles[size]}`} ref={panelRef} role="dialog">
      <header className={styles.head}>
        <div><h2 id="modal-title">{title}</h2>{subtitle && <p>{subtitle}</p>}</div>
        <button aria-label="Kapat" className={styles.close} onClick={onClose} type="button">✕</button>
      </header>
      <div className={styles.body}>{children}</div>
      {footer && <footer className={styles.foot}>{footer}</footer>}
    </div>
  </div>;
}
