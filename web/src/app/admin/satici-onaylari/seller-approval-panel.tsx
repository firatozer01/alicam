"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, apiRequest, firstApiError } from "@/lib/api";

type Status = "pending" | "approved" | "rejected";

type AdminUser = {
  id: number;
  name: string;
  email: string;
  roles: string[];
};

type SellerApplication = {
  user: {
    id: number;
    name: string;
    email: string;
    phone: string;
    verification: { email: boolean; phone: boolean; complete: boolean };
  };
  profile: {
    profile_type: "individual" | "company";
    company_name: string | null;
    tax_no: string | null;
    description: string;
    approval_status: Status | "suspended" | "draft";
    rejection_reason: string | null;
    submitted_at: string | null;
    reviewed_at: string | null;
  } | null;
  categories: { id: number; name: string; icon: string; color: string }[];
  locations: { city_id: number; city_name: string; district_id: number; district_name: string }[];
};

type ApprovalListResponse = {
  data: SellerApplication[];
  meta: { current_page: number; last_page: number; total: number; status: Status };
};

const statusTabs: { value: Status; label: string }[] = [
  { value: "pending", label: "Bekleyenler" },
  { value: "approved", label: "Onaylananlar" },
  { value: "rejected", label: "Reddedilenler" },
];

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function groupLocations(locations: SellerApplication["locations"]) {
  const groups = new Map<string, string[]>();
  locations.forEach((location) => {
    groups.set(location.city_name, [...(groups.get(location.city_name) ?? []), location.district_name]);
  });
  return [...groups.entries()];
}

export function SellerApprovalPanel() {
  const router = useRouter();
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [applications, setApplications] = useState<SellerApplication[]>([]);
  const [status, setStatus] = useState<Status>("pending");
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [busySellerId, setBusySellerId] = useState<number | null>(null);
  const [rejectingSellerId, setRejectingSellerId] = useState<number | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    apiRequest<{ data: AdminUser }>("/me")
      .then(({ data }) => {
        if (!active) return;
        if (!data.roles.includes("admin")) {
          setAccessDenied(true);
          setLoading(false);
          return;
        }
        setAdmin(data);
      })
      .catch((requestError: unknown) => {
        if (requestError instanceof ApiError && requestError.status === 401) {
          router.replace("/giris?devam=%2Fadmin%2Fsatici-onaylari");
          return;
        }
        if (active) {
          setError("Yönetici oturumu doğrulanamadı.");
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    if (!admin) return;
    let active = true;

    apiRequest<ApprovalListResponse>(`/admin/seller-approvals?status=${status}`)
      .then((response) => {
        if (!active) return;
        setApplications(response.data);
        setTotal(response.meta.total);
      })
      .catch((requestError: unknown) => {
        if (active) setError(firstApiError(requestError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [admin, status]);

  const decide = async (sellerId: number, decision: "approved" | "rejected") => {
    if (decision === "rejected" && rejectionReason.trim().length < 5) {
      setError("Red gerekçesi en az 5 karakter olmalıdır.");
      return;
    }

    setBusySellerId(sellerId);
    setError("");
    setNotice("");

    try {
      const response = await apiRequest<{ message: string }>(`/admin/seller-approvals/${sellerId}`, {
        method: "PATCH",
        body: JSON.stringify({
          decision,
          reason: decision === "rejected" ? rejectionReason.trim() : null,
        }),
      });
      setApplications((current) => current.filter((application) => application.user.id !== sellerId));
      setTotal((current) => Math.max(0, current - 1));
      setRejectingSellerId(null);
      setRejectionReason("");
      setNotice(response.message);
    } catch (requestError: unknown) {
      setError(firstApiError(requestError));
    } finally {
      setBusySellerId(null);
    }
  };

  if (accessDenied) {
    return (
      <main className="admin-page admin-access-page">
        <section className="admin-access-card">
          <span>403</span><h1>Bu alan yöneticilere özel.</h1>
          <p>Satıcı başvurularını incelemek için admin rolüne sahip bir hesapla giriş yapmalısın.</p>
          <Link className="button button-primary" href="/">Ana sayfaya dön</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="admin-page">
      <aside className="admin-sidebar">
        <Link className="brand admin-brand" href="/">alıcam<span>.net</span></Link>
        <div className="admin-product"><span>YÖNETİM MERKEZİ</span><strong>Operasyon</strong></div>
        <nav>
          <Link href="/admin"><i>◇</i> Genel bakış</Link>
          <Link className="active" href="/admin/satici-onaylari"><i>✓</i> Satıcı onayları <b>{status === "pending" ? total : ""}</b></Link>
        </nav>
        <div className="admin-account"><span>{admin?.name.slice(0, 2).toLocaleUpperCase("tr-TR") ?? "AD"}</span><p><strong>{admin?.name ?? "Yönetici"}</strong><small>{admin?.email ?? "Oturum doğrulanıyor"}</small></p></div>
      </aside>

      <section className="admin-content">
        <header className="admin-header">
          <div><span className="admin-kicker">PAZARYERİ OPERASYONU</span><h1>Satıcı başvuruları</h1><p>Hizmet veren profillerini, uzmanlıklarını ve çalışma bölgelerini incele.</p></div>
          <Link className="admin-home-button" href="/">Siteyi görüntüle ↗</Link>
        </header>

        <div className="admin-toolbar">
          <div className="admin-tabs">
            {statusTabs.map((tab) => (
              <button className={status === tab.value ? "active" : ""} type="button" onClick={() => { setLoading(true); setError(""); setStatus(tab.value); setNotice(""); }} key={tab.value}>{tab.label}</button>
            ))}
          </div>
          <span><strong>{total}</strong> başvuru</span>
        </div>

        {notice && <p className="admin-notice">✓ {notice}</p>}
        {error && <p className="admin-error">{error}</p>}

        {loading ? (
          <div className="admin-empty"><i className="admin-spinner" /><h2>Başvurular yükleniyor…</h2></div>
        ) : applications.length === 0 ? (
          <div className="admin-empty"><span>✓</span><h2>Bu listede başvuru yok.</h2><p>Yeni başvurular geldiğinde burada görünecek.</p></div>
        ) : (
          <div className="admin-application-list">
            {applications.map((application) => {
              const profile = application.profile;
              const locationGroups = groupLocations(application.locations);
              const isRejecting = rejectingSellerId === application.user.id;
              const isBusy = busySellerId === application.user.id;

              return (
                <article className="admin-application" key={application.user.id}>
                  <div className="admin-application-head">
                    <div className="admin-avatar">{application.user.name.slice(0, 2).toLocaleUpperCase("tr-TR")}</div>
                    <div><span>{profile?.profile_type === "company" ? "FİRMA" : "BİREYSEL UZMAN"}</span><h2>{profile?.company_name || application.user.name}</h2><small>Başvuru: {formatDate(profile?.submitted_at)}</small></div>
                    <span className={`admin-status status-${profile?.approval_status}`}>{profile?.approval_status === "pending" ? "İnceleme bekliyor" : profile?.approval_status === "approved" ? "Onaylandı" : "Reddedildi"}</span>
                  </div>

                  <div className="admin-application-body">
                    <div className="admin-main-info">
                      <section><span>PROFİL AÇIKLAMASI</span><p>{profile?.description}</p></section>
                      <section><span>HİZMET KATEGORİLERİ</span><div className="admin-category-tags">{application.categories.map((category) => <b key={category.id}><i style={{ background: category.color }}>{category.icon}</i>{category.name}</b>)}</div></section>
                      <section><span>HİZMET BÖLGELERİ · {application.locations.length} İLÇE</span><div className="admin-location-list">{locationGroups.map(([city, districts]) => <p key={city}><strong>{city}</strong><small>{districts.join(", ")}</small></p>)}</div></section>
                    </div>
                    <aside className="admin-contact-card">
                      <span>HESAP BİLGİLERİ</span>
                      <p><small>Yetkili</small><strong>{application.user.name}</strong></p>
                      <p><small>E-posta</small><strong>{application.user.email}</strong></p>
                      <p><small>Telefon</small><strong>{application.user.phone}</strong></p>
                      <div className={application.user.verification.complete ? "verified" : "unverified"}>{application.user.verification.complete ? "✓ İletişim doğrulandı" : "! Eksik doğrulama"}</div>
                      {profile?.profile_type === "company" && <p><small>Vergi / T.C. no</small><strong>{profile.tax_no}</strong></p>}
                    </aside>
                  </div>

                  {profile?.rejection_reason && <div className="admin-old-reason"><span>RED GEREKÇESİ</span><p>{profile.rejection_reason}</p></div>}

                  {status === "pending" && (
                    <div className="admin-decision-bar">
                      {isRejecting ? (
                        <div className="admin-reject-form">
                          <label>Red gerekçesi<textarea rows={3} value={rejectionReason} maxLength={500} onChange={(event) => { setRejectionReason(event.target.value); setError(""); }} placeholder="Başvurunun neden güncellenmesi gerektiğini açıkça belirt…" /></label>
                          <div><button type="button" onClick={() => { setRejectingSellerId(null); setRejectionReason(""); }}>Vazgeç</button><button className="reject" type="button" disabled={isBusy} onClick={() => decide(application.user.id, "rejected")}>{isBusy ? "Kaydediliyor…" : "Reddi kaydet"}</button></div>
                        </div>
                      ) : (
                        <><span>Karar, denetim kaydına işlenecektir.</span><div><button className="reject-ghost" type="button" onClick={() => { setRejectingSellerId(application.user.id); setRejectionReason(""); setError(""); }}>Düzeltme iste</button><button className="approve" type="button" disabled={isBusy} onClick={() => decide(application.user.id, "approved")}>{isBusy ? "İşleniyor…" : "Başvuruyu onayla"} <b>✓</b></button></div></>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
