"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { apiRequest } from "@/lib/api";
import styles from "./assistant.module.css";

type Topic = {
  key: string;
  title: string;
  icon: string | null;
  summary: string | null;
  group: string | null;
};

type Group = { key: string; title: string };

type Lookup = { label: string; placeholder: string; action: string };

type LookupResult = {
  found: boolean;
  message?: string;
  reference?: string;
  title?: string;
  status_label?: string;
  role?: "buyer" | "seller";
  category?: string | null;
  location?: string | null;
  offer_count?: number | null;
  own_offer_status?: string | null;
};

type Intro = {
  mode: "knowledge" | "ai";
  greeting: string;
  subtitle: string | null;
  display_name: string | null;
  topics: Topic[];
  groups: Group[];
  lookup: Lookup | null;
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
  const [failed, setFailed] = useState(false);
  const [reference, setReference] = useState("");
  const [looking, setLooking] = useState(false);
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
      .catch(() => { if (active) setFailed(true); });
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

  /** Talep referansindan durum ogrenme. Sonuc sohbete bot balonu olarak duser. */
  const runLookup = async (event: React.FormEvent) => {
    event.preventDefault();
    const value = reference.trim();
    if (value.length < 3 || looking) return;

    push("user", value);
    setReference("");
    setLooking(true);

    try {
      const data = await apiRequest<LookupResult>("/assistant/lookup", {
        method: "POST",
        body: JSON.stringify({ reference: value }),
      });

      if (!data.found) {
        push("bot", data.message ?? "Bu referansla bir talep bulamadım.");
      } else {
        const satirlar = [
          `${data.reference} — ${data.title}`,
          `Durum: ${data.status_label}`,
          data.category ? `Kategori: ${data.category}` : null,
          data.location ? `Konum: ${data.location}` : null,
          data.role === "buyer"
            ? `Gelen teklif: ${data.offer_count ?? 0}`
            : data.own_offer_status ? `Senin teklifin: ${data.own_offer_status}` : null,
        ].filter(Boolean);

        push("bot", satirlar.join("\n"));
      }
    } catch {
      push("bot", "Sorgulayamadım, birazdan tekrar dener misin?");
    } finally {
      setLooking(false);
    }
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = question.trim();
    if (trimmed.length < 2) return;
    void send({ question: trimmed }, trimmed);
  };

  // Varsayilan misafir: kimlik belli olana kadar koyu surum gosterilir.
  // Tersi olsaydi giris yapmamis ziyaretci once acik surumu gorurdu.
  const guest = intro === null || intro.display_name === null;

  // Uyenin acilis gorunumu: gruplu kartlar. Sohbet basladiktan sonra yerini
  // kisa oneri ciplerine birakir, yoksa panel her cevapta bastan sisecekti.
  const grouped = !guest && turns.length === 0 && (intro?.groups.length ?? 0) > 0;

  return <>
    <button
      aria-label={open ? "Asistanı kapat" : "alıcam asistanını aç"}
      className={styles.launcher}
      data-open={open}
      onClick={() => setOpen((current) => !current)}
      type="button"
    >
      <Image alt="" height={106} priority={false} src="/asistan.gif" unoptimized width={132} />
      {!open && <span className={styles.ping} />}
    </button>

    {open && (
      <section aria-label="alıcam asistanı" className={styles.panel} data-guest={guest}>
        <header className={styles.head}>
          <span className={styles.avatar}><Image alt="" height={38} src="/asistan.gif" unoptimized width={38} /></span>
          <div>
            <strong>alıcam asistanı</strong>
            <small>
              {/* Misafire calisma modu yazilmaz: isine yaramayan bir ic ayrinti. */}
              {guest
                ? intro?.subtitle ?? "Sık sorulan konular"
                : <>
                    <i data-mode={intro?.mode ?? "knowledge"} />
                    {intro?.mode === "ai" ? "Yapay zekâ bağlı" : "Hazır cevap modu"}
                  </>}
            </small>
          </div>
          <button aria-label="Kapat" onClick={() => setOpen(false)} type="button">✕</button>
        </header>

        <div className={styles.thread} ref={threadRef}>
          <p className={styles.bubbleBot}>
            {intro?.greeting ?? "Merhaba! Birkaç saniye içinde hazır olacağım."}
          </p>

          {failed && (
            <p className={styles.modeNote}>
              Şu an bağlanamadım. İnternet bağlantını kontrol edip paneli kapatıp açabilirsin.
            </p>
          )}

          {!guest && intro?.mode === "knowledge" && (
            <p className={styles.modeNote}>
              Yapay zekâ şu anda bağlı değil. Soruları Bilgi Bankası&apos;nda arayıp bulduğum kaydı olduğu gibi gösteriyorum.
            </p>
          )}

          {turns.map((turn) => (
            <p className={turn.role === "bot" ? styles.bubbleBot : styles.bubbleUser} key={turn.id}>{turn.text}</p>
          ))}

          {busy && <p className={styles.typing}><i /><i /><i /></p>}

          {/* Uye: talep referansindan durum sorgulama. Sohbet baslayinca cekilir. */}
          {intro?.lookup && turns.length === 0 && !busy && (
            <div className={styles.lookup}>
              <p className={styles.topicsHead}>{intro.lookup.label}</p>
              <form onSubmit={runLookup}>
                <input
                  onChange={(event) => setReference(event.target.value)}
                  placeholder={intro.lookup.placeholder}
                  value={reference}
                />
                <button disabled={looking || reference.trim().length < 3} type="submit">
                  {looking ? "…" : intro.lookup.action}
                </button>
              </form>
            </div>
          )}

          {/* Uyede ilk gorunum gruplu kartlar; sonrasinda kisa oneri cipleri. */}
          {grouped && intro && !busy ? (
            <div className={styles.groups}>
              {intro.groups.map((group) => (
                <section key={group.key}>
                  <p className={styles.topicsHead}>{group.title}</p>
                  <div className={styles.cards}>
                    {intro.topics.filter((topic) => topic.group === group.key).map((topic) => (
                      <button
                        className={styles.card}
                        key={topic.key}
                        onClick={() => void send({ topic: topic.key }, topic.title)}
                        type="button"
                      >
                        <span className={styles.cardIcon}>{topic.icon ?? "💬"}</span>
                        <span className={styles.cardBody}>
                          <strong>{topic.title}</strong>
                          {topic.summary && <small>{topic.summary}</small>}
                        </span>
                        <span aria-hidden className={styles.chev}>›</span>
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : suggestions.length > 0 && !busy && (
            <div className={styles.topics}>
              <p className={styles.topicsHead}>
                {turns.length === 0
                  ? "Hangi konuda yardım istersin?"
                  : guest ? "Başka bir konu seç" : "Bunlar da ilgini çekebilir"}
              </p>
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

        {/* Giris yapmamis ziyaretci soru yazmaz; yalnizca basliklardan secer. */}
        {!guest && (
          <form className={styles.composer} onSubmit={submit}>
            <input
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Sorunu yaz…"
              value={question}
            />
            <button aria-label="Gönder" disabled={busy || question.trim().length < 2} type="submit">➤</button>
          </form>
        )}
      </section>
    )}
  </>;
}
