"use client";

import type { ComponentProps, ReactNode } from "react";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";
import styles from "./page-shell.module.css";

/**
 * Sayfanin cercevesi: ust cubuk, govde kapsayicisi ve alt bilgi.
 *
 * Bunlar eskiden her sayfada ayri ayri kuruluyordu ve sonuc dagilmisti:
 * ust cubugun uc ayri kopyasi, alti farkli kapsayici genisligi (1688/48,
 * 1680/40, 1320/40, 1180/20, 1080/40, 1180/48) ve alt bilginin yalnizca
 * yol adina bakan sabit bir listeden basilmasi vardi. Yeni sayfa ekleyen
 * kisi o listeyi guncellemeyi unutuyordu; alt bilgi 21 rotanin 15'inde
 * yoktu.
 *
 * Artik sayfa yalnizca "ben hangi turdenim" diyor, gerisini kabuk kuruyor.
 */

/**
 * Sayfanin turu. Ikisini birden belirler: ust cubuk basilsin mi, alt bilgi
 * basilsin mi.
 *
 *  public -> ust cubuk + alt bilgi. Herkese acik sayfalar.
 *  panel  -> ust cubuk var, alt bilgi yok. Oturum ici calisma ekranlari;
 *            alt bilgi orada yalnizca dikkat dagitir.
 *  bare   -> ikisi de yok. Sayfa kendi cercevesini kuruyor (odeme donusu
 *            gibi tek isli ekranlar).
 */
export type ShellTone = "public" | "panel" | "bare";

type Props = {
  tone?: ShellTone;
  /**
   * Govde ortak kapsayiciya alinsin mi.
   *
   * "full" yalnizca sayfa kendi tam genislikli bolumlerini yonetiyorsa
   * kullanilir (vitrin kapak gorseli, girisin iki panelli yerlesimi).
   * O durumda sayfa kenar boslugunu KENDI vermeli ve ayni --gutter
   * degiskenini kullanmali, yoksa ust cubukla hizasi kayar.
   */
  width?: "wrap" | "full";
  /** Ust cubuga gecirilecekler; kabuk oldugu gibi aktarir. */
  header?: ComponentProps<typeof SiteHeader>;
  /** Dis sarmalayiciya eklenecek sinif; sayfaya ozel zemin icin. */
  className?: string;
  children: ReactNode;
};

export function PageShell({ tone = "public", width = "wrap", header, className, children }: Props) {
  // Govde <main> olarak basiliyor: ekran okuyucu ve klavye kullanicisi icin
  // sayfanin ana bolgesi bu. width="full" veren sayfalar kendi <main>'ini
  // kuruyor (zeminleri tam genislik oldugu icin kapsayiciya giremiyorlar).
  const body = width === "wrap"
    ? <main className={styles.wrap}>{children}</main>
    : children;

  return <div className={className ? `${styles.page} ${className}` : styles.page}>
    {tone !== "bare" && <SiteHeader {...header} />}
    {body}
    {tone === "public" && <SiteFooter />}
  </div>;
}
