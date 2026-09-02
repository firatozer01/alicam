"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./nav-menu.module.css";

export type NavItem = {
  key: string;
  label: string;
  icon: string;
  hint?: string;
  badge?: string;
  /** Rozet tonu: yeni (cyan), one (amber), ucretsiz (yesil). */
  tone?: "new" | "hot" | "free";
  count?: number;
  href?: string;
  onSelect?: () => void;
};

export type NavSection = {
  key: string;
  title: string;
  icon: string;
  color?: string;
  description?: string;
  badge?: string;
  /** Vurgulu sutun: hafif renkli zemin ve kenarlik alir. */
  accent?: boolean;
  items: NavItem[];
  footer?: { label: string; href?: string; onSelect?: () => void };
};

export type NavMenuDef = {
  key: string;
  label: string;
  panelIcon?: string;
  panelTitle?: string;
  panelHint?: string;
  /** Panel basliginin saginda kucuk bilgi, orn. "5 kategori · 23 hizmet". */
  meta?: string;
  allLink?: { label: string; href: string };
  sections: NavSection[];
  /** Panelin altindaki kisayol seridi. */
  quickLinks?: { key: string; label: string; icon: string; href?: string; onSelect?: () => void; primary?: boolean }[];
};

/**
 * Cok sutunlu ust gezinme. Panel cubuga sabitlenir: tetikleyiciler arasinda
 * gecerken kapanip yeniden acilmaz, yerinde kalip icerigi degisir. Kapanis
 * gecikmeli oldugu icin fare panele inerken kaybolmaz.
 */
export function NavMenuBar({ menus, activeKey, children }: {
  menus: NavMenuDef[];
  activeKey: string;
  children?: React.ReactNode;
}) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | undefined>(undefined);

  const cancelClose = useCallback(() => {
    if (closeTimer.current) { window.clearTimeout(closeTimer.current); closeTimer.current = undefined; }
  }, []);

  const scheduleClose = useCallback(() => {
    cancelClose();
    closeTimer.current = window.setTimeout(() => setOpenKey(null), 260);
  }, [cancelClose]);

  useEffect(() => cancelClose, [cancelClose]);

  useEffect(() => {
    if (!openKey) return;
    const onPointer = (event: PointerEvent) => { if (!barRef.current?.contains(event.target as Node)) setOpenKey(null); };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpenKey(null); };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onPointer); document.removeEventListener("keydown", onKey); };
  }, [openKey]);

  const open = menus.find((menu) => menu.key === openKey);
  const wide = (open?.sections.length ?? 0) > 1;

  const renderItem = (item: NavItem, index: number) => {
    const inner = <>
      <i className={styles.itemIcon}>{item.icon}</i>
      <span className={styles.itemText}>
        <strong>{item.label}{item.badge && <em className={`${styles.badge} ${item.tone ? styles[item.tone] : ""}`}>{item.badge}</em>}</strong>
        {item.hint && <small>{item.hint}</small>}
      </span>
      {item.count !== undefined && <b className={styles.itemCount}>{item.count}</b>}
    </>;

    const shared = {
      className: `${styles.item} ${item.key === activeKey ? styles.itemActive : ""}`,
      style: { "--i": index } as React.CSSProperties,
      role: "menuitem" as const,
    };

    if (item.href) {
      return <Link {...shared} href={item.href} key={item.key} onClick={() => setOpenKey(null)}>{inner}</Link>;
    }
    return <button {...shared} key={item.key} onClick={() => { item.onSelect?.(); setOpenKey(null); }} type="button">{inner}</button>;
  };

  return <div
    className={styles.bar}
    onPointerEnter={cancelClose}
    onPointerLeave={scheduleClose}
    ref={barRef}
  >
    {children}
    {menus.map((menu) => {
      const owns = menu.sections.some((section) => section.items.some((item) => item.key === activeKey));
      return <button
        aria-expanded={openKey === menu.key}
        className={`${styles.trigger} ${owns ? styles.triggerActive : ""} ${openKey === menu.key ? styles.triggerOpen : ""}`}
        key={menu.key}
        onClick={() => setOpenKey(openKey === menu.key ? null : menu.key)}
        onPointerEnter={() => { cancelClose(); setOpenKey(menu.key); }}
        type="button"
      >{menu.label}<i className={styles.chevron} data-open={openKey === menu.key}>⌄</i></button>;
    })}

    <div
      className={`${styles.panelWrap} ${wide ? styles.panelWide : ""} ${open ? styles.panelOpen : ""}`}
      onPointerEnter={cancelClose}
    >
      {open && <div className={styles.panel} key={open.key} role="menu">
        {(open.panelTitle || open.allLink) && <header className={styles.panelHead}>
          {open.panelIcon && <span className={styles.panelIcon}>{open.panelIcon}</span>}
          <div className={styles.panelTitle}>
            <strong>{open.panelTitle}</strong>
            {open.panelHint && <small>{open.panelHint}</small>}
          </div>
          <div className={styles.panelMeta}>
            {open.allLink && <Link href={open.allLink.href} onClick={() => setOpenKey(null)}>{open.allLink.label} →</Link>}
            {open.meta && <span>{open.meta}</span>}
          </div>
        </header>}

        <div className={styles.columns} style={{ "--cols": Math.min(open.sections.length, 5) } as React.CSSProperties}>
          {open.sections.map((section, columnIndex) => <section
            className={`${styles.column} ${section.accent ? styles.columnAccent : ""}`}
            key={section.key}
            style={{ "--c": columnIndex, ...(section.color ? { "--tint": section.color } : {}) } as React.CSSProperties}
          >
            <header className={styles.columnHead}>
              <span className={styles.columnIcon}>{section.icon}</span>
              <strong>{section.title}</strong>
              {section.badge && <em className={`${styles.badge} ${styles.hot}`}>{section.badge}</em>}
            </header>
            {section.description && <p className={styles.columnDesc}>{section.description}</p>}

            <div className={styles.items}>{section.items.map(renderItem)}</div>

            {section.footer && (section.footer.href
              ? <Link className={styles.columnFooter} href={section.footer.href} onClick={() => setOpenKey(null)}>{section.footer.label} →</Link>
              : <button className={styles.columnFooter} onClick={() => { section.footer?.onSelect?.(); setOpenKey(null); }} type="button">{section.footer.label} →</button>)}
          </section>)}
        </div>

        {open.quickLinks && open.quickLinks.length > 0 && <footer className={styles.quickBar}>
          <span className={styles.quickHint}>ℹ Aradığını bulamadıysan hızlı işlemler</span>
          <div className={styles.quickLinks}>{open.quickLinks.map((link) => link.href
            ? <Link className={`${styles.quickLink} ${link.primary ? styles.quickPrimary : ""}`} href={link.href} key={link.key} onClick={() => setOpenKey(null)}>{link.icon} {link.label}</Link>
            : <button className={`${styles.quickLink} ${link.primary ? styles.quickPrimary : ""}`} key={link.key} onClick={() => { link.onSelect?.(); setOpenKey(null); }} type="button">{link.icon} {link.label}</button>)}
          </div>
        </footer>}
      </div>}
    </div>
  </div>;
}
