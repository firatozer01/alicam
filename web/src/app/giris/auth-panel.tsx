"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, apiRequest, firstApiError } from "@/lib/api";

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

function destinationFor(user: User, requestedPath: string | null) {
  if (requestedPath) return requestedPath;
  if (user.roles.includes("admin")) return "/admin";
  if (user.roles.includes("seller")) return "/satici-paneli";
  return "/musteri-panel";
}

export function AuthPanel({ returnTo, forceVerification }: { returnTo: string | null; forceVerification: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(forceVerification ? "verify" : "login");
  const [user, setUser] = useState<User | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [codes, setCodes] = useState({ email: "", phone: "" });
  const [previewCodes, setPreviewCodes] = useState<Partial<Record<"email" | "phone", string>>>({});

  useEffect(() => {
    if (!forceVerification) return;

    apiRequest<{ data: User }>("/me")
      .then(({ data }) => {
        setUser(data);
        if (data.verification.complete) router.replace(destinationFor(data, returnTo));
      })
      .catch((requestError) => {
        if (requestError instanceof ApiError && requestError.status === 401) setMode("login");
      });
  }, [forceVerification, returnTo, router]);

  const submitLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError("");

    try {
      const response = await apiRequest<AuthResponse>("/login", {
        method: "POST",
        body: JSON.stringify({
          email: data.get("email"),
          password: data.get("password"),
          remember: data.get("remember") === "on",
        }),
      });
      setUser(response.data);

      if (response.data.verification.complete) {
        router.push(destinationFor(response.data, returnTo));
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
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError("");

    try {
      const response = await apiRequest<AuthResponse>("/register", {
        method: "POST",
        body: JSON.stringify(Object.fromEntries(data)),
      });
      setUser(response.data);
      setPreviewCodes(response.verification_preview ?? {});
      setMode("verify");
      setNotice("Hesabın hazır. Şimdi e-posta ve telefonunu doğrula.");
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
        window.setTimeout(() => router.push(destinationFor(response.data, returnTo)), 450);
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

  if (mode === "verify") {
    return (
      <div className="auth-card auth-verify-card">
        <span className="auth-card-kicker">HESABINI DOĞRULA</span>
        <h2>Son bir güvenlik adımı.</h2>
        <p className="auth-card-copy">Talep yayınlamak için e-posta ve telefon doğrulaması zorunludur.</p>
        {notice && <p className="form-notice" role="status">{notice}</p>}
        {error && <p className="form-error" role="alert">{error}</p>}

        {(["email", "phone"] as const).map((channel) => {
          const complete = user?.verification[channel] ?? false;
          const label = channel === "email" ? "E-posta" : "Telefon";
          const destination = channel === "email" ? user?.email : user?.phone;

          return (
            <div className={`verification-row ${complete ? "complete" : ""}`} key={channel}>
              <div className="verification-title">
                <span>{complete ? "✓" : channel === "email" ? "@" : "⌕"}</span>
                <div><strong>{label} doğrulaması</strong><small>{destination ?? "Hesabına giriş yapmalısın"}</small></div>
              </div>
              {complete ? (
                <b className="verified-label">DOĞRULANDI</b>
              ) : user ? (
                <>
                  {previewCodes[channel] && <p className="preview-code">Yerel test kodu: <b>{previewCodes[channel]}</b></p>}
                  <div className="verification-input">
                    <input
                      aria-label={`${label} doğrulama kodu`}
                      inputMode="numeric"
                      maxLength={6}
                      onChange={(event) => setCodes((current) => ({ ...current, [channel]: event.target.value.replace(/\D/g, "") }))}
                      placeholder="6 haneli kod"
                      value={codes[channel]}
                    />
                    <button disabled={busy || codes[channel].length !== 6} onClick={() => verify(channel)} type="button">Doğrula</button>
                  </div>
                  <button className="resend-button" disabled={busy} onClick={() => resend(channel)} type="button">Kodu yeniden gönder</button>
                </>
              ) : null}
            </div>
          );
        })}

        {!user && <button className="button button-primary auth-submit" onClick={() => setMode("login")} type="button">Giriş yap</button>}
        {user?.verification.complete && <button className="button button-primary auth-submit" onClick={() => router.push(destinationFor(user, returnTo))} type="button">Devam et →</button>}
      </div>
    );
  }

  return (
    <div className="auth-card">
      <div className="auth-tabs" role="tablist">
        <button aria-selected={mode === "login"} className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setError(""); }} role="tab" type="button">Giriş yap</button>
        <button aria-selected={mode === "register"} className={mode === "register" ? "active" : ""} onClick={() => { setMode("register"); setError(""); }} role="tab" type="button">Ücretsiz üye ol</button>
      </div>

      <span className="auth-card-kicker">{mode === "login" ? "TEKRAR HOŞ GELDİN" : "HEMEN BAŞLA"}</span>
      <h2>{mode === "login" ? "Hesabına giriş yap." : "Ücretsiz hesabını oluştur."}</h2>
      <p className="auth-card-copy">{mode === "login" ? "Taleplerini ve tekliflerini kaldığın yerden yönet." : "Birkaç dakika içinde talebini yayınlamaya hazır ol."}</p>
      {error && <p className="form-error" role="alert">{error}</p>}

      {mode === "login" ? (
        <form className="auth-form" onSubmit={submitLogin}>
          <label>E-posta adresi<input autoComplete="email" name="email" placeholder="ornek@eposta.com" required type="email" /></label>
          <label>Şifre<input autoComplete="current-password" minLength={8} name="password" placeholder="Şifren" required type="password" /></label>
          <label className="remember-field"><input name="remember" type="checkbox" /><span>Beni hatırla</span><a href="mailto:destek@alicam.net?subject=%C5%9Eifre%20s%C4%B1f%C4%B1rlama%20talebi">Şifremi unuttum</a></label>
          <button className="button button-primary auth-submit" disabled={busy} type="submit">{busy ? "Giriş yapılıyor…" : "Giriş yap →"}</button>
        </form>
      ) : (
        <form className="auth-form" onSubmit={submitRegister}>
          <label>Ad soyad<input autoComplete="name" minLength={2} name="name" placeholder="Adın ve soyadın" required /></label>
          <label>E-posta adresi<input autoComplete="email" name="email" placeholder="ornek@eposta.com" required type="email" /></label>
          <label>Telefon<input autoComplete="tel" name="phone" placeholder="+90 555 111 22 33" required type="tel" /><small>+90 ile başlayan cep telefonu numarası</small></label>
          <div className="auth-form-grid">
            <label>Şifre<input autoComplete="new-password" minLength={8} name="password" placeholder="En az 8 karakter" required type="password" /></label>
            <label>Şifre tekrarı<input autoComplete="new-password" minLength={8} name="password_confirmation" placeholder="Şifreni tekrar yaz" required type="password" /></label>
          </div>
          <label className="terms-field"><input required type="checkbox" /><span><a href="/kullanim-kosullari" target="_blank">Kullanım koşullarını</a> ve <a href="/gizlilik" target="_blank">gizlilik politikasını</a> kabul ediyorum.</span></label>
          <button className="button button-primary auth-submit" disabled={busy} type="submit">{busy ? "Hesap oluşturuluyor…" : "Ücretsiz hesap oluştur →"}</button>
        </form>
      )}
    </div>
  );
}
