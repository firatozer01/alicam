"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, apiRequest, firstApiError } from "@/lib/api";
import styles from "./satici-paneli.module.css";

type CurrentUser = { id: number; name: string; email: string; roles: string[] };
type Category = { id: number; name: string; slug: string; icon: string; color: string };
type RequestAttribute = { key: string; label: string; value: string | number | boolean | string[] | null; unit: string | null; is_private?: boolean };
type SellerRequest = {
  id: number; reference: string; title: string; summary: string; status: string;
  budget: { min: string; max: string }; category: Category;
  location: { city: { id: number; name: string }; district: { id: number; name: string } };
  summary_attributes: RequestAttribute[]; is_unlocked: boolean; unlock_cost: number | null;
  expires_at: string | null; created_at: string;
  details?: { description: string; full_address: string | null; attributes: RequestAttribute[]; contact: { name: string; email: string; phone: string } };
};
type Offer = { id: number; request_id: number; price: string; message: string; status: string; created_at: string; updated_at: string };
type SellerOfferItem = { offer: Offer; request: SellerRequest };
type CreditTransaction = { id: number; type: string; amount: number; balance_after: number; reference_type: string | null; metadata: { public_reference?: string; merchant_oid?: string; days?: number } | null; created_at: string };
type CreditWorkspace = { balance: number; transactions: CreditTransaction[] };
type SellerService = { id: number; title: string; description: string; price_from: string | null; delivery_time: string | null; is_active: boolean; category: Category };
type FeaturedWorkspace = { is_featured: boolean; featured_until: string | null; packages: Record<string, { label: string; days: number; credits: number }> };
type ProfileWorkspace = { categories: Category[]; profile: { company_name: string | null; approval_status: string } | null };
type View = "requests" | "offers" | "services" | "visibility";

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
  const [services, setServices] = useState<SellerService[]>([]);
  const [featured, setFeatured] = useState<FeaturedWorkspace>({ is_featured: false, featured_until: null, packages: {} });
  const [profile, setProfile] = useState<ProfileWorkspace>({ categories: [], profile: null });
  const [view, setView] = useState<View>("requests");
  const [filter, setFilter] = useState<"all" | "unlocked">("all");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [offerRequest, setOfferRequest] = useState<number | null>(null);
  const [editingOffer, setEditingOffer] = useState<number | null>(null);
  const [price, setPrice] = useState("");
  const [message, setMessage] = useState("");
  const [serviceForm, setServiceForm] = useState({ id: 0, category_id: "", title: "", description: "", price_from: "", delivery_time: "", is_active: true });
  const [showServiceForm, setShowServiceForm] = useState(false);
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

  const visibleRequests = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("tr-TR");
    if (!needle) return requests;
    return requests.filter((item) => [item.title, item.reference, item.category.name, item.location.city.name, item.location.district.name].some((value) => value.toLocaleLowerCase("tr-TR").includes(needle)));
  }, [requests, search]);
  const offerByRequest = useMemo(() => new Map(offers.map((item) => [item.offer.request_id, item.offer])), [offers]);
  const acceptedOffers = offers.filter((item) => item.offer.status === "accepted").length;
  const successRate = offers.length ? Math.round((acceptedOffers / offers.length) * 100) : 0;

  const openOffer = (requestId: number, offer?: Offer) => {
    setOfferRequest(requestId); setEditingOffer(offer?.id ?? null); setPrice(offer?.price ?? ""); setMessage(offer?.message ?? ""); setError("");
  };

  const submitOffer = async (requestId: number) => {
    setBusy(true); setError(""); setNotice("");
    try {
      const updating = editingOffer !== null;
      const response = await apiRequest<{ message: string }>(updating ? `/seller/offers/${editingOffer}` : "/seller/offers", {
        method: updating ? "PUT" : "POST", body: JSON.stringify({ ...(updating ? {} : { request_id: requestId }), price, message }),
      });
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
      const response = await apiRequest<{ message: string }>(updating ? `/seller/services/${serviceForm.id}` : "/seller/services", {
        method: updating ? "PUT" : "POST",
        body: JSON.stringify({ ...serviceForm, category_id: Number(serviceForm.category_id), price_from: serviceForm.price_from || null }),
      });
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
    <header className={styles.topbar}><div className={styles.topbarInner}><Link className={styles.brand} href="/">alıcam<span>.net</span></Link><nav><Link href="/">Ana sayfa</Link><button className={view === "requests" ? styles.active : ""} onClick={() => setView("requests")}>Gelen talepler</button><button className={view === "offers" ? styles.active : ""} onClick={() => setView("offers")}>Tekliflerim</button><button className={view === "services" ? styles.active : ""} onClick={() => setView("services")}>Hizmetlerim</button></nav><div><Link className={styles.creditPill} href="/kontor-yukle">⚡ {credits.balance} kontör</Link><span className={styles.avatar}>{user?.name.slice(0, 2).toLocaleUpperCase("tr-TR")}</span></div></div></header>
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <span>TALEP YÖNETİMİ</span><button className={view === "requests" ? styles.active : ""} onClick={() => setView("requests")}><i>📥</i> Gelen talepler <b>{requests.length}</b></button><button onClick={() => { setView("requests"); setFilter("unlocked"); }}><i>🔓</i> Açtıklarım</button><button className={view === "offers" ? styles.active : ""} onClick={() => setView("offers")}><i>📨</i> Tekliflerim <b>{offers.length}</b></button>
        <span>FİRMA</span><button className={view === "services" ? styles.active : ""} onClick={() => setView("services")}><i>▦</i> Hizmetlerim <b>{services.length}</b></button><Link href="/satici-ol"><i>🏢</i> Firma profilim</Link><button className={view === "visibility" ? styles.active : ""} onClick={() => setView("visibility")}><i>★</i> Öne çık</button>
        <div className={styles.creditCard}><span>KONTÖR BAKİYEN</span><strong>{credits.balance}</strong><p>Teklif vermek ve vitrinde öne çıkmak için kullanılır.</p><Link href="/kontor-yukle">Kontör yükle</Link></div>
      </aside>

      <section className={styles.content}>
        <header className={styles.pageHead}><div><span>HİZMET VEREN MERKEZİ</span><h1>{profile.profile?.company_name || user?.name}</h1><p>Talep akışını, teklif performansını, hizmetlerini ve görünürlüğünü yönet.</p></div>{featured.is_featured ? <b className={styles.featuredBadge}>★ Öne çıkan profil</b> : <button onClick={() => setView("visibility")}>Vitrinde öne çık →</button>}</header>
        <section className={styles.stats}><article><i>📥</i><div><strong>{requests.length}</strong><span>eşleşen talep</span></div><b>canlı</b></article><article><i>📨</i><div><strong>{offers.length}</strong><span>verilen teklif</span></div><b>toplam</b></article><article><i>✓</i><div><strong>%{successRate}</strong><span>kabul oranı</span></div><b>{acceptedOffers} iş</b></article><article><i>⚡</i><div><strong>{credits.balance}</strong><span>kontör bakiyesi</span></div><Link href="/kontor-yukle">yükle</Link></article></section>
        {notice && <p className={styles.notice}>✓ {notice}</p>}{error && <p className={styles.error}>{error}</p>}

        {view === "requests" && <>
          <section className={styles.performance}><div><header><span>TEKLİF PERFORMANSI</span><b>Son hareketler</b></header><div className={styles.bars}>{[38, 55, 44, 72, 64, Math.max(28, Math.min(92, 35 + offers.length * 6))].map((height, index) => <i key={index} style={{ height: `${height}%` }}><small>{index + 1}. hf</small></i>)}</div></div><aside><span>BU AYIN ODAĞI</span><strong>{visibleRequests.length}</strong><p>uzmanlığın ve hizmet bölgenle eşleşen aktif fırsat</p><button onClick={() => setFilter(filter === "all" ? "unlocked" : "all")}>{filter === "all" ? "Açtıklarımı göster" : "Tümünü göster"}</button></aside></section>
          <div className={styles.toolbar}><label>⌕<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Talep no, başlık veya konum ara…" /></label><button className={filter === "all" ? styles.active : ""} onClick={() => setFilter("all")}>Tüm talepler</button><button className={filter === "unlocked" ? styles.active : ""} onClick={() => setFilter("unlocked")}>Açtıklarım</button><span>En yeni fırsatlar</span></div>
          <div className={styles.requestList}>{visibleRequests.length === 0 ? <div className={styles.empty}>Bu filtrede eşleşen talep bulunmuyor.</div> : visibleRequests.map((item) => {
            const existingOffer = offerByRequest.get(item.id);
            return <article className={`${styles.requestCard} ${item.is_unlocked ? styles.unlocked : ""}`} key={item.id}>
              <header><div><span style={{ color: item.category.color, background: `${item.category.color}12` }}>{item.category.icon} {item.category.name}</span><small><i /> {date(item.created_at)}</small></div><b>{item.is_unlocked ? "🔓 Açıldı" : `${item.unlock_cost} kontör`}</b></header><h2>{item.title}</h2><p>{item.summary}</p><div className={styles.attributes}>{item.summary_attributes.map((attribute) => <span key={attribute.key}>{attribute.label}: <b>{attributeValue(attribute)}</b></span>)}</div>
              <footer><div><span>⌖ <b>{item.location.district.name}, {item.location.city.name}</b></span><span>№ <b>{item.reference}</b></span></div><aside><strong>{money(item.budget.min)} – {money(item.budget.max)}</strong>{item.is_unlocked && <button onClick={() => setExpanded(expanded === item.id ? null : item.id)}>{expanded === item.id ? "Kapat" : "Detay"}</button>}{existingOffer ? <button className={styles.sent} onClick={() => setView("offers")}>{statusLabel[existingOffer.status]}</button> : <button onClick={() => openOffer(item.id)}>{item.is_unlocked ? "Teklif ver" : "Aç ve teklif ver"} →</button>}</aside></footer>
              {offerRequest === item.id && !existingOffer && <div className={styles.offerForm}><div><span>TEKLİFİNİ HAZIRLA</span><strong>{item.is_unlocked ? "Bu talep daha önce açıldı; ek kontör düşmez." : `${item.unlock_cost} kontör teklif gönderildiğinde düşer.`}</strong></div><label>Fiyat<input inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} placeholder="Örn. 12500" /></label><label>Teklif notu<textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Kapsamı ve teslim süresini açıkla…" /></label><aside><button onClick={() => setOfferRequest(null)}>Vazgeç</button><button disabled={busy} onClick={() => submitOffer(item.id)}>{busy ? "Gönderiliyor…" : "Teklifi gönder"}</button></aside></div>}
              {expanded === item.id && item.details && <div className={styles.details}><section><span>TALEP DETAYI</span><p>{item.details.description}</p><div>{item.details.attributes.map((attribute) => <p key={attribute.key}><small>{attribute.label}</small><strong>{attributeValue(attribute)}</strong></p>)}</div></section><aside><span>İLETİŞİM VE ADRES</span><strong>{item.details.contact.name}</strong><a href={`tel:${item.details.contact.phone}`}>{item.details.contact.phone}</a><a href={`mailto:${item.details.contact.email}`}>{item.details.contact.email}</a><p>{item.details.full_address || "Açık adres belirtilmedi"}</p></aside></div>}
              {!item.is_unlocked && expanded === item.id && <div className={styles.unlock}><span>İletişim detayını teklif vermeden aç</span><button disabled={busy} onClick={() => unlock(item)}>{item.unlock_cost} kontörle aç</button></div>}
            </article>;
          })}</div>
        </>}

        {view === "offers" && <section className={styles.workspaceView}><header><div><span>TEKLİF PORTFÖYÜ</span><h2>Tekliflerim</h2><p>Gönderdiğin teklifleri ve sonuçlarını takip et.</p></div><button onClick={() => setView("requests")}>Yeni fırsat bul →</button></header><div className={styles.offerList}>{offers.length === 0 ? <div className={styles.empty}>Henüz teklif göndermedin.</div> : offers.map(({ offer, request: item }) => <article key={offer.id}><header><span style={{ color: item.category.color, background: `${item.category.color}12` }}>{item.category.icon} {item.category.name}</span><b className={styles[offer.status]}>{statusLabel[offer.status]}</b></header><h3>{item.title}</h3><small>{item.reference} · {item.location.district.name}, {item.location.city.name}</small><div><strong>{money(offer.price)}</strong><p>{offer.message}</p></div><footer><span>{date(offer.created_at)}</span>{offer.status === "pending" && <button onClick={() => openOffer(item.id, offer)}>Teklifi düzenle</button>}</footer>{offerRequest === item.id && editingOffer === offer.id && <div className={styles.offerForm}><label>Fiyat<input value={price} onChange={(event) => setPrice(event.target.value)} /></label><label>Teklif notu<textarea value={message} onChange={(event) => setMessage(event.target.value)} /></label><aside><button onClick={() => setOfferRequest(null)}>Vazgeç</button><button disabled={busy} onClick={() => submitOffer(item.id)}>Güncelle</button></aside></div>}</article>)}</div></section>}

        {view === "services" && <section className={styles.workspaceView}><header><div><span>HİZMET KATALOĞU</span><h2>Vereceğin hizmetler</h2><p>Müşterilere hangi işleri, hangi başlangıç fiyatıyla sunduğunu göster.</p></div><button onClick={() => editService()}>＋ Hizmet ekle</button></header>{showServiceForm && <div className={styles.serviceForm}><label>Kategori<select value={serviceForm.category_id} onChange={(event) => setServiceForm({ ...serviceForm, category_id: event.target.value })}>{profile.categories.map((item) => <option key={item.id} value={item.id}>{item.icon} {item.name}</option>)}</select></label><label>Hizmet başlığı<input value={serviceForm.title} onChange={(event) => setServiceForm({ ...serviceForm, title: event.target.value })} placeholder="Örn. Anahtar teslim banyo yenileme" /></label><label className={styles.wide}>Açıklama<textarea value={serviceForm.description} onChange={(event) => setServiceForm({ ...serviceForm, description: event.target.value })} placeholder="Hizmet kapsamını, dahil olan işleri ve çalışma biçimini anlat…" /></label><label>Başlangıç fiyatı<input inputMode="decimal" value={serviceForm.price_from} onChange={(event) => setServiceForm({ ...serviceForm, price_from: event.target.value })} placeholder="Örn. 5000" /></label><label>Teslim süresi<input value={serviceForm.delivery_time} onChange={(event) => setServiceForm({ ...serviceForm, delivery_time: event.target.value })} placeholder="Örn. 3–5 gün" /></label><label className={styles.toggle}><input type="checkbox" checked={serviceForm.is_active} onChange={(event) => setServiceForm({ ...serviceForm, is_active: event.target.checked })} /> Yayında</label><aside><button onClick={() => setShowServiceForm(false)}>Vazgeç</button><button disabled={busy} onClick={submitService}>{busy ? "Kaydediliyor…" : "Hizmeti kaydet"}</button></aside></div>}
          <div className={styles.serviceGrid}>{services.length === 0 ? <div className={styles.empty}>Henüz hizmet eklemedin. İlk hizmetini oluşturarak profilini güçlendir.</div> : services.map((service) => <article key={service.id}><header><span style={{ color: service.category.color, background: `${service.category.color}12` }}>{service.category.icon}</span><div><small>{service.category.name}</small><b className={service.is_active ? styles.live : ""}>{service.is_active ? "Yayında" : "Gizli"}</b></div></header><h3>{service.title}</h3><p>{service.description}</p><div><span><small>BAŞLAYAN FİYAT</small><strong>{service.price_from ? money(service.price_from) : "Teklif alın"}</strong></span><span><small>TESLİM</small><strong>{service.delivery_time || "Planlanır"}</strong></span></div><footer><button onClick={() => editService(service)}>Düzenle</button><button onClick={() => deleteService(service.id)}>Kaldır</button></footer></article>)}</div>
        </section>}

        {view === "visibility" && <section className={styles.workspaceView}><header><div><span>VİTRİN VE GÖRÜNÜRLÜK</span><h2>Öne çıkanlarda yer al</h2><p>Profilini ana sayfadaki öne çıkan profesyoneller bölümüne taşı.</p></div>{featured.is_featured && <b className={styles.featuredBadge}>★ {featured.featured_until ? new Date(featured.featured_until).toLocaleDateString("tr-TR") : "Aktif"} tarihine kadar</b>}</header><div className={styles.visibilityHero}><div><span>KONTÖRLE GÖRÜNÜRLÜK</span><h3>Daha çok müşteri tarafından keşfedil.</h3><p>Öne çıkarılan profiller ana sayfa vitrininde “Öne Çıkan” etiketiyle gösterilir. Sıralamada gerçek müşteri puanı ve değerlendirme sayısı korunur.</p><ul><li>✓ Ana sayfa profesyonel vitrini</li><li>✓ Sponsorlu ibaresiyle şeffaf gösterim</li><li>✓ Hizmetlerinin ve puanının öne çıkarılması</li></ul></div><aside><small>MEVCUT BAKİYE</small><strong>⚡ {credits.balance}</strong><Link href="/kontor-yukle">Kontör yükle →</Link></aside></div><div className={styles.packageGrid}>{Object.entries(featured.packages).map(([key, item], index) => <article className={index === 1 ? styles.popular : ""} key={key}>{index === 1 && <b>EN AVANTAJLI</b>}<span>{item.label.toUpperCase()}</span><strong>{item.credits}<small> kontör</small></strong><p>{item.days} gün boyunca vitrin görünürlüğü</p><button disabled={busy || credits.balance < item.credits} onClick={() => buyPromotion(key)}>{credits.balance < item.credits ? "Bakiye yetersiz" : "Paketi etkinleştir"}</button></article>)}</div>
          <section className={styles.ledger}><header><div><span>HESAP HAREKETLERİ</span><h3>Kontör geçmişi</h3></div><Link href="/kontor-yukle">Kontör yükle →</Link></header>{credits.transactions.length === 0 ? <p>Henüz kontör hareketi bulunmuyor.</p> : credits.transactions.map((transaction) => <div key={transaction.id}><i className={transaction.amount < 0 ? styles.spend : ""}>{transaction.amount < 0 ? "−" : "+"}</i><p><strong>{transaction.reference_type === "seller_promotion" ? "Vitrinde öne çıkarma" : transaction.type === "spend" ? "Talep açma bedeli" : transaction.type === "bonus" ? "Paket bonusu" : "Kontör yükleme"}</strong><small>{transaction.metadata?.public_reference ?? transaction.metadata?.merchant_oid ?? (transaction.metadata?.days ? `${transaction.metadata.days} gün` : "Hesap hareketi")} · {date(transaction.created_at)}</small></p><b>{transaction.amount > 0 ? "+" : ""}{transaction.amount}<small>kalan {transaction.balance_after}</small></b></div>)}</section>
        </section>}
      </section>
    </div>
  </main>;
}
