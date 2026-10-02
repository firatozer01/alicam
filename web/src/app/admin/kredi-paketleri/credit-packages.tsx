"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, apiRequest, firstApiError } from "@/lib/api";
import { AdminSidebar, type AdminSidebarUser } from "../admin-sidebar";
import "../admin-standard.css";
import styles from "./credit-packages.module.css";

type AdminUser = AdminSidebarUser & { roles: string[] };

type Paket = {
  id: number;
  name: string;
  credit_amount: number;
  bonus_credit: number;
  price: string | number;
  is_active: boolean;
  sort_order: number;
  payment_orders_count?: number;
};

/** Formda tutulan hal: sayilar yaziliyorken bos kalabilmeli. */
type Form = {
  id: number | null;
  name: string;
  credit_amount: string;
  bonus_credit: string;
  price: string;
  is_active: boolean;
  sort_order: string;
};

const bos: Form = {
  id: null,
  name: "",
  credit_amount: "",
  bonus_credit: "0",
  price: "",
  is_active: true,
  sort_order: "0",
};

const para = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 2 });

function formaCevir(paket: Paket): Form {
  return {
    id: paket.id,
    name: paket.name,
    credit_amount: String(paket.credit_amount),
    bonus_credit: String(paket.bonus_credit),
    price: String(paket.price),
    is_active: paket.is_active,
    sort_order: String(paket.sort_order),
  };
}

/**
 * Hizmet verenin satin aldigi kredi paketleri.
 *
 * Bu tablonun daha once hicbir yonetim ekrani yoktu: fiyatlarin yazili
 * oldugu tek yer tohumlama dosyasiydi, yani zam yapmak icin kod dagitimi
 * gerekiyordu.
 */
export function CreditPackages() {
  const router = useRouter();
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [paketler, setPaketler] = useState<Paket[]>([]);
  const [form, setForm] = useState<Form>(bos);
  const [formAcik, setFormAcik] = useState(false);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [erisimYok, setErisimYok] = useState(false);
  const [mesgul, setMesgul] = useState(false);
  const [bildirim, setBildirim] = useState("");
  const [hata, setHata] = useState("");

  useEffect(() => {
    let acik = true;

    apiRequest<{ data: AdminUser }>("/me")
      .then(({ data }) => {
        if (!acik) return;
        if (!data.roles.includes("admin")) {
          setErisimYok(true);
          setYukleniyor(false);
          return;
        }
        setAdmin(data);
      })
      .catch((sorun: unknown) => {
        if (sorun instanceof ApiError && sorun.status === 401) {
          router.replace("/giris?devam=%2Fadmin%2Fkredi-paketleri");
          return;
        }
        if (acik) {
          setErisimYok(true);
          setYukleniyor(false);
        }
      });

    return () => {
      acik = false;
    };
  }, [router]);

  useEffect(() => {
    if (!admin) return;
    let acik = true;

    apiRequest<{ data: Paket[] }>("/admin/credit-packages")
      .then(({ data }) => {
        if (!acik) return;
        setPaketler(data);
        setYukleniyor(false);
      })
      .catch((sorun: unknown) => {
        if (!acik) return;
        setHata(firstApiError(sorun) ?? "Paketler yüklenemedi.");
        setYukleniyor(false);
      });

    return () => {
      acik = false;
    };
  }, [admin]);

  const basla = (paket?: Paket) => {
    setHata("");
    setBildirim("");
    setForm(paket ? formaCevir(paket) : { ...bos, sort_order: String(paketler.length + 1) });
    setFormAcik(true);
  };

  const kaydet = async () => {
    setMesgul(true);
    setHata("");
    setBildirim("");

    const govde = {
      name: form.name.trim(),
      credit_amount: Number(form.credit_amount),
      bonus_credit: Number(form.bonus_credit || 0),
      // Virgulle yazilan fiyat da kabul edilsin.
      price: Number(form.price.replace(",", ".")),
      is_active: form.is_active,
      sort_order: Number(form.sort_order || 0),
    };

    try {
      const cevap = await apiRequest<{ message: string; data: Paket }>(
        form.id ? `/admin/credit-packages/${form.id}` : "/admin/credit-packages",
        { method: form.id ? "PUT" : "POST", body: JSON.stringify(govde) },
      );

      setPaketler((onceki) => form.id
        ? onceki.map((x) => (x.id === cevap.data.id ? { ...x, ...cevap.data } : x))
        : [...onceki, cevap.data].sort((a, b) => a.sort_order - b.sort_order));
      setBildirim(cevap.message);
      setFormAcik(false);
    } catch (sorun: unknown) {
      setHata(firstApiError(sorun) ?? "Paket kaydedilemedi.");
    } finally {
      setMesgul(false);
    }
  };

  const yayindanKaldir = async (paket: Paket) => {
    setMesgul(true);
    setHata("");
    setBildirim("");

    try {
      const cevap = await apiRequest<{ message: string; data: Paket }>(
        `/admin/credit-packages/${paket.id}`,
        { method: "DELETE" },
      );
      setPaketler((onceki) => onceki.map((x) => (x.id === paket.id ? { ...x, ...cevap.data } : x)));
      setBildirim(cevap.message);
    } catch (sorun: unknown) {
      setHata(firstApiError(sorun) ?? "Paket yayından kaldırılamadı.");
    } finally {
      setMesgul(false);
    }
  };

  const yayinla = async (paket: Paket) => {
    setForm({ ...formaCevir(paket), is_active: true });
    setMesgul(true);
    setHata("");

    try {
      const cevap = await apiRequest<{ message: string; data: Paket }>(
        `/admin/credit-packages/${paket.id}`,
        {
          method: "PUT",
          body: JSON.stringify({
            name: paket.name,
            credit_amount: paket.credit_amount,
            bonus_credit: paket.bonus_credit,
            price: Number(paket.price),
            is_active: true,
            sort_order: paket.sort_order,
          }),
        },
      );
      setPaketler((onceki) => onceki.map((x) => (x.id === paket.id ? { ...x, ...cevap.data } : x)));
      setBildirim(cevap.message);
    } catch (sorun: unknown) {
      setHata(firstApiError(sorun) ?? "Paket yayınlanamadı.");
    } finally {
      setMesgul(false);
      setForm(bos);
    }
  };

  if (erisimYok) {
    return <div className="admin-page">
      <div className="admin-content">
        <div className="admin-access-card">
          <h1>Bu sayfa yöneticilere özel</h1>
          <p>Yönetim paneline erişim yetkin yok.</p>
          <Link className="admin-home-button" href="/">Ana sayfaya dön</Link>
        </div>
      </div>
    </div>;
  }

  return <div className="admin-page">
    <AdminSidebar active="kredi-paketleri" user={admin} />

    <div className="admin-content">
      <header className="admin-header">
        <div>
          <span className="admin-kicker">KREDİ EKONOMİSİ</span>
          <h1>Kredi paketleri</h1>
          <p>Hizmet verenin satın aldığı paketlerin adı, kredisi, bonusu ve fiyatı. Değişiklik anında satın alma ekranına yansır.</p>
        </div>
        <button className="admin-home-button" onClick={() => basla()} type="button">＋ Yeni paket</button>
      </header>

      {bildirim && <p className="admin-notice">{bildirim}</p>}
      {hata && <p className="admin-error">{hata}</p>}

      {formAcik && <section className={styles.duzenleyici}>
        <header>
          <h2>{form.id ? "Paketi düzenle" : "Yeni paket"}</h2>
          <button onClick={() => setFormAcik(false)} type="button">×</button>
        </header>

        <div className={styles.alanlar}>
          <label>
            Paket adı
            <input onChange={(olay) => setForm({ ...form, name: olay.target.value })} placeholder="Örn. Standart" value={form.name} />
          </label>
          <label>
            Kredi
            <input inputMode="numeric" onChange={(olay) => setForm({ ...form, credit_amount: olay.target.value })} placeholder="60" value={form.credit_amount} />
          </label>
          <label>
            Bonus kredi
            <input inputMode="numeric" onChange={(olay) => setForm({ ...form, bonus_credit: olay.target.value })} placeholder="10" value={form.bonus_credit} />
          </label>
          <label>
            Fiyat (₺)
            <input inputMode="decimal" onChange={(olay) => setForm({ ...form, price: olay.target.value })} placeholder="1200" value={form.price} />
          </label>
          <label>
            Sıra
            <input inputMode="numeric" onChange={(olay) => setForm({ ...form, sort_order: olay.target.value })} placeholder="1" value={form.sort_order} />
          </label>
          <label className={styles.onay}>
            <input checked={form.is_active} onChange={(olay) => setForm({ ...form, is_active: olay.target.checked })} type="checkbox" />
            Paket satışta
          </label>
        </div>

        <footer>
          <button onClick={() => setFormAcik(false)} type="button">Vazgeç</button>
          <button className={styles.birincil} disabled={mesgul} onClick={kaydet} type="button">
            {mesgul ? "Kaydediliyor…" : "Paketi kaydet"}
          </button>
        </footer>
      </section>}

      {yukleniyor
        ? <p className="admin-empty">Paketler yükleniyor…</p>
        : paketler.length === 0
          ? <div className="admin-empty"><span>₺</span><p>Henüz paket yok. Satıcıların kredi alabilmesi için en az bir paket gerekir.</p></div>
          : <section className={styles.liste}>
            <header className={styles.satirBasi}>
              <span>PAKET</span><span>KREDİ</span><span>FİYAT</span><span>KREDİ BAŞI</span><span>SATIŞ</span><span />
            </header>

            {paketler.map((paket) => {
              const toplam = paket.credit_amount + paket.bonus_credit;
              const fiyat = Number(paket.price);

              return <article className={styles.satir} data-pasif={!paket.is_active} key={paket.id}>
                <div className={styles.ad}>
                  <strong>{paket.name}</strong>
                  <small>{paket.payment_orders_count ?? 0} sipariş · sıra {paket.sort_order}</small>
                </div>
                <div className={styles.kredi}>
                  <strong>{toplam}</strong>
                  {paket.bonus_credit > 0 && <small>{paket.credit_amount} + {paket.bonus_credit} bonus</small>}
                </div>
                <div className={styles.fiyat}><strong>{para.format(fiyat)}</strong></div>
                {/* Zam/kampanya kararini kolaylastiran tek sayi. */}
                <div className={styles.birim}>{toplam > 0 ? para.format(fiyat / toplam) : "—"}</div>
                <div>
                  <em className={paket.is_active ? styles.acik : styles.kapali}>
                    {paket.is_active ? "Satışta" : "Yayında değil"}
                  </em>
                </div>
                <div className={styles.islem}>
                  <button disabled={mesgul} onClick={() => basla(paket)} type="button">Düzenle</button>
                  {paket.is_active
                    ? <button disabled={mesgul} onClick={() => yayindanKaldir(paket)} type="button">Yayından kaldır</button>
                    : <button disabled={mesgul} onClick={() => yayinla(paket)} type="button">Yayınla</button>}
                </div>
              </article>;
            })}
          </section>}

      <p className={styles.dipnot}>
        Paket silinmez, yayından kaldırılır: geçmiş ödeme siparişleri bu kayda bağlı ve silinirse muhasebe kaydı eksik kalır.
      </p>
    </div>

  </div>;
}
