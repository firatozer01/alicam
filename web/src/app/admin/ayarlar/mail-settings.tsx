"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, apiRequest, firstApiError } from "@/lib/api";
import { applyBranding } from "@/components/shell/brand";
import { AdminSidebar, type AdminSidebarUser } from "../admin-sidebar";
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
  "images.pexels_key": string;
  "images.pexels_key_set"?: boolean;
  "assistant.model": string;
  "social.instagram": string;
  "social.youtube": string;
  "social.tiktok": string;
  "social.x": string;
  "social.facebook": string;
  "social.linkedin": string;
  "paytr.enabled": string;
  "paytr.merchant_id": string;
  "paytr.merchant_key": string;
  "paytr.merchant_key_set"?: boolean;
  "paytr.merchant_salt": string;
  "paytr.merchant_salt_set"?: boolean;
  "paytr.test_mode": string;
  "company.unvan": string;
  "company.adres": string;
  "company.telefon": string;
  "company.eposta": string;
  "company.mersis": string;
  "company.vergi_dairesi": string;
  "company.vergi_no": string;
  "company.kep": string;
};

type Meta = { active_mailer: string; sms_ready: boolean; assistant_mode: "ai" | "knowledge"; image_source: "pexels" | "acik-kaynak" };

type BrandKind = "logo" | "logo_light" | "mark";

/**
 * Yuklenmis dosyanin adresi ya da null. null "yonetici bir sey yuklemedi,
 * paketle gelen gorsel kullaniliyor" demek; bu yuzden bos metin degil null.
 */
type Branding = Record<BrandKind, string | null>;

type SiteSettingsResponse = { data: { branding?: Branding } };

type BrandingResponse = { message?: string; data: { branding: Branding } };

const noBranding: Branding = { logo: null, logo_light: null, mark: null };

/**
 * Uc yuva da ayni kaliba oturdugu icin tek yerden tarif ediliyor.
 * fallback, hic yukleme yapilmamisken onizlemede gosterilecek gomulu dosya.
 */
const brandSlots: { kind: BrandKind; label: string; fallback: string; hint: string; dark?: boolean; square?: boolean }[] = [
  { kind: "logo", label: "Logo", fallback: "/logo.png", hint: "Üst bar ve panellerde kullanılır." },
  { kind: "logo_light", label: "Koyu zemin logosu", fallback: "/logo-light.png", hint: "Alt bilgi gibi koyu zeminlerde kullanılır.", dark: true },
  { kind: "mark", label: "Simge", fallback: "/mark.png", hint: "Dar ekranda, tam logonun sığmadığı yerlerde kullanılır.", square: true },
];

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
  "assistant.model": "gemini-3.8-flash",
  "images.pexels_key": "",
  "social.instagram": "",
  "social.youtube": "",
  "social.tiktok": "",
  "social.x": "",
  "social.facebook": "",
  "social.linkedin": "",
  "paytr.enabled": "0",
  "paytr.merchant_id": "",
  "paytr.merchant_key": "",
  "paytr.merchant_salt": "",
  "paytr.test_mode": "1",
  "company.unvan": "",
  "company.adres": "",
  "company.telefon": "",
  "company.eposta": "",
  "company.mersis": "",
  "company.vergi_dairesi": "",
  "company.vergi_no": "",
  "company.kep": "",
};

export function MailSettings() {
  const router = useRouter();
  const [form, setForm] = useState<Settings>(empty);
  const [passwordSet, setPasswordSet] = useState(false);
  const [geminiSet, setGeminiSet] = useState(false);
  const [pexelsSet, setPexelsSet] = useState(false);
  const [paytrKeySet, setPaytrKeySet] = useState(false);
  const [paytrSaltSet, setPaytrSaltSet] = useState(false);
  const [paytrBusy, setPaytrBusy] = useState(false);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [testTo, setTestTo] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [branding, setBranding] = useState<Branding>(noBranding);
  // Ayni anda yalnizca bir yuva ile islem yapiliyor; hangisi oldugunu
  // tutmak, o yuvanin dugmelerini digerlerine dokunmadan kilitlemeye yetiyor.
  const [brandBusy, setBrandBusy] = useState<BrandKind | "">("");
  const brandInputs = useRef<Partial<Record<BrandKind, HTMLInputElement | null>>>({});
  const [admin, setAdmin] = useState<AdminSidebarUser | null>(null);

  // Kenar cubugundaki kullanici bloku icin. Ayri bir istek, cunku
  // /admin/settings yaniti yoneticiyi tasimiyor. Sessizce yutuyoruz: oturum
  // sorununu zaten asagidaki ana istek yakalayip girise yonlendiriyor.
  useEffect(() => {
    let active = true;
    apiRequest<{ data: AdminSidebarUser }>("/me")
      .then((response) => { if (active) setAdmin(response.data); })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    apiRequest<{ data: Settings; meta: Meta }>("/admin/settings")
      .then((response) => {
        if (!active) return;
        setForm({ ...empty, ...response.data, "mail.password": "", "assistant.gemini_key": "", "images.pexels_key": "", "paytr.merchant_key": "", "paytr.merchant_salt": "" });
        setPasswordSet(Boolean(response.data["mail.password_set"]));
        setGeminiSet(Boolean(response.data["assistant.gemini_key_set"]));
        setPexelsSet(Boolean(response.data["images.pexels_key_set"]));
        setPaytrKeySet(Boolean(response.data["paytr.merchant_key_set"]));
        setPaytrSaltSet(Boolean(response.data["paytr.merchant_salt_set"]));
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

  // Marka gorselleri /admin/settings'te degil; sitenin her yeri ile ayni
  // kaynaktan okunsun diye herkese acik uctan aliniyor. Uc hazir degilse
  // sessizce gomulu varsayilanlarda kaliyoruz, kart yine de acilir.
  useEffect(() => {
    let active = true;
    apiRequest<SiteSettingsResponse>("/site-settings")
      .then((response) => {
        if (active && response.data.branding) setBranding(response.data.branding);
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setNotice(""); setError("");
  };

  const save = async (clear: string[] = []) => {
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
          images: {
            pexels_key: form["images.pexels_key"],
          },
          social: {
            instagram: form["social.instagram"],
            youtube: form["social.youtube"],
            tiktok: form["social.tiktok"],
            x: form["social.x"],
            facebook: form["social.facebook"],
            linkedin: form["social.linkedin"],
          },
          paytr: {
            enabled: form["paytr.enabled"] === "1",
            merchant_id: form["paytr.merchant_id"],
            merchant_key: form["paytr.merchant_key"],
            merchant_salt: form["paytr.merchant_salt"],
            test_mode: form["paytr.test_mode"] === "1",
          },
          company: {
            unvan: form["company.unvan"],
            adres: form["company.adres"],
            telefon: form["company.telefon"],
            eposta: form["company.eposta"],
            mersis: form["company.mersis"],
            vergi_dairesi: form["company.vergi_dairesi"],
            vergi_no: form["company.vergi_no"],
            kep: form["company.kep"],
          },
          ...(clear.length > 0 ? { clear } : {}),
        }),
      });
      setNotice(response.message);
      setPasswordSet(Boolean(response.data["mail.password_set"]));
      setGeminiSet(Boolean(response.data["assistant.gemini_key_set"]));
      setPexelsSet(Boolean(response.data["images.pexels_key_set"]));
      setPaytrKeySet(Boolean(response.data["paytr.merchant_key_set"]));
      setPaytrSaltSet(Boolean(response.data["paytr.merchant_salt_set"]));
      // Sunucu sosyal adresleri normalize ediyor ("tiktok.com/@x" ->
      // "https://tiktok.com/@x"); kaydedilen hali geri yazilmazsa ekranda
      // yazan ile sitede gorunen farkli kalir.
      setForm((current) => ({
        ...current,
        "social.instagram": response.data["social.instagram"],
        "social.youtube": response.data["social.youtube"],
        "social.tiktok": response.data["social.tiktok"],
        "social.x": response.data["social.x"],
        "social.facebook": response.data["social.facebook"],
        "social.linkedin": response.data["social.linkedin"],
        "mail.password": "",
        "assistant.gemini_key": "",
        "images.pexels_key": "",
        "paytr.merchant_key": "",
        "paytr.merchant_salt": "",
      }));
    } catch (requestError: unknown) {
      setError(firstApiError(requestError));
    } finally {
      setBusy(false);
    }
  };

  /**
   * PayTR baglantisini sinar.
   *
   * Uc gercek bir token istegi gonderiyor: PayTR bilgileri ve imzayi
   * dogrulamadan token vermez, dolayisiyla olumlu yanit bilgilerin
   * CALISTIGININ kanitidir. Siparis olusmaz, para cekilmez.
   */
  const testPaytr = async () => {
    setPaytrBusy(true); setNotice(""); setError("");
    try {
      const response = await apiRequest<{ message: string }>("/admin/settings/paytr-test", { method: "POST" });
      setNotice(response.message);
    } catch (requestError: unknown) {
      setError(firstApiError(requestError));
    } finally {
      setPaytrBusy(false);
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

  const uploadBrand = async (kind: BrandKind, file: File) => {
    setBrandBusy(kind); setNotice(""); setError("");
    try {
      // FormData dogrudan veriliyor: apiRequest boyle bir govdede
      // Content-Type yazmiyor, multipart sinirini tarayici koyuyor.
      const body = new FormData();
      body.append("file", file);
      const response = await apiRequest<BrandingResponse>(`/admin/branding/${kind}`, { method: "POST", body });
      setBranding(response.data.branding);
      // Kenar cubugu ve sayfadaki obur logolar da ayni anda yenilensin.
      applyBranding(response.data.branding);
      setNotice(response.message ?? "Görsel yüklendi.");
    } catch (requestError: unknown) {
      setError(firstApiError(requestError));
    } finally {
      setBrandBusy("");
    }
  };

  const resetBrand = async (kind: BrandKind) => {
    setBrandBusy(kind); setNotice(""); setError("");
    try {
      const response = await apiRequest<BrandingResponse>(`/admin/branding/${kind}`, { method: "DELETE" });
      setBranding(response.data.branding);
      // Kenar cubugu ve sayfadaki obur logolar da ayni anda yenilensin.
      applyBranding(response.data.branding);
      setNotice(response.message ?? "Varsayılan görsele dönüldü.");
    } catch (requestError: unknown) {
      setError(firstApiError(requestError));
    } finally {
      setBrandBusy("");
    }
  };

  const on = form["mail.enabled"] === "1";

  return <main className="admin-page">
    <AdminSidebar active="ayarlar" user={admin} />

    <section className="admin-content">
      <header className="admin-header">
        <div>
          <span className="admin-kicker">SİTE AYARLARI</span>
          <h1>Ayarlar</h1>
          <p>E-posta gönderimi, asistan, görsel kaynağı ve sosyal medya hesapları buradan yönetilir; sunucu dosyasını düzenlemeye gerek yok.</p>
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
            <button disabled={busy} onClick={() => void save()} type="button">{busy ? "Kaydediliyor…" : "Ayarları kaydet"}</button>
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
              <small>Şu anki mod: <b>{geminiSet ? "Yapay zekâ bağlı" : "Hazır cevap modu"}</b></small>
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
            <label>Model<input onChange={(event) => set("assistant.model", event.target.value)} placeholder="gemini-3.8-flash" value={form["assistant.model"]} /><small>Gemini 3 Flash ailesi kullanılır. Google model kimliğini değiştirirse güncelini buraya yazman yeterli.</small></label>
          </div>
          <footer>
            {geminiSet && (
              <button
                className={styles.unlink}
                disabled={busy}
                onClick={() => void save(["assistant.gemini_key"])}
                type="button"
              >
                Yapay zekâyı kaldır
              </button>
            )}
            <button disabled={busy} onClick={() => void save()} type="button">{busy ? "Kaydediliyor…" : "Asistan ayarlarını kaydet"}</button>
          </footer>
        </section>

        <section className={styles.card}>
          <header>
            <div>
              <strong>Hizmet kartı fotoğrafları</strong>
              <small>
                Şu anki kaynak: <b>{meta?.image_source === "pexels" ? "Pexels (stok fotoğraf)" : "Açık kaynak (Openverse + Wikimedia)"}</b>
              </small>
            </div>
          </header>
          <div className={styles.grid}>
            <label className={styles.wide}>
              Pexels API anahtarı
              <input
                autoComplete="off"
                onChange={(event) => set("images.pexels_key", event.target.value)}
                placeholder={pexelsSet ? "•••••••• (kayıtlı)" : "Boş bırakırsan açık kaynaklardan aranır"}
                type="password"
                value={form["images.pexels_key"]}
              />
              <small>
                {pexelsSet
                  ? "Anahtar kayıtlı. Değiştirmek istemiyorsan boş bırak."
                  : "pexels.com/api adresinden ücretsiz alınır. Açık kaynaklar ansiklopedik olduğu için hizmet kartlarına uygun fotoğraf bulmakta zorlanıyor; Pexels bir stok fotoğraf kütüphanesi ve belirgin şekilde daha isabetli sonuç veriyor."}
              </small>
            </label>
          </div>
          <footer>
            {pexelsSet && (
              <button
                className={styles.unlink}
                disabled={busy}
                onClick={() => void save(["images.pexels_key"])}
                type="button"
              >
                Anahtarı kaldır
              </button>
            )}
            <button disabled={busy} onClick={() => void save()} type="button">{busy ? "Kaydediliyor…" : "Görsel ayarını kaydet"}</button>
          </footer>
        </section>

        {/* PayTR odeme kurulusu. Bilgiler daha once yalnizca sunucudaki .env
            dosyasindan okunuyordu; artik SMTP parolasiyla ayni sifreli
            depoda. Alanlar bos birakilirsa .env gecerli kalir. */}
        <section className={styles.card}>
          <header>
            <div>
              <strong>PayTR ödeme bağlantısı</strong>
              <small>
                Kredi satın alma bu bağlantı üzerinden çalışır. Mağaza bilgilerini
                PayTR panelindeki <b>Bilgi</b> sayfasından alırsın.
              </small>
            </div>
            <label className={styles.toggle}>
              <input
                checked={form["paytr.enabled"] === "1"}
                onChange={(event) => set("paytr.enabled", event.target.checked ? "1" : "0")}
                type="checkbox"
              />
              {form["paytr.enabled"] === "1" ? "Panelden yönetiliyor" : "Panel kapalı"}
            </label>
          </header>

          <div className={styles.grid}>
            <label>
              Mağaza no (merchant_id)
              <input autoComplete="off" inputMode="numeric" onChange={(event) => set("paytr.merchant_id", event.target.value)} placeholder="123456" value={form["paytr.merchant_id"]} />
            </label>
            <label>
              Mağaza parola (merchant_key)
              <input
                autoComplete="off"
                onChange={(event) => set("paytr.merchant_key", event.target.value)}
                placeholder={paytrKeySet ? "•••••••• (kayıtlı)" : "PayTR panelinden alınır"}
                type="password"
                value={form["paytr.merchant_key"]}
              />
            </label>
            <label>
              Mağaza gizli anahtar (merchant_salt)
              <input
                autoComplete="off"
                onChange={(event) => set("paytr.merchant_salt", event.target.value)}
                placeholder={paytrSaltSet ? "•••••••• (kayıtlı)" : "PayTR panelinden alınır"}
                type="password"
                value={form["paytr.merchant_salt"]}
              />
            </label>
            <label className={styles.toggle}>
              <input
                checked={form["paytr.test_mode"] === "1"}
                onChange={(event) => set("paytr.test_mode", event.target.checked ? "1" : "0")}
                type="checkbox"
              />
              Test kipi {form["paytr.test_mode"] === "1" ? "açık — karttan para çekilmez" : "KAPALI — gerçek tahsilat yapılır"}
            </label>
            <label className={styles.wide}>
              Bildirim (callback) adresi
              <input onChange={() => undefined} readOnly value="https://alicam.net/api/payments/paytr/callback" />
              <small>
                Bu adresi PayTR panelindeki <b>Bildirim URL</b> alanına yapıştır. Ödeme ancak
                PayTR bu adrese imzalı bildirimi gönderdikten sonra krediye dönüşür; tarayıcının
                başarı sayfası ödeme kanıtı sayılmaz.
              </small>
            </label>
          </div>

          <footer>
            {(paytrKeySet || paytrSaltSet) && (
              <button
                className={styles.unlink}
                disabled={busy}
                onClick={() => void save(["paytr.merchant_key", "paytr.merchant_salt"])}
                type="button"
              >
                Kayıtlı anahtarları sil
              </button>
            )}
            <button disabled={paytrBusy || busy} onClick={() => void testPaytr()} type="button">
              {paytrBusy ? "Deneniyor…" : "Bağlantıyı dene"}
            </button>
            <button disabled={busy} onClick={() => void save()} type="button">{busy ? "Kaydediliyor…" : "PayTR ayarlarını kaydet"}</button>
          </footer>
        </section>

        {/* Kurumsal kimlik: iletisim sayfasi ve KVKK aydinlatma metni bu
            alanlari basiyor. Bos birakilan alan o sayfalarda hic gorunmez. */}
        <section className={styles.card}>
          <header>
            <div>
              <strong>Kurumsal kimlik</strong>
              <small>İletişim sayfası ve KVKK aydınlatma metni bu bilgileri yayımlar. Boş bıraktığın alan o sayfalarda hiç görünmez.</small>
            </div>
          </header>
          <div className={styles.grid}>
            <label className={styles.wide}>Unvan<input onChange={(event) => set("company.unvan", event.target.value)} placeholder="SMN LIFE İNŞAAT TİCARET LİMİTED ŞİRKETİ" value={form["company.unvan"]} /></label>
            <label className={styles.wide}>Adres<input onChange={(event) => set("company.adres", event.target.value)} placeholder="Mahalle, sokak, no, ilçe / il" value={form["company.adres"]} /></label>
            <label>Telefon<input inputMode="tel" onChange={(event) => set("company.telefon", event.target.value)} placeholder="+90 216 000 00 00" value={form["company.telefon"]} /></label>
            <label>E-posta<input inputMode="email" onChange={(event) => set("company.eposta", event.target.value)} placeholder="destek@alicam.net" value={form["company.eposta"]} /></label>
            <label>Vergi dairesi<input onChange={(event) => set("company.vergi_dairesi", event.target.value)} placeholder="Kozyatağı" value={form["company.vergi_dairesi"]} /></label>
            <label>Vergi no<input inputMode="numeric" onChange={(event) => set("company.vergi_no", event.target.value)} placeholder="7721513073" value={form["company.vergi_no"]} /></label>
            <label>MERSİS no<input inputMode="numeric" onChange={(event) => set("company.mersis", event.target.value)} placeholder="0000000000000000" value={form["company.mersis"]} /></label>
            <label>KEP adresi<input inputMode="email" onChange={(event) => set("company.kep", event.target.value)} placeholder="sirket@hs01.kep.tr" value={form["company.kep"]} /></label>
          </div>
          <footer>
            <button disabled={busy} onClick={() => void save()} type="button">{busy ? "Kaydediliyor…" : "Kurumsal bilgileri kaydet"}</button>
          </footer>
        </section>

        <section className={styles.card}>
          <header>
            <div>
              <strong>Sosyal medya hesapları</strong>
              <small>Alt bilgideki simgeler bu adreslere gider. Boş bıraktığın hesabın simgesi sitede hiç görünmez.</small>
            </div>
          </header>
          <div className={styles.grid}>
            <label>Instagram<input autoComplete="off" inputMode="url" onChange={(event) => set("social.instagram", event.target.value)} placeholder="https://www.instagram.com/alicamnet" value={form["social.instagram"]} /></label>
            <label>YouTube<input autoComplete="off" inputMode="url" onChange={(event) => set("social.youtube", event.target.value)} placeholder="https://www.youtube.com/@alicamnet" value={form["social.youtube"]} /></label>
            <label>TikTok<input autoComplete="off" inputMode="url" onChange={(event) => set("social.tiktok", event.target.value)} placeholder="https://www.tiktok.com/@alicamnet" value={form["social.tiktok"]} /></label>
            <label>X (Twitter)<input autoComplete="off" inputMode="url" onChange={(event) => set("social.x", event.target.value)} placeholder="https://x.com/alicamnet" value={form["social.x"]} /></label>
            <label>
              Facebook
              <input autoComplete="off" inputMode="url" onChange={(event) => set("social.facebook", event.target.value)} placeholder="https://www.facebook.com/alicamnet" value={form["social.facebook"]} />
              <small>Hesap yoksa boş bırakılabilir.</small>
            </label>
            <label>
              LinkedIn
              <input autoComplete="off" inputMode="url" onChange={(event) => set("social.linkedin", event.target.value)} placeholder="https://www.linkedin.com/company/alicamnet" value={form["social.linkedin"]} />
              <small>Hesap yoksa boş bırakılabilir.</small>
            </label>
          </div>
          <footer>
            <button disabled={busy} onClick={() => void save()} type="button">{busy ? "Kaydediliyor…" : "Sosyal medya bağlantılarını kaydet"}</button>
          </footer>
        </section>

        <section className={styles.card}>
          <header>
            <div>
              <strong>Logo ve marka</strong>
              <small>Buradaki görseller sitenin her yerinde kullanılır: üst bar, alt bilgi, yönetim panelleri ve sihirbazlar. Yenisini yükleyince tamamı birden değişir. Tarayıcı sekmesindeki simge buraya dahil değil; o uygulamaya gömülüdür.</small>
            </div>
          </header>
          <div className={styles.brandGrid}>
            {brandSlots.map((slot) => {
              const current = branding[slot.kind];
              const slotBusy = brandBusy === slot.kind;
              return <div className={styles.brandSlot} key={slot.kind}>
                <span>{slot.label}</span>
                <div className={`${styles.brandBox}${slot.dark ? ` ${styles.brandBoxDark}` : ""}${slot.square ? ` ${styles.brandBoxSquare}` : ""}`}>
                  {/* Adresteki surum damgasi uctan geliyor; next/image ise
                      /api yollarini optimize edemiyor, o yuzden duz <img>. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img alt={`${slot.label} önizlemesi`} src={current ?? slot.fallback} />
                </div>
                <input
                  accept="image/png,image/webp,image/jpeg"
                  className={styles.brandFile}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    // Ayni dosya ikinci kez secilirse de onChange dussun diye
                    // alan hemen bosaltiliyor.
                    event.target.value = "";
                    if (file) void uploadBrand(slot.kind, file);
                  }}
                  ref={(node) => { brandInputs.current[slot.kind] = node; }}
                  type="file"
                />
                <div className={styles.brandActions}>
                  <button disabled={slotBusy} onClick={() => brandInputs.current[slot.kind]?.click()} type="button">
                    {slotBusy ? "Yükleniyor…" : "Değiştir"}
                  </button>
                  {current && (
                    <button className={styles.brandReset} disabled={slotBusy} onClick={() => void resetBrand(slot.kind)} type="button">
                      Varsayılana dön
                    </button>
                  )}
                </div>
                <small>{slot.hint}</small>
              </div>;
            })}
          </div>
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
