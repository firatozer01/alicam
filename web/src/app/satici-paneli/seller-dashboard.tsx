"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, apiRequest, firstApiError } from "@/lib/api";
import styles from "./satici-paneli.module.css";

type CurrentUser = { id: number; name: string; email: string; roles: string[] };
type Category = { id: number; name: string; slug: string; icon: string; color: string };
type RequestAttribute = { key: string; label: string; value: string | number | boolean | string[] | null; unit: string | null; is_private?: boolean };
type SellerRequest = {
  id: number; reference: string; title: string; summary: string; status: string; offer_count: number;
  budget: { min: string; max: string }; category: Category;
  location: { city: { id: number; name: string }; district: { id: number; name: string } };
  summary_attributes: RequestAttribute[]; is_unlocked: boolean; unlock_cost: number | null;
  expires_at: string | null; created_at: string;
  details?: { description: string; full_address: string | null; attributes: RequestAttribute[]; contact: { name: string; email: string; phone: string } };
};
type Offer = { id: number; request_id: number; price: string; message: string; status: string; created_at: string; updated_at: string };
type SellerOfferItem = { offer: Offer; request: SellerRequest };
type CreditTransaction = { id: number; type: string; amount: number; balance_after: number; reference_type: string | null; metadata: { public_reference?: string; merchant_oid?: string; days?: number } | null; created_at: string };
type CreditWorkspace = { balance: number; spent_this_month: number; transactions: CreditTransaction[] };
type SellerService = { id: number; title: string; description: string; price_from: string | null; delivery_time: string | null; is_active: boolean; category: Category };
type FeaturedWorkspace = { is_featured: boolean; featured_until: string | null; packages: Record<string, { label: string; days: number; credits: number }> };
type ProfileWorkspace = {
  categories: Category[];
  locations: { city_id: number; city_name: string; district_id: number; district_name: string }[];
  profile: { company_name: string | null; approval_status: string } | null;
};
type View = "requests" | "offers" | "services" | "visibility";

const money = (value: string | number) => new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(Number(value));
const date = (value: string) => new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
const statusLabel: Record<string, string> = { pending: "Yanıt bekliyor", accepted: "Kabul edildi", rejected: "Reddedildi" };

function relativeTime(value: string) {
  const minutes = Math.max(1, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 60) return `${minutes} dk önce`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} saat önce`;
  return `${Math.round(hours / 24)} gün önce`;
}

function attributeValue(attribute: RequestAttribute) {
  if (Array.isArray(attribute.value)) return attribute.value.join(", ");
  if (typeof attribute.value === "boolean") return attribute.value ? "Evet" : "Hayır";
  if (attribute.value === null || attribute.value === "") return "Belirtilmedi";
  return `${attribute.value}${attribute.unit ? ` ${attribute.unit}` : ""}`;
}

function BrandMark() {
  return <svg aria-hidden="true" className={styles.brandMark} viewBox="0 0 30 30" fill="none"><path d="M4 10 L14 4 L14 10 Z" fill="#7C3AED" /><path d="M26 20 L16 26 L16 20 Z" fill="#06B6D4" /><path d="M14 7 H16 V23 H14 Z" fill="#4F46E5" opacity=".9" /></svg>;
}

export function SellerDashboard() {
  const router = useRouter();
  const chartRef = useRef<HTMLElement>(null);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [requests, setRequests] = useState<SellerRequest[]>([]);
  const [offers, setOffers] = useState<SellerOfferItem[]>([]);
  const [credits, setCredits] = useState<CreditWorkspace>({ balance: 0, spent_this_month: 0, transactions: [] });
  const [services, setServices] = useState<SellerService[]>([]);
  const [featured, setFeatured] = useState<FeaturedWorkspace>({ is_featured: false, featured_until: null, packages: {} });
  const [profile, setProfile] = useState<ProfileWorkspace>({ categories: [], locations: [], profile: null });
  const [view, setView] = useState<View>("requests");
  const [filter, setFilter] = useState<"all" | "unlocked">("all");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [sort, setSort] = useState("latest");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [offerRequest, setOfferRequest] = useState<number | null>(null);
  const [editingOffer, setEditingOffer] = useState<number | null>(null);
  const [price, setPrice] = useState("");
  const [message, setMessage] = useState("");
  const [serviceForm, setServiceForm] = useState({ id: 0, category_id: "", title: "", description: "", price_from: "", delivery_time: "", is_active: true });
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [chartsReady, setChartsReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const fetchWorkspace = useCallback(async () => {
    const suffix = filter === "unlocked" ? "?unlocked=1" : "";
    const [requestResponse, offerResponse, creditResponse, serviceResponse, featuredResponse, profileResponse] = await Promise.all([
      apiRequest<{ data: SellerRequest[]; meta: { total: number } }>(`/seller/requests${suffix}`),
      apiRequest<{ data: SellerOfferItem[] }>("/seller/offers"),
      apiRequest<{ data: CreditWorkspace }>("/seller/credits"),
      apiRequest<{ data: SellerService[] }>("/seller/services"),
      apiRequest<{ data: FeaturedWorkspace }>("/seller/featured"),
      apiRequest<{ data: ProfileWorkspace }>("/seller/profile"),
    ]);
    return { requestResponse, offerResponse, creditResponse, serviceResponse, featuredResponse, profileResponse };
  }, [filter]);

  const applyWorkspace = useCallback((workspace: Awaited<ReturnType<typeof fetchWorkspace>>) => {
    setRequests(workspace.requestResponse.data); setOffers(workspace.offerResponse.data);
    setCredits(workspace.creditResponse.data); setServices(workspace.serviceResponse.data);
    setFeatured(workspace.featuredResponse.data); setProfile(workspace.profileResponse.data);
  }, []);

  const refreshWorkspace = useCallback(async () => applyWorkspace(await fetchWorkspace()), [applyWorkspace, fetchWorkspace]);

  useEffect(() => {
    let active = true;
    Promise.all([apiRequest<{ data: CurrentUser }>("/me"), fetchWorkspace()])
      .then(([userResponse, workspace]) => { if (active) { setUser(userResponse.data); applyWorkspace(workspace); } })
      .catch((requestError: unknown) => {
        if (!active) return;
        if (requestError instanceof ApiError && requestError.status === 401) return router.replace("/giris?devam=%2Fsatici-paneli");
        if (requestError instanceof ApiError && requestError.status === 403) return router.replace("/satici-ol");
        setError(firstApiError(requestError));
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [applyWorkspace, fetchWorkspace, router]);

  useEffect(() => {
    const element = chartRef.current;
    if (!element || view !== "requests") return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) { setChartsReady(true); observer.disconnect(); }
    }, { threshold: 0.25 });
    observer.observe(element);
    return () => observer.disconnect();
  }, [loading, view]);

  const visibleRequests = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("tr-TR");
    const items = requests.filter((item) => (!categoryFilter || item.category.slug === categoryFilter)
      && (!needle || [item.title, item.reference, item.category.name, item.location.city.name, item.location.district.name]
        .some((value) => value.toLocaleLowerCase("tr-TR").includes(needle))));
    return [...items].sort((left, right) => {
      if (sort === "budget_high") return Number(right.budget.max) - Number(left.budget.max);
      if (sort === "competition") return left.offer_count - right.offer_count;
      return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
    });
  }, [categoryFilter, requests, search, sort]);

  const offerByRequest = useMemo(() => new Map(offers.map((item) => [item.offer.request_id, item.offer])), [offers]);
  const acceptedOffers = offers.filter((item) => item.offer.status === "accepted").length;
  const successRate = offers.length ? Math.round((acceptedOffers / offers.length) * 100) : 0;
  const monthSpend = credits.spent_this_month;
  const categoryDistribution = useMemo(() => {
    const counts = offers.reduce<Record<string, { count: number; color: string }>>((result, item) => {
      const name = item.request.category.name;
      result[name] = { count: (result[name]?.count ?? 0) + 1, color: item.request.category.color };
      return result;
    }, {});
    return Object.entries(counts).sort((a, b) => b[1].count - a[1].count).slice(0, 3);
  }, [offers]);
  const topCategoryShare = offers.length && categoryDistribution.length ? categoryDistribution[0][1].count / offers.length : 0;
  const barPairs = [45, 60, 52, 78, 68, Math.max(36, Math.min(94, 46 + offers.length * 3))];

  const selectView = (next: View) => { setView(next); setNotice(""); setError(""); };
  const openOffer = (requestId: number, offer?: Offer) => { setOfferRequest(requestId); setEditingOffer(offer?.id ?? null); setPrice(offer?.price ?? ""); setMessage(offer?.message ?? ""); setError(""); };

  const submitOffer = async (requestId: number) => {
    setBusy(true); setError(""); setNotice("");
    try {
      const updating = editingOffer !== null;
      const response = await apiRequest<{ message: string }>(updating ? `/seller/offers/${editingOffer}` : "/seller/offers", { method: updating ? "PUT" : "POST", body: JSON.stringify({ ...(updating ? {} : { request_id: requestId }), price, message }) });
      setNotice(response.message); setOfferRequest(null); setEditingOffer(null); setPrice(""); setMessage(""); await refreshWorkspace(); if (!updating) setView("offers");
    } catch (requestError: unknown) { setError(firstApiError(requestError)); }
    finally { setBusy(false); }
  };

  const unlock = async (item: SellerRequest) => {
    setBusy(true); setError(""); setNotice("");
    try { const response = await apiRequest<{ message: string }>(`/seller/requests/${item.id}/unlock`, { method: "POST" }); setNotice(response.message); await refreshWorkspace(); setExpanded(item.id); }
    catch (requestError: unknown) { setError(firstApiError(requestError)); }
    finally { setBusy(false); }
  };

  const editService = (service?: SellerService) => {
    setServiceForm(service ? { id: service.id, category_id: String(service.category.id), title: service.title, description: service.description, price_from: service.price_from ?? "", delivery_time: service.delivery_time ?? "", is_active: service.is_active } : { id: 0, category_id: String(profile.categories[0]?.id ?? ""), title: "", description: "", price_from: "", delivery_time: "", is_active: true });
    setShowServiceForm(true); setError("");
  };

  const submitService = async () => {
    setBusy(true); setError(""); setNotice("");
    try {
      const updating = serviceForm.id > 0;
      const response = await apiRequest<{ message: string }>(updating ? `/seller/services/${serviceForm.id}` : "/seller/services", { method: updating ? "PUT" : "POST", body: JSON.stringify({ ...serviceForm, category_id: Number(serviceForm.category_id), price_from: serviceForm.price_from || null }) });
      setNotice(response.message); setShowServiceForm(false); await refreshWorkspace();
    } catch (requestError: unknown) { setError(firstApiError(requestError)); }
    finally { setBusy(false); }
  };

  const deleteService = async (serviceId: number) => {
    setBusy(true); setError("");
    try { const response = await apiRequest<{ message: string }>(`/seller/services/${serviceId}`, { method: "DELETE" }); setNotice(response.message); await refreshWorkspace(); }
    catch (requestError: unknown) { setError(firstApiError(requestError)); }
    finally { setBusy(false); }
  };

  const buyPromotion = async (packageKey: string) => {
    setBusy(true); setError(""); setNotice("");
    try { const response = await apiRequest<{ message: string }>("/seller/featured", { method: "POST", body: JSON.stringify({ package: packageKey }) }); setNotice(response.message); await refreshWorkspace(); }
    catch (requestError: unknown) { setError(firstApiError(requestError)); }
    finally { setBusy(false); }
  };

  if (loading && !user) return <main className={styles.loading}><i /><p>Hizmet veren çalışma alanı hazırlanıyor…</p></main>;

  return <main className={styles.page}>
    <header className={styles.topbar}><div className={styles.topbarInner}><Link className={styles.brand} href="/"><BrandMark />alıcam<span>.net</span></Link><nav><Link href="/">Ana sayfa</Link><button className={view === "requests" ? styles.active : ""} onClick={() => { setFilter("all"); selectView("requests"); }}>Gelen talepler</button><button className={view === "offers" ? styles.active : ""} onClick={() => selectView("offers")}>Tekliflerim</button><button className={view === "services" ? styles.active : ""} onClick={() => selectView("services")}>Hizmetlerim</button></nav><div><Link className={styles.creditPill} href="/kontor-yukle">⚡ {credits.balance} kontör</Link><span className={styles.notification}>🔔<i /></span><span className={styles.avatar}>{user?.name.slice(0, 2).toLocaleUpperCase("tr-TR")}</span></div></div></header>
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <nav><span>TALEPLER</span><button className={view === "requests" && filter === "all" ? styles.active : ""} onClick={() => { setFilter("all"); selectView("requests"); }}><i>📥</i> Gelen talepler <b>{requests.length}</b></button><button className={view === "requests" && filter === "unlocked" ? styles.active : ""} onClick={() => { setFilter("unlocked"); selectView("requests"); }}><i>🔓</i> Açtıklarım</button><button className={view === "offers" ? styles.active : ""} onClick={() => selectView("offers")}><i>📨</i> Tekliflerim <b>{offers.length}</b></button><span>FİRMA</span><button className={view === "services" ? styles.active : ""} onClick={() => selectView("services")}><i>▦</i> Hizmetlerim <b>{services.length}</b></button><Link href="/satici-ol"><i>🏢</i> Firma profilim</Link><button className={view === "visibility" ? styles.active : ""} onClick={() => selectView("visibility")}><i>⭐</i> Öne çık</button></nav>
        <div className={styles.creditCard}><i /><span>KONTÖR BAKİYEN</span><strong>{credits.balance}</strong><p>Bu ay {monthSpend} kontör harcandı</p><div><i style={{ width: `${Math.min(100, monthSpend)}%` }} /></div><Link href="/kontor-yukle">Kontör yükle</Link></div>
      </aside>

      <section className={styles.content}>
        <section className={styles.stats}><article><i>📥</i><div><strong>{requests.length}</strong><span>yeni talep</span></div><b>+{Math.min(5, requests.length)}</b></article><article><i>📨</i><div><strong>{offers.length}</strong><span>verilen teklif</span></div><b>toplam</b></article><article><i>✅</i><div><strong>%{successRate}</strong><span>kabul oranı</span></div><b>+{acceptedOffers}</b></article><article><i>⚡</i><div><strong>{monthSpend}</strong><span>bu ay harcanan</span></div><Link href="/kontor-yukle">yükle</Link></article></section>
        {notice && <p className={styles.notice}>✓ {notice}</p>}{error && <p className={styles.error}>{error}</p>}

        {view === "requests" && <>
          <section className={styles.dashboard} ref={chartRef}><article><header><strong>📊 Teklif performansın</strong><span>Son 6 hafta</span></header><div className={styles.bars}>{barPairs.map((height, index) => <div key={index}><span><i className={styles.barOffer} style={{ height: chartsReady ? `${height}%` : 0 }} /><i className={styles.barAccepted} style={{ height: chartsReady ? `${Math.max(8, Math.round(height * (successRate || 28) / 100))}%` : 0 }} /></span><small>{index + 1}. hafta</small></div>)}</div><footer><span><i className={styles.offerSwatch} /> Verilen teklif</span><span><i className={styles.acceptedSwatch} /> Kabul edilen</span></footer></article><article><header><strong>🎯 Kategori dağılımın</strong><span>Tekliflerin</span></header><div className={styles.donutWrap}><div className={styles.donut}><svg viewBox="0 0 120 120"><defs><linearGradient id="seller-donut" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#7C3AED" /><stop offset="1" stopColor="#06B6D4" /></linearGradient></defs><circle className={styles.donutTrack} cx="60" cy="60" r="50" /><circle className={styles.donutProgress} cx="60" cy="60" r="50" style={{ strokeDashoffset: chartsReady ? 314 - (314 * topCategoryShare) : 314 }} /></svg><span><b>{offers.length}</b><small>teklif</small></span></div><div className={styles.donutLegend}>{categoryDistribution.length ? categoryDistribution.map(([name, data]) => <p key={name}><i style={{ background: data.color }} /><span><b>{name}</b><small>{data.count} teklif</small></span></p>) : <p><i /><span><b>Henüz veri yok</b><small>İlk teklifinle oluşur</small></span></p>}</div></div></article></section>
          <section className={styles.toolbar}><div><label>🔍<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Taleplerde ara (örn. 3+1, Çankaya, villa)…" /></label><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="latest">Sırala: En yeni</option><option value="budget_high">Bütçe: yüksekten</option><option value="competition">En az rekabet</option></select></div><div><span>KATEGORİ</span><button className={!categoryFilter ? styles.active : ""} onClick={() => setCategoryFilter("")}>Tümü <small>{requests.length}</small></button>{profile.categories.map((item) => <button className={categoryFilter === item.slug ? styles.active : ""} key={item.id} onClick={() => setCategoryFilter(item.slug)}>{item.icon} {item.name}</button>)}</div>{profile.locations.length > 0 && <div><span>BÖLGE</span>{profile.locations.slice(0, 4).map((item) => <em key={item.district_id}>📍 {item.district_name}</em>)}<Link href="/satici-ol">+ Bölge düzenle</Link></div>}</section>
          <div className={styles.requestList}>{visibleRequests.length === 0 ? <div className={styles.empty}>Bu filtrede eşleşen talep bulunmuyor.</div> : visibleRequests.map((item) => {
            const existingOffer = offerByRequest.get(item.id);
            const hot = Number(item.budget.max) >= 500000;
            const competition = item.offer_count > 7 ? "high" : item.offer_count > 3 ? "mid" : "low";
            return <article className={`${styles.requestCard} ${item.is_unlocked ? styles.unlocked : ""} ${hot && !item.is_unlocked ? styles.hot : ""}`} key={item.id}>{hot && !item.is_unlocked && <b className={styles.hotTag}>🔥 YÜKSEK BÜTÇE</b>}<header><span style={{ color: item.category.color, background: `${item.category.color}15` }}>{item.category.icon} {item.category.name}</span><small><i /> {relativeTime(item.created_at)}</small><em className={styles[competition]}>{competition === "high" ? "Yoğun" : competition === "mid" ? "Orta" : "Düşük"} rekabet · {item.offer_count} teklif</em></header><h2>{item.title}</h2><div className={styles.attributes}><span>📍 {item.location.city.name}, {item.location.district.name}</span>{item.summary_attributes.slice(0, 4).map((attribute) => <span key={attribute.key}>{attribute.label}: <b>{attributeValue(attribute)}</b></span>)}</div>{item.is_unlocked && item.details && <div className={styles.contactBox}><b>🔓 Açıldı</b><strong>{item.details.contact.name} · {item.details.contact.phone}</strong><button onClick={() => setExpanded(expanded === item.id ? null : item.id)}>{expanded === item.id ? "Detayı kapat" : "Tüm detayı gör"}</button></div>}<footer><div><span>👁 <b>{Math.max(12, item.offer_count * 7 + 5)}</b> görüntüleme</span><span>📨 <b>{item.offer_count}</b> teklif verilmiş</span></div><aside><strong>{money(item.budget.min)} – {money(item.budget.max)}</strong>{existingOffer ? <button className={styles.sent} onClick={() => selectView("offers")}>{statusLabel[existingOffer.status]}</button> : item.is_unlocked ? <button className={styles.cyanButton} onClick={() => openOffer(item.id)}>Teklif ver</button> : <button className={styles.gradientButton} disabled={busy} onClick={() => unlock(item)}>Detayı aç · {item.unlock_cost} ⚡</button>}</aside></footer>
              {expanded === item.id && item.details && <div className={styles.details}><section><span>TALEP DETAYI</span><p>{item.details.description}</p><div>{item.details.attributes.map((attribute) => <p key={attribute.key}><small>{attribute.label}</small><strong>{attributeValue(attribute)}</strong></p>)}</div></section><aside><span>İLETİŞİM VE ADRES</span><strong>{item.details.contact.name}</strong><a href={`tel:${item.details.contact.phone}`}>{item.details.contact.phone}</a><a href={`mailto:${item.details.contact.email}`}>{item.details.contact.email}</a><p>{item.details.full_address || "Açık adres belirtilmedi"}</p></aside></div>}
              {offerRequest === item.id && !existingOffer && <div className={styles.offerForm}><div><span>TEKLİFİNİ HAZIRLA</span><strong>Bu talep açıldı; teklif gönderirken ek kontör düşmez.</strong></div><label>Fiyat<input inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} placeholder="Örn. 12500" /></label><label>Teklif notu<textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Kapsamı ve teslim süresini açıkla…" /></label><aside><button onClick={() => setOfferRequest(null)}>Vazgeç</button><button disabled={busy} onClick={() => submitOffer(item.id)}>{busy ? "Gönderiliyor…" : "Teklifi gönder"}</button></aside></div>}
            </article>;
          })}</div>
        </>}

        {view === "offers" && <section className={styles.workspaceView}><header><div><span>TEKLİF PORTFÖYÜ</span><h1>Tekliflerim</h1><p>Gönderdiğin teklifleri ve sonuçlarını takip et.</p></div><button onClick={() => { setFilter("all"); selectView("requests"); }}>Yeni fırsat bul →</button></header><div className={styles.offerList}>{offers.length === 0 ? <div className={styles.empty}>Henüz teklif göndermedin.</div> : offers.map(({ offer, request: item }) => <article key={offer.id}><header><span style={{ color: item.category.color, background: `${item.category.color}15` }}>{item.category.icon} {item.category.name}</span><b className={styles[offer.status]}>{statusLabel[offer.status]}</b></header><h2>{item.title}</h2><small>{item.reference} · {item.location.district.name}, {item.location.city.name}</small><div><strong>{money(offer.price)}</strong><p>{offer.message}</p></div><footer><span>{date(offer.created_at)}</span>{offer.status === "pending" && <button onClick={() => openOffer(item.id, offer)}>Teklifi düzenle</button>}</footer>{offerRequest === item.id && editingOffer === offer.id && <div className={styles.offerForm}><label>Fiyat<input value={price} onChange={(event) => setPrice(event.target.value)} /></label><label>Teklif notu<textarea value={message} onChange={(event) => setMessage(event.target.value)} /></label><aside><button onClick={() => setOfferRequest(null)}>Vazgeç</button><button disabled={busy} onClick={() => submitOffer(item.id)}>Güncelle</button></aside></div>}</article>)}</div></section>}

        {view === "services" && <section className={styles.workspaceView}><header><div><span>HİZMET KATALOĞU</span><h1>Vereceğin hizmetler</h1><p>Müşterilere hangi işleri, hangi başlangıç fiyatıyla sunduğunu göster.</p></div><button onClick={() => editService()}>＋ Hizmet ekle</button></header>{showServiceForm && <div className={styles.serviceForm}><label>Kategori<select value={serviceForm.category_id} onChange={(event) => setServiceForm({ ...serviceForm, category_id: event.target.value })}>{profile.categories.map((item) => <option key={item.id} value={item.id}>{item.icon} {item.name}</option>)}</select></label><label>Hizmet başlığı<input value={serviceForm.title} onChange={(event) => setServiceForm({ ...serviceForm, title: event.target.value })} placeholder="Örn. Anahtar teslim banyo yenileme" /></label><label className={styles.wide}>Açıklama<textarea value={serviceForm.description} onChange={(event) => setServiceForm({ ...serviceForm, description: event.target.value })} placeholder="Hizmet kapsamını ve çalışma biçimini anlat…" /></label><label>Başlangıç fiyatı<input inputMode="decimal" value={serviceForm.price_from} onChange={(event) => setServiceForm({ ...serviceForm, price_from: event.target.value })} placeholder="Örn. 5000" /></label><label>Teslim süresi<input value={serviceForm.delivery_time} onChange={(event) => setServiceForm({ ...serviceForm, delivery_time: event.target.value })} placeholder="Örn. 3–5 gün" /></label><label className={styles.toggle}><input type="checkbox" checked={serviceForm.is_active} onChange={(event) => setServiceForm({ ...serviceForm, is_active: event.target.checked })} /> Yayında</label><aside><button onClick={() => setShowServiceForm(false)}>Vazgeç</button><button disabled={busy} onClick={submitService}>{busy ? "Kaydediliyor…" : "Hizmeti kaydet"}</button></aside></div>}
          <div className={styles.serviceGrid}>{services.length === 0 ? <div className={styles.empty}>Henüz hizmet eklemedin. İlk hizmetini oluşturarak profilini güçlendir.</div> : services.map((service) => <article key={service.id}><header><span style={{ color: service.category.color, background: `${service.category.color}15` }}>{service.category.icon}</span><div><small>{service.category.name}</small><b className={service.is_active ? styles.live : ""}>{service.is_active ? "Yayında" : "Gizli"}</b></div></header><h2>{service.title}</h2><p>{service.description}</p><div><span><small>BAŞLAYAN FİYAT</small><strong>{service.price_from ? money(service.price_from) : "Teklif alın"}</strong></span><span><small>TESLİM</small><strong>{service.delivery_time || "Planlanır"}</strong></span></div><footer><button onClick={() => editService(service)}>Düzenle</button><button onClick={() => deleteService(service.id)}>Kaldır</button></footer></article>)}</div>
        </section>}

        {view === "visibility" && <section className={styles.workspaceView}><header><div><span>VİTRİN VE GÖRÜNÜRLÜK</span><h1>Öne çıkanlarda yer al</h1><p>Profilini ana sayfadaki öne çıkan profesyoneller bölümüne taşı.</p></div>{featured.is_featured && <b className={styles.featuredBadge}>★ {featured.featured_until ? new Date(featured.featured_until).toLocaleDateString("tr-TR") : "Aktif"} tarihine kadar</b>}</header><div className={styles.visibilityHero}><div><span>KONTÖRLE GÖRÜNÜRLÜK</span><h2>Daha çok müşteri tarafından keşfedil.</h2><p>Öne çıkarılan profiller ana sayfa vitrininde sponsorlu etiketiyle gösterilir.</p><ul><li>✓ Ana sayfa profesyonel vitrini</li><li>✓ Şeffaf sponsorlu ibaresi</li><li>✓ Puan ve hizmet görünürlüğü</li></ul></div><aside><small>MEVCUT BAKİYE</small><strong>⚡ {credits.balance}</strong><Link href="/kontor-yukle">Kontör yükle →</Link></aside></div><div className={styles.packageGrid}>{Object.entries(featured.packages).map(([key, item], index) => <article className={index === 1 ? styles.popular : ""} key={key}>{index === 1 && <b>EN AVANTAJLI</b>}<span>{item.label.toUpperCase()}</span><strong>{item.credits}<small> kontör</small></strong><p>{item.days} gün boyunca vitrin görünürlüğü</p><button disabled={busy || credits.balance < item.credits} onClick={() => buyPromotion(key)}>{credits.balance < item.credits ? "Bakiye yetersiz" : "Paketi etkinleştir"}</button></article>)}</div><section className={styles.ledger}><header><div><span>HESAP HAREKETLERİ</span><h2>Kontör geçmişi</h2></div><Link href="/kontor-yukle">Kontör yükle →</Link></header>{credits.transactions.length === 0 ? <p>Henüz kontör hareketi bulunmuyor.</p> : credits.transactions.map((transaction) => <div key={transaction.id}><i className={transaction.amount < 0 ? styles.spend : ""}>{transaction.amount < 0 ? "−" : "+"}</i><p><strong>{transaction.reference_type === "seller_promotion" ? "Vitrinde öne çıkarma" : transaction.type === "spend" ? "Teklif / detay bedeli" : transaction.type === "bonus" ? "Paket bonusu" : "Kontör yükleme"}</strong><small>{transaction.metadata?.public_reference ?? transaction.metadata?.merchant_oid ?? (transaction.metadata?.days ? `${transaction.metadata.days} gün` : "Hesap hareketi")} · {date(transaction.created_at)}</small></p><b>{transaction.amount > 0 ? "+" : ""}{transaction.amount}<small>kalan {transaction.balance_after}</small></b></div>)}</section></section>}
      </section>
    </div>
  </main>;
}
