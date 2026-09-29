import type { Metadata } from "next";
import { SiteHeader } from "@/components/shell/site-header";
import { AuthPanel } from "./auth-panel";
import styles from "./auth.module.css";

export const metadata: Metadata = {
  title: "Giriş yap veya üye ol — alıcam.net",
  description: "alıcam.net hesabına giriş yap ya da ücretsiz üye ol. Talep oluştur veya teklif ver.",
};

type LoginPageProps = {
  searchParams: Promise<{ devam?: string; dogrulama?: string; kayit?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;

  // ?devam= yalnizca site ici bir yol olabilir; "//" ile baslayan deger
  // baska siteye gonderirdi.
  const requestedPath = params.devam;
  const returnTo = requestedPath?.startsWith("/") && !requestedPath.startsWith("//")
    ? requestedPath
    : null;

  // ?kayit=veren | ?kayit=alici uyelik sekmesini secili rolle acar.
  const initialRole = params.kayit === "veren" ? "veren" : params.kayit === "alici" ? "alici" : null;

  return <>
    <SiteHeader minimal="← Ana sayfa" />
    <main className={styles.auth} id="icerik">
      <AuthPanel
        forceVerification={params.dogrulama === "1"}
        initialRole={initialRole}
        returnTo={returnTo}
      />
    </main>
  </>;
}
