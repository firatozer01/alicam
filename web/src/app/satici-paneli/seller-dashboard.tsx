"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, apiRequest, firstApiError } from "@/lib/api";

type CurrentUser = { id: number; name: string; email: string; roles: string[] };
type RequestAttribute = { key: string; label: string; value: string | number | boolean | string[] | null; unit: string | null; is_private?: boolean };
type SellerRequest = {
  id: number; reference: string; title: string; summary: string; status: string;
  budget: { min: string; max: string };
  category: { id: number; name: string; slug: string; icon: string; color: string };
  location: { city: { id: number; name: string }; district: { id: number; name: string } };
  summary_attributes: RequestAttribute[]; is_unlocked: boolean; unlock_cost: number | null;
  expires_at: string | null; created_at: string;
  details?: { description: string; full_address: string | null; attributes: RequestAttribute[]; contact: { name: string; email: string; phone: string } };
};
type Offer = { id: number; request_id: number; price: string; message: string; status: string; created_at: string; updated_at: string };
type SellerOfferItem = { offer: Offer; request: SellerRequest };
type CreditTransaction = { id: number; type: string; amount: number; balance_after: number; metadata: { public_reference?: string; merchant_oid?: string } | null; created_at: string };
type CreditWorkspace = { balance: number; transactions: CreditTransaction[] };
type RequestListResponse = { data: SellerRequest[]; meta: { total: number } };

const money = (value: string | number) => new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(Number(value));
const date = (value: string) => new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
const statusLabel: Record<string, string> = { pending: "Yanıt bekliyor", accepted: "Kabul edildi", rejected: "Reddedildi" };

function attributeValue(attribute: RequestAttribute) {
  if (Array.isArray(attribute.value)) return attribute.value.join(", ");
  if (typeof attribute.value === "boolean") return attribute.value ? "Evet" : "Hayır";
  if (attribute.value === null || attribute.value === "") return "Belirtilmedi";
  return `${attribute.value}${attribute.unit ? ` ${attribute.unit}` : ""}`;
}

export function SellerDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [requests, setRequests] = useState<SellerRequest[]>([]);
  const [offers, setOffers] = useState<SellerOfferItem[]>([]);
  const [credits, setCredits] = useState<CreditWorkspace>({ balance: 0, transactions: [] });
  const [view, setView] = useState<"requests" | "offers">("requests");
  const [filter, setFilter] = useState<"all" | "unlocked">("all");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [offerRequest, setOfferRequest] = useState<number | null>(null);
  const [editingOffer, setEditingOffer] = useState<number | null>(null);
  const [price, setPrice] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const fetchWorkspace = useCallback(async () => {
    const suffix = filter === "unlocked" ? "?unlocked=1" : "";
    const [requestResponse, offerResponse, creditResponse] = await Promise.all([
      apiRequest<RequestListResponse>(`/seller/requests${suffix}`),
      apiRequest<{ data: SellerOfferItem[] }>("/seller/offers"),
      apiRequest<{ data: CreditWorkspace }>("/seller/credits"),
    ]);
    return { requestResponse, offerResponse, creditResponse };
  }, [filter]);

  const refreshWorkspace = useCallback(async () => {
    const { requestResponse, offerResponse, creditResponse } = await fetchWorkspace();
    setRequests(requestResponse.data);
    setOffers(offerResponse.data);
    setCredits(creditResponse.data);
  }, [fetchWorkspace]);

  useEffect(() => {
    let active = true;
    Promise.all([apiRequest<{ data: CurrentUser }>("/me"), fetchWorkspace()])
      .then(([userResponse, workspace]) => { if (active) { setUser(userResponse.data); setRequests(workspace.requestResponse.data); setOffers(workspace.offerResponse.data); setCredits(workspace.creditResponse.data); } })
      .catch((requestError: unknown) => {
        if (!active) return;
        if (requestError instanceof ApiError && requestError.status === 401) return router.replace("/giris?devam=%2Fsatici-paneli");
        if (requestError instanceof ApiError && requestError.status === 403) return router.replace("/satici-ol");
        setError(firstApiError(requestError));
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [fetchWorkspace, router]);

  const visibleRequests = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("tr-TR");
    if (!needle) return requests;
    return requests.filter((item) => [item.title, item.reference, item.category.name, item.location.city.name, item.location.district.name]
      .some((value) => value.toLocaleLowerCase("tr-TR").includes(needle)));
  }, [requests, search]);
  const offerByRequest = useMemo(() => new Map(offers.map((item) => [item.offer.request_id, item.offer])), [offers]);

  const openOffer = (requestId: number, offer?: Offer) => {
    setOfferRequest(requestId);
    setEditingOffer(offer?.id ?? null);
    setPrice(offer?.price ?? "");
    setMessage(offer?.message ?? "");
    setError("");
  };

  const submitOffer = async (requestId: number) => {
    setBusy(true); setError(""); setNotice("");
    try {
      const updating = editingOffer !== null;
      const path = updating ? `/seller/offers/${editingOffer}` : "/seller/offers";
      const response = await apiRequest<{ message: string }>(path, {
        method: updating ? "PUT" : "POST",
        body: JSON.stringify({ ...(updating ? {} : { request_id: requestId }), price, message }),
      });
      setNotice(response.message);
      setOfferRequest(null); setEditingOffer(null); setPrice(""); setMessage("");
      await refreshWorkspace();
      if (!updating) setView("offers");
    } catch (requestError: unknown) { setError(firstApiError(requestError)); }
    finally { setBusy(false); }
  };

  const unlock = async (item: SellerRequest) => {
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await apiRequest<{ message: string }>(`/seller/requests/${item.id}/unlock`, { method: "POST" });
      setNotice(response.message); await refreshWorkspace(); setExpanded(item.id);
    } catch (requestError: unknown) { setError(firstApiError(requestError)); }
    finally { setBusy(false); }
  };

  if (loading && !user) return <main className="provider-page provider-loading"><Link className="brand" href="/">alıcam<span>.net</span></Link><i /><p>Hizmet veren çalışma alanı hazırlanıyor…</p></main>;

  return (
    <main className="provider-page">
      <header className="provider-topbar"><div className="provider-topbar-inner">
        <Link className="brand" href="/">alıcam<span>.net</span></Link>
        <nav><button className={view === "requests" ? "active" : ""} onClick={() => setView("requests")}>Gelen talepler</button><button className={view === "offers" ? "active" : ""} onClick={() => setView("offers")}>Tekliflerim</button></nav>
        <div className="provider-account"><Link className="provider-balance-pill" href="/kontor-yukle"><span>⚡</span><b>{credits.balance}</b> kontör</Link><span className="provider-avatar">{user?.name.slice(0, 2).toLocaleUpperCase("tr-TR") ?? "HV"}</span></div>
      </div></header>

      <div className="provider-layout">
        <aside className="provider-sidebar">
          <span className="provider-side-label">ÇALIŞMA ALANI</span><nav>
            <button className={view === "requests" ? "active" : ""} onClick={() => setView("requests")}><i>⌁</i> Gelen talepler <b>{requests.length}</b></button>
            <button className={view === "offers" ? "active" : ""} onClick={() => setView("offers")}><i>↗</i> Tekliflerim <b>{offers.length}</b></button>
          </nav>
          <span className="provider-side-label">PROFİL</span><nav><Link href="/satici-ol"><i>◎</i> Hizmet veren profilim</Link></nav>
          <section className="provider-credit-card"><span>KONTÖR BAKİYEN</span><strong>{credits.balance}</strong><small>Teklif göndermek talebin kategori bedeli kadar kontör kullanır.</small><div><i style={{ width: `${Math.min(100, credits.balance * 5)}%` }} /></div><Link href="/kontor-yukle">Kontör yükle →</Link></section>
        </aside>

        <section className="provider-content">
          <header className="provider-heading"><div><span className="provider-kicker">HİZMET VEREN PANELİ</span><h1>{view === "requests" ? "Gelen talepler" : "Tekliflerim"}</h1><p>{view === "requests" ? "Uzmanlığın ve bölgelerinle eşleşen talepleri incele, kontörle teklif ver." : "Gönderdiğin tekliflerin durumunu tek yerde takip et."}</p></div><div className="provider-heading-badge"><span>GÜVENLİ İŞ AKIŞI</span><strong>İletişim bilgileri kontrollü paylaşılır</strong></div></header>
          <div className="provider-stats"><article><i className="petrol">⌁</i><div><strong>{requests.length}</strong><span>eşleşen talep</span></div></article><article><i className="amber">↗</i><div><strong>{offers.length}</strong><span>gönderilen teklif</span></div></article><article><i className="violet">⚡</i><div><strong>{credits.balance}</strong><span>kontör bakiyesi</span></div></article></div>
          {notice && <p className="provider-notice">✓ {notice}</p>}{error && <p className="provider-error">{error}</p>}

          {view === "requests" ? <>
            <div className="provider-toolbar"><label><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Talep, kategori veya konum ara…" /></label><div><button className={filter === "all" ? "active" : ""} onClick={() => { setLoading(true); setFilter("all"); }}>Tümü</button><button className={filter === "unlocked" ? "active" : ""} onClick={() => { setLoading(true); setFilter("unlocked"); }}>Açılanlar</button></div></div>
            <div className="provider-request-list">{visibleRequests.length === 0 ? <div className="provider-empty"><span>⌁</span><h2>Bu görünümde eşleşen talep yok.</h2></div> : visibleRequests.map((item) => {
              const existingOffer = offerByRequest.get(item.id);
              return <article className={`provider-request-card ${item.is_unlocked ? "unlocked" : "locked"}`} key={item.id}>
                <div className="provider-request-top"><span className="provider-category" style={{ color: item.category.color, background: `${item.category.color}12` }}>{item.category.icon} {item.category.name}</span><span className="provider-request-time"><i />{date(item.created_at)}</span><span className={item.is_unlocked ? "provider-unlocked-tag" : "provider-locked-tag"}>{item.is_unlocked ? "✓ DETAYLAR AÇIK" : `⚡ ${item.unlock_cost} KONTÖR`}</span></div>
                <h2>{item.title}</h2><p>{item.summary}</p><div className="provider-attribute-row">{item.summary_attributes.map((attribute) => <span key={attribute.key}><b>{attribute.label}</b>{attributeValue(attribute)}</span>)}</div>
                <div className="provider-request-foot"><div className="provider-request-metrics"><span>⌖ <b>{item.location.district.name}, {item.location.city.name}</b></span><span>№ <b>{item.reference}</b></span></div><div className="provider-request-action"><strong>{money(item.budget.min)} – {money(item.budget.max)}</strong>{item.is_unlocked && <button onClick={() => setExpanded(expanded === item.id ? null : item.id)}>{expanded === item.id ? "Detayı kapat" : "Detayı göster"}</button>}{existingOffer ? <button className="provider-offer-existing" onClick={() => setView("offers")}>{statusLabel[existingOffer.status]}</button> : <button onClick={() => openOffer(item.id)}>{item.is_unlocked ? "Teklif ver" : `${item.unlock_cost} kontörle teklif ver`} →</button>}</div></div>
                {offerRequest === item.id && !existingOffer && <div className="provider-offer-form"><div><span>TEKLİFİNİ HAZIRLA</span><strong>{item.is_unlocked ? "Bu talep daha önce açıldı; ek kontör düşmez." : `${item.unlock_cost} kontör, teklif gönderildiğinde düşecek.`}</strong></div><label>Fiyat<input inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} placeholder="Örn. 12500" /></label><label>Teklif notu<textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Kapsamı, teslim süresini ve teklif detayını açıkla…" /></label><div className="provider-offer-buttons"><button onClick={() => setOfferRequest(null)}>Vazgeç</button><button className="primary" disabled={busy} onClick={() => submitOffer(item.id)}>{busy ? "Gönderiliyor…" : "Teklifi gönder"}</button></div></div>}
                {expanded === item.id && item.details && <div className="provider-open-details"><section><span>TALEP DETAYI</span><p>{item.details.description}</p><div className="provider-detail-attrs">{item.details.attributes.map((attribute) => <div key={attribute.key}><small>{attribute.label}</small><strong>{attributeValue(attribute)}</strong></div>)}</div></section><aside><span>İLETİŞİM VE ADRES</span><p><small>Talep sahibi</small><strong>{item.details.contact.name}</strong></p><a href={`tel:${item.details.contact.phone}`}><small>Telefon</small><strong>{item.details.contact.phone}</strong></a><a href={`mailto:${item.details.contact.email}`}><small>E-posta</small><strong>{item.details.contact.email}</strong></a><p><small>Açık adres</small><strong>{item.details.full_address || "Belirtilmedi"}</strong></p></aside></div>}
                {!item.is_unlocked && expanded === item.id && <div className="provider-standalone-unlock"><span>Teklif vermeden yalnızca iletişim detayını açmak istersen</span><button disabled={busy} onClick={() => unlock(item)}>{item.unlock_cost} kontörle aç</button></div>}
              </article>;
            })}</div>
          </> : <div className="provider-offer-list">{offers.length === 0 ? <div className="provider-empty"><span>↗</span><h2>Henüz teklif göndermedin.</h2><p>Eşleşen taleplerden birini seçerek ilk teklifini oluşturabilirsin.</p><button onClick={() => setView("requests")}>Taleplere dön</button></div> : offers.map(({ offer, request: item }) => <article className="provider-offer-card" key={offer.id}><header><div><span className="provider-category" style={{ color: item.category.color, background: `${item.category.color}12` }}>{item.category.icon} {item.category.name}</span><small>{item.reference} · {date(offer.created_at)}</small></div><b className={`offer-status ${offer.status}`}>{statusLabel[offer.status]}</b></header><h2>{item.title}</h2><div className="provider-offer-summary"><strong>{money(offer.price)}</strong><p>{offer.message}</p></div><footer><span>⌖ {item.location.district.name}, {item.location.city.name}</span>{offer.status === "pending" && <button onClick={() => openOffer(item.id, offer)}>Teklifi düzenle</button>}</footer>{offerRequest === item.id && editingOffer === offer.id && <div className="provider-offer-form compact"><label>Fiyat<input value={price} onChange={(event) => setPrice(event.target.value)} /></label><label>Teklif notu<textarea value={message} onChange={(event) => setMessage(event.target.value)} /></label><div className="provider-offer-buttons"><button onClick={() => setOfferRequest(null)}>Vazgeç</button><button className="primary" disabled={busy} onClick={() => submitOffer(item.id)}>{busy ? "Kaydediliyor…" : "Güncelle"}</button></div></div>}</article>)}</div>}

          <section className="provider-ledger"><header><div><span className="provider-kicker">HESAP HAREKETLERİ</span><h2>Kontör geçmişi</h2></div><Link href="/kontor-yukle">Kontör yükle →</Link></header>{credits.transactions.length === 0 ? <p className="provider-ledger-empty">Henüz kontör hareketi bulunmuyor.</p> : credits.transactions.map((transaction) => <div className="provider-transaction" key={transaction.id}><i className={transaction.amount < 0 ? "spend" : "income"}>{transaction.amount < 0 ? "−" : "+"}</i><p><strong>{transaction.type === "spend" ? "Teklif / talep açma bedeli" : transaction.type === "bonus" ? "Paket bonusu" : "Kontör satın alımı"}</strong><small>{transaction.metadata?.public_reference ?? transaction.metadata?.merchant_oid ?? "Hesap hareketi"} · {date(transaction.created_at)}</small></p><b>{transaction.amount > 0 ? "+" : ""}{transaction.amount}<small>kalan {transaction.balance_after}</small></b></div>)}</section>
        </section>
      </div>
    </main>
  );
}
