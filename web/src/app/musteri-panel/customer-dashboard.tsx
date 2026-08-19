"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, apiRequest, firstApiError } from "@/lib/api";
import styles from "./musteri-panel.module.css";

type User = { id: number; name: string; email: string; phone: string; roles: string[] };
type BuyerRequest = {
  id: number; reference: string; title: string; description: string; status: string; offer_count: number;
  budget: { min: string; max: string }; category: { name: string; icon: string; color: string };
  location: { city: { name: string }; district: { name: string } }; created_at: string; expires_at: string | null;
};
type Offer = {
  id: number; request_id: number; price: string; message: string; status: string; created_at: string;
  review?: { rating: number; comment: string | null; created_at: string } | null;
  seller: { name: string; company_name: string | null; profile_type: string | null; description: string | null; contact?: { email: string; phone: string } };
};

const money = (value: string) => new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(Number(value));
const date = (value: string) => new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium" }).format(new Date(value));
const status: Record<string, string> = { open: "Yayında", in_negotiation: "Teklif alıyor", accepted: "Anlaşma sağlandı", cancelled: "İptal edildi" };
const offerStatus: Record<string, string> = { pending: "Değerlendiriliyor", accepted: "Kabul edildi", rejected: "Reddedildi" };

export function CustomerDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [requests, setRequests] = useState<BuyerRequest[]>([]);
  const [offers, setOffers] = useState<Record<number, Offer[]>>({});
  const [expanded, setExpanded] = useState<number | null>(null);
  const [filter, setFilter] = useState<"all" | "active" | "completed">("all");
  const [busy, setBusy] = useState<number | null>(null);
  const [reviewOffer, setReviewOffer] = useState<number | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const loadRequests = async () => {
    const response = await apiRequest<{ data: BuyerRequest[] }>("/requests/mine");
    setRequests(response.data);
  };

  const loadOffers = async (requestId: number) => {
    const response = await apiRequest<{ data: Offer[] }>(`/requests/${requestId}/offers`);
    setOffers((current) => ({ ...current, [requestId]: response.data }));
  };

  useEffect(() => {
    let active = true;
    Promise.all([apiRequest<{ data: User }>("/me"), apiRequest<{ data: BuyerRequest[] }>("/requests/mine")])
      .then(([userResponse, requestResponse]) => { if (active) { setUser(userResponse.data); setRequests(requestResponse.data); } })
      .catch((requestError: unknown) => {
        if (!active) return;
        if (requestError instanceof ApiError && requestError.status === 401) return router.replace("/giris?devam=%2Fmusteri-panel");
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

  const toggleOffers = async (item: BuyerRequest) => {
    if (expanded === item.id) return setExpanded(null);
    setExpanded(item.id); setError("");
    try { await loadOffers(item.id); } catch (requestError: unknown) { setError(firstApiError(requestError)); }
  };

  const decide = async (offer: Offer, decision: "accepted" | "rejected") => {
    setBusy(offer.id); setError(""); setNotice("");
    try {
      const response = await apiRequest<{ message: string }>(`/offers/${offer.id}`, { method: "PATCH", body: JSON.stringify({ decision }) });
      await Promise.all([loadOffers(offer.request_id), loadRequests()]);
      setNotice(response.message);
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

  const submitReview = async (offer: Offer) => {
    setBusy(offer.id); setError(""); setNotice("");
    try {
      const response = await apiRequest<{ message: string }>(`/offers/${offer.id}/review`, {
        method: "POST", body: JSON.stringify({ rating, comment: comment.trim() || null }),
      });
      await loadOffers(offer.request_id); setReviewOffer(null); setComment(""); setRating(5); setNotice(response.message);
    } catch (requestError: unknown) { setError(firstApiError(requestError)); }
    finally { setBusy(null); }
  };

  if (loading) return <main className={styles.loading}><i /><p>Müşteri çalışma alanın hazırlanıyor…</p></main>;

  const activeCount = requests.filter((item) => ["open", "in_negotiation"].includes(item.status)).length;
  const acceptedCount = requests.filter((item) => item.status === "accepted").length;
  const totalOffers = requests.reduce((sum, item) => sum + item.offer_count, 0);

  return <main className={styles.page}>
    <aside className={styles.sidebar}>
      <Link className={styles.brand} href="/">alıcam<span>.net</span></Link>
      <div className={styles.workspace}><span>MÜŞTERİ ÇALIŞMA ALANI</span><strong>Talep merkezi</strong></div>
      <nav><a className={styles.active} href="#ozet"><i>⌂</i> Genel bakış</a><a href="#taleplerim"><i>▤</i> Taleplerim <b>{requests.length}</b></a><Link href="/talep-olustur"><i>＋</i> Yeni talep</Link><a href="#hesabim"><i>◎</i> Hesabım</a></nav>
      <div className={styles.sideHelp}><span>DAHA İYİ TEKLİFLER</span><p>Talebini doğru anlatmak, doğru profesyonellere daha hızlı ulaşmanı sağlar.</p><Link href="/talep-olustur">Yeni talep oluştur →</Link></div>
      <div className={styles.sideAccount}><span>{user?.name.slice(0, 2).toLocaleUpperCase("tr-TR")}</span><div><strong>{user?.name}</strong><small>{user?.email}</small></div></div>
    </aside>

    <section className={styles.content}>
      <header className={styles.topbar}><div><span>Güvenli pazar yeri</span><b>•</b><small>İletişim bilgilerin yalnızca kabul ettiğin hizmet verene açılır.</small></div><div><Link href="/">Pazaryerine dön</Link><Link className={styles.newButton} href="/talep-olustur">＋ Yeni talep</Link></div></header>
      <div className={styles.canvas} id="ozet">
        <section className={styles.welcome}><div><span>BUGÜNÜN ÖZETİ</span><h1>Merhaba {user?.name.split(" ")[0]},<br /><em>doğru teklifi birlikte seçelim.</em></h1><p>Taleplerindeki hareketleri, gelen teklifleri ve tamamlanan işleri tek ekrandan yönet.</p></div><aside><span>AKTİF TALEPLER</span><strong>{activeCount}</strong><p>{totalOffers} teklif karşılaştırılmayı bekliyor</p><a href="#taleplerim">Taleplere git ↓</a></aside></section>

        <section className={styles.metrics}>
          <article><i>▤</i><div><span>TOPLAM TALEP</span><strong>{requests.length}</strong><small>oluşturduğun tüm talepler</small></div></article>
          <article><i>↗</i><div><span>GELEN TEKLİF</span><strong>{totalOffers}</strong><small>profesyonellerden</small></div></article>
          <article><i>✓</i><div><span>ANLAŞMA</span><strong>{acceptedCount}</strong><small>kabul edilen hizmet</small></div></article>
          <article><i>◷</i><div><span>YANIT ORANI</span><strong>%{requests.length ? Math.min(100, Math.round((requests.filter((item) => item.offer_count > 0).length / requests.length) * 100)) : 0}</strong><small>teklif alan talepler</small></div></article>
        </section>

        <section className={styles.mainGrid} id="taleplerim">
          <div className={styles.requestsArea}>
            <header className={styles.sectionHead}><div><span>TALEP PORTFÖYÜ</span><h2>Taleplerim</h2></div><div>{(["all", "active", "completed"] as const).map((value) => <button key={value} className={filter === value ? styles.selected : ""} onClick={() => setFilter(value)}>{value === "all" ? "Tümü" : value === "active" ? "Aktif" : "Sonuçlanan"}</button>)}</div></header>
            {notice && <p className={styles.notice}>✓ {notice}</p>}{error && <p className={styles.error}>{error}</p>}
            <div className={styles.requestList}>{visibleRequests.length === 0 ? <div className={styles.empty}><span>◇</span><h3>Bu görünümde talep yok.</h3><Link href="/talep-olustur">Yeni talep oluştur →</Link></div> : visibleRequests.map((item) => <article className={styles.requestCard} key={item.id}>
              <header><div><span style={{ color: item.category.color, background: `${item.category.color}12` }}>{item.category.icon}</span><p><small>{item.category.name} · {item.reference}</small><strong>{item.title}</strong></p></div><b className={styles[item.status]}><i />{status[item.status] ?? item.status}</b></header>
              <p>{item.description}</p>
              <div className={styles.requestMeta}><span>⌖ <b>{item.location.district.name}, {item.location.city.name}</b></span><span>₺ <b>{money(item.budget.min)} – {money(item.budget.max)}</b></span><span>◷ <b>{date(item.created_at)}</b></span></div>
              <div className={styles.progress}><span className={styles.done}>Talep yayınlandı</span><i /><span className={item.offer_count ? styles.done : ""}>{item.offer_count} teklif geldi</span><i /><span className={item.status === "accepted" ? styles.done : ""}>Hizmet veren seçildi</span></div>
              <footer><p><strong>{item.offer_count}</strong><span>gelen teklif</span></p><div><button onClick={() => toggleOffers(item)}>{expanded === item.id ? "Teklifleri kapat" : "Teklifleri karşılaştır"} →</button>{["open", "in_negotiation"].includes(item.status) && <button className={styles.ghost} disabled={busy === -item.id} onClick={() => cancel(item)}>Talebi iptal et</button>}</div></footer>
              {expanded === item.id && <div className={styles.offers}><header><span>TEKLİF KARŞILAŞTIRMA</span><b>{offers[item.id]?.length ?? 0} profesyonel</b></header>{(offers[item.id] ?? []).length === 0 ? <p className={styles.noOffer}>Henüz teklif gelmedi. Talebin uygun profesyonellere gösteriliyor.</p> : <div className={styles.offerGrid}>{offers[item.id].map((offer) => <article className={`${styles.offer} ${styles[offer.status]}`} key={offer.id}>
                <header><span>{(offer.seller.company_name || offer.seller.name).slice(0, 2).toLocaleUpperCase("tr-TR")}</span><div><strong>{offer.seller.company_name || offer.seller.name}</strong><small>✓ Doğrulanmış hizmet veren</small></div><b>{offerStatus[offer.status]}</b></header><p>{offer.message}</p><strong className={styles.offerPrice}>{money(offer.price)}</strong>
                {offer.status === "pending" && <footer><button onClick={() => decide(offer, "rejected")}>Reddet</button><button className={styles.accept} onClick={() => decide(offer, "accepted")}>{busy === offer.id ? "İşleniyor…" : "Kabul et"}</button></footer>}
                {offer.status === "accepted" && <div className={styles.acceptedInfo}>{offer.seller.contact && <p><a href={`tel:${offer.seller.contact.phone}`}>{offer.seller.contact.phone}</a><a href={`mailto:${offer.seller.contact.email}`}>{offer.seller.contact.email}</a></p>}{offer.review ? <div className={styles.reviewDone}><strong>{"★".repeat(offer.review.rating)}{"☆".repeat(5 - offer.review.rating)}</strong><span>{offer.review.comment || "Değerlendirildi"}</span></div> : <button onClick={() => setReviewOffer(reviewOffer === offer.id ? null : offer.id)}>Hizmeti değerlendir ★</button>}</div>}
                {reviewOffer === offer.id && !offer.review && <div className={styles.reviewForm}><div>{[1, 2, 3, 4, 5].map((value) => <button className={value <= rating ? styles.starActive : ""} key={value} onClick={() => setRating(value)}>★</button>)}</div><textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Deneyimini kısaca anlat…"/><button onClick={() => submitReview(offer)} disabled={busy === offer.id}>Değerlendirmeyi yayınla</button></div>}
              </article>)}</div>}</div>}
            </article>)}</div>
          </div>
          <aside className={styles.rightRail}>
            <section><span>AKILLI İPUCU</span><h3>Daha fazla teklif almak için</h3><ul><li><b>1</b>Başlığı net ve sonuç odaklı yaz</li><li><b>2</b>Bütçe aralığını gerçekçi tut</li><li><b>3</b>İş kapsamını ayrıntılandır</li></ul><Link href="/talep-olustur">Yeni talep oluştur →</Link></section>
            <section id="hesabim"><span>HESAP GÜVENLİĞİ</span><h3>İletişim doğrulandı</h3><p><b>✓</b> E-posta: {user?.email}</p><p><b>✓</b> Telefon: {user?.phone}</p><small>Bilgilerin teklifler kabul edilene kadar gizli kalır.</small></section>
            <section className={styles.marketLink}><span>YENİ FIRSATLAR</span><h3>Hizmet verenleri ve güncel talepleri keşfet.</h3><Link href="/">Pazaryerine git ↗</Link></section>
          </aside>
        </section>
      </div>
    </section>
  </main>;
}
