"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, apiRequest, firstApiError } from "@/lib/api";
import { BrandLogo } from "@/components/shell/brand";
import "../admin-standard.css";
import styles from "./home-editor.module.css";

type Copy = {
  hero_title: string;
  hero_accent: string;
  hero_placeholder: string;
  popular_title: string;
  popular_subtitle: string;
  trending_title: string;
  trending_subtitle: string;
  groups_title: string;
  groups_subtitle: string;
  listing_title: string;
  listing_subtitle: string;
};

type CategoryRow = {
  id: number;
  slug: string;
  name: string;
  icon: string;
  color: string;
  parent: string | null;
  image_url: string | null;
  image_credit: string | null;
  image_source: string | null;
};

type Payload = {
  data: { copy: Copy; pinned: string[]; categories: CategoryRow[] };
  meta: { with_image: number; total: number };
};

const BOS: Copy = {
  hero_title: "", hero_accent: "", hero_placeholder: "",
  popular_title: "", popular_subtitle: "",
  trending_title: "", trending_subtitle: "",
  groups_title: "", groups_subtitle: "",
  listing_title: "", listing_subtitle: "",
};

/** Alan etiketleri; sirasi ekranda gorunen sira. */
const ALANLAR: { key: keyof Copy; label: string; hint?: string; wide?: boolean }[] = [
  { key: "hero_title", label: "Üst başlık", wide: true },
  { key: "hero_accent", label: "Üst başlık — vurgulu ikinci satır", wide: true },
  { key: "hero_placeholder", label: "Arama kutusu ipucu", wide: true },
  { key: "popular_subtitle", label: "Popüler — üst etiket" },
  { key: "popular_title", label: "Popüler — başlık" },
  { key: "trending_subtitle", label: "Trend — üst etiket" },
  { key: "trending_title", label: "Trend — başlık", hint: "Yalnızca gerçek trend varken görünür." },
  { key: "groups_subtitle", label: "Tüm hizmetler — üst etiket" },
  { key: "groups_title", label: "Tüm hizmetler — başlık" },
  { key: "listing_subtitle", label: "İlanlar — üst etiket" },
  { key: "listing_title", label: "İlanlar — başlık" },
];

/**
 * Anasayfa duzenleyici.
 *
 * Uc is yapar: cerceve metinlerini degistirir, populer seride elle baslik
 * sabitler ve hizmet kartlarinin fotograflarini yonetir.
 *
 * Basliklarin kendisi burada duzenlenmez; onlar kategori agacindan gelir
 * ve Kategoriler ekraninin isidir.
 */
export function HomeEditor() {
  const router = useRouter();
  const [copy, setCopy] = useState<Copy>(BOS);
  const [pinned, setPinned] = useState<string[]>([]);
  const [rows, setRows] = useState<CategoryRow[]>([]);
  const [meta, setMeta] = useState<Payload["meta"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  const [onlyMissing, setOnlyMissing] = useState(false);
  /** O an islenen kategori id'si; butonlar yalnizca o satirda kilitlenir. */
  const [working, setWorking] = useState<number | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploadFor, setUploadFor] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    apiRequest<Payload>("/admin/home")
      .then((response) => {
        if (!active) return;
        setCopy({ ...BOS, ...response.data.copy });
        setPinned(response.data.pinned);
        setRows(response.data.categories);
        setMeta(response.meta);
      })
      .catch((requestError: unknown) => {
        if (!active) return;
        if (requestError instanceof ApiError && requestError.status === 401) {
          return router.replace("/giris?devam=%2Fadmin%2Fanasayfa");
        }
        setError(firstApiError(requestError));
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [router]);

  const set = <K extends keyof Copy>(key: K, value: Copy[K]) => {
    setCopy((current) => ({ ...current, [key]: value }));
    setNotice(""); setError("");
  };

  const save = async () => {
    setBusy(true); setNotice(""); setError("");
    try {
      const response = await apiRequest<{ message: string; data: { copy: Copy; pinned: string[] } }>("/admin/home", {
        method: "PUT",
        body: JSON.stringify({ copy, pinned }),
      });
      setCopy({ ...BOS, ...response.data.copy });
      setPinned(response.data.pinned);
      setNotice(response.message);
    } catch (requestError: unknown) {
      setError(firstApiError(requestError));
    } finally {
      setBusy(false);
    }
  };

  /** Sunucudan donen satiri listede yerine koyar. */
  const replaceRow = (row: CategoryRow) =>
    setRows((current) => current.map((item) => (item.id === row.id ? row : item)));

  const fetchImage = async (row: CategoryRow) => {
    setWorking(row.id); setNotice(""); setError("");
    try {
      const response = await apiRequest<{ message: string; data: CategoryRow }>(
        `/admin/home/categories/${row.id}/fetch-image`,
        { method: "POST" },
      );
      replaceRow(response.data);
      setNotice(`${row.name}: ${response.message}`);
    } catch (requestError: unknown) {
      setError(`${row.name} — ${firstApiError(requestError)}`);
    } finally {
      setWorking(null);
    }
  };

  const removeImage = async (row: CategoryRow) => {
    setWorking(row.id); setNotice(""); setError("");
    try {
      const response = await apiRequest<{ message: string; data: CategoryRow }>(
        `/admin/home/categories/${row.id}/image`,
        { method: "DELETE" },
      );
      replaceRow(response.data);
      setNotice(`${row.name}: ${response.message}`);
    } catch (requestError: unknown) {
      setError(`${row.name} — ${firstApiError(requestError)}`);
    } finally {
      setWorking(null);
    }
  };

  const uploadImage = async (file: File) => {
    if (uploadFor === null) return;
    const row = rows.find((item) => item.id === uploadFor);
    setWorking(uploadFor); setNotice(""); setError("");
    try {
      const body = new FormData();
      body.append("image", file);
      const response = await apiRequest<{ message: string; data: CategoryRow }>(
        `/admin/home/categories/${uploadFor}/image`,
        { method: "POST", body },
      );
      replaceRow(response.data);
      setNotice(`${row?.name ?? "Kategori"}: ${response.message}`);
    } catch (requestError: unknown) {
      setError(`${row?.name ?? "Kategori"} — ${firstApiError(requestError)}`);
    } finally {
      setWorking(null);
      setUploadFor(null);
    }
  };

  const gorunen = useMemo(() => {
    const arama = filter.trim().toLocaleLowerCase("tr-TR");
    return rows.filter((row) => {
      if (onlyMissing && row.image_url) return false;
      if (arama === "") return true;
      return `${row.name} ${row.parent ?? ""}`.toLocaleLowerCase("tr-TR").includes(arama);
    });
  }, [rows, filter, onlyMissing]);

  const pin = (slug: string) => {
    setPinned((current) => (current.includes(slug) ? current : [...current, slug]));
    setNotice(""); setError("");
  };

  const unpin = (slug: string) => {
    setPinned((current) => current.filter((item) => item !== slug));
    setNotice(""); setError("");
  };

  const move = (index: number, yon: -1 | 1) => {
    setPinned((current) => {
      const hedef = index + yon;
      if (hedef < 0 || hedef >= current.length) return current;
      const kopya = [...current];
      [kopya[index], kopya[hedef]] = [kopya[hedef], kopya[index]];
      return kopya;
    });
  };

  const adiyla = (slug: string) => rows.find((row) => row.slug === slug)?.name ?? slug;

  return <main className="admin-shell">
    <aside className="admin-sidebar">
      <Link aria-label="alıcam.net ana sayfa" className="brand admin-brand" href="/"><BrandLogo /></Link>
      <div className="admin-product"><span>YÖNETİM MERKEZİ</span><strong>Operasyon</strong></div>
      <nav>
        <Link href="/admin"><i>◇</i> Genel bakış</Link>
        <Link className="active" href="/admin/anasayfa"><i>▤</i> Anasayfa</Link>
        <Link href="/admin/kategoriler"><i>▦</i> Kategoriler</Link>
        <Link href="/admin/satici-onaylari"><i>✓</i> Satıcı onayları</Link>
        <Link href="/admin/ayarlar"><i>⚙</i> Ayarlar</Link>
      </nav>
    </aside>

    <section className="admin-content">
      <header className="admin-header">
        <div>
          <span className="admin-kicker">VİTRİN</span>
          <h1>Anasayfa</h1>
          <p>Bölüm başlıkları, öne çıkan hizmetler ve kart fotoğrafları. Değişiklikler yayına anında yansır.</p>
        </div>
        <Link className="admin-home-button" href="/">Siteyi görüntüle ↗</Link>
      </header>

      {loading ? <p className={styles.state}>Yükleniyor…</p> : <>
        {notice && <p className={styles.notice}>✓ {notice}</p>}
        {error && <p className="admin-error">{error}</p>}

        <section className={styles.card}>
          <header>
            <div>
              <strong>Bölüm metinleri</strong>
              <small>Başlıkların kendisi kategori ağacından gelir; burası yalnızca çerçeve yazıları.</small>
            </div>
          </header>

          <div className={styles.grid}>
            {ALANLAR.map((alan) => (
              <label className={alan.wide ? styles.wide : undefined} key={alan.key}>
                {alan.label}
                <input onChange={(event) => set(alan.key, event.target.value)} value={copy[alan.key]} />
                {alan.hint && <small>{alan.hint}</small>}
              </label>
            ))}
          </div>
        </section>

        <section className={styles.card}>
          <header>
            <div>
              <strong>Öne çıkan hizmetler</strong>
              <small>
                {pinned.length === 0
                  ? "Şu an boş: popüler şerit talep sayısına göre kendiliğinden sıralanıyor."
                  : `${pinned.length} başlık sabitlendi; kalan yerler talep sayısına göre doluyor.`}
              </small>
            </div>
          </header>

          {pinned.length > 0 && (
            <ol className={styles.pinList}>
              {pinned.map((slug, index) => (
                <li key={slug}>
                  <b>{index + 1}</b>
                  <span>{adiyla(slug)}</span>
                  <button disabled={index === 0} onClick={() => move(index, -1)} type="button">↑</button>
                  <button disabled={index === pinned.length - 1} onClick={() => move(index, 1)} type="button">↓</button>
                  <button className={styles.danger} onClick={() => unpin(slug)} type="button">Kaldır</button>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className={styles.card}>
          <header>
            <div>
              <strong>Kart fotoğrafları</strong>
              <small>
                {meta ? `${meta.with_image}/${meta.total} başlıkta görsel var. ` : ""}
                Görseli olmayan başlık, kategori renginde emoji kutusuna düşer.
              </small>
            </div>
          </header>

          <div className={styles.toolbar}>
            <input
              onChange={(event) => setFilter(event.target.value)}
              placeholder="Başlık ara…"
              value={filter}
            />
            <label className={styles.check}>
              <input checked={onlyMissing} onChange={(event) => setOnlyMissing(event.target.checked)} type="checkbox" />
              Yalnızca görseli olmayanlar
            </label>
            <span className={styles.count}>{gorunen.length} başlık</span>
          </div>

          <div className={styles.imageGrid}>
            {gorunen.map((row) => (
              <article className={styles.imageCard} key={row.id}>
                <span className={styles.shot} style={{ background: `${row.color}1f` }}>
                  {row.image_url
                    ? <Image alt="" fill sizes="220px" src={row.image_url} unoptimized />
                    : <i>{row.icon}</i>}
                </span>

                <div className={styles.imageBody}>
                  <strong>{row.name}</strong>
                  <small>{row.parent ?? "Ana başlık"}</small>
                  {row.image_credit && <em title={row.image_source ?? undefined}>{row.image_credit}</em>}
                </div>

                <div className={styles.imageActions}>
                  <button disabled={working === row.id} onClick={() => fetchImage(row)} type="button">
                    {working === row.id ? "…" : "Otomatik bul"}
                  </button>
                  <button
                    disabled={working === row.id}
                    onClick={() => { setUploadFor(row.id); fileInput.current?.click(); }}
                    type="button"
                  >
                    Yükle
                  </button>
                  {row.image_url && (
                    <button className={styles.danger} disabled={working === row.id} onClick={() => removeImage(row)} type="button">
                      Kaldır
                    </button>
                  )}
                  {/* Kok kategoriler populer seritte gosterilmiyor;
                      yalnizca 2. seviye basliklar sabitlenebilir. */}
                  {row.parent && (
                    <button
                      className={pinned.includes(row.slug) ? styles.pinOn : undefined}
                      onClick={() => (pinned.includes(row.slug) ? unpin(row.slug) : pin(row.slug))}
                      type="button"
                    >
                      {pinned.includes(row.slug) ? "★ Öne çıkarıldı" : "☆ Öne çıkar"}
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>

          {gorunen.length === 0 && <p className={styles.state}>Aramaya uyan başlık yok.</p>}

          <input
            accept="image/jpeg,image/png,image/webp"
            className={styles.hiddenFile}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void uploadImage(file);
            }}
            ref={fileInput}
            type="file"
          />
        </section>

        <div className={styles.saveBar}>
          <button className={styles.primary} disabled={busy} onClick={() => void save()} type="button">
            {busy ? "Kaydediliyor…" : "Metinleri ve sıralamayı kaydet"}
          </button>
          <small>Fotoğraf işlemleri anında kaydedilir, bu düğmeyi beklemez.</small>
        </div>
      </>}
    </section>
  </main>;
}
