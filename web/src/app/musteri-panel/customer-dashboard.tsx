"use client";

import Link from "next/link";
import { type ChangeEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SiteHeader } from "@/components/shell/site-header";
import { Modal } from "@/components/modal/modal";
import { ApiError, apiRequest, apiUpload, firstApiError } from "@/lib/api";
import styles from "./musteri-panel.module.css";

type User = { id: number; name: string; email: string; phone: string; avatar_url: string | null; roles: string[] };
type Owner = { name: string | null; avatar_url: string | null };
type BuyerRequest = {
  id: number; reference: string; title: string; description: string; status: string; offer_count: number;
  owner?: Owner | null;
  budget: { min: string; max: string }; category: { name: string; icon: string; color: string };
  location: { city: { name: string }; district: { name: string } }; created_at: string; expires_at: string | null;
};
/** Ilan ozellik tablosunun tek satiri; deger kategoriye gore degisir. */
type ListingAttribute = { key: string; label: string; value: unknown; unit: string | null };
/**
 * Teklife iliktirilen urun. Bu blok teklif gonderildigi andaki ANLIK
 * GORUNTU: satici ilani sonradan duzenlese ya da silse bile alici neyi
 * teklif aldigini gormeye devam eder. Canli ilanin hala durup durmadigini
 * yalnizca is_available ve listing_id soyler.
 */
type OfferListing = {
  reference: string | null; title: string | null; price: string | null; cover_url: string | null;
  category: { id: number; name: string; slug: string; icon: string } | null;
  location: { city: string | null; district: string | null } | null;
  attributes: ListingAttribute[];
  is_available: boolean; listing_id: number | null;
};
type Offer = {
  id: number; request_id: number; price: string; message: string; status: string; created_at: string;
  review?: { rating: number; comment: string | null; created_at: string } | null;
  listing?: OfferListing | null;
  seller: { id: number; name: string; company_name: string | null; profile_type: string | null; description: string | null; avatar_url: string | null; logo_url: string | null; contact?: { email: string; phone: string } };
};

const money = (value: string) => new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(Number(value));
const date = (value: string) => new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium" }).format(new Date(value));
const status: Record<string, string> = { open: "Yayında", in_negotiation: "Teklif alıyor", accepted: "Anlaşma sağlandı", cancelled: "İptal edildi" };
const offerStatus: Record<string, string> = { pending: "Değerlendiriliyor", accepted: "Kabul edildi", rejected: "Reddedildi" };
const MAX_PHOTO = 4 * 1024 * 1024;

const initialsOf = (value: string) => value.trim().split(/\s+/).slice(0, 2).map((part) => part[0] ?? "").join("").toLocaleUpperCase("tr-TR");

/** Ozellik degerini tek satirlik metne cevirir; bos deger cip uretmez. */
const attributeText = (row: ListingAttribute): string => {
  const raw = Array.isArray(row.value) ? row.value.join(", ")
    : typeof row.value === "boolean" ? (row.value ? "Var" : "Yok")
      : typeof row.value === "number" ? new Intl.NumberFormat("tr-TR").format(row.value)
        : typeof row.value === "string" ? row.value.trim()
          : "";
  return raw && row.unit ? `${raw} ${row.unit}` : raw;
};

/**
 * Profil fotografi.
 *
 * /api/avatars/{id} girisli ve yetkili kisiye acik: API bir adres
 * vermediyse o fotografi gorme hakkimiz yok demektir, bu yuzden adres
 * uydurulmaz, bas harflere dusulur.
 */
function Photo({ className, name, url }: { className: string; name: string; url: string | null }) {
  return <span className={className} title={name || undefined}>{url
    // eslint-disable-next-line @next/next/no-img-element
    ? <img alt={name} loading="lazy" src={url} />
    : initialsOf(name) || "◎"}</span>;
}

/**
 * Teklife iliktirilen urun seridi.
 *
 * Teklif tutariyla karismamasi icin urun ayri bir cerceve icinde ve
 * kendi "urun fiyati" etiketiyle durur. Ilan yayindan kalkmis olsa bile
 * anlik goruntu gosterilmeye devam eder, yalnizca baglanti kapanir.
 */
function AttachedListing({ listing, sellerId }: { listing: OfferListing; sellerId: number }) {
  const place = [listing.location?.district, listing.location?.city].filter(Boolean).join(", ");
  const chips = listing.attributes.filter((row) => attributeText(row) !== "").slice(0, 3);
  const canOpen = listing.is_available && listing.listing_id !== null;

  const body = <>
    <span className={styles.attachedLabel}>▦ TEKLİF EDİLEN ÜRÜN{canOpen && <b>Vitrinde gör ↗</b>}</span>
    <div className={styles.attachedBody}>
      <span className={styles.attachedCover}>{listing.cover_url
        // eslint-disable-next-line @next/next/no-img-element
        ? <img alt={listing.title ?? "Ürün görseli"} loading="lazy" src={listing.cover_url} />
        : <i>{listing.category?.icon ?? "▦"}</i>}</span>
      <div className={styles.attachedInfo}>
        <strong>{listing.title ?? "Ürün"}</strong>
        <small>{[listing.category?.name, place, listing.reference].filter(Boolean).join(" · ")}</small>
        {listing.price && <em className={styles.attachedPrice}><b>{money(listing.price)}</b><span>ürün fiyatı</span></em>}
        {chips.length > 0 && <ul className={styles.attachedChips}>
          {chips.map((row) => <li key={row.key}><b>{row.label}</b> {attributeText(row)}</li>)}
        </ul>}
      </div>
    </div>
    {!canOpen && <p className={styles.attachedGone}>◌ Bu ürün artık yayında değil</p>}
  </>;

  return canOpen
    ? <Link className={`${styles.attached} ${styles.attachedLink}`} href={`/satici/${sellerId}`} target="_blank">{body}</Link>
    : <section className={styles.attached}>{body}</section>;
}

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
  const [photoBusy, setPhotoBusy] = useState(false);
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

  // Fotograf degisince talep kartlarindaki kucuk resim de tazelensin diye
  // talepler yeniden okunur; adres zaten surum damgasi tasiyor.
  const uploadPhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > MAX_PHOTO) { setNotice(""); setError("Fotoğraf en fazla 4 MB olabilir."); return; }

    setPhotoBusy(true); setError(""); setNotice("");
    try {
      const response = await apiUpload<{ message: string; data: { avatar_url: string | null } }>("/avatar", file);
      setUser((current) => (current ? { ...current, avatar_url: response.data.avatar_url } : current));
      await loadRequests();
      setNotice(response.message);
    } catch (requestError: unknown) { setError(firstApiError(requestError)); }
    finally { setPhotoBusy(false); }
  };

  const removePhoto = async () => {
    setPhotoBusy(true); setError(""); setNotice("");
    try {
      const response = await apiRequest<{ message: string }>("/avatar", { method: "DELETE" });
      setUser((current) => (current ? { ...current, avatar_url: null } : current));
      await loadRequests();
      setNotice(response.message);
    } catch (requestError: unknown) { setError(firstApiError(requestError)); }
    finally { setPhotoBusy(false); }
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

  // Yukleme ekraninda da ortak ust cubuk durur; sayfa gecisinde zipla olmaz.
  if (loading) return <main className={styles.page}><SiteHeader workspace="buyer" /><div className={styles.loading}><i /><p>Alıcı çalışma alanın hazırlanıyor…</p></div></main>;

  const activeCount = requests.filter((item) => ["open", "in_negotiation"].includes(item.status)).length;
  const acceptedCount = requests.filter((item) => item.status === "accepted").length;
  const totalOffers = requests.reduce((sum, item) => sum + item.offer_count, 0);

  return <main className={styles.page}>
    <SiteHeader
      activeKey={section}
      cta={{ label: "＋ Yeni talep", href: "/talep-olustur" }}
      links={[{ label: "Ana sayfa", href: "/" }, { label: "Taleplerim", href: "/musteri-panel" }]}
      sessionReady={!!user}
      user={user}
      workspace="buyer"
      menus={[
          {
            key: "panel", label: "Panelim",
            panelIcon: "◇", panelTitle: "Alıcı panelin", panelHint: "Taleplerin, gelen teklifler ve hesabın",
            meta: `${requests.length} talep · ${totalOffers} teklif`,
            sections: [
              { key: "flow", title: "TALEPLERİM", icon: "▤", color: "#7C3AED", description: "Yayınladığın talepler ve gelen teklifler.", items: [
                { key: "ozet", label: "Genel bakış", icon: "⌂", hint: "Özet ve metrikler", onSelect: () => jump("ozet") },
                { key: "taleplerim", label: "Taleplerim", icon: "▤", hint: `${activeCount} aktif talep`, count: requests.length, onSelect: () => jump("taleplerim") },
                { key: "yeni", label: "Yeni talep oluştur", icon: "＋", hint: "Ücretsiz teklif almaya başla", badge: "Ücretsiz", tone: "free", href: "/talep-olustur" },
              ], footer: { label: "Taleplere git", onSelect: () => jump("taleplerim") } },
              { key: "discover", title: "KEŞFET", icon: "🏬", color: "#06B6D4", description: "Hizmet verenleri incele, hesabını yönet.", items: [
                { key: "hesabim", label: "Hesabım", icon: "◎", hint: "İletişim doğrulaması ve güvenlik", onSelect: () => jump("hesabim") },
              ] },
            ],
            quickLinks: [
              { key: "market", label: "Pazaryeri", icon: "🛒", href: "/" },
              { key: "new", label: "Yeni talep oluştur", icon: "＋", href: "/talep-olustur", primary: true },
            ],
          },
      ]}
    />

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
              <header><div><Photo className={styles.ownerPhoto} name={item.owner?.name ?? user?.name ?? ""} url={item.owner?.avatar_url ?? null} /><span style={{ color: item.category.color, background: `${item.category.color}12` }}>{item.category.icon}</span><p><small>{item.category.name} · {item.reference}</small><strong>{item.title}</strong></p></div><b className={styles[item.status]}><i />{status[item.status] ?? item.status}</b></header>
              <p>{item.description}</p>
              <div className={styles.requestMeta}><span>⌖ <b>{item.location.district.name}, {item.location.city.name}</b></span><span>₺ <b>{money(item.budget.min)} – {money(item.budget.max)}</b></span><span>◷ <b>{date(item.created_at)}</b></span></div>
              <div className={styles.progress}><span className={styles.done}>Talep yayınlandı</span><i /><span className={item.offer_count ? styles.done : ""}>{item.offer_count} teklif geldi</span><i /><span className={item.status === "accepted" ? styles.done : ""}>Hizmet veren seçildi</span></div>
              <footer><p><strong>{item.offer_count}</strong><span>gelen teklif</span></p><div><button disabled={item.offer_count === 0} onClick={() => openCompare(item)}>{item.offer_count === 0 ? "Teklif bekleniyor" : "Teklifleri karşılaştır →"}</button>{["open", "in_negotiation"].includes(item.status) && <button className={styles.ghost} disabled={busy === -item.id} onClick={() => cancel(item)}>Talebi iptal et</button>}</div></footer>
            </article>)}</div>
          </div>
          <aside className={styles.rightRail}>
            <section><span>AKILLI İPUCU</span><h3>Daha fazla teklif almak için</h3><ul><li><b>1</b>Başlığı net ve sonuç odaklı yaz</li><li><b>2</b>Bütçe aralığını gerçekçi tut</li><li><b>3</b>İş kapsamını ayrıntılandır</li></ul><Link href="/talep-olustur">Yeni talep oluştur →</Link></section>
            <section id="hesabim"><span>PROFİLİM VE GÜVENLİK</span>
              <div className={styles.photoRow}>
                <Photo className={styles.accountPhoto} name={user?.name ?? ""} url={user?.avatar_url ?? null} />
                <div>
                  <strong>Profil fotoğrafın</strong>
                  <small>Açtığın taleplerde ve mesajlarında görünür.</small>
                  <div className={styles.photoActions}>
                    <label className={`${styles.photoButton} ${styles.photoPick}`}>
                      {photoBusy ? "Yükleniyor…" : user?.avatar_url ? "Değiştir" : "Fotoğraf ekle"}
                      <input accept="image/jpeg,image/png,image/webp" disabled={photoBusy} onChange={uploadPhoto} type="file" />
                    </label>
                    {user?.avatar_url && <button className={`${styles.photoButton} ${styles.photoDrop}`} disabled={photoBusy} onClick={removePhoto} type="button">Kaldır</button>}
                  </div>
                  <em className={styles.photoHint}>JPG, PNG veya WEBP · en fazla 4 MB</em>
                </div>
              </div>
              <h3>İletişim doğrulandı</h3><p><b>✓</b> E-posta: {user?.email}</p><p><b>✓</b> Telefon: {user?.phone}</p><small>Bilgilerin teklifler kabul edilene kadar gizli kalır.</small></section>
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
            const isLowest = Number(offer.price) === lowest && rows.length > 1;
            return <article className={`${styles.offer} ${styles[offer.status]}`} key={offer.id}>
              <header>
                <Photo className={styles.sellerPhoto} name={name} url={offer.seller.logo_url ?? offer.seller.avatar_url} />
                <div><strong>{name}</strong><small>✓ Doğrulanmış hizmet veren</small></div>
                <b>{offerStatus[offer.status]}</b>
              </header>
              <Link className={styles.profileLink} href={`/satici/${offer.seller.id}`} target="_blank">Profili ve geçmiş işlerini gör ↗</Link>
              <p>{offer.message}</p>
              {offer.listing && <AttachedListing listing={offer.listing} sellerId={offer.seller.id} />}
              <div className={styles.priceRow}>
                <div>
                  <span className={styles.priceLabel}>TEKLİF TUTARI</span>
                  <strong className={styles.offerPrice}>{money(offer.price)}</strong>
                </div>
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
