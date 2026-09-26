"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiRequest } from "@/lib/api";
import { useConversation, type ConversationSummary } from "./use-conversation";
import styles from "./dock.module.css";

const MIN_WIDTH = 320;
const MAX_WIDTH = 560;
const WIDTH_KEY = "alicam-dock-width";

const timeLabel = (value: string) =>
  new Date(value).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });

/**
 * Sag kenara sabit anlik mesajlasma paneli.
 *
 * Yalnizca giris yapmis kullaniciya gorunur: konusma listesi 401 donerse
 * bilesen hicbir sey cizmez. Mesajlar sayfasinin kendisinde de gizlenir,
 * yoksa ayni liste iki kere gosterilmis olurdu.
 *
 * Kapaliyken dikey bir tutamaktir; acilinca sol kenarindan tutularak
 * genisligi ayarlanir ve secilen genislik tarayicida hatirlanir.
 */
export function MessagesDock() {
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [width, setWidth] = useState(() => {
    // Sunucu render'inda depolama yok; istemcide kayitli deger varsa alinir.
    if (typeof window === "undefined") return 360;
    try {
      const saved = Number(window.localStorage.getItem(WIDTH_KEY));
      return saved >= MIN_WIDTH && saved <= MAX_WIDTH ? saved : 360;
    } catch {
      return 360;
    }
  });
  const [list, setList] = useState<ConversationSummary[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [term, setTerm] = useState("");
  const [tab, setTab] = useState<"all" | "unread">("all");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const dragging = useRef(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  const { messages, compose, send, unlock } = useConversation(open ? activeId : null);

  useEffect(() => {
    let active = true;
    apiRequest<{ data: ConversationSummary[] }>("/conversations")
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
    setWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, window.innerWidth - event.clientX)));
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

  const visible = useMemo(() => {
    const needle = term.trim().toLocaleLowerCase("tr-TR");

    return list
      .filter((item) => tab === "all" || item.unread > 0)
      .filter((item) => needle === "" || item.counterpart.name.toLocaleLowerCase("tr-TR").includes(needle));
  }, [list, tab, term]);

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

  /** Hizmet veren kontor odeyip konusmayi acar. */
  const runUnlock = async () => {
    if (unlocking) return;
    setUnlocking(true);
    setSendError("");
    try {
      await unlock();
    } catch {
      setSendError("Açılamadı. Kontörün yetmiyor olabilir.");
    } finally {
      setUnlocking(false);
    }
  };

  const emptyText = term.trim() !== ""
    ? "Bu isimde bir konuşma bulamadım."
    : tab === "unread"
      ? "Okunmamış mesajın yok."
      : "Bu alanda alıcam.net üzerindeki tüm özel mesajlarını yönetebilirsin.";

  // Mesajlar sayfasinda panel gizlenir: ayni liste zaten sayfanin kendisi.
  if (!ready || pathname?.startsWith("/mesajlar")) return null;

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
            <button aria-label="Listeye dön" className={styles.back} onClick={() => setActiveId(null)} type="button">‹</button>
          ) : null}
          <div>
            <strong>{active ? active.counterpart.name : "Anlık Mesajlaşma"}</strong>
            {active && <small>{active.request?.title ?? "Doğrudan mesaj"}</small>}
          </div>
          <Link className={styles.expand} href="/mesajlar" title="Tam sayfada aç">⤢</Link>
          <button aria-label="Kapat" className={styles.close} onClick={() => setOpen(false)} type="button">✕</button>
        </header>

        {!activeId && <>
          <div className={styles.search}>
            <span aria-hidden>⌕</span>
            <input
              onChange={(event) => setTerm(event.target.value)}
              placeholder="Kişilerde ara"
              value={term}
            />
          </div>

          <div className={styles.tabs} role="tablist">
            <button
              aria-selected={tab === "all"}
              className={tab === "all" ? styles.tabOn : styles.tab}
              onClick={() => setTab("all")}
              role="tab"
              type="button"
            >
              Gelen kutusu
            </button>
            <button
              aria-selected={tab === "unread"}
              className={tab === "unread" ? styles.tabOn : styles.tab}
              onClick={() => setTab("unread")}
              role="tab"
              type="button"
            >
              Okunmamış{unreadTotal > 0 ? ` (${unreadTotal})` : ""}
            </button>
          </div>
        </>}

        <div className={styles.body} ref={bodyRef}>
          {!activeId ? (
            visible.length === 0
              ? <div className={styles.empty}>
                  <span aria-hidden className={styles.emptyArt}>💬</span>
                  <p>{emptyText}</p>
                </div>
              : visible.map((item) => (
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
              {/* Kilitli konusmada govde sunucudan hic gelmez. */}
              {message.locked
                ? <p className={styles.masked}>🔒 Mesajı görmek için konuşmayı aç</p>
                : <p>{message.body}</p>}
              <time>{timeLabel(message.created_at)}</time>
            </article>
          ))}
        </div>

        {activeId && <>
          {compose.notice && <p className={styles.notice}>⚡ {compose.notice}</p>}
          {sendError && <p className={styles.error}>{sendError}</p>}

          {compose.locked ? (
            <div className={styles.unlock}>
              <button disabled={unlocking} onClick={() => void runUnlock()} type="button">
                {unlocking ? "Açılıyor…" : `Konuşmayı aç · ${compose.credit_cost} ⚡`}
              </button>
            </div>
          ) : (
            <form className={styles.composer} onSubmit={submit}>
              <input
                disabled={!compose.can_send}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={compose.can_send ? "Mesaj yaz…" : "Yeni mesaj gönderemezsin"}
                value={draft}
              />
              <button
                aria-label="Gönder"
                disabled={sending || !compose.can_send || draft.trim().length === 0}
                type="submit"
              >➤</button>
            </form>
          )}
        </>}
      </aside>
    )}
  </>;
}
