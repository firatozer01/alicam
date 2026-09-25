"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { apiRequest } from "@/lib/api";
import styles from "./assistant.module.css";

type Topic = { key: string; title: string };

type Intro = {
  mode: "knowledge" | "ai";
  greeting: string;
  display_name: string | null;
  topics: Topic[];
};

type Turn = { id: number; role: "bot" | "user"; text: string };

/**
 * alıcam asistanı. Sağ alt köşedeki maskot açılınca panel gelir.
 *
 * Yapay zekâ bağlı değilken "hazır cevap modu" çalışır: cevaplar Bilgi
 * Bankası'ndaki kayıtlı metinlerdir, uydurma yapılmaz. Panelde bu durum
 * açıkça yazar. Giriş yapmamış ziyaretçiye koyu, sade bir sürüm gösterilir.
 */
export function AssistantWidget() {
  const [open, setOpen] = useState(false);
  const [intro, setIntro] = useState<Intro | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [suggestions, setSuggestions] = useState<Topic[]>([]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);
  const counter = useRef(0);

  useEffect(() => {
    if (!open || intro) return;
    let active = true;
    apiRequest<Intro>("/assistant")
      .then((data) => {
        if (!active) return;
        setIntro(data);
        setSuggestions(data.topics);
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [open, intro]);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, busy]);

  const push = (role: Turn["role"], text: string) => {
    counter.current += 1;
    const id = counter.current;
    setTurns((current) => [...current, { id, role, text }]);
  };

  const send = async (payload: { question?: string; topic?: string }, label: string) => {
    if (busy) return;
    push("user", label);
    setQuestion("");
    setBusy(true);

    try {
      const response = await apiRequest<{ answer: string; suggestions: Topic[] }>("/assistant/ask", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      push("bot", response.answer);
      setSuggestions(response.suggestions ?? []);
    } catch {
      push("bot", "Şu an yanıt veremiyorum. Birazdan tekrar dener misin?");
    } finally {
      setBusy(false);
    }
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = question.trim();
    if (trimmed.length < 2) return;
    void send({ question: trimmed }, trimmed);
  };

  const guest = intro !== null && intro.display_name === null;

  return <>
    <button
      aria-label={open ? "Asistanı kapat" : "alıcam asistanını aç"}
      className={styles.launcher}
      data-open={open}
      onClick={() => setOpen((current) => !current)}
      type="button"
    >
      <Image alt="" height={92} priority={false} src="/asistan.gif" unoptimized width={92} />
      {!open && <span className={styles.ping} />}
    </button>

    {open && (
      <section aria-label="alıcam asistanı" className={styles.panel} data-guest={guest}>
        <header className={styles.head}>
          <span className={styles.avatar}><Image alt="" height={38} src="/asistan.gif" unoptimized width={38} /></span>
          <div>
            <strong>alıcam asistanı</strong>
            <small>
              <i data-mode={intro?.mode ?? "knowledge"} />
              {intro?.mode === "ai" ? "Yapay zekâ bağlı" : "Hazır cevap modu"}
            </small>
          </div>
          <button aria-label="Kapat" onClick={() => setOpen(false)} type="button">✕</button>
        </header>

        <div className={styles.thread} ref={threadRef}>
          <p className={styles.bubbleBot}>
            {intro?.greeting ?? "Merhaba! Birkaç saniye içinde hazır olacağım."}
          </p>

          {intro?.mode === "knowledge" && (
            <p className={styles.modeNote}>
              Yapay zekâ şu anda bağlı değil. Soruları Bilgi Bankası&apos;nda arayıp bulduğum kaydı olduğu gibi gösteriyorum.
            </p>
          )}

          {turns.map((turn) => (
            <p className={turn.role === "bot" ? styles.bubbleBot : styles.bubbleUser} key={turn.id}>{turn.text}</p>
          ))}

          {busy && <p className={styles.typing}><i /><i /><i /></p>}

          {suggestions.length > 0 && !busy && (
            <div className={styles.topics}>
              <p className={styles.topicsHead}>{turns.length === 0 ? "Hangi konuda yardım istersin?" : "Bunlar da ilgini çekebilir"}</p>
              <div>
                {suggestions.map((topic) => (
                  <button key={topic.key} onClick={() => void send({ topic: topic.key }, topic.title)} type="button">
                    {topic.title}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <form className={styles.composer} onSubmit={submit}>
          <input
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Sorunu yaz…"
            value={question}
          />
          <button aria-label="Gönder" disabled={busy || question.trim().length < 2} type="submit">➤</button>
        </form>
      </section>
    )}
  </>;
}
