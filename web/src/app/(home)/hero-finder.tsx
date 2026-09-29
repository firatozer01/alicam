"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { apiRequest } from "@/lib/api";
import styles from "../marketplace.module.css";
import {
  Catalog, CatalogChild, City, FINDER, FINDER_TABS, FinderField, FinderTabId,
  Suggestion, findVertical, fold, talepUrl,
} from "./home-data";

const sayi = new Intl.NumberFormat("tr-TR");

type Props = {
  catalog: Catalog | null;
  cities: City[];
  childrenByRoot: Record<string, CatalogChild[]>;
  /** Sekmenin kokunun alt kategorilerini yukletir; ayni kok iki kez istenmez. */
  requestRoot: (slug: string) => void;
};

/** Eslesen parcayi <mark> ile isaretler; sunucudan gelen ad HTML olarak degil metin olarak islenir. */
function highlight(name: string, term: string) {
  const needle = term.trim();
  if (!needle) return name;

  const at = fold(name).indexOf(fold(needle));
  if (at < 0) return name;

  return <>
    {name.slice(0, at)}
    <mark>{name.slice(at, at + needle.length)}</mark>
    {name.slice(at + needle.length)}
  </>;
}

export function HeroFinder({ catalog, cities, childrenByRoot, requestRoot }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<FinderTabId>("hizmet");
  const [values, setValues] = useState<Record<string, string>>({ islem: "Kiralık" });
  const [term, setTerm] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const textRef = useRef<HTMLInputElement | null>(null);
  const tabsRef = useRef<HTMLDivElement | null>(null);

  const config = FINDER[tab];
  const textField = config.fields.find((field) => field.suggest);
  const roots = useMemo(() => findVertical(tab).roots, [tab]);

  // Sekmeye gecildiginde o kokun alt kategorileri bir kez yuklenir.
  useEffect(() => {
    roots.forEach((slug) => requestRoot(slug));
  }, [roots, requestRoot]);

  // Oneri listesi: 180 ms bekler, iki harften kisa sorgu atmaz.
  useEffect(() => {
    const aranan = term.trim();
    if (!textField || aranan.length < 2) return;

    let alive = true;
    const timer = window.setTimeout(() => {
      apiRequest<{ data: Suggestion[] }>(
        `/categories/search?q=${encodeURIComponent(aranan)}&kind=${textField.suggest}&limit=8`,
      )
        .then((response) => { if (alive) setSuggestions(response.data); })
        .catch(() => undefined);
    }, 180);

    return () => { alive = false; window.clearTimeout(timer); };
  }, [term, textField]);

  // Disariya tiklayinca oneri listesi kapanir.
  useEffect(() => {
    const onDown = (event: MouseEvent) => {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  /** Bos aramada gosterilen "Popüler" listesi de gercek veriden gelir. */
  const fallback: Suggestion[] = useMemo(() => {
    if (!catalog) return [];

    if (textField?.suggest === "service") {
      return catalog.popular.slice(0, 6).map((card) => ({
        id: card.id, slug: card.slug, name: card.name, kind: "service" as const, path: [card.root.name],
      }));
    }

    return roots
      .flatMap((slug) => (childrenByRoot[slug] ?? []).slice(0, 3).map((child) => ({
        id: child.id, slug: child.slug, name: child.name, kind: "listing" as const,
        path: [catalog.listing_roots.find((root) => root.slug === slug)?.name ?? ""],
      })))
      .slice(0, 6);
  }, [catalog, textField, roots, childrenByRoot]);

  const shown = term.trim().length >= 2 ? suggestions : fallback;

  /** Sekmenin kategori secimi: gercek alt kategoriler, iki kokte birleserek. */
  const categoryOptions = useMemo(
    () => roots.flatMap((slug) => childrenByRoot[slug] ?? []),
    [roots, childrenByRoot],
  );

  /** "Sık istenenler" kisayollari: hizmette katalogun populeri, urunde kokun ilk basliklari. */
  const shortcuts = useMemo(() => {
    if (tab === "hizmet") {
      return (catalog?.popular ?? []).slice(0, 5).map((card) => ({ slug: card.slug, name: card.name }));
    }
    return categoryOptions.slice(0, 4).map((child) => ({ slug: child.slug, name: child.name }));
  }, [tab, catalog, categoryOptions]);

  const switchTab = (next: FinderTabId) => {
    setTab(next);
    setValues({ islem: "Kiralık" });
    setTerm("");
    setSuggestions([]);
    setOpen(false);
    setActive(-1);
  };

  const onTabKeys = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();

    const step = event.key === "ArrowRight" ? 1 : -1;
    const index = (FINDER_TABS.indexOf(tab) + step + FINDER_TABS.length) % FINDER_TABS.length;
    const next = FINDER_TABS[index];

    switchTab(next);
    tabsRef.current?.querySelector<HTMLButtonElement>(`#ft-${next}`)?.focus();
  };

  const setField = (id: string, value: string) => setValues((current) => ({ ...current, [id]: value }));

  const onNumber = (id: string, raw: string) => {
    const digits = raw.replace(/\D/g, "");
    setField(id, digits ? `${sayi.format(Number(digits))} ₺` : "");
  };

  /**
   * Derin baglantinin anahtarlari sihirbazin okudugu setle birebir ayni:
   * tip, kategori/hizmet, urun, islem, oda, marka, yil, durum, il, butce.
   * Kategori secildiyse slug gider; yalnizca metin yazildiysa ad gider ve
   * sihirbaz onu /categories/search ile cozer.
   */
  const goTo = (item: Suggestion) => {
    const city = cities.find((entry) => String(entry.id) === values.il);
    router.push(talepUrl({ tip: tab, kategori: item.slug, il: city?.name }));
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();

    if (textField && !term.trim()) {
      textRef.current?.focus();
      setOpen(true);
      return;
    }

    const city = cities.find((entry) => String(entry.id) === values.il);
    const butce = (values.butce ?? "").replace(/\D/g, "");

    const params: Record<string, string | undefined> = {
      tip: tab,
      kategori: values.kategori,
      islem: tab === "emlak" || tab === "makine" ? values.islem : undefined,
      oda: values.oda,
      marka: values.marka,
      yil: values.yil,
      durum: values.durum,
      il: city?.name,
      butce: butce || undefined,
    };

    // Serbest metin, sekmesine gore "hizmet" ya da "urun" olarak gider.
    if (textField) params[textField.id] = term.trim();

    router.push(talepUrl(params));
  };

  const onTextKeys = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") { setOpen(false); return; }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) setOpen(true);
      if (shown.length === 0) return;

      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((current) => (current + step + shown.length) % shown.length);
      return;
    }

    if (event.key === "Enter" && open && active > -1 && shown[active]) {
      event.preventDefault();
      goTo(shown[active]);
    }
  };

  const renderField = (field: FinderField) => {
    const id = `f-${tab}-${field.id}`;

    if (field.kind === "seg") {
      const current = values[field.id] ?? field.opts?.[0] ?? "";

      return <div className={`${styles.ff}`} key={field.id}>
        <span className={styles.segLabel} id={`${id}-l`}>{field.label}</span>
        <div aria-labelledby={`${id}-l`} className={styles.segMini} role="group">
          {(field.opts ?? []).map((option) => (
            <button
              aria-pressed={current === option}
              key={option}
              onClick={() => setField(field.id, option)}
              type="button"
            >{option}</button>
          ))}
        </div>
      </div>;
    }

    if (field.kind === "city") {
      return <div className={styles.ff} key={field.id}>
        <label htmlFor={id}>{field.label}</label>
        <select
          disabled={cities.length === 0}
          id={id}
          onChange={(event) => setField(field.id, event.target.value)}
          value={values[field.id] ?? ""}
        >
          <option value="">{cities.length === 0 ? "İller yükleniyor…" : "Tüm Türkiye"}</option>
          {cities.map((city) => <option key={city.id} value={String(city.id)}>{city.name}</option>)}
        </select>
      </div>;
    }

    if (field.kind === "category") {
      return <div className={styles.ff} key={field.id}>
        <label htmlFor={id}>{field.label}</label>
        <select
          disabled={categoryOptions.length === 0}
          id={id}
          onChange={(event) => setField(field.id, event.target.value)}
          value={values[field.id] ?? ""}
        >
          <option value="">{categoryOptions.length === 0 ? "Yükleniyor…" : "Farketmez"}</option>
          {categoryOptions.map((child) => <option key={child.id} value={child.slug}>{child.name}</option>)}
        </select>
      </div>;
    }

    if (field.kind === "select") {
      return <div className={styles.ff} key={field.id}>
        <label htmlFor={id}>{field.label}</label>
        <select id={id} onChange={(event) => setField(field.id, event.target.value)} value={values[field.id] ?? ""}>
          {(field.opts ?? []).map((option, index) => (
            <option key={option} value={index === 0 ? "" : option}>{option}</option>
          ))}
        </select>
      </div>;
    }

    if (field.suggest) {
      return <div className={`${styles.ff} ${styles.ffGrow}`} key={field.id} ref={boxRef}>
        <label htmlFor={id}>{field.label}</label>
        <input
          aria-autocomplete="list"
          aria-controls={`${id}-list`}
          aria-expanded={open}
          autoComplete="off"
          id={id}
          onChange={(event) => { setTerm(event.target.value); setOpen(true); setActive(-1); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onTextKeys}
          placeholder={field.ph}
          ref={textRef}
          role="combobox"
          type="text"
          value={term}
        />

        {open && <ul className={styles.suggest} id={`${id}-list`} role="listbox">
          {!term.trim() && shown.length > 0 && <li className={styles.sHead}>Popüler</li>}
          {shown.length === 0 && <li className={styles.sHead}>
            {term.trim().length >= 2
              ? `Başlık bulunamadı — yine de “${term.trim()}” için talep oluşturabilirsin`
              : "Yazmaya başla, başlıkları getirelim"}
          </li>}
          {shown.map((item, index) => (
            <li
              aria-selected={index === active}
              key={item.id}
              onMouseDown={(event) => { event.preventDefault(); goTo(item); }}
              role="option"
            >
              <span className={styles.sEmo}>{item.kind === "service" ? "🛠️" : "🏷️"}</span>
              <span>{highlight(item.name, term)}</span>
              {item.path.length > 0 && <small>{item.path.join(" › ")}</small>}
            </li>
          ))}
        </ul>}
      </div>;
    }

    return <div className={`${styles.ff}${field.grow ? ` ${styles.ffGrow}` : ""}`} key={field.id}>
      <label htmlFor={id}>{field.label}</label>
      <input
        autoComplete="off"
        id={id}
        inputMode={field.num ? "numeric" : undefined}
        onChange={(event) => (field.num ? onNumber(field.id, event.target.value) : setField(field.id, event.target.value))}
        placeholder={field.ph}
        type="text"
        value={values[field.id] ?? ""}
      />
    </div>;
  };

  return <>
    <div className={styles.finder} id="finder">
      <div aria-label="Ne arıyorsun?" className={styles.finderTabs} onKeyDown={onTabKeys} ref={tabsRef} role="tablist">
        {FINDER_TABS.map((item) => {
          const vertical = findVertical(item);

          return <button
            aria-selected={item === tab}
            id={`ft-${item}`}
            key={item}
            onClick={() => switchTab(item)}
            role="tab"
            tabIndex={item === tab ? 0 : -1}
            type="button"
          ><i>{vertical.emoji}</i>{vertical.name}</button>;
        })}
      </div>

      <form autoComplete="off" className={styles.finderBody} onSubmit={onSubmit}>
        <div className={styles.finderFields}>{config.fields.map(renderField)}</div>
        <button className={`${styles.btn} ${styles.btnCta} ${styles.btnLg} ${styles.finderGo}`} type="submit">
          <span>Teklif al</span> →
        </button>
      </form>
    </div>

    <div className={styles.heroPopular}>
      <span>Sık istenenler:</span>
      {shortcuts.map((item) => (
        <Link href={talepUrl({ tip: tab, kategori: item.slug })} key={item.slug}>{item.name}</Link>
      ))}
      {shortcuts.length === 0 && Array.from({ length: 4 }, (_, index) => (
        <span className={`${styles.skel} ${styles.skelChip}`} key={index} />
      ))}
    </div>
  </>;
}
