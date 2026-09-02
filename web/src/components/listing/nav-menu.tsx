"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./nav-menu.module.css";

export type NavItem = { key: string; label: string; icon: string; hint?: string; count?: number; onSelect: () => void };
export type NavMenuDef = { key: string; label: string; panelTitle?: string; panelHint?: string; items: NavItem[] };

/**
 * Tek panelli üst gezinme. Panel çubuğa sabitlenir: bir tetikleyiciden
 * diğerine geçildiğinde kapanıp yeniden açılmaz, yerinde kalıp yalnızca
 * içeriği değişir. Kapanış gecikmeli olduğu için fare panele inerken kaybolmaz.
 */
export function NavMenuBar({ menus, activeKey, children }: {
  menus: NavMenuDef[];
  /** Hangi öğe seçili durumda; tetikleyici ve satır vurgulanır. */
  activeKey: string;
  /** Menülerin soluna yerleşen düz bağlantılar. */
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

  return <div className={styles.bar} onPointerEnter={cancelClose} onPointerLeave={scheduleClose} ref={barRef}>
    {children}
    {menus.map((menu) => {
      const owns = menu.items.some((item) => item.key === activeKey);
      return <button
        aria-expanded={openKey === menu.key}
        className={`${styles.trigger} ${owns ? styles.triggerActive : ""} ${openKey === menu.key ? styles.triggerOpen : ""}`}
        key={menu.key}
        onClick={() => setOpenKey(openKey === menu.key ? null : menu.key)}
        onPointerEnter={() => { cancelClose(); setOpenKey(menu.key); }}
        type="button"
      >{menu.label}<i data-open={openKey === menu.key}>▾</i></button>;
    })}

    <div className={`${styles.panelWrap} ${open ? styles.panelOpen : ""}`} onPointerEnter={cancelClose}>
      {open && <div className={styles.panel} role="menu">
        {open.panelTitle && <header className={styles.panelHead}><strong>{open.panelTitle}</strong>{open.panelHint && <small>{open.panelHint}</small>}</header>}
        {/* key: içerik değişince yalnızca satırlar tazelenir, panel yerinde kalır */}
        <div className={styles.grid} key={open.key}>
          {open.items.map((item) => <button
            className={`${styles.item} ${item.key === activeKey ? styles.itemActive : ""}`}
            key={item.key}
            onClick={() => { item.onSelect(); setOpenKey(null); }}
            role="menuitem"
            type="button"
          >
            <i>{item.icon}</i>
            <span><strong>{item.label}</strong>{item.hint && <small>{item.hint}</small>}</span>
            {item.count !== undefined && <b>{item.count}</b>}
          </button>)}
        </div>
      </div>}
    </div>
  </div>;
}
