import type { Metadata } from "next";
import { Fraunces, IBM_Plex_Mono, Inter } from "next/font/google";
import "./globals.css";
import "./admin/admin-standard.css";

const inter = Inter({ subsets: ["latin", "latin-ext"], variable: "--font-inter" });
const fraunces = Fraunces({ subsets: ["latin", "latin-ext"], variable: "--font-fraunces" });
const plexMono = IBM_Plex_Mono({ weight: ["500", "600"], subsets: ["latin", "latin-ext"], variable: "--font-plex" });

export const metadata: Metadata = {
  title: "alıcam.net — Talebini yaz, teklifler sana gelsin",
  description: "İhtiyacını ücretsiz paylaş, doğrulanmış hizmet verenlerden sana özel teklifler al ve karşılaştır.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="tr" className={`${inter.variable} ${fraunces.variable} ${plexMono.variable}`} data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
