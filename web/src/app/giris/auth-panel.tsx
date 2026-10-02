"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { ApiError, apiRequest, firstApiError } from "@/lib/api";
import styles from "./auth.module.css";

type User = {
  id: number;
  name: string;
  email: string;
  phone: string;
  roles: string[];
  verification: { email: boolean; phone: boolean; complete: boolean };
};

type AuthResponse = {
  data: User;
  verification_preview?: Partial<Record<"email" | "phone", string>>;
};

type Mode = "login" | "register" | "verify";
type Role = "alici" | "veren";

/**
 * Sag paneldeki metin sekmeye ve secili role gore degisir; tasarimdaki
 * VIS haritasinin birebir karsiligi.
 */
function visualCopy(key: "login" | Role) {
  if (key === "alici") {
    return {
      title: <>Bir kez yaz,<br /><em>teklifler sana gelsin.</em></>,
      text: "Talep oluşturmak, teklif almak ve karşılaştırmak her zaman ücretsiz.",
    };
  }

  if (key === "veren") {
    return {
      title: <>Müşteri aramayı bırak,<br /><em>talepler sana gelsin.</em></>,
      text: "Bölgendeki gerçek taleplere ulaş. Özetleri ücretsiz gör, sadece ilgilendiğin talep için öde.",
    };
  }

  return {
    title: <>Aramakla uğraşma.<br /><em>Ne istediğini yaz.</em></>,
    text: "Usta, kiralık daire, araç ya da telefon… Tek bir talep yaz; uygun teklif verenler sana gelsin.",
  };
}

const verticals = [
  { value: "hizmet", icon: "🛠️", label: "Hizmet" },
  { value: "emlak", icon: "🏠", label: "Emlak" },
  { value: "vasita", icon: "🚗", label: "Vasıta" },
  { value: "alisveris", icon: "🛍️", label: "Ürün satışı" },
  { value: "makine", icon: "🚜", label: "İş makinesi" },
];

const sampleRequests = [
  { icon: "🏠", title: "3+1 kiralık daire", meta: "Ataşehir · 35–42 bin ₺/ay", count: "6 teklif" },
  { icon: "🚗", title: "Otomatik dizel otomobil", meta: "Çankaya · 1,15 milyon ₺'ye kadar", count: "4 teklif" },
  { icon: "🔧", title: "Kombi yıllık bakımı", meta: "Kadıköy · 1.500–2.500 ₺", count: "3 teklif" },
];

const benefits = ["Talep etmek ücretsiz", "Numaran gizli", "Onaylı teklif verenler"];

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const letterPattern = /[a-zçğıöşü]/i;
const phoneLikePattern = /^[+\d][\d\s()./-]{6,}$/;

/**
 * Olcer yalnizca gorsel, ama sunucunun kuraliyla ayni dili konusur:
 * Password::min(8)->letters()->numbers(). Bu kurali gecmeyen bir sifreye
 * asla "iyi" demez, boylece kayit ekrani "guclu" deyip sunucu reddetmez.
 */
function passwordStrength(value: string) {
  if (!value) return { score: 0, hint: "Harf ve rakam karışık, en az 8 karakter.", ok: false };
  if (value.length < 8) return { score: 1, hint: "En az 8 karakter olmalı.", ok: false };
  if (!letterPattern.test(value)) return { score: 2, hint: "En az bir harf ekle.", ok: false };
  if (!/\d/.test(value)) return { score: 2, hint: "En az bir rakam ekle.", ok: false };

  const extra = value.length >= 12 || /[^a-zçğıöşü0-9\s]/i.test(value);
  return { score: extra ? 4 : 3, hint: extra ? "Güçlü 💪" : "İyi", ok: true };
}

/** Yazarken 05xx xxx xx xx bicimi. */
function maskPhone(value: string) {
  let digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits && !digits.startsWith("0")) digits = `0${digits}`.slice(0, 11);

  return [digits.slice(0, 4), digits.slice(4, 7), digits.slice(7, 9), digits.slice(9, 11)].filter(Boolean).join(" ");
}

/** API +90XXXXXXXXXX bekliyor; maske 0 ile basladigi icin bas hane atilir. */
function toApiPhone(value: string) {
  return `+90${value.replace(/\D/g, "").slice(1)}`;
}

/**
 * Kayit sonrasi nereye gidilecegi. ?devam= her zaman kazanir: sihirbaz
 * kaydettigi taslagi gondermek icin geri donmeyi bekliyor. Teklif veren
 * olmak isteyen kisi, hesabi acildiktan sonra basvuru sihirbazina gider.
 */
function destinationFor(user: User, requestedPath: string | null, sellerIntent: boolean) {
  if (requestedPath) return requestedPath;
  if (sellerIntent) return "/satici-ol";
  if (user.roles.includes("admin")) return "/admin";
  if (user.roles.includes("seller")) return "/satici-paneli";

  return "/musteri-panel";
}

export function AuthPanel({
  returnTo,
  forceVerification,
  initialRole,
}: {
  returnTo: string | null;
  forceVerification: boolean;
  /** ?kayit=veren | ?kayit=alici ile gelindiyse uyelik sekmesi bu rolle acilir. */
  initialRole: Role | null;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(() => (forceVerification ? "verify" : initialRole ? "register" : "login"));
  const [role, setRole] = useState<Role>(() => initialRole ?? "alici");
  const [picked, setPicked] = useState<string[]>(() => ["hizmet"]);
  const [user, setUser] = useState<User | null>(null);
  const [busy, setBusy] = useState(false);
  // Sunucuda false, istemcide hydration sonrasi true. Efekt icinde setState
  // gerektirmedigi icin cascading render olusturmaz.
  const hydrated = useSyncExternalStore(() => () => {}, () => true, () => false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [codes, setCodes] = useState({ email: "", phone: "" });
  const [previewCodes, setPreviewCodes] = useState<Partial<Record<"email" | "phone", string>>>({});
  // Kayit sirasinda "teklif vereceğim" secildiyse dogrulama bitince
  // panel yerine /satici-ol acilir.
  const [sellerIntent, setSellerIntent] = useState(false);

  const [loginId, setLoginId] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [terms, setTerms] = useState(false);
  // Ticari elektronik ileti izni AYRI bir onay ve varsayilan KAPALI.
  // 6563 sayili kanun ve Ticari Iletisim Yonetmeligi geregi bu onay
  // uyelik sozlesmesinin icine gomulemez, onceden isaretli gelemez ve
  // uyelik icin zorunlu tutulamaz -- kutu isaretlenmeden de kayit olur.
  const [ileti, setIleti] = useState(false);
  const [invalid, setInvalid] = useState<Record<string, string>>({});

  const strength = passwordStrength(password);

  useEffect(() => {
    if (!forceVerification) return;

    let active = true;

    apiRequest<{ data: User }>("/me")
      .then(({ data }) => {
        if (!active) return;
        setUser(data);
        if (data.verification.complete) router.replace(destinationFor(data, returnTo, false));
      })
      .catch((requestError: unknown) => {
        if (!active) return;
        if (requestError instanceof ApiError && requestError.status === 401) setMode("login");
      });

    return () => { active = false; };
  }, [forceVerification, returnTo, router]);

  const clearField = (field: string) => setInvalid((current) => {
    if (!current[field]) return current;
    const next = { ...current };
    delete next[field];

    return next;
  });

  const goTo = (next: Mode) => {
    setMode(next);
    setError("");
    setInvalid({});
  };

  const submitLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    // Sunucu /login icin yalnizca e-posta doğruluyor; telefonla giris
    // henuz yok, o yuzden kullanicilyi bosuna hataya dusurmuyoruz.
    const identifier = loginId.trim();
    const problems: Record<string, string> = {};
    if (!identifier) problems.loginId = "E-posta adresini yaz.";
    else if (!emailPattern.test(identifier)) {
      problems.loginId = phoneLikePattern.test(identifier)
        ? "Şimdilik yalnızca e-posta ile giriş yapılabiliyor. Üye olurken kullandığın e-posta adresini yaz."
        : "Geçerli bir e-posta yaz.";
    }
    if (!loginPassword) problems.loginPassword = "Şifreni yaz.";

    setInvalid(problems);
    if (Object.keys(problems).length > 0) return;

    setBusy(true);
    setError("");

    try {
      const response = await apiRequest<AuthResponse>("/login", {
        method: "POST",
        body: JSON.stringify({ email: identifier, password: loginPassword, remember }),
      });
      setUser(response.data);

      if (response.data.verification.complete) {
        router.push(destinationFor(response.data, returnTo, false));
      } else {
        setMode("verify");
        setNotice("Devam etmek için iletişim bilgilerini doğrula.");
      }
    } catch (requestError) {
      setError(firstApiError(requestError));
    } finally {
      setBusy(false);
    }
  };

  const submitRegister = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const problems: Record<string, string> = {};
    if (name.trim().length < 2) problems.name = "Bu alanı doldur.";
    if (!/^05\d{9}$/.test(phone.replace(/\D/g, ""))) problems.phone = "Geçerli bir cep telefonu yaz.";
    if (!emailPattern.test(email.trim())) problems.email = "Geçerli bir e-posta yaz.";
    if (!strength.ok) problems.password = "Şifre en az 8 karakter olmalı; harf ve rakam içermeli.";
    if (!terms) problems.terms = "Devam etmek için koşulları kabul et.";

    setInvalid(problems);
    if (Object.keys(problems).length > 0) return;

    const wantsSeller = role === "veren";
    setBusy(true);
    setError("");

    try {
      // API'de rol ya da dikey alani yok: herkes alici olarak acilir,
      // teklif veren olmak isteyen kisi kayittan sonra /satici-ol'a gider.
      const response = await apiRequest<AuthResponse>("/register", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          phone: toApiPhone(phone),
          password,
          password_confirmation: password,
          marketing_consent: ileti,
        }),
      });
      setUser(response.data);
      setPreviewCodes(response.verification_preview ?? {});
      setSellerIntent(wantsSeller);
      setMode("verify");
      setNotice(wantsSeller
        ? "Hesabın hazır. Doğrulamayı bitirince teklif veren başvurusuna geçeceksin."
        : "Hesabın hazır. Şimdi e-posta ve telefonunu doğrula.");
    } catch (requestError) {
      setError(firstApiError(requestError));
    } finally {
      setBusy(false);
    }
  };

  const verify = async (channel: "email" | "phone") => {
    setBusy(true);
    setError("");
    setNotice("");

    try {
      const response = await apiRequest<{ data: User; message: string }>("/verification/verify", {
        method: "POST",
        body: JSON.stringify({ channel, code: codes[channel] }),
      });
      setUser(response.data);
      setNotice(channel === "email" ? "E-posta adresin doğrulandı." : "Telefon numaran doğrulandı.");

      if (response.data.verification.complete) {
        window.setTimeout(() => router.push(destinationFor(response.data, returnTo, sellerIntent)), 450);
      }
    } catch (requestError) {
      setError(firstApiError(requestError));
    } finally {
      setBusy(false);
    }
  };

  const resend = async (channel: "email" | "phone") => {
    setBusy(true);
    setError("");

    try {
      const response = await apiRequest<{ message: string; verification_preview?: string }>("/verification/send", {
        method: "POST",
        body: JSON.stringify({ channel }),
      });
      if (response.verification_preview) {
        setPreviewCodes((current) => ({ ...current, [channel]: response.verification_preview }));
      }
      setNotice(response.message);
    } catch (requestError) {
      setError(firstApiError(requestError));
    } finally {
      setBusy(false);
    }
  };

  const copy = visualCopy(mode === "register" ? role : "login");

  const visual = <aside aria-label="alıcam.net nasıl işler" className={styles.visual}>
    <h2 className={styles.visualTitle}>{copy.title}</h2>
    <p className={styles.visualText}>{copy.text}</p>
    <div className={styles.stack}>
      {sampleRequests.map((item) => <div className={styles.req} key={item.title}>
        <span aria-hidden="true" className={styles.reqIco}>{item.icon}</span>
        <span><strong>{item.title}</strong><small>{item.meta}</small></span>
        <b className={styles.reqCount}>{item.count}</b>
      </div>)}
    </div>
    <div className={styles.benefits}>{benefits.map((item) => <span key={item}>{item}</span>)}</div>
  </aside>;

  if (mode === "verify") {
    return <>
      <section className={styles.formSide}>
        <div className={styles.card}>
          <h1 className={styles.title}>Son bir güvenlik adımı.</h1>
          <p className={styles.lead}>Talep yayınlamak için e-posta ve telefon doğrulaması zorunludur.</p>
          {notice && <p className={styles.notice} role="status">{notice}</p>}
          {error && <p className={styles.error} role="alert">{error}</p>}

          {(["email", "phone"] as const).map((channel) => {
            const complete = user?.verification[channel] ?? false;
            const label = channel === "email" ? "E-posta" : "Telefon";
            const destination = channel === "email" ? user?.email : user?.phone;

            return <div className={`${styles.verifyRow} ${complete ? styles.done : ""}`} key={channel}>
              <div className={styles.verifyTitle}>
                <span aria-hidden="true">{complete ? "✓" : channel === "email" ? "@" : "☎"}</span>
                <div><strong>{label} doğrulaması</strong><small>{destination ?? "Hesabına giriş yapmalısın"}</small></div>
              </div>
              {complete ? (
                <b className={styles.verified}>DOĞRULANDI</b>
              ) : user ? (
                <>
                  {previewCodes[channel] && <p className={styles.previewCode}>Yerel test kodu: <b>{previewCodes[channel]}</b></p>}
                  <div className={styles.verifyInput}>
                    <input
                      aria-label={`${label} doğrulama kodu`}
                      className={styles.input}
                      inputMode="numeric"
                      maxLength={6}
                      onChange={(event) => setCodes((current) => ({ ...current, [channel]: event.target.value.replace(/\D/g, "") }))}
                      placeholder="6 haneli kod"
                      value={codes[channel]}
                    />
                    <button
                      className={`${styles.btn} ${styles.blue}`}
                      disabled={busy || codes[channel].length !== 6}
                      onClick={() => verify(channel)}
                      type="button"
                    >Doğrula</button>
                  </div>
                  <button className={styles.resend} disabled={busy} onClick={() => resend(channel)} type="button">Kodu yeniden gönder</button>
                </>
              ) : null}
            </div>;
          })}

          {!user && <button
            className={`${styles.btn} ${styles.blue} ${styles.lg} ${styles.block} ${styles.verifyAction}`}
            onClick={() => goTo("login")}
            type="button"
          >Giriş yap</button>}
          {user?.verification.complete && <button
            className={`${styles.btn} ${styles.blue} ${styles.lg} ${styles.block} ${styles.verifyAction}`}
            onClick={() => router.push(destinationFor(user, returnTo, sellerIntent))}
            type="button"
          >Devam et →</button>}
        </div>
      </section>
      {visual}
    </>;
  }

  return <>
    <section className={styles.formSide}>
      <div className={styles.card}>
        <div aria-label="Hesap" className={styles.tabs} role="tablist">
          <button
            aria-selected={mode === "login"}
            className={`${styles.tab} ${mode === "login" ? styles.on : ""}`}
            id="tab-login"
            onClick={() => goTo("login")}
            role="tab"
            type="button"
          >Giriş yap</button>
          <button
            aria-selected={mode === "register"}
            className={`${styles.tab} ${mode === "register" ? styles.on : ""}`}
            id="tab-signup"
            onClick={() => goTo("register")}
            role="tab"
            type="button"
          >Ücretsiz üye ol</button>
        </div>

        {mode === "login" ? (
          <div aria-labelledby="tab-login" id="panel-login" role="tabpanel">
            <h1 className={styles.title}>Tekrar hoş geldin 👋</h1>
            <p className={styles.lead}>Taleplerini ve gelen teklifleri kaldığın yerden takip et.</p>
            {error && <p className={styles.error} role="alert">{error}</p>}

            <form className={styles.form} noValidate onSubmit={submitLogin}>
              <label className={`${styles.field} ${invalid.loginId ? styles.invalid : ""}`}>
                <span className={styles.label}>E-posta adresi</span>
                <input
                  autoComplete="username"
                  className={styles.input}
                  name="email"
                  onChange={(event) => { setLoginId(event.target.value); clearField("loginId"); }}
                  placeholder="ornek@eposta.com"
                  type="email"
                  value={loginId}
                />
                <span className={styles.err}>{invalid.loginId}</span>
              </label>

              <label className={`${styles.field} ${invalid.loginPassword ? styles.invalid : ""}`}>
                <span className={styles.label}>Şifre</span>
                <div className={styles.inputGroup}>
                  <input
                    autoComplete="current-password"
                    className={styles.input}
                    name="password"
                    onChange={(event) => { setLoginPassword(event.target.value); clearField("loginPassword"); }}
                    placeholder="Şifren"
                    type={showLoginPassword ? "text" : "password"}
                    value={loginPassword}
                  />
                  <button
                    aria-label={showLoginPassword ? "Şifreyi gizle" : "Şifreyi göster"}
                    className={styles.suffix}
                    onClick={() => setShowLoginPassword((shown) => !shown)}
                    type="button"
                  >{showLoginPassword ? "Gizle" : "Göster"}</button>
                </div>
                <span className={styles.err}>{invalid.loginPassword}</span>
              </label>

              <div className={styles.row}>
                <label className={styles.check}>
                  <input checked={remember} name="remember" onChange={(event) => setRemember(event.target.checked)} type="checkbox" />
                  <span>Beni hatırla</span>
                </label>
                <a className={styles.rowLink} href="mailto:destek@alicam.net?subject=%C5%9Eifre%20s%C4%B1f%C4%B1rlama">Şifremi unuttum</a>
              </div>

              <button className={`${styles.btn} ${styles.blue} ${styles.lg} ${styles.block}`} disabled={busy || !hydrated} type="submit">
                {busy ? "Giriş yapılıyor…" : "Giriş yap"}
              </button>

              <div className={styles.divider}>veya</div>
              {/* SMS ve Google girisinin sunucu tarafi yok. Sahte akis kurmak
                  yerine dugmeler kapali duruyor, not nedenini soyluyor. */}
              <div className={styles.social}>
                <button className={`${styles.btn} ${styles.line}`} disabled type="button">📱 SMS kodu ile</button>
                <button className={`${styles.btn} ${styles.line}`} disabled type="button">
                  <b className={styles.googleMark}>G</b> Google ile
                </button>
              </div>
              <p className={styles.socialNote}>SMS ve Google ile giriş yakında açılacak.</p>

              <p className={styles.note}>
                Hesabın yok mu? <button className={styles.noteLink} onClick={() => goTo("register")} type="button">Ücretsiz üye ol</button>
              </p>
            </form>
          </div>
        ) : (
          <div aria-labelledby="tab-signup" id="panel-signup" role="tabpanel">
            <h1 className={styles.title}>Ücretsiz hesap oluştur</h1>
            <p className={styles.lead}>Bir dakikada üye ol. Sonra istediğin zaman diğer rolü de ekleyebilirsin.</p>
            {error && <p className={styles.error} role="alert">{error}</p>}

            <form className={styles.form} noValidate onSubmit={submitRegister}>
              <div className={styles.field}>
                <span className={styles.label}>Ne yapmak istiyorsun?</span>
                <div className={styles.rolePick}>
                  {([
                    { value: "alici" as const, icon: "🙋", title: "Talep oluşturacağım", note: "Hizmet, ev, araç, ürün için teklif almak istiyorum." },
                    { value: "veren" as const, icon: "💼", title: "Teklif vereceğim", note: "Usta, emlakçı, galeri, mağaza ya da satıcıyım." },
                  ]).map((option) => <label className={`${styles.role} ${role === option.value ? styles.on : ""}`} key={option.value}>
                    <input checked={role === option.value} name="rol" onChange={() => setRole(option.value)} type="radio" value={option.value} />
                    <i>{option.icon}</i>
                    <strong>{option.title}</strong>
                    <small>{option.note}</small>
                  </label>)}
                </div>
              </div>

              {role === "veren" && <div className={styles.field}>
                <span className={styles.label}>Neyle ilgileniyorsun?</span>
                <div className={styles.chips}>
                  {verticals.map((vertical) => {
                    const on = picked.includes(vertical.value);

                    return <label className={`${styles.chip} ${on ? styles.on : ""}`} key={vertical.value}>
                      <input
                        checked={on}
                        onChange={() => setPicked((current) => on
                          ? current.filter((value) => value !== vertical.value)
                          : [...current, vertical.value])}
                        type="checkbox"
                        value={vertical.value}
                      />
                      {vertical.icon} {vertical.label}
                    </label>;
                  })}
                </div>
                <small className={styles.hint}>Başvuru adımında kategorilerini ayrıntılı seçeceksin.</small>
              </div>}

              <label className={`${styles.field} ${invalid.name ? styles.invalid : ""}`}>
                <span className={styles.label}>{role === "veren" ? "Ad soyad veya firma adı" : "Ad soyad"}</span>
                <input
                  autoComplete="name"
                  className={styles.input}
                  name="name"
                  onChange={(event) => { setName(event.target.value); clearField("name"); }}
                  placeholder="Adın ve soyadın"
                  value={name}
                />
                <span className={styles.err}>{invalid.name}</span>
              </label>

              <label className={`${styles.field} ${invalid.phone ? styles.invalid : ""}`}>
                <span className={styles.label}>Cep telefonu</span>
                <input
                  autoComplete="tel"
                  className={styles.input}
                  inputMode="tel"
                  name="phone"
                  onChange={(event) => { setPhone(maskPhone(event.target.value)); clearField("phone"); }}
                  placeholder="05xx xxx xx xx"
                  type="tel"
                  value={phone}
                />
                <span className={styles.err}>{invalid.phone}</span>
              </label>

              <label className={`${styles.field} ${invalid.email ? styles.invalid : ""}`}>
                <span className={styles.label}>E-posta</span>
                <input
                  autoComplete="email"
                  className={styles.input}
                  name="email"
                  onChange={(event) => { setEmail(event.target.value); clearField("email"); }}
                  placeholder="ornek@eposta.com"
                  type="email"
                  value={email}
                />
                <span className={styles.err}>{invalid.email}</span>
              </label>

              <label className={`${styles.field} ${invalid.password ? styles.invalid : ""}`}>
                <span className={styles.label}>Şifre</span>
                <div className={styles.inputGroup}>
                  <input
                    autoComplete="new-password"
                    className={styles.input}
                    name="password"
                    onChange={(event) => { setPassword(event.target.value); clearField("password"); }}
                    placeholder="En az 8 karakter"
                    type={showPassword ? "text" : "password"}
                    value={password}
                  />
                  <button
                    aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
                    className={styles.suffix}
                    onClick={() => setShowPassword((shown) => !shown)}
                    type="button"
                  >{showPassword ? "Gizle" : "Göster"}</button>
                </div>
                <div aria-hidden="true" className={styles.pwMeter}>
                  {[1, 2, 3, 4].map((step) => <i
                    className={`${styles.bar} ${step <= strength.score ? `${styles.on} ${styles[`s${strength.score}`]}` : ""}`}
                    key={step}
                  />)}
                </div>
                <small className={styles.hint}>{strength.hint}</small>
                <span className={styles.err}>{invalid.password}</span>
              </label>

              {/* Zorunlu onay: sozlesme ve gizlilik. */}
              <label className={`${styles.field} ${invalid.terms ? styles.invalid : ""}`}>
                <span className={styles.check}>
                  <input checked={terms} onChange={(event) => { setTerms(event.target.checked); clearField("terms"); }} type="checkbox" />
                  <span>
                    <Link href="/kullanim-kosullari" target="_blank">Kullanım koşullarını</Link> ve <Link href="/gizlilik" target="_blank">gizlilik politikasını</Link> okudum, kabul ediyorum.
                  </span>
                </span>
                <span className={styles.err}>{invalid.terms}</span>
              </label>

              {/*
                Aydinlatma BILGILENDIRMEDIR, onay degil: KVKK m. 10 veri
                sorumlusuna bildirme yukumlulugu getiriyor, kullanicidan
                bunun icin kutu isaretlemesi istenmez. Bu yuzden metne
                baglanti var ama onay kutusu YOK.
              */}
              <p className={styles.consentNote}>
                Kişisel verilerinin nasıl işlendiğini <Link href="/kvkk" target="_blank">KVKK aydınlatma metninde</Link> bulabilirsin.
              </p>

              {/* Istege bagli onay: isaretlenmese de kayit tamamlanir. */}
              <label className={styles.field}>
                <span className={styles.check}>
                  <input checked={ileti} onChange={(event) => setIleti(event.target.checked)} type="checkbox" />
                  <span>
                    Kampanya ve duyurulardan e-posta ile haberdar olmak istiyorum. <b className={styles.consentOptional}>İsteğe bağlı</b>
                  </span>
                </span>
              </label>

              <button className={`${styles.btn} ${styles.cta} ${styles.lg} ${styles.block}`} disabled={busy || !hydrated} type="submit">
                {busy ? "Hesap oluşturuluyor…" : role === "veren" ? "Teklif veren olarak katıl" : "Ücretsiz üye ol"}
              </button>

              <p className={styles.note}>
                Zaten üye misin? <button className={styles.noteLink} onClick={() => goTo("login")} type="button">Giriş yap</button>
              </p>
            </form>
          </div>
        )}
      </div>
    </section>
    {visual}
  </>;
}
