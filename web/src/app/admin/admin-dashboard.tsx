"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, apiRequest, firstApiError } from "@/lib/api";
import { AdminSidebar } from "./admin-sidebar";
import "./admin-standard.css";

type User = { name: string; email: string; roles: string[] };
type Dashboard = {
  stats: { users: number; requests: number; active_requests: number; offers: number; pending_sellers: number; paid_revenue: string; credits_sold: number };
  recent_requests: { id: number; reference: string; title: string; status: string; buyer: string; category: string; location: string; offer_count: number; created_at: string }[];
  recent_payments: { merchant_oid: string; user: string; package: string | null; price: string; status: string; created_at: string }[];
};

const money = (value: string) => new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(Number(value));
const date = (value: string) => new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
const status: Record<string, string> = { open: "Yayında", in_negotiation: "Teklif aşamasında", accepted: "Anlaşıldı", cancelled: "İptal", pending: "Bekliyor", paid: "Ödendi", failed: "Başarısız" };

export function AdminDashboard() {
  const router = useRouter();
  const [admin, setAdmin] = useState<User | null>(null);
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([apiRequest<{ data: User }>("/me"), apiRequest<{ data: Dashboard }>("/admin/dashboard")])
      .then(([userResponse, dashboardResponse]) => { if (active) { setAdmin(userResponse.data); setData(dashboardResponse.data); } })
      .catch((requestError: unknown) => {
        if (!active) return;
        if (requestError instanceof ApiError && requestError.status === 401) return router.replace("/giris?devam=%2Fadmin");
        if (requestError instanceof ApiError && requestError.status === 403) return router.replace("/?erisim=reddedildi");
        setError(firstApiError(requestError));
      });
    return () => { active = false; };
  }, [router]);

  return <main className="admin-page">
    <AdminSidebar active="genel" pendingSellers={data?.stats.pending_sellers} user={admin} />
    <section className="admin-content admin-overview"><header className="admin-header"><div><span className="admin-kicker">PAZARYERİ NABZI</span><h1>Genel bakış</h1><p>Talep, teklif, satıcı ve kredi ekonomisinin güncel operasyon özeti.</p></div><Link className="admin-home-button" href="/">Siteyi görüntüle ↗</Link></header>
      {error && <p className="admin-error">{error}</p>}
      {!data ? <div className="admin-empty"><i className="admin-spinner" /><h2>Operasyon verileri hazırlanıyor…</h2></div> : <>
        <div className="admin-metric-grid"><article><span>TOPLAM KULLANICI</span><strong>{data.stats.users}</strong><small>Kayıtlı hesap</small></article><article><span>AKTİF TALEP</span><strong>{data.stats.active_requests}</strong><small>Toplam {data.stats.requests} talep</small></article><article><span>TEKLİF HACMİ</span><strong>{data.stats.offers}</strong><small>Gönderilen teklifler</small></article><article className="warning"><span>ONAY BEKLEYEN</span><strong>{data.stats.pending_sellers}</strong><Link href="/admin/satici-onaylari">İncelemeye git →</Link></article><article className="revenue"><span>ONAYLI ÖDEME HACMİ</span><strong>{money(data.stats.paid_revenue)}</strong><small>{data.stats.credits_sold} kredi satıldı</small></article></div>
        <div className="admin-overview-grid"><section className="admin-data-card"><header><div><span>SON HAREKETLER</span><h2>Yeni talepler</h2></div><b>{data.stats.active_requests} aktif</b></header>{data.recent_requests.length === 0 ? <p className="admin-data-empty">Henüz talep yok.</p> : data.recent_requests.map((item) => <article className="admin-request-row" key={item.id}><span>{item.category.slice(0, 2).toLocaleUpperCase("tr-TR")}</span><div><strong>{item.title}</strong><small>{item.reference} · {item.buyer} · {item.location}</small></div><p><b>{item.offer_count}</b><small>teklif</small></p><em className={item.status}>{status[item.status] ?? item.status}</em></article>)}</section>
          <section className="admin-data-card"><header><div><span>KREDİ EKONOMİSİ</span><h2>Son ödemeler</h2></div></header>{data.recent_payments.length === 0 ? <p className="admin-data-empty">Henüz ödeme siparişi yok.</p> : data.recent_payments.map((item) => <article className="admin-payment-row" key={item.merchant_oid}><div><strong>{item.user}</strong><small>{item.package || "Silinmiş paket"} · {date(item.created_at)}</small></div><p><strong>{money(item.price)}</strong><em className={item.status}>{status[item.status] ?? item.status}</em></p></article>)}</section></div>
      </>}
    </section>
  </main>;
}
