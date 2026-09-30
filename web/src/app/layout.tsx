import type { Metadata } from "next";
import { Fraunces, IBM_Plex_Mono, Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { AssistantWidget } from "@/components/assistant/assistant-widget";
import { MessagesDock } from "@/components/messages/messages-dock";

const inter = Inter({ subsets: ["latin", "latin-ext"], variable: "--font-inter" });
const fraunces = Fraunces({ subsets: ["latin", "latin-ext"], variable: "--font-fraunces" });
const plexMono = IBM_Plex_Mono({ weight: ["500", "600"], subsets: ["latin", "latin-ext"], variable: "--font-plex" });
// Yeni tasarimin baslik yazi tipi; govde Inter olarak kaliyor.
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin", "latin-ext"], variable: "--font-jakarta" });

export const metadata: Metadata = {
  title: "alıcam.net — Talebini yaz, teklifler sana gelsin",
  description: "İhtiyacını ücretsiz paylaş, doğrulanmış hizmet verenlerden sana özel teklifler al ve karşılaştır.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="tr" className={`${inter.variable} ${fraunces.variable} ${plexMono.variable} ${jakarta.variable}`} data-scroll-behavior="smooth">
      {/* Alt bilgi ARTIK BURADA DEGIL. Eskiden PublicFooter yol adina
          bakan sabit bir listeden karar veriyordu ve yeni sayfa eklendiginde
          o liste guncellenmedigi icin alt bilgi 21 rotanin 15'inde yoktu.
          Karari artik sayfanin kendi PageShell'i veriyor.

          admin-standard.css de buradan kalkti: admin renk kurallari her
          genel sayfaya yukleniyordu, artik yalnizca admin sayfalari
          kendileri iceri aliyor. */}
      <body>{children}<MessagesDock /><AssistantWidget /></body>
    </html>
  );
}
