"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, apiRequest, firstApiError } from "@/lib/api";
import "../admin-standard.css";
import styles from "./mail-settings.module.css";

type Settings = {
  "mail.enabled": string;
  "mail.host": string;
  "mail.port": string;
  "mail.encryption": string;
  "mail.username": string;
  "mail.password": string;
  "mail.password_set"?: boolean;
  "mail.from_address": string;
  "mail.from_name": string;
  "assistant.gemini_key": string;
  "assistant.gemini_key_set"?: boolean;
  "assistant.model": string;
};

type Meta = { active_mailer: string; sms_ready: boolean; assistant_mode: "ai" | "knowledge" };

const empty: Settings = {
  "mail.enabled": "0",
  "mail.host": "",
  "mail.port": "587",
  "mail.encryption": "tls",
  "mail.username": "",
  "mail.password": "",
  "mail.from_address": "",
  "mail.from_name": "alıcam.net",
  "assistant.gemini_key": "",
  "assistant.model": "gemini-3-flash",
};

export function MailSettings() {
  const router = useRouter();
  const [form, setForm] = useState<Settings>(empty);
  const [passwordSet, setPasswordSet] = useState(false);
  const [geminiSet, setGeminiSet] = useState(false);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [testTo, setTestTo] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    apiRequest<{ data: Settings; meta: Meta }>("/admin/settings")
      .then((response) => {
        if (!active) return;
        setForm({ ...empty, ...response.data, "mail.password": "", "assistant.gemini_key": "" });
        setPasswordSet(Boolean(response.data["mail.password_set"]));
        setGeminiSet(Boolean(response.data["assistant.gemini_key_set"]));
        setMeta(response.meta);
      })
      .catch((requestError: unknown) => {
        if (!active) return;
        if (requestError instanceof ApiError && requestError.status === 401) return router.replace("/giris?devam=%2Fadmin%2Fayarlar");
        setError(firstApiError(requestError));
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [router]);

  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setNotice(""); setError("");
  };

  const save = async () => {
    setBusy(true); setNotice(""); setError("");
    try {
      const response = await apiRequest<{ message: string; data: Settings }>("/admin/settings", {
        method: "PUT",
        body: JSON.stringify({
          mail: {
            enabled: form["mail.enabled"] === "1",
            host: form["mail.host"],
            port: Number(form["mail.port"]) || 587,
            encryption: form["mail.encryption"],
            username: form["mail.username"],
            password: form["mail.password"],
            from_address: form["mail.from_address"],
            from_name: form["mail.from_name"],
          },
          assistant: {
            gemini_key: form["assistant.gemini_key"],
            model: form["assistant.model"],
          },
        }),
      });
      setNotice(response.message);
      setPasswordSet(Boolean(response.data["mail.password_set"]) || Boolean(form["mail.password"]));
      setGeminiSet((current) => current || Boolean(form["assistant.gemini_key"]));
      setForm((current) => ({ ...current, "mail.password": "", "assistant.gemini_key": "" }));
    } catch (requestError: unknown) {
      setError(firstApiError(requestError));
    } finally {
      setBusy(false);
    }
  };

  const sendTest = async () => {
    setBusy(true); setNotice(""); setError("");
    try {
      const response = await apiRequest<{ message: string }>("/admin/settings/mail-test", {
        method: "POST",
        body: JSON.stringify({ to: testTo }),
      });
      setNotice(response.message);
    } catch (requestError: unknown) {
      setError(firstApiError(requestError));
    } finally {
      setBusy(false);
    }
  };

  const on = form["mail.enabled"] === "1";

  return <main className="admin-shell">
    <aside className="admin-sidebar">
      <Link className="brand admin-brand" href="/">alıcam<span>.net</span></Link>
      <div className="admin-product"><span>YÖNETİM MERKEZİ</span><strong>Operasyon</strong></div>
      <nav>
        <Link href="/admin"><i>◇</i> Genel bakış</Link>
        <Link href="/admin/kategoriler"><i>▦</i> Kategoriler</Link>
        <Link href="/admin/satici-onaylari"><i>✓</i> Satıcı onayları</Link>
        <Link className="active" href="/admin/ayarlar"><i>✉</i> Bildirim ayarları</Link>
      </nav>
    </aside>

    <section className="admin-content">
      <header className="admin-header">
        <div>
          <span className="admin-kicker">BİLDİRİM ALTYAPISI</span>
          <h1>E-posta bağlantısı</h1>
          <p>SMTP bilgilerini buradan girin; sunucu dosyasını düzenlemeye gerek yok.</p>
        </div>
        <Link className="admin-home-button" href="/">Siteyi görüntüle ↗</Link>
      </header>

      {loading ? <p className={styles.state}>Ayarlar yükleniyor…</p> : <>
        {notice && <p className={styles.notice}>✓ {notice}</p>}
        {error && <p className="admin-error">{error}</p>}

        <section className={styles.card}>
          <header>
            <div>
              <strong>SMTP sunucusu</strong>
              <small>Şu anki gönderim sürücüsü: <b>{meta?.active_mailer ?? "?"}</b>{meta?.active_mailer === "log" && " — e-postalar yalnızca kayda yazılıyor"}</small>
            </div>
            <label className={styles.toggle}>
              <input checked={on} onChange={(event) => set("mail.enabled", event.target.checked ? "1" : "0")} type="checkbox" />
              <span>{on ? "Gönderim açık" : "Gönderim kapalı"}</span>
            </label>
          </header>

          <div className={styles.grid}>
            <label className={styles.wide}>Sunucu adresi (host)<input onChange={(event) => set("mail.host", event.target.value)} placeholder="smtp.sirketim.com" value={form["mail.host"]} /></label>
            <label>Port<input inputMode="numeric" onChange={(event) => set("mail.port", event.target.value)} placeholder="587" value={form["mail.port"]} /></label>
            <label>Şifreleme
              <select onChange={(event) => set("mail.encryption", event.target.value)} value={form["mail.encryption"]}>
                <option value="tls">TLS (587)</option>
                <option value="ssl">SSL (465)</option>
                <option value="none">Yok</option>
              </select>
            </label>
            <label>Kullanıcı adı<input autoComplete="off" onChange={(event) => set("mail.username", event.target.value)} placeholder="bildirim@sirketim.com" value={form["mail.username"]} /></label>
            <label>
              Parola
              <input
                autoComplete="new-password"
                onChange={(event) => set("mail.password", event.target.value)}
                placeholder={passwordSet ? "•••••••• (kayıtlı)" : "SMTP parolası"}
                type="password"
                value={form["mail.password"]}
              />
              <small>{passwordSet ? "Kayıtlı parola saklı. Değiştirmek istemiyorsan boş bırak." : "Şifrelenerek saklanır, panelde bir daha gösterilmez."}</small>
            </label>
            <label>Gönderen e-posta<input onChange={(event) => set("mail.from_address", event.target.value)} placeholder="bildirim@alicam.net" value={form["mail.from_address"]} /></label>
            <label>Gönderen adı<input onChange={(event) => set("mail.from_name", event.target.value)} value={form["mail.from_name"]} /></label>
          </div>

          <footer>
            <button disabled={busy} onClick={save} type="button">{busy ? "Kaydediliyor…" : "Ayarları kaydet"}</button>
          </footer>
        </section>

        <section className={styles.card}>
          <header><div><strong>Deneme gönderimi</strong><small>Kayıtlı ayarlarla tek bir e-posta gönderilir.</small></div></header>
          <div className={styles.testRow}>
            <input onChange={(event) => setTestTo(event.target.value)} placeholder="deneme@adresin.com" type="email" value={testTo} />
            <button disabled={busy || !testTo.includes("@")} onClick={sendTest} type="button">Deneme gönder</button>
          </div>
        </section>

        <section className={styles.card}>
          <header>
            <div>
              <strong>alıcam asistanı</strong>
              <small>Şu anki mod: <b>{meta?.assistant_mode === "ai" ? "Yapay zekâ bağlı" : "Hazır cevap modu"}</b></small>
            </div>
          </header>
          <div className={styles.grid}>
            <label className={styles.wide}>
              Gemini API anahtarı
              <input
                autoComplete="off"
                onChange={(event) => set("assistant.gemini_key", event.target.value)}
                placeholder={geminiSet ? "•••••••• (kayıtlı)" : "Boş bırakırsan hazır cevap modunda çalışır"}
                type="password"
                value={form["assistant.gemini_key"]}
              />
              <small>{geminiSet ? "Anahtar kayıtlı. Değiştirmek istemiyorsan boş bırak." : "Şifrelenerek saklanır. Anahtar girilene kadar asistan yalnızca Bilgi Bankası'ndaki kayıtlı cevapları verir."}</small>
            </label>
            <label>Model<input onChange={(event) => set("assistant.model", event.target.value)} placeholder="gemini-3-flash" value={form["assistant.model"]} /><small>Gemini 3 Flash ailesi kullanılır. Google model kimliğini değiştirirse güncelini buraya yazman yeterli.</small></label>
          </div>
          <footer>
            <button disabled={busy} onClick={save} type="button">{busy ? "Kaydediliyor…" : "Asistan ayarlarını kaydet"}</button>
          </footer>
        </section>

        <section className={`${styles.card} ${styles.soon}`}>
          <header><div><strong>SMS sağlayıcısı</strong><small>Altyapı hazır; sağlayıcı seçilince aynı ekrandan bağlanacak.</small></div><span className={styles.badge}>Yakında</span></header>
          <p className={styles.soonText}>
            Bildirimler sağlayıcı bağımsız yazıldı. Sağlayıcıya karar verdiğinizde kullanıcı adı, parola ve gönderici başlığı
            alanları bu bölüme eklenecek; uygulama içi ve e-posta bildirimleri bundan etkilenmeyecek.
          </p>
        </section>
      </>}
    </section>
  </main>;
}
