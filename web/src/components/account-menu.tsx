"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { apiRequest, firstApiError } from "@/lib/api";
import styles from "./account-menu.module.css";

export type AccountUser = {
  name: string;
  email?: string;
  roles: string[];
};

function accountMeta(user: AccountUser) {
  if (user.roles.includes("admin")) return { label: "Yönetici", href: "/admin", action: "Yönetim merkezini aç" };
  if (user.roles.includes("seller")) return { label: "Hizmet veren", href: "/satici-paneli", action: "Satıcı panelini aç" };
  return { label: "Müşteri", href: "/musteri-panel", action: "Müşteri panelini aç" };
}

export function AccountMenu({ user, displayName, compact = false }: {
  user: AccountUser;
  displayName?: string | null;
  compact?: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const meta = accountMeta(user);
  const visibleName = displayName || user.name;
  const initials = visibleName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toLocaleUpperCase("tr-TR");

  useEffect(() => {
    const closeOnOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  const logout = async () => {
    setBusy(true);
    setError("");
    try {
      await apiRequest<{ message: string }>("/logout", { method: "POST" });
      window.location.replace("/giris");
    } catch (requestError: unknown) {
      setError(firstApiError(requestError));
      setBusy(false);
    }
  };

  return <div className={styles.root} data-compact={compact} ref={rootRef}>
    <button
      aria-expanded={open}
      aria-haspopup="menu"
      className={styles.trigger}
      onClick={() => setOpen((current) => !current)}
      type="button"
    >
      <span className={styles.avatar}>{initials || "A"}</span>
      <span className={styles.identity}><strong>{visibleName}</strong><small><i /> {meta.label}</small></span>
      <span className={styles.chevron}>⌄</span>
    </button>

    <div aria-hidden={!open} className={`${styles.menu} ${open ? styles.open : ""}`} role="menu">
      <header><span className={styles.largeAvatar}>{initials || "A"}</span><div><strong>{visibleName}</strong><small>{user.email || meta.label}</small></div></header>
      <p className={styles.session}><i /> Oturum açık · {meta.label}</p>
      <nav>
        <Link href={meta.href} onClick={() => setOpen(false)} role="menuitem"><span>⌂</span><div><strong>{meta.action}</strong><small>Çalışma alanına devam et</small></div><b>→</b></Link>
        {user.roles.includes("seller") && <Link href="/kontor-yukle" onClick={() => setOpen(false)} role="menuitem"><span>⚡</span><div><strong>Kontör işlemleri</strong><small>Bakiye ve paketleri görüntüle</small></div><b>→</b></Link>}
        {user.roles.includes("buyer") && <Link href="/talep-olustur" onClick={() => setOpen(false)} role="menuitem"><span>＋</span><div><strong>Yeni talep oluştur</strong><small>Ücretsiz teklif almaya başla</small></div><b>→</b></Link>}
        {user.roles.includes("admin") && <Link href="/admin/kategoriler" onClick={() => setOpen(false)} role="menuitem"><span>▦</span><div><strong>Kategori yönetimi</strong><small>Form alanları ve kontör bedelleri</small></div><b>→</b></Link>}
      </nav>
      {error && <p className={styles.error}>{error}</p>}
      <button className={styles.logout} disabled={busy} onClick={logout} role="menuitem" type="button"><span>↪</span>{busy ? "Oturum kapatılıyor…" : "Güvenli çıkış yap"}</button>
    </div>
  </div>;
}
