"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, apiRequest, firstApiError } from "@/lib/api";

type User = { id: number; name: string; email: string };
type BuyerRequest = {
  id: number; reference: string; title: string; description: string; status: string; offer_count: number;
  budget: { min: string; max: string }; category: { name: string; icon: string; color: string };
  location: { city: { name: string }; district: { name: string } }; created_at: string; expires_at: string | null;
};
type Offer = {
  id: number; request_id: number; price: string; message: string; status: string; created_at: string;
  seller: { name: string; company_name: string | null; profile_type: string | null; description: string | null; contact?: { email: string; phone: string } };
};

const money = (value: string) => new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(Number(value));
const date = (value: string) => new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium" }).format(new Date(value));
const requestStatus: Record<string, string> = { open: "Yayında", in_negotiation: "Teklif geldi", accepted: "Anlaşıldı", cancelled: "İptal edildi" };
const offerStatus: Record<string, string> = { pending: "Değerlendiriliyor", accepted: "Kabul edildi", rejected: "Uygun bulunmadı" };

export function BuyerDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [requests, setRequests] = useState<BuyerRequest[]>([]);
  const [offers, setOffers] = useState<Record<number, Offer[]>>({});
  const [expanded, setExpanded] = useState<number | null>(null);
  const [filter, setFilter] = useState<"all" | "active" | "completed">("all");
  const [busy, setBusy] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const loadRequests = async () => {
    const response = await apiRequest<{ data: BuyerRequest[] }>("/requests/mine");
    setRequests(response.data);
  };

  useEffect(() => {
    let active = true;
    Promise.all([apiRequest<{ data: User }>("/me"), apiRequest<{ data: BuyerRequest[] }>("/requests/mine")])
      .then(([userResponse, requestResponse]) => { if (active) { setUser(userResponse.data); setRequests(requestResponse.data); } })
      .catch((requestError: unknown) => {
        if (!active) return;
        if (requestError instanceof ApiError && requestError.status === 401) return router.replace("/giris?devam=%2Fpanel");
        setError(firstApiError(requestError));
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [router]);

  const visibleRequests = useMemo(() => requests.filter((item) => {
    if (filter === "active") return ["open", "in_negotiation"].includes(item.status);
    if (filter === "completed") return ["accepted", "cancelled"].includes(item.status);
    return true;
  }), [filter, requests]);

  const openOffers = async (item: BuyerRequest) => {
    if (expanded === item.id) { setExpanded(null); return; }
    setExpanded(item.id); setError("");
    try {
      const response = await apiRequest<{ data: Offer[] }>(`/requests/${item.id}/offers`);
      setOffers((current) => ({ ...current, [item.id]: response.data }));
    } catch (requestError: unknown) { setError(firstApiError(requestError)); }
  };

  const decide = async (offer: Offer, decision: "accepted" | "rejected") => {
    setBusy(offer.id); setError(""); setNotice("");
    try {
      const response = await apiRequest<{ message: string }>(`/offers/${offer.id}`, { method: "PATCH", body: JSON.stringify({ decision }) });
      const refreshed = await apiRequest<{ data: Offer[] }>(`/requests/${offer.request_id}/offers`);
      setOffers((current) => ({ ...current, [offer.request_id]: refreshed.data }));
      await loadRequests(); setNotice(response.message);
    } catch (requestError: unknown) { setError(firstApiError(requestError)); }
    finally { setBusy(null); }
  };

  const cancel = async (item: BuyerRequest) => {
    setBusy(-item.id); setError(""); setNotice("");
    try {
      const response = await apiRequest<{ message: string }>(`/requests/${item.id}/cancel`, { method: "PATCH" });
      await loadRequests(); setNotice(response.message);
    } catch (requestError: unknown) { setError(firstApiError(requestError)); }
    finally { setBusy(null); }
  };

  if (loading) return <main className="buyer-page buyer-loading"><Link className="brand" href="/">alıcam<span>.net</span></Link><i /><p>Taleplerin hazırlanıyor…</p></main>;

  const totalOffers = requests.reduce((sum, item) => sum + item.offer_count, 0);
  const activeCount = requests.filter((item) => ["open", "in_negotiation"].includes(item.status)).length;

  return <main className="buyer-page">
    <header className="buyer-topbar"><div><Link className="brand" href="/">alıcam<span>.net</span></Link><nav><a className="active" href="/panel">Taleplerim</a><Link href="/talep-olustur">Yeni talep</Link></nav><span className="buyer-user"><i>{user?.name.slice(0, 2).toLocaleUpperCase("tr-TR")}</i><b>{user?.name}</b></span></div></header>
    <section className="buyer-hero"><div><span>ALICI ÇALIŞMA ALANI</span><h1>İhtiyacın için en doğru<br /><em>teklifi seç.</em></h1><p>Taleplerini, teklifleri ve kararlarını tek bir sakin çalışma alanından yönet.</p></div><Link href="/talep-olustur"><b>＋</b><span>Yeni talep oluştur<small>Ücretsiz yayınla, teklifleri karşılaştır</small></span></Link></section>
    <section className="buyer-dashboard">
      <div className="buyer-stats"><article><span>AKTİF TALEP</span><strong>{activeCount}</strong><small>hizmet verenlerle eşleşiyor</small></article><article><span>GELEN TEKLİF</span><strong>{totalOffers}</strong><small>karşılaştırmaya hazır</small></article><article><span>TAMAMLANAN</span><strong>{requests.filter((item) => item.status === "accepted").length}</strong><small>anlaşmaya dönüştü</small></article></div>
      <div className="buyer-section-head"><div><span>TALEP PORTFÖYÜN</span><h2>Taleplerim</h2></div><div>{(["all", "active", "completed"] as const).map((value) => <button key={value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>{value === "all" ? "Tümü" : value === "active" ? "Aktif" : "Sonuçlanan"}</button>)}</div></div>
      {notice && <p className="buyer-notice">✓ {notice}</p>}{error && <p className="buyer-error">{error}</p>}
      <div className="buyer-request-list">{visibleRequests.length === 0 ? <div className="buyer-empty"><span>◇</span><h2>Bu görünümde talep yok.</h2><Link href="/talep-olustur">İlk talebini oluştur →</Link></div> : visibleRequests.map((item) => <article className="buyer-request-card" key={item.id}>
        <header><span className="buyer-category" style={{ color: item.category.color, background: `${item.category.color}12` }}>{item.category.icon} {item.category.name}</span><span className={`buyer-status ${item.status}`}>{requestStatus[item.status] ?? item.status}</span></header>
        <div className="buyer-request-main"><div><small>{item.reference} · {date(item.created_at)}</small><h2>{item.title}</h2><p>{item.description}</p><span>⌖ {item.location.district.name}, {item.location.city.name}</span></div><aside><small>TAHMİNİ BÜTÇE</small><strong>{money(item.budget.min)}<i>—</i>{money(item.budget.max)}</strong><b>{item.offer_count} teklif</b></aside></div>
        <footer><button onClick={() => openOffers(item)}>{expanded === item.id ? "Teklifleri kapat" : item.offer_count ? `${item.offer_count} teklifi karşılaştır` : "Teklifleri görüntüle"} <span>→</span></button>{["open", "in_negotiation"].includes(item.status) && <button className="buyer-cancel" disabled={busy === -item.id} onClick={() => cancel(item)}>{busy === -item.id ? "İptal ediliyor…" : "Talebi iptal et"}</button>}</footer>
        {expanded === item.id && <section className="buyer-offers"><header><span>GELEN TEKLİFLER</span><strong>{offers[item.id]?.length ?? 0} hizmet veren</strong></header>{(offers[item.id] ?? []).length === 0 ? <p className="buyer-no-offer">Henüz teklif gelmedi. Talebin uygun hizmet verenlere gösterilmeye devam ediyor.</p> : <div>{offers[item.id].map((offer) => <article className={`buyer-offer ${offer.status}`} key={offer.id}><header><span>{(offer.seller.company_name || offer.seller.name).slice(0, 2).toLocaleUpperCase("tr-TR")}</span><div><strong>{offer.seller.company_name || offer.seller.name}</strong><small>{offer.seller.profile_type === "company" ? "Kurumsal hizmet veren" : "Doğrulanmış hizmet veren"}</small></div><b>{offerStatus[offer.status]}</b></header><p>{offer.message}</p><div className="buyer-offer-foot"><strong>{money(offer.price)}</strong>{offer.status === "pending" && <span><button disabled={busy === offer.id} onClick={() => decide(offer, "rejected")}>Reddet</button><button className="accept" disabled={busy === offer.id} onClick={() => decide(offer, "accepted")}>{busy === offer.id ? "İşleniyor…" : "Teklifi kabul et"}</button></span>}{offer.status === "accepted" && offer.seller.contact && <span className="buyer-contact"><a href={`tel:${offer.seller.contact.phone}`}>{offer.seller.contact.phone}</a><a href={`mailto:${offer.seller.contact.email}`}>{offer.seller.contact.email}</a></span>}</div></article>)}</div>}</section>}
      </article>)}</div>
    </section>
  </main>;
}
