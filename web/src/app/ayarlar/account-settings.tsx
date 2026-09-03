"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SiteHeader } from "@/components/shell/site-header";
import { ApiError, apiRequest, firstApiError } from "@/lib/api";
import styles from "./settings.module.css";

type User = {
  id: number; name: string; email: string; phone: string; roles: string[];
  verification: { email: boolean; phone: boolean; complete: boolean };
};
type SellerProfile = {
  profile: { profile_type: string; company_name: string | null; approval_status: string } | null;
  categories: { id: number; name: string; icon: string; color: string }[];
  locations: { district_id: number; district_name: string; city_name: string }[];
};

const approvalLabel: Record<string, string> = {
  approved: "Onaylandı",
  pending: "İnceleniyor",
  rejected: "Reddedildi",
  draft: "Tamamlanmadı",
};

export function AccountSettings() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [seller, setSeller] = useState<SellerProfile | null>(null);
  const [tab, setTab] = useState<"hesap" | "guvenlik" | "alanlar">("hesap");
  const [form, setForm] = useState({ name: "", phone: "" });
  const [passwords, setPasswords] = useState({ current_password: "", password: "", password_confirmation: "" });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    apiRequest<{ data: User }>("/me")
      .then((response) => {
        if (!active) return;
        setUser(response.data);
        setForm({ name: response.data.name, phone: response.data.phone });
        if (response.data.roles.includes("seller")) {
          apiRequest<{ data: SellerProfile }>("/seller/profile")
            .then((profile) => { if (active) setSeller(profile.data); })
            .catch(() => undefined);
        }
      })
      .catch((requestError: unknown) => {
        if (!active) return;
        if (requestError instanceof ApiError && requestError.status === 401) return router.replace("/giris?devam=%2Fayarlar");
        setError(firstApiError(requestError));
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [router]);

  const saveProfile = async () => {
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await apiRequest<{ message: string; data: User }>("/me", { method: "PUT", body: JSON.stringify(form) });
      setUser(response.data); setNotice(response.message);
    } catch (requestError: unknown) { setError(firstApiError(requestError)); }
    finally { setBusy(false); }
  };

  const savePassword = async () => {
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await apiRequest<{ message: string }>("/me/password", { method: "PUT", body: JSON.stringify(passwords) });
      setNotice(response.message);
      setPasswords({ current_password: "", password: "", password_confirmation: "" });
    } catch (requestError: unknown) { setError(firstApiError(requestError)); }
    finally { setBusy(false); }
  };

  // Yukleme ve hata durumlarinda da ortak ust cubuk korunur.
  if (loading) return <main className={styles.page}><SiteHeader /><div className={styles.state}><i /><p>Ayarlar yükleniyor…</p></div></main>;
  if (!user) return <main className={styles.page}><SiteHeader user={null} sessionReady /><div className={styles.state}><p>{error || "Hesap bulunamadı."}</p><Link href="/giris">Giriş yap →</Link></div></main>;

  const initials = user.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toLocaleUpperCase("tr-TR");
  const isSeller = user.roles.includes("seller");

  return <main className={styles.page}>
    <SiteHeader
      cta={isSeller ? { label: "Satıcı paneli", href: "/satici-paneli" } : { label: "Müşteri paneli", href: "/musteri-panel" }}
      sessionReady
      user={user}
    />

    <div className={styles.wrap}>
      <header className={styles.head}>
        <span className={styles.avatar}>{initials || "A"}</span>
        <div>
          <h1>{user.name}</h1>
          <p>{user.email} · {user.phone}</p>
          <div className={styles.roleChips}>
            <span className={styles.roleBuyer}>◇ Müşteri</span>
            {isSeller && <span className={styles.roleSeller}>⌂ Hizmet veren</span>}
            {user.roles.includes("admin") && <span className={styles.roleAdmin}>▦ Yönetici</span>}
          </div>
        </div>
        <div className={styles.verifyBox}>
          <p className={user.verification.email ? styles.ok : styles.pending}>{user.verification.email ? "✓" : "!"} E-posta {user.verification.email ? "doğrulandı" : "bekliyor"}</p>
          <p className={user.verification.phone ? styles.ok : styles.pending}>{user.verification.phone ? "✓" : "!"} Telefon {user.verification.phone ? "doğrulandı" : "bekliyor"}</p>
          {!user.verification.complete && <Link href="/giris?dogrulama=1">Doğrulamayı tamamla →</Link>}
        </div>
      </header>

      <div className={styles.tabs}>
        {([["hesap", "Hesap bilgileri"], ["guvenlik", "Güvenlik"], ["alanlar", "Çalışma alanları"]] as const).map(([key, label]) =>
          <button className={tab === key ? styles.tabOn : ""} key={key} onClick={() => { setTab(key); setNotice(""); setError(""); }} type="button">{label}</button>)}
      </div>

      {notice && <p className={styles.notice}>✓ {notice}</p>}
      {error && <p className={styles.error}>{error}</p>}

      {tab === "hesap" && <section className={styles.card}>
        <header><h2>Hesap bilgileri</h2><p>Adın ve telefon numaran teklif kabul edildiğinde karşı tarafa gösterilir.</p></header>
        <div className={styles.form}>
          <label>Ad soyad<input onChange={(event) => setForm({ ...form, name: event.target.value })} value={form.name} /></label>
          <label>Telefon<input onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="+90 555 111 22 33" value={form.phone} /><small>Numaranı değiştirirsen yeniden doğrulaman gerekir.</small></label>
          <label className={styles.readonly}>E-posta<input disabled value={user.email} /><small>E-posta değişikliği için destek ile iletişime geç.</small></label>
        </div>
        <footer><button disabled={busy || !form.name.trim() || !form.phone.trim()} onClick={saveProfile} type="button">{busy ? "Kaydediliyor…" : "Bilgileri kaydet"}</button></footer>
      </section>}

      {tab === "guvenlik" && <section className={styles.card}>
        <header><h2>Parola değiştir</h2><p>En az 8 karakter, harf ve rakam içermeli.</p></header>
        <div className={styles.form}>
          <label className={styles.wide}>Mevcut parolan<input autoComplete="current-password" onChange={(event) => setPasswords({ ...passwords, current_password: event.target.value })} type="password" value={passwords.current_password} /></label>
          <label>Yeni parola<input autoComplete="new-password" onChange={(event) => setPasswords({ ...passwords, password: event.target.value })} type="password" value={passwords.password} /></label>
          <label>Yeni parola tekrar<input autoComplete="new-password" onChange={(event) => setPasswords({ ...passwords, password_confirmation: event.target.value })} type="password" value={passwords.password_confirmation} /></label>
        </div>
        <footer><button disabled={busy || !passwords.current_password || passwords.password.length < 8} onClick={savePassword} type="button">{busy ? "Güncelleniyor…" : "Parolayı güncelle"}</button></footer>
      </section>}

      {tab === "alanlar" && <div className={styles.spaces}>
        <section className={styles.card}>
          <header><h2>Müşteri alanı</h2><p>Talep oluştur, gelen teklifleri karşılaştır.</p></header>
          <div className={styles.spaceBody}>
            <span className={styles.spaceIcon}>◇</span>
            <p>Her hesap müşteri alanını kullanabilir. Talep yayınlamak ücretsizdir.</p>
            <div className={styles.spaceActions}><Link href="/musteri-panel">Müşteri paneli →</Link><Link className={styles.ghost} href="/talep-olustur">Yeni talep</Link></div>
          </div>
        </section>

        <section className={styles.card}>
          <header><h2>Hizmet veren alanı</h2><p>Talepleri gör, teklif ver, vitrinini yönet.</p></header>
          <div className={styles.spaceBody}>
            <span className={styles.spaceIcon}>⌂</span>
            {isSeller ? <>
              <p>
                {seller?.profile?.company_name || "Firma"} ·{" "}
                <b className={seller?.profile?.approval_status === "approved" ? styles.ok : styles.pending}>
                  {approvalLabel[seller?.profile?.approval_status ?? "draft"] ?? "Bilinmiyor"}
                </b>
              </p>
              {seller && seller.categories.length > 0 && <div className={styles.miniChips}>{seller.categories.map((item) => <span key={item.id} style={{ background: `${item.color}18`, color: item.color }}>{item.icon} {item.name}</span>)}</div>}
              {seller && seller.locations.length > 0 && <p className={styles.muted}>📍 {seller.locations.slice(0, 5).map((item) => item.district_name).join(", ")}{seller.locations.length > 5 && ` +${seller.locations.length - 5}`}</p>}
              <div className={styles.spaceActions}><Link href="/satici-paneli">Satıcı paneli →</Link><Link className={styles.ghost} href={`/satici/${user.id}`}>Vitrinimi gör ↗</Link></div>
            </> : <>
              <p>Henüz hizmet veren değilsin. Firma bilgilerini ekleyerek talep almaya başlayabilirsin.</p>
              <div className={styles.spaceActions}><Link href="/satici-ol">Hizmet vermeye başla →</Link></div>
            </>}
          </div>
        </section>
      </div>}
    </div>
  </main>;
}
