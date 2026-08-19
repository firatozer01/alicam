import type { Metadata } from "next";
import Link from "next/link";
import { AuthPanel } from "./auth-panel";

export const metadata: Metadata = {
  title: "Giriş ve Üyelik — alıcam.net",
  description: "alıcam.net hesabına giriş yap veya ücretsiz üyeliğini oluştur.",
};

type LoginPageProps = {
  searchParams: Promise<{ devam?: string; dogrulama?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const requestedPath = params.devam ?? "/talep-olustur";
  const returnTo = requestedPath.startsWith("/") && !requestedPath.startsWith("//")
    ? requestedPath
    : "/talep-olustur";

  return (
    <main className="auth-page">
      <div className="auth-aurora auth-aurora-one" />
      <div className="auth-aurora auth-aurora-two" />
      <nav className="auth-nav shell">
        <Link className="brand" href="/">alıcam<span>.net</span></Link>
        <Link className="auth-home-link" href="/">Ana sayfaya dön <span>→</span></Link>
      </nav>

      <section className="auth-shell shell">
        <div className="auth-story">
          <span className="section-kicker">TEKLİFLER SANA GELSİN</span>
          <h1>Aramakla uğraşma.<br /><em>Ne istediğini anlat.</em></h1>
          <p>Ücretsiz hesabını oluştur, talebini yayınla ve uygun hizmet verenlerden teklifleri tek yerde karşılaştır.</p>
          <div className="auth-benefits">
            <div><b>01</b><span><strong>Alıcı için tamamen ücretsiz</strong><small>Talep oluştururken veya teklif alırken ödeme yok.</small></span></div>
            <div><b>02</b><span><strong>İletişim bilgilerin korumalı</strong><small>Anonim özet dışında kişisel verilerin gösterilmez.</small></span></div>
            <div><b>03</b><span><strong>Doğru kişilerle eşleş</strong><small>Kategori ve konuma göre ilgili hizmet verenlere ulaş.</small></span></div>
          </div>
        </div>

        <AuthPanel forceVerification={params.dogrulama === "1"} returnTo={returnTo} />
      </section>
    </main>
  );
}
