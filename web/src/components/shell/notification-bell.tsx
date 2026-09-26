"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiRequest } from "@/lib/api";
import { realtime } from "@/lib/echo";
import styles from "./notifications.module.css";

type Item = {
  id: number;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  created_at: string;
};

const zaman = (value: string) => {
  const gecen = Date.now() - new Date(value).getTime();
  const dakika = Math.floor(gecen / 60000);

  if (dakika < 1) return "az önce";
  if (dakika < 60) return `${dakika} dk`;

  const saat = Math.floor(dakika / 60);
  if (saat < 24) return `${saat} sa`;

  return new Date(value).toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
};

/**
 * Ust cubuktaki zil ve bildirim paneli.
 *
 * Her sayfa yuklemesinde yalnizca UCUZ sayac ucu okunur; listeyi ancak panel
 * acilinca cekeriz. Panel acilmasi her seyi okundu saymaz: yalnizca ekrana
 * basilan satirlar kapatilir, boylece goz atmadigin bir bildirim kaybolmaz.
 *
 * Yeni bildirim acik sekmeye Reverb uzerinden duser; tasiyici yoksa sayac
 * bir sonraki sayfa yuklemesinde guncellenir.
 */
export function NotificationBell({ userId }: { userId: number }) {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Sayac: her sayfa yuklemesinde tek ucuz sorgu.
  useEffect(() => {
    let active = true;
    apiRequest<{ unread: number }>("/notifications/count")
      .then(({ unread: count }) => { if (active) setUnread(count); })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  // Canli akis: kisisel kanal, baskasi abone olamaz.
  useEffect(() => {
    let stopped = false;
    let socket: Awaited<ReturnType<typeof realtime>> = null;
    const channel = `user.${userId}`;

    realtime()
      .then((instance) => {
        if (stopped || !instance) return;
        socket = instance;

        instance.private(channel).listen(
          ".notification.pushed",
          (payload: { unread: number; notification: Item }) => {
            if (stopped) return;
            setUnread(payload.unread);
            setItems((current) => {
              const kalan = current.filter((item) => item.id !== payload.notification.id);
              return [payload.notification, ...kalan].slice(0, 20);
            });
          },
        );
      })
      .catch(() => undefined);

    return () => { stopped = true; socket?.leave(channel); };
  }, [userId]);

  // Disari tiklayinca kapan.
  useEffect(() => {
    if (!open) return;

    const onDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };

    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const load = useCallback(() => {
    setLoading(true);
    apiRequest<{ data: Item[]; meta: { unread: number } }>("/notifications")
      .then((response) => {
        setItems(response.data);
        setUnread(response.meta.unread);

        // Yalnizca gercekten gosterilen satirlar okundu sayilir.
        const gosterilen = response.data.filter((item) => !item.read).map((item) => item.id);
        if (gosterilen.length === 0) return;

        return apiRequest<{ unread: number }>("/notifications/read", {
          method: "POST",
          body: JSON.stringify({ ids: gosterilen }),
        }).then(({ unread: kalan }) => {
          setUnread(kalan);
          setItems((current) => current.map((item) => ({ ...item, read: true })));
        });
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) load();
  };

  return <div className={styles.root} ref={rootRef}>
    <button aria-label="Bildirimler" className={styles.bell} onClick={toggle} type="button">
      🔔
      {unread > 0 && <b className={styles.badge}>{unread > 99 ? "99+" : unread}</b>}
    </button>

    {open && (
      <section aria-label="Bildirimler" className={styles.panel}>
        <header>
          <strong>Bildirimler</strong>
          {unread > 0 && <small>{unread} okunmamış</small>}
        </header>

        <div className={styles.list}>
          {loading && items.length === 0
            ? <p className={styles.hint}>Yükleniyor…</p>
            : items.length === 0
              ? <div className={styles.empty}>
                  <span aria-hidden>🔔</span>
                  <p>Henüz bildirimin yok. Teklif, mesaj ve hesap hareketleri burada görünür.</p>
                </div>
              : items.map((item) => {
                const govde = <>
                  <span className={styles.dot} data-unread={!item.read} />
                  <span className={styles.itemBody}>
                    <strong>{item.title}</strong>
                    {item.body && <small>{item.body}</small>}
                  </span>
                  <time>{zaman(item.created_at)}</time>
                </>;

                return item.link
                  ? <Link className={styles.item} href={item.link} key={item.id} onClick={() => setOpen(false)}>{govde}</Link>
                  : <div className={styles.item} key={item.id}>{govde}</div>;
              })}
        </div>
      </section>
    )}
  </div>;
}
