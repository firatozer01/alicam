"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SiteHeader } from "@/components/shell/site-header";
import { ApiError, apiRequest, firstApiError } from "@/lib/api";
import styles from "./favorites.module.css";

type Category = { id: number; name: string; slug: string; icon: string; color: string };

type FavoriteRequest = {
  id: number;
  reference: string;
  title: string;
  summary: string;
  status: string;
  offer_count: number;
  budget: { min: string; max: string };
  category: Category;
  location: { city: { name: string }; district: { name: string } };
  is_unlocked: boolean;
  is_favorite: boolean;
  unlock_cost: number | null;
  created_at: string;
};

const money = (value: string) =>
  new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(Number(value));

const gecenSure = (value: string) => {
  const dakika = Math.floor((Date.now() - new Date(value).getTime()) / 60000);
  if (dakika < 60) return `${Math.max(1, dakika)} dk önce`;
  const saat = Math.floor(dakika / 60);
  if (saat < 24) return `${saat} saat önce`;
  return `${Math.floor(saat / 24)} gün önce`;
};

/**
 * Hizmet verenin favorilediği talepler.
 *
 * Panelin icindeki "Favorilerim" gorunumuyle ayni veriyi kullanir; buradaki
 * fark, ust cubuktan tek tiklamayla ulasilan kendi adresi olmasi. Kontorle
 * acma ve teklif verme panelde kaldi: burasi isaretlenenleri toplu gormek
 * ve aralarindan secmek icin.
 */
export function FavoritesPage() {
  const router = useRouter();
  const [items, setItems] = useState<FavoriteRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);

  // Istek dogrudan efektin icinde zincirlenir: adlandirilmis bir fonksiyonu
  // cagirmak lint tarafindan "efekt icinde setState" sayiliyor.
  useEffect(() => {
    let active = true;

    apiRequest<{ data: FavoriteRequest[] }>("/seller/requests?favorite=1&per_page=50")
      .then((response) => { if (active) setItems(response.data); })
      .catch((requestError: unknown) => {
        if (!active) return;
        if (requestError instanceof ApiError && requestError.status === 401) {
          router.replace("/giris?devam=%2Ffavorilerim");
          return;
        }
        setError(firstApiError(requestError));
      })
      .finally(() => { if (active) setLoading(false); });

    return () => { active = false; };
  }, [router]);

  /** Yildizi kaldirinca satir listeden de cikar; burasi zaten favori listesi. */
  const removeFavorite = async (item: FavoriteRequest) => {
    setBusyId(item.id);
    const before = items;
    setItems((current) => current.filter((row) => row.id !== item.id));

    try {
      await apiRequest(`/seller/requests/${item.id}/favorite`, { method: "POST" });
    } catch {
      setItems(before);
      setError("Favorilerden çıkarılamadı, tekrar dener misin?");
    } finally {
      setBusyId(null);
    }
  };

  return <main className={styles.page}>
    <SiteHeader activeKey="favoriler" />

    <div className={styles.wrap}>
      <header className={styles.head}>
        <div>
          <span className={styles.kicker}>TAKİP LİSTEN</span>
          <h1>Favori talepler</h1>
          <p>İşaretlediğin talepler burada toplanır. Detayını açmak ve teklif vermek için panele geç.</p>
        </div>
        <Link className={styles.ghost} href="/satici-paneli">Gelen taleplere dön →</Link>
      </header>

      {error && <p className={styles.error}>{error}</p>}

      {loading
        ? <p className={styles.hint}>Yükleniyor…</p>
        : items.length === 0
          ? <div className={styles.empty}>
              <span aria-hidden>★</span>
              <strong>Henüz favori talebin yok</strong>
              <p>Gelen talepler listesinde bir kartın sağ üstündeki yıldıza basarak takip etmek istediklerini buraya ekleyebilirsin.</p>
              <Link href="/satici-paneli">Gelen talepleri aç →</Link>
            </div>
          : <div className={styles.grid}>
            {items.map((item) => (
              <article className={styles.card} key={item.id}>
                <div className={styles.cardTop}>
                  <span className={styles.tag} style={{ background: `${item.category.color}1a`, color: item.category.color }}>
                    {item.category.icon} {item.category.name}
                  </span>
                  <button
                    aria-label="Favorilerden çıkar"
                    className={styles.star}
                    disabled={busyId === item.id}
                    onClick={() => void removeFavorite(item)}
                    type="button"
                  >★</button>
                </div>

                <h2>{item.title}</h2>
                <p className={styles.summary}>{item.summary}</p>

                <div className={styles.meta}>
                  <span>📍 {item.location.district.name}, {item.location.city.name}</span>
                  <span>📨 <b>{item.offer_count}</b> teklif</span>
                  <span>{gecenSure(item.created_at)}</span>
                </div>

                <footer className={styles.cardFoot}>
                  <div>
                    <small>TAHMİNİ BÜTÇE</small>
                    <strong>{money(item.budget.min)} – {money(item.budget.max)}</strong>
                  </div>
                  <Link className={styles.action} href="/satici-paneli">
                    {item.is_unlocked ? "Panelde aç →" : `Panelde aç · ${item.unlock_cost ?? 1} ⚡`}
                  </Link>
                </footer>
              </article>
            ))}
          </div>}
    </div>
  </main>;
}
