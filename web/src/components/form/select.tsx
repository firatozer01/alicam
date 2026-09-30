"use client";

import { type CSSProperties, type KeyboardEvent, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./control.module.css";

export type SelectSecenek = { value: string; label: string };

/**
 * Turkce harfleri Latin karsiliklarina indirger.
 * NEDEN: kullanici "istanbul" yazdiginda "İstanbul" bulunmali. toLocaleLowerCase("tr")
 * "İ" harfini "i"ye, "I" harfini "ı"ya cevirdigi icin tek basina yetmiyor; noktali "i"
 * ile noktasiz "ı" ayri kaliyor. Bu tablo ikisini ve diger Turkce harfleri esitler.
 */
const HARF_ESI: Record<string, string> = {
  "ı": "i", "ş": "s", "ğ": "g", "ü": "u", "ö": "o", "ç": "c",
  "â": "a", "î": "i", "û": "u",
};

function aramaAnahtari(deger: string) {
  return deger
    .toLocaleLowerCase("tr")
    // Bazi kaynaklarda "İ" kucultulurken geride birlesik nokta (U+0307) kalir.
    .replace(/̇/g, "")
    .replace(/[ışğüöçâîû]/g, (harf) => HARF_ESI[harf] ?? harf);
}

/**
 * Listenin ulasabilecegi en buyuk yukseklik.
 *
 * Once yalnizca "ne kadar yer varsa o kadar" yaziyordu. Panelin konumu her
 * kaydirmada yeniden hesaplandigi icin kutu ekranin ustune dogru ciktikca
 * altindaki bosluk buyuyor, liste de onunla birlikte uzuyordu: anasayfa
 * seridindeki sehir secimi kaydirdikca ekranin yarisini kaplayan bir surune
 * donusuyordu. Bir sinirdan sonra fazladan yer ISE YARAMIYOR zaten --
 * sekiz secenekten uzun bir listeyi kimse gozle taramaz, arar.
 *
 * Deger CSS'teki varsayilanla (.liste max-height) ayni tutuluyor.
 */
const LISTE_TAVANI = 300;

/**
 * Yerel <select> yerine kullanilan acilir liste.
 * NEDEN: tarayicinin kendi acilir listesi CSS ile bicimlendirilemiyor, kutudan
 * bagimsiz konumlaniyor ve 81 il gibi uzun listelerde yazarak arama yapilamiyor.
 */
export function Select({
  value,
  onChange,
  options,
  placeholder = "Seçin",
  searchable,
  disabled = false,
  id,
  ariaLabel,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectSecenek[];
  /** Secim yokken kutuda gorunen metin. */
  placeholder?: string;
  /** Verilmezse 12'den fazla secenekte kendiliginden acilir. */
  searchable?: boolean;
  disabled?: boolean;
  id?: string;
  ariaLabel?: string;
  className?: string;
}) {
  const otoId = useId();
  const alanId = id ?? `secim-${otoId}`;
  const listeId = `${alanId}-liste`;

  const rootRef = useRef<HTMLDivElement>(null);
  const tetikRef = useRef<HTMLButtonElement>(null);

  const [acik, setAcik] = useState(false);
  const [sorgu, setSorgu] = useState("");
  const [aktif, setAktif] = useState(-1);

  const aranabilir = searchable ?? options.length > 12;
  const secili = options.find((secenek) => secenek.value === value);

  const gorunen = useMemo(() => {
    const temiz = sorgu.trim();
    if (!aranabilir || temiz === "") return options;
    const anahtar = aramaAnahtari(temiz);
    return options.filter((secenek) => aramaAnahtari(secenek.label).includes(anahtar));
  }, [options, sorgu, aranabilir]);

  /**
   * Gezinen ogeye baglanan geri cagrimli ref.
   * NEDEN effect degil: react-hooks/refs kurali ref'i render ve effect govdesinde
   * okumayi yasakliyor. Geri cagrimli ref yalnizca DOM'a baglanirken calisir, yani
   * liste acildiginda ve gezinilen oge degistiginde tam zamaninda.
   */
  const aktifOgeRef = useCallback((dugum: HTMLLIElement | null) => {
    dugum?.scrollIntoView({ block: "nearest" });
  }, []);

  /** Arama kutusu acilir acilmaz odaklansin; ayni sebeple geri cagrimli ref. */
  const aramaRef = useCallback((dugum: HTMLInputElement | null) => {
    dugum?.focus();
  }, []);

  const sifirla = useCallback(() => {
    setAcik(false);
    setAktif(-1);
    setSorgu("");
  }, []);

  /**
   * Panelin ekrandaki yeri. Portal ile <body>'ye basildigi icin konumu
   * tetikleyiciden olcup satir ici veriyoruz; boylece modal govdesi onu
   * kirpamiyor ve ekranin altina yakin kutularda liste yukari aciliyor.
   */
  type PanelKonum = CSSProperties & { "--liste-max": string };
  const [konum, setKonum] = useState<PanelKonum | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const konumla = useCallback(() => {
    const kutu = tetikRef.current?.getBoundingClientRect();
    if (!kutu) return;
    const BOSLUK = 6;
    const asagida = window.innerHeight - kutu.bottom - BOSLUK - 8;
    const yukarida = kutu.top - BOSLUK - 8;
    // Asagisi 220px'i tasimiyorsa ve yukarisi daha genisse yukari acilir.
    const yukari = asagida < 220 && yukarida > asagida;
    const alan = Math.max(160, Math.floor(yukari ? yukarida : asagida));
    // Panel en az 220px: anasayfa arama seridinde alanlar ~140px'e dusuyor ve
    // "Mercedes-Benz" gibi secenekler uc noktaya iniyordu. Sag kenardan da
    // tasmasin diye ekrana sigacak sekilde kirpiliyor.
    const genislik = Math.min(Math.max(220, Math.round(kutu.width)), window.innerWidth - 16);
    const sol = Math.min(Math.round(kutu.left), window.innerWidth - genislik - 8);
    const yeri: PanelKonum = {
      left: Math.max(8, sol),
      width: genislik,
      ...(yukari
        ? { bottom: Math.round(window.innerHeight - kutu.top + BOSLUK) }
        : { top: Math.round(kutu.bottom + BOSLUK) }),
      // Arama kutusu da panelin icinde; liste ondan arta kalani kullanir.
      // Arama yoksa o 56px'i dusmek listeyi bosuna kisaltiyordu.
      "--liste-max": `${Math.min(LISTE_TAVANI, alan - (aranabilir ? 56 : 0))}px`,
    };
    setKonum(yeri);
  }, [aranabilir]);

  const ac = useCallback(() => {
    if (disabled) return;
    setSorgu("");
    // Acilista gezinme zaten secili olan ogeden baslar, yoksa bastan.
    setAktif(Math.max(0, options.findIndex((secenek) => secenek.value === value)));
    konumla();
    setAcik(true);
  }, [disabled, konumla, options, value]);

  const kapat = useCallback(() => {
    sifirla();
    tetikRef.current?.focus();
  }, [sifirla]);

  const sec = useCallback((secenek: SelectSecenek) => {
    onChange(secenek.value);
    sifirla();
    tetikRef.current?.focus();
  }, [onChange, sifirla]);

  // Sayfa kaydirilinca ya da pencere boyutlanınca panel tetikleyiciden
  // kopmasin: portal ile body'de durdugu icin kendiliginden takip etmiyor.
  useEffect(() => {
    if (!acik) return;
    const guncelle = () => konumla();
    window.addEventListener("scroll", guncelle, true);
    window.addEventListener("resize", guncelle);
    return () => {
      window.removeEventListener("scroll", guncelle, true);
      window.removeEventListener("resize", guncelle);
    };
  }, [acik, konumla]);

  useEffect(() => {
    if (!acik) return;
    // Disari tiklayinca kapanir. Odak geri alinmaz: kullanici baska bir yere
    // tikladiysa oraya gitmek istiyordur.
    const disariTik = (olay: PointerEvent) => {
      const hedef = olay.target as Node;
      // Panel portal ile body'de: root'un icinde degil, ayrica sorulmali.
      if (rootRef.current?.contains(hedef) || panelRef.current?.contains(hedef)) return;
      sifirla();
    };
    document.addEventListener("pointerdown", disariTik);
    return () => document.removeEventListener("pointerdown", disariTik);
  }, [acik, sifirla]);

  /**
   * Klavye tek yerde toplandi: tuslar hem tetikleyiciden hem arama kutusundan
   * gelebiliyor, ikisi de bu sarmalayicinin icinde.
   */
  const tusla = (olay: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;

    if (!acik) {
      if (olay.key === "ArrowDown" || olay.key === "ArrowUp") {
        olay.preventDefault();
        ac();
      }
      return;
    }

    if (olay.key === "Escape") {
      olay.preventDefault();
      // Olay YUTULUYOR: Modal kendi Escape kancasini document uzerinde kuruyor.
      // Durdurulmazsa liste kapanirken modal da kapaniyor ve doldurulmus form
      // gidiyordu. React'in kok dinleyicisi ile Modal'inki ayni dugumde oldugu
      // icin sade stopPropagation yetmez.
      olay.stopPropagation();
      olay.nativeEvent.stopImmediatePropagation();
      kapat();
      return;
    }

    // Tab varsayilan gibi calissin: liste kapanir, odak siradaki alana gider.
    if (olay.key === "Tab") {
      sifirla();
      return;
    }

    if (olay.key === "ArrowDown" || olay.key === "ArrowUp") {
      olay.preventDefault();
      if (gorunen.length === 0) return;
      const yon = olay.key === "ArrowDown" ? 1 : -1;
      setAktif((onceki) => {
        const sonraki = onceki + yon;
        if (sonraki < 0) return gorunen.length - 1;
        if (sonraki >= gorunen.length) return 0;
        return sonraki;
      });
      return;
    }

    if (olay.key === "Home" || olay.key === "End") {
      olay.preventDefault();
      if (gorunen.length === 0) return;
      setAktif(olay.key === "Home" ? 0 : gorunen.length - 1);
      return;
    }

    // Bosluk yalnizca arama kutusu yokken secer; varsa kullanici bosluk yaziyordur.
    if (olay.key === "Enter" || (olay.key === " " && !aranabilir)) {
      olay.preventDefault();
      const secenek = gorunen[aktif];
      if (secenek) sec(secenek);
    }
  };

  const aktifOgeId = acik && gorunen[aktif] ? `${listeId}-${aktif}` : undefined;

  return (
    <div className={className ? `${styles.root} ${className}` : styles.root} onKeyDown={tusla} ref={rootRef}>
      <button
        aria-controls={acik ? listeId : undefined}
        aria-expanded={acik}
        aria-activedescendant={aranabilir ? undefined : aktifOgeId}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        className={`control ${styles.trigger}`}
        disabled={disabled}
        id={alanId}
        onClick={() => (acik ? kapat() : ac())}
        ref={tetikRef}
        role="combobox"
        type="button"
      >
        <span className={secili ? styles.deger : styles.tutucu}>{secili ? secili.label : placeholder}</span>
        <i aria-hidden="true" className={styles.ok} />
      </button>

      {acik && konum && createPortal(
        // onKeyDown panele de baglandi: portal ile body'ye tasindigi icin
        // arama kutusundan gelen tuslar artik kok sarmalayiciya ulasmiyor.
        <div className={styles.panel} onKeyDown={tusla} ref={panelRef} style={konum}>
          {aranabilir && (
            <div className={styles.aramaKutu}>
              <input
                // Odak buradayken gezilen ogeyi ekran okuyucu ancak bu
                // oznitelik ODAKLI ogede oldugunda duyuruyor.
                aria-activedescendant={aktifOgeId}
                aria-controls={listeId}
                aria-label="Seçenekleri ara"
                autoComplete="off"
                className={styles.arama}
                onChange={(olay) => {
                  setSorgu(olay.target.value);
                  // Filtre degisince gezinme bastan baslasin; eski sira artik baska ogeyi gosterir.
                  setAktif(0);
                }}
                placeholder="Ara…"
                ref={aramaRef}
                type="text"
                value={sorgu}
              />
            </div>
          )}

          <ul aria-label={ariaLabel} className={styles.liste} id={listeId} role="listbox">
            {gorunen.map((secenek, sira) => (
              <li
                aria-selected={secenek.value === value}
                className={styles.oge}
                data-aktif={sira === aktif}
                id={`${listeId}-${sira}`}
                key={secenek.value}
                onClick={() => sec(secenek)}
                onPointerEnter={() => setAktif(sira)}
                ref={sira === aktif ? aktifOgeRef : undefined}
                role="option"
              >
                <span>{secenek.label}</span>
              </li>
            ))}
            {gorunen.length === 0 && <li className={styles.bos} role="presentation">Sonuç yok</li>}
          </ul>
        </div>,
        document.body,
      )}
    </div>
  );
}
