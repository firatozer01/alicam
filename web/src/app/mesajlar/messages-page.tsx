"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SiteHeader } from "@/components/shell/site-header";
import { ApiError, apiRequest, firstApiError } from "@/lib/api";
import { useConversation, type ConversationSummary } from "@/components/messages/use-conversation";
import styles from "./messages.module.css";

const timeLabel = (value: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  const sameDay = new Date().toDateString() === date.toDateString();

  return sameDay
    ? date.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
};

export function MessagesPage({ initialConversationId }: { initialConversationId?: string }) {
  const router = useRouter();
  const [list, setList] = useState<ConversationSummary[]>([]);
  const [activeId, setActiveId] = useState<number | null>(
    initialConversationId ? Number(initialConversationId) : null,
  );
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState("");
  const [draft, setDraft] = useState("");
  const [sendError, setSendError] = useState("");
  const [sending, setSending] = useState(false);

  const { messages, compose, summary, loading, send } = useConversation(activeId);

  useEffect(() => {
    let active = true;
    apiRequest<{ data: ConversationSummary[] }>("/conversations")
      .then(({ data }) => {
        if (!active) return;
        setList(data);
        setActiveId((current) => current ?? data[0]?.id ?? null);
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (error instanceof ApiError && error.status === 401) return router.replace("/giris?devam=%2Fmesajlar");
        setListError(firstApiError(error));
      })
      .finally(() => { if (active) setLoadingList(false); });
    return () => { active = false; };
  }, [router]);

  const active = useMemo(() => list.find((item) => item.id === activeId) ?? summary, [list, activeId, summary]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;

    setSending(true);
    setSendError("");
    try {
      await send(body);
      setDraft("");
      setList((current) => current.map((item) => item.id === activeId
        ? { ...item, last_message_at: new Date().toISOString() }
        : item));
    } catch (error: unknown) {
      setSendError(error instanceof ApiError && error.status === 402
        ? "İlk mesaj için yeterli kontörün yok. Kontör yükleyip tekrar dene."
        : firstApiError(error));
    } finally {
      setSending(false);
    }
  };

  return <main className={styles.page}>
    <SiteHeader />

    <div className={styles.wrap}>
      <header className={styles.head}>
        <div>
          <span className={styles.kicker}>MESAJLAR</span>
          <h1>Konuşmalarım</h1>
          <p>Alıcı ve hizmet verenlerle yazışmaların burada toplanır.</p>
        </div>
        <Link className={styles.ghost} href="/musteri-panel">Panelime dön →</Link>
      </header>

      <div className={styles.layout}>
        <aside className={styles.list}>
          {loadingList ? <p className={styles.hint}>Yükleniyor…</p>
            : listError ? <p className={styles.error}>{listError}</p>
              : list.length === 0 ? <p className={styles.hint}>Henüz bir konuşman yok. Bir hizmet verenin vitrininden mesaj başlatabilirsin.</p>
                : list.map((item) => (
                  <button
                    className={`${styles.row} ${item.id === activeId ? styles.rowOn : ""}`}
                    key={item.id}
                    onClick={() => setActiveId(item.id)}
                    type="button"
                  >
                    <span className={styles.avatar}>{item.counterpart.name.slice(0, 2).toLocaleUpperCase("tr-TR")}</span>
                    <span className={styles.rowBody}>
                      <strong>{item.counterpart.name}</strong>
                      <small>{item.request ? item.request.title : item.role === "buyer" ? "Hizmet veren" : "Alıcı"}</small>
                    </span>
                    <span className={styles.rowMeta}>
                      <em>{timeLabel(item.last_message_at)}</em>
                      {item.unread > 0 && <b>{item.unread}</b>}
                    </span>
                  </button>
                ))}
        </aside>

        <section className={styles.thread}>
          {!activeId ? <p className={styles.hint}>Soldan bir konuşma seç.</p> : <>
            <header className={styles.threadHead}>
              <div>
                <strong>{active?.counterpart.name ?? "Konuşma"}</strong>
                {active?.request && <small>{active.request.reference} · {active.request.title}</small>}
              </div>
            </header>

            <div className={styles.bubbles}>
              {loading ? <p className={styles.hint}>Mesajlar yükleniyor…</p>
                : messages.length === 0 ? <p className={styles.hint}>Henüz mesaj yok. İlk mesajı sen yaz.</p>
                  : messages.map((message) => (
                    <article className={message.mine ? styles.mine : styles.theirs} key={message.id}>
                      <p>{message.body}</p>
                      <time>{timeLabel(message.created_at)}{message.mine && message.read ? " · okundu" : ""}</time>
                    </article>
                  ))}
            </div>

            {compose.notice && <p className={styles.notice}>⚡ {compose.notice}</p>}
            {sendError && <p className={styles.error}>{sendError}</p>}

            <form className={styles.composer} onSubmit={submit}>
              <textarea
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void submit(event); }
                }}
                placeholder="Mesajını yaz… (Enter ile gönder)"
                rows={2}
                value={draft}
              />
              <button disabled={sending || draft.trim().length === 0} type="submit">
                {sending ? "…" : "Gönder"}
              </button>
            </form>
          </>}
        </section>
      </div>
    </div>
  </main>;
}
