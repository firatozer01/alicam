"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";

export function PaymentResult({ order, initialFailure = false }: { order: string; initialFailure?: boolean }) {
  const [status, setStatus] = useState(initialFailure ? "failed" : "pending");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!order || initialFailure) return;
    let attempts = 0;
    const poll = async () => {
      attempts += 1;
      try {
        const response = await apiRequest<{ data: { status: string; failed_reason?: string } }>(`/seller/payments/${order}`);
        setStatus(response.data.status); setReason(response.data.failed_reason ?? "");
        if (response.data.status === "pending" && attempts < 20) window.setTimeout(poll, 1500);
      } catch { if (attempts < 20) window.setTimeout(poll, 1500); }
    };
    void poll();
  }, [initialFailure, order]);

  const paid = status === "paid";
  const failed = status === "failed";
  return <main className="payment-result-page"><Link className="brand" href="/">alıcam<span>.net</span></Link><section className={`payment-result-card ${paid ? "paid" : failed ? "failed" : "pending"}`}><span>{paid ? "✓" : failed ? "×" : "⌁"}</span><small>{paid ? "ÖDEME ONAYLANDI" : failed ? "ÖDEME TAMAMLANAMADI" : "ÖDEME DOĞRULANIYOR"}</small><h1>{paid ? "Kontörlerin hesabında." : failed ? "İşlem sonuçlanmadı." : "Banka bildirimi bekleniyor."}</h1><p>{paid ? "PayTR sunucu bildirimi doğrulandı ve paket bakiyene güvenle eklendi." : failed ? reason || "Ödeme alınmadı. Dilersen farklı bir kartla yeniden deneyebilirsin." : "Bu sayfayı kapatma; sonuç birkaç saniye içinde otomatik güncellenecek."}</p><div><Link href="/satici-paneli">Satıcı paneline dön</Link>{failed && <Link className="primary" href="/kontor-yukle">Yeniden dene</Link>}</div></section></main>;
}
