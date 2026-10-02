"use client";

import { useEffect, useRef } from "react";
import styles from "./modal.module.css";

/**
 * Acik modallarin yigini, en alttan en uste.
 *
 * Modal ustune modal acilabiliyor: teklif formunun icinden "urun ekle"
 * secicisi gibi. Escape dinleyicisi document uzerinde kuruldugu icin
 * ikisi de ayni olayi goruyordu ve tek tusla IKISI BIRDEN kapaniyordu --
 * kullanici urun listesini kapatmak isterken doldurdugu teklif formunu
 * kaybediyordu. Ayni sey odak tuzagi icin de gecerli: Tab, altta kalan
 * modalin ogelerine de ugruyordu.
 *
 * Yigin modul duzeyinde: iki ayri Modal ornegi birbirini ancak boyle
 * gorebilir.
 */
const yigin: symbol[] = [];

/**
 * Govde kilidi YIGININ TAMAMINA ait, tek tek modallara degil.
 *
 * Once her modal acilirken govdenin o anki overflow degerini saklayip
 * kapanirken geri koyuyordu. Ic ice modalde bu bozuluyor: ustteki acikken
 * alttakinin efekti yeniden calisirsa (onClose her cizimde yeni bir islev
 * oldugu icin siksik oluyor) "onceki deger" olarak KILITLI hali sakliyor
 * ve en son kapanan modal kilidi geri birakmiyordu -- butun modallar
 * kapandigi halde sayfa kaydirilamaz kaliyordu.
 *
 * Artik ilk modal kilitliyor, sonuncusu cozuyor; aradakiler dokunmuyor.
 */
let oncekiOverflow = "";
let oncekiPadding = "";

function govdeyiKilitle(): void {
  // Kaydirma cubugu kaybolunca sayfa yana kaymasin diye genisligi telafi et.
  const bosluk = window.innerWidth - document.documentElement.clientWidth;
  oncekiOverflow = document.body.style.overflow;
  oncekiPadding = document.body.style.paddingRight;
  document.body.style.overflow = "hidden";
  if (bosluk > 0) document.body.style.paddingRight = `${bosluk}px`;
}

function govdeyiCoz(): void {
  document.body.style.overflow = oncekiOverflow;
  document.body.style.paddingRight = oncekiPadding;
}

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
  // Bu ornegi yiginda temsil eden deger; render'lar arasinda degismiyor.
  const kimlik = useRef<symbol>(undefined as unknown as symbol);
  kimlik.current ??= Symbol("modal");

  // Yigina girip cikmak ve govde kilidi: YALNIZCA acilista ve kapanista.
  // onClose her cizimde yeni bir islev oldugu icin tus efekti siksik
  // yeniden kuruluyor; kilit ayni efekte bagli kalsaydi her seferinde
  // "onceki deger" yeniden okunurdu.
  useEffect(() => {
    if (!open) return;

    const benim = kimlik.current;
    yigin.push(benim);
    if (yigin.length === 1) govdeyiKilitle();

    return () => {
      const sira = yigin.lastIndexOf(benim);
      if (sira !== -1) yigin.splice(sira, 1);
      if (yigin.length === 0) govdeyiCoz();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const benim = kimlik.current;
    const enUstteMiyim = () => yigin[yigin.length - 1] === benim;

    const onKey = (event: KeyboardEvent) => {
      // Yalnizca en ustteki modal tuslari isler; altindakiler bekler.
      if (!enUstteMiyim()) return;

      // Ic katman (orn. acik bir Select listesi) Escape'i tuketmisse modal
      // kapanmaz; yoksa kullanici listeyi kapatmak isterken doldurdugu
      // formu kaybediyordu.
      if (event.key === "Escape") { if (!event.defaultPrevented) onClose(); return; }
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

    document.addEventListener("keydown", onKey);
    window.setTimeout(() => panelRef.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus(), 40);

    return () => { document.removeEventListener("keydown", onKey); };
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
