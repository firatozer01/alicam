"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AccountMenu } from "@/components/account-menu";
import { NavMenuBar } from "@/components/listing/nav-menu";
import { Modal } from "@/components/modal/modal";
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
  seller: { id: number; name: string; company_name: string | null; profile_type: string | null; description: string | null; contact?: { email: string; phone: string } };
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
  const [compareRequest, setCompareRequest] = useState<BuyerRequest | null>(null);
  const [section, setSection] = useState("ozet");
  const jump = (id: string) => { setSection(id); document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }); };
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
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

  const visibleRequests = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("tr-TR");
    return requests.filter((item) => {
      if (filter === "active" && !["open", "in_negotiation"].includes(item.status)) return false;
      if (filter === "completed" && !["accepted", "cancelled"].includes(item.status)) return false;
      if (categoryFilter && item.category.name !== categoryFilter) return false;
      if (!needle) return true;
      return [item.title, item.reference, item.category.name, item.location.city.name, item.location.district.name]
        .some((value) => value.toLocaleLowerCase("tr-TR").includes(needle));
    });
  }, [categoryFilter, filter, requests, search]);

  const requestCategories = useMemo(
    () => Array.from(new Map(requests.map((item) => [item.category.name, item.category])).values()),
    [requests],
  );

  const openCompare = async (item: BuyerRequest) => {
    setCompareRequest(item); setError("");
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
    <header className={styles.shellBar}><div className={styles.shellInner}>
      <Link className={styles.brand} href="/">alıcam<span>.net</span></Link>
      <nav className={styles.shellNav}>
        <NavMenuBar activeKey={section} menus={[
          {
            key: "panel", label: "Panelim",
            panelIcon: "◇", panelTitle: "Müşteri panelin", panelHint: "Taleplerin, gelen teklifler ve hesabın",
            meta: `${requests.length} talep · ${totalOffers} teklif`,
            sections: [
              { key: "flow", title: "TALEPLERİM", icon: "▤", color: "#7C3AED", description: "Yayınladığın talepler ve gelen teklifler.", items: [
                { key: "ozet", label: "Genel bakış", icon: "⌂", hint: "Özet ve metrikler", onSelect: () => jump("ozet") },
                { key: "taleplerim", label: "Taleplerim", icon: "▤", hint: `${activeCount} aktif talep`, count: requests.length, onSelect: () => jump("taleplerim") },
                { key: "yeni", label: "Yeni talep oluştur", icon: "＋", hint: "Ücretsiz teklif almaya başla", badge: "Ücretsiz", tone: "free", href: "/talep-olustur" },
              ], footer: { label: "Taleplere git", onSelect: () => jump("taleplerim") } },
              { key: "discover", title: "KEŞFET", icon: "🏬", color: "#06B6D4", description: "Hizmet verenleri incele, hesabını yönet.", items: [
                { key: "hizmet-verenler", label: "Hizmet verenler", icon: "🏬", hint: "Vitrin, galeri ve puanlar", badge: "Yeni", tone: "new", href: "/hizmet-verenler" },
                { key: "hesabim", label: "Hesabım", icon: "◎", hint: "İletişim doğrulaması ve güvenlik", onSelect: () => jump("hesabim") },
              ], footer: { label: "Hizmet verenleri gör", href: "/hizmet-verenler" } },
            ],
            quickLinks: [
              { key: "market", label: "Pazaryeri", icon: "🛒", href: "/" },
              { key: "new", label: "Yeni talep oluştur", icon: "＋", href: "/talep-olustur", primary: true },
            ],
          },
        ]}><Link href="/">Ana sayfa</Link><Link href="/hizmet-verenler">Hizmet verenler</Link></NavMenuBar>
      </nav>
      <div className={styles.shellActions}><Link className={styles.newButton} href="/talep-olustur">＋ Yeni talep</Link>{user && <AccountMenu compact user={user} workspace="buyer" />}</div>
    </div></header>

    <section className={styles.content}>
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
            <div className={styles.searchRow}>
              <label>⌕<input onChange={(event) => setSearch(event.target.value)} placeholder="Talep başlığı, referans veya konum ara…" value={search} /></label>
              {requestCategories.length > 1 && <select onChange={(event) => setCategoryFilter(event.target.value)} value={categoryFilter}>
                <option value="">Tüm kategoriler</option>
                {requestCategories.map((item) => <option key={item.name} value={item.name}>{item.icon} {item.name}</option>)}
              </select>}
            </div>

            <div className={styles.requestList}>{visibleRequests.length === 0 ? <div className={styles.empty}><span>◇</span><h3>{requests.length === 0 ? "Henüz talep oluşturmadın." : "Bu filtrede talep yok."}</h3><Link href="/talep-olustur">Yeni talep oluştur →</Link></div> : visibleRequests.map((item) => <article className={styles.requestCard} key={item.id}>
              <header><div><span style={{ color: item.category.color, background: `${item.category.color}12` }}>{item.category.icon}</span><p><small>{item.category.name} · {item.reference}</small><strong>{item.title}</strong></p></div><b className={styles[item.status]}><i />{status[item.status] ?? item.status}</b></header>
              <p>{item.description}</p>
              <div className={styles.requestMeta}><span>⌖ <b>{item.location.district.name}, {item.location.city.name}</b></span><span>₺ <b>{money(item.budget.min)} – {money(item.budget.max)}</b></span><span>◷ <b>{date(item.created_at)}</b></span></div>
              <div className={styles.progress}><span className={styles.done}>Talep yayınlandı</span><i /><span className={item.offer_count ? styles.done : ""}>{item.offer_count} teklif geldi</span><i /><span className={item.status === "accepted" ? styles.done : ""}>Hizmet veren seçildi</span></div>
              <footer><p><strong>{item.offer_count}</strong><span>gelen teklif</span></p><div><button disabled={item.offer_count === 0} onClick={() => openCompare(item)}>{item.offer_count === 0 ? "Teklif bekleniyor" : "Teklifleri karşılaştır →"}</button>{["open", "in_negotiation"].includes(item.status) && <button className={styles.ghost} disabled={busy === -item.id} onClick={() => cancel(item)}>Talebi iptal et</button>}</div></footer>
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
    {compareRequest && <Modal
      onClose={() => { setCompareRequest(null); setReviewOffer(null); }}
      open
      size="xl"
      subtitle={`${compareRequest.category.name} · ${compareRequest.location.district.name}, ${compareRequest.location.city.name} · bütçe ${money(compareRequest.budget.min)} – ${money(compareRequest.budget.max)}`}
      title={compareRequest.title}
    >
      {(() => {
        const rows = offers[compareRequest.id] ?? [];
        if (rows.length === 0) return <p className={styles.noOffer}>Henüz teklif gelmedi. Talebin uygun profesyonellere gösteriliyor.</p>;
        const prices = rows.map((row) => Number(row.price));
        const lowest = Math.min(...prices);
        const highest = Math.max(...prices);
        const average = prices.reduce((total, value) => total + value, 0) / prices.length;
        return <>
          <div className={styles.compareStats}>
            <div><span>GELEN TEKLİF</span><strong>{rows.length}</strong></div>
            <div><span>EN DÜŞÜK</span><strong>{money(String(lowest))}</strong></div>
            <div><span>ORTALAMA</span><strong>{money(String(average))}</strong></div>
            <div><span>EN YÜKSEK</span><strong>{money(String(highest))}</strong></div>
          </div>

          <div className={styles.offerGrid}>{rows.map((offer) => {
            const name = offer.seller.company_name || offer.seller.name;
            const initials = name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toLocaleUpperCase("tr-TR");
            const isLowest = Number(offer.price) === lowest && rows.length > 1;
            return <article className={`${styles.offer} ${styles[offer.status]}`} key={offer.id}>
              <header>
                <span>{initials}</span>
                <div><strong>{name}</strong><small>✓ Doğrulanmış hizmet veren</small></div>
                <b>{offerStatus[offer.status]}</b>
              </header>
              <Link className={styles.profileLink} href={`/satici/${offer.seller.id}`} target="_blank">Profili ve geçmiş işlerini gör ↗</Link>
              <p>{offer.message}</p>
              <div className={styles.priceRow}>
                <strong className={styles.offerPrice}>{money(offer.price)}</strong>
                {isLowest && <em className={styles.bestPrice}>EN DÜŞÜK TEKLİF</em>}
              </div>
              {offer.status === "pending" && <footer>
                <button disabled={busy === offer.id} onClick={() => decide(offer, "rejected")}>Reddet</button>
                <button className={styles.accept} disabled={busy === offer.id} onClick={() => decide(offer, "accepted")}>{busy === offer.id ? "İşleniyor…" : "Kabul et"}</button>
              </footer>}
              {offer.status === "accepted" && <div className={styles.acceptedInfo}>
                {offer.seller.contact && <p><a href={`tel:${offer.seller.contact.phone}`}>{offer.seller.contact.phone}</a><a href={`mailto:${offer.seller.contact.email}`}>{offer.seller.contact.email}</a></p>}
                {offer.review
                  ? <div className={styles.reviewDone}><strong>{"★".repeat(offer.review.rating)}{"☆".repeat(5 - offer.review.rating)}</strong><span>{offer.review.comment || "Değerlendirildi"}</span></div>
                  : <button onClick={() => setReviewOffer(reviewOffer === offer.id ? null : offer.id)}>Hizmeti değerlendir ★</button>}
              </div>}
              {reviewOffer === offer.id && !offer.review && <div className={styles.reviewForm}>
                <div>{[1, 2, 3, 4, 5].map((value) => <button className={value <= rating ? styles.starActive : ""} key={value} onClick={() => setRating(value)} type="button">★</button>)}</div>
                <textarea onChange={(event) => setComment(event.target.value)} placeholder="Deneyimini kısaca anlat…" value={comment} />
                <button disabled={busy === offer.id} onClick={() => submitReview(offer)} type="button">Değerlendirmeyi yayınla</button>
              </div>}
            </article>;
          })}</div>
        </>;
      })()}
    </Modal>}
  </main>;
}
