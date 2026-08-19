"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiRequest, firstApiError } from "@/lib/api";

type Package = { id: number; name: string; credit_amount: number; bonus_credit: number; total_credit: number; price: string };
type Credit = { balance: number };

const money = (value: string) => new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(Number(value));

export function CreditPurchase() {
  const [packages, setPackages] = useState<Package[]>([]);
  const [balance, setBalance] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [iframeUrl, setIframeUrl] = useState("");
  const [order, setOrder] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([apiRequest<{ data: Package[] }>("/credits/packages"), apiRequest<{ data: Credit }>("/seller/credits")])
      .then(([packageResponse, creditResponse]) => { setPackages(packageResponse.data); setBalance(creditResponse.data.balance); setSelected(packageResponse.data[1]?.id ?? packageResponse.data[0]?.id ?? null); })
      .catch((requestError: unknown) => setError(firstApiError(requestError)));
  }, []);

  const purchase = async () => {
    if (!selected) return;
    setBusy(true); setError("");
    try {
      const response = await apiRequest<{ data: { merchant_oid: string; iframe_url: string } }>("/seller/credits/purchase", { method: "POST", body: JSON.stringify({ package_id: selected }) });
      setIframeUrl(response.data.iframe_url); setOrder(response.data.merchant_oid);
    } catch (requestError: unknown) { setError(firstApiError(requestError)); }
    finally { setBusy(false); }
  };

  return <main className="credit-page">
    <header className="credit-topbar"><Link className="brand" href="/">alıcam<span>.net</span></Link><div><Link href="/satici-paneli">← Satıcı paneli</Link><span><i>⚡</i><b>{balance}</b> mevcut kontör</span></div></header>
    <section className="credit-hero"><span>HİZMET VEREN BÜYÜME MERKEZİ</span><h1>Daha çok fırsata ulaş.<br /><em>Kontörünü seç.</em></h1><p>Teklif vermek istediğin talepleri güvenle aç. Paketlerin süresi dolmaz; bonuslar anında hesabına eklenir.</p></section>
    {!iframeUrl ? <section className="credit-content">
      <div className="credit-packages">{packages.map((item, index) => <button type="button" onClick={() => setSelected(item.id)} className={`credit-package ${selected === item.id ? "selected" : ""} ${index === 1 ? "featured" : ""}`} key={item.id}>{index === 1 && <span className="credit-popular">EN ÇOK TERCİH EDİLEN</span>}<small>{item.name.toLocaleUpperCase("tr-TR")}</small><strong>{item.credit_amount}<i>kontör</i></strong>{item.bonus_credit > 0 ? <b>+{item.bonus_credit} bonus kontör</b> : <b className="muted">Bonus içermez</b>}<hr /><em>{money(item.price)}</em><span className="credit-unit">Kontör başına {money(String(Number(item.price) / item.total_credit))}</span><i className="credit-check">{selected === item.id ? "✓" : ""}</i></button>)}</div>
      {error && <p className="credit-error">{error}</p>}
      <div className="credit-checkout"><div><span>SEÇİLEN PAKET</span><strong>{packages.find((item) => item.id === selected)?.name ?? "—"} · {packages.find((item) => item.id === selected)?.total_credit ?? 0} kontör</strong></div><div><small>Güvenli ödeme</small><button disabled={busy || !selected} onClick={purchase}>{busy ? "Ödeme hazırlanıyor…" : "PayTR ile ödemeye geç"} <span>→</span></button></div></div>
      <div className="credit-trust"><span>⌁ <b>3D Secure altyapısı</b><small>Ödeme bilgilerin alıcam.net sunucularında tutulmaz.</small></span><span>◇ <b>Anında yükleme</b><small>Onaylı ödeme bildirimiyle kontör otomatik tanımlanır.</small></span><span>↺ <b>Tekrarlı işlem koruması</b><small>Aynı sipariş yalnızca bir kez bakiyeye yansır.</small></span></div>
    </section> : <section className="credit-iframe-wrap"><header><div><span>GÜVENLİ ÖDEME</span><h2>PayTR ödeme ekranı</h2><small>Sipariş: {order}</small></div><button onClick={() => { setIframeUrl(""); setOrder(""); }}>Paketi değiştir</button></header><iframe title="PayTR güvenli ödeme" src={iframeUrl} allow="payment" /></section>}
  </main>;
}
