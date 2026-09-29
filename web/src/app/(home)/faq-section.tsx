"use client";

import Link from "next/link";
import { MouseEvent, useState } from "react";
import styles from "../marketplace.module.css";
import { FAQ, FAQ_TOPICS, FaqItem, fold } from "./home-data";
import { useInView, useReducedMotion } from "./home-hooks";

/** Aramadaki kelimeyi baslikta isaretler. */
function highlight(text: string, term: string) {
  const needle = term.trim();
  if (!needle) return text;

  const at = fold(text).indexOf(fold(needle));
  if (at < 0) return text;

  return <>
    {text.slice(0, at)}
    <mark>{text.slice(at, at + needle.length)}</mark>
    {text.slice(at + needle.length)}
  </>;
}

function matches(item: FaqItem, words: string[]): boolean {
  if (words.length === 0) return true;
  const key = fold(`${item.q} ${item.a}`);
  return words.every((word) => key.includes(word));
}

export function FaqSection() {
  const reduced = useReducedMotion();
  const [helpRef, helpSeen] = useInView<HTMLDivElement>(!reduced);
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string>(FAQ[0].id);

  const words = fold(query.trim()).split(/\s+/).filter(Boolean);
  const shown = FAQ.filter((item) => (topic ? item.topics.includes(topic) : matches(item, words)));

  const onSearch = (value: string) => {
    setQuery(value);
    setTopic(null);

    const list = FAQ.filter((item) => matches(item, fold(value.trim()).split(/\s+/).filter(Boolean)));
    if (list.length > 0) setOpenId(list[0].id);
  };

  const onTopic = (id: string) => {
    const next = topic === id ? null : id;
    setTopic(next);
    setQuery("");

    const list = next ? FAQ.filter((item) => item.topics.includes(next)) : FAQ;
    if (list.length > 0) setOpenId(list[0].id);
  };

  const onSummary = (event: MouseEvent<HTMLElement>, id: string) => {
    event.preventDefault();
    setOpenId((current) => (current === id ? "" : id));
  };

  return <div className={styles.faqWrap}>
    <div className={styles.faqSide}>
      <div className={styles.secHead}>
        <span className={styles.eyebrow}>Sık sorulanlar</span>
        <h2 id="faq-title">Aklına takılanlar.</h2>
      </div>

      <label className={styles.faqSearch}>
        <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
        <input
          aria-label="Sık sorulanlarda ara"
          autoComplete="off"
          onChange={(event) => onSearch(event.target.value)}
          placeholder="Sorunu yaz… örn. ücret, numara, kontör"
          type="search"
          value={query}
        />
        <kbd>{shown.length} soru</kbd>
      </label>

      <div aria-label="Konular" className={styles.faqTopics} role="group">
        {FAQ_TOPICS.map((item) => (
          <button
            aria-pressed={topic === item.id}
            key={item.id}
            onClick={() => onTopic(item.id)}
            type="button"
          >
            <i>{item.emoji}</i>
            <span><strong>{item.title}</strong><small>{item.hint}</small></span>
          </button>
        ))}
      </div>

      <div className={`${styles.faqHelp}${helpSeen ? ` ${styles.faqHelpGo}` : ""}`} ref={helpRef}>
        <div aria-hidden="true" className={styles.chat}>
          <div className={`${styles.bubble} ${styles.bubbleMe}`}>Sorumun cevabını bulamadım 🤔</div>
          <div className={`${styles.bubble} ${styles.bubbleThem}`}>
            <span className={styles.avMini}>a</span>Hemen yardımcı olalım! Bize yazman yeterli.
          </div>
          <div className={`${styles.bubble} ${styles.bubbleThem} ${styles.bubbleTyping}`}>
            <span className={styles.avMini}>a</span><i /><i /><i />
          </div>
        </div>

        <strong>Hâlâ aklında soru mu var?</strong>
        <p>Destek ekibimiz talep oluşturma, teklif verme ve hesap konularında yardımcı olur.</p>
        <div className={styles.faqHelpActions}>
          <a className={`${styles.btn} ${styles.btnWhite}`} href="mailto:destek@alicam.net">✉️ Bize yaz</a>
          <Link className={`${styles.btn} ${styles.btnGhostLight}`} href="/talep-olustur">＋ Talep oluştur</Link>
        </div>
      </div>
    </div>

    <div className={styles.faq}>
      {shown.map((item) => (
        <details key={item.id} open={openId === item.id}>
          <summary onClick={(event) => onSummary(event, item.id)}>{highlight(item.q, query)}</summary>
          <p>{item.a}</p>
        </details>
      ))}

      {shown.length === 0 && (
        <p className={styles.faqEmpty}>
          Bu konuda hazır bir cevap bulamadık. <a href="mailto:destek@alicam.net">destek@alicam.net</a> adresine yaz,
          hemen yardımcı olalım.
        </p>
      )}
    </div>
  </div>;
}
