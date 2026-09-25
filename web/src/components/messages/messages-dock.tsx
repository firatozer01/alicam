"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiRequest } from "@/lib/api";
import { useConversation, type ConversationSummary } from "./use-conversation";
import styles from "./dock.module.css";

const MIN_WIDTH = 320;
const MAX_WIDTH = 640;
const WIDTH_KEY = "alicam-dock-width";

const timeLabel = (value: string) =>
  new Date(value).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });

/**
 * Sag kenara sabit mesaj paneli.
 *
 * Kapaliyken dikey bir tutamak olarak durur; tutamaktan tutup sola cekince
 * acilir. Acikken sol kenarindan tutularak genisligi ayarlanabilir ve secilen
 * genislik tarayicida hatirlanir.
 */
export function MessagesDock() {
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [width, setWidth] = useState(() => {
    // Sunucu render'inda depolama yok; istemcide kayitli deger varsa alinir.
    if (typeof window === "undefined") return 380;
    try {
      const saved = Number(window.localStorage.getItem(WIDTH_KEY));
      return saved >= MIN_WIDTH && saved <= MAX_WIDTH ? saved : 380;
    } catch {
      return 380;
    }
  });
  const [list, setList] = useState<ConversationSummary[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const dragging = useRef(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  const { messages, compose, send } = useConversation(open ? activeId : null);

  // Oturum yoksa dock hic gorunmez.
  useEffect(() => {
    let active = true;
    apiRequest<{ data: ConversationSummary[]; meta: { unread_total: number } }>("/conversations")
      .then(({ data }) => {
        if (!active) return;
        setList(data);
        setReady(true);
      })
      .catch(() => undefined);

    return () => { active = false; };
  }, []);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const onDrag = useCallback((event: PointerEvent) => {
    if (!dragging.current) return;
    const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, window.innerWidth - event.clientX));
    setWidth(next);
  }, []);

  const stopDrag = useCallback(() => {
    if (!dragging.current) return;
    dragging.current = false;
    document.body.style.userSelect = "";
    setWidth((current) => {
      try { window.localStorage.setItem(WIDTH_KEY, String(current)); } catch { /* yoksay */ }
      return current;
    });
  }, []);

  useEffect(() => {
    window.addEventListener("pointermove", onDrag);
    window.addEventListener("pointerup", stopDrag);
    return () => {
      window.removeEventListener("pointermove", onDrag);
      window.removeEventListener("pointerup", stopDrag);
    };
  }, [onDrag, stopDrag]);

  const startDrag = () => {
    dragging.current = true;
    document.body.style.userSelect = "none";
  };

  const unreadTotal = list.reduce((total, item) => total + item.unread, 0);
  const active = list.find((item) => item.id === activeId) ?? null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body || sending || !activeId) return;

    setSending(true);
    setSendError("");
    try {
      await send(body);
      setDraft("");
    } catch {
      setSendError("Gönderilemedi. Kontörün yetmiyor olabilir.");
    } finally {
      setSending(false);
    }
  };

  if (!ready) return null;

  return <>
    {!open && (
      <button className={styles.handle} onClick={() => setOpen(true)} type="button">
        <span>Mesajlar</span>
        {unreadTotal > 0 && <b>{unreadTotal}</b>}
      </button>
    )}

    {open && (
      <aside className={styles.dock} style={{ width }}>
        <span
          aria-label="Genişliği ayarla"
          className={styles.grip}
          onPointerDown={startDrag}
          role="separator"
        />

        <header className={styles.head}>
          {activeId ? (
            <button className={styles.back} onClick={() => setActiveId(null)} type="button">‹</button>
          ) : null}
          <div>
            <strong>{active ? active.counterpart.name : "Mesajlar"}</strong>
            <small>{active ? (active.request?.title ?? "Doğrudan mesaj") : `${list.length} konuşma`}</small>
          </div>
          <Link className={styles.expand} href="/mesajlar" title="Tam sayfada aç">⤢</Link>
          <button className={styles.close} onClick={() => setOpen(false)} type="button">✕</button>
        </header>

        <div className={styles.body} ref={bodyRef}>
          {!activeId ? (
            list.length === 0
              ? <p className={styles.hint}>Henüz konuşman yok. Bir hizmet verenin vitrininden mesaj başlatabilirsin.</p>
              : list.map((item) => (
                <button className={styles.row} key={item.id} onClick={() => setActiveId(item.id)} type="button">
                  <span className={styles.avatar}>{item.counterpart.name.slice(0, 2).toLocaleUpperCase("tr-TR")}</span>
                  <span className={styles.rowBody}>
                    <strong>{item.counterpart.name}</strong>
                    <small>{item.request?.title ?? (item.role === "buyer" ? "Hizmet veren" : "Alıcı")}</small>
                  </span>
                  {item.unread > 0 && <b className={styles.badge}>{item.unread}</b>}
                </button>
              ))
          ) : messages.length === 0 ? (
            <p className={styles.hint}>Henüz mesaj yok.</p>
          ) : messages.map((message) => (
            <article className={message.mine ? styles.mine : styles.theirs} key={message.id}>
              <p>{message.body}</p>
              <time>{timeLabel(message.created_at)}</time>
            </article>
          ))}
        </div>

        {activeId && <>
          {compose.notice && <p className={styles.notice}>⚡ {compose.notice}</p>}
          {sendError && <p className={styles.error}>{sendError}</p>}
          <form className={styles.composer} onSubmit={submit}>
            <input
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Mesaj yaz…"
              value={draft}
            />
            <button disabled={sending || draft.trim().length === 0} type="submit">➤</button>
          </form>
        </>}
      </aside>
    )}
  </>;
}
