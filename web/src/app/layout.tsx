import type { Metadata } from "next";
import { Fraunces, IBM_Plex_Mono, Inter, Plus_Jakarta_Sans } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { AssistantWidget } from "@/components/assistant/assistant-widget";
import { MessagesDock } from "@/components/messages/messages-dock";

const inter = Inter({ subsets: ["latin", "latin-ext"], variable: "--font-inter" });
const fraunces = Fraunces({ subsets: ["latin", "latin-ext"], variable: "--font-fraunces" });
const plexMono = IBM_Plex_Mono({ weight: ["500", "600"], subsets: ["latin", "latin-ext"], variable: "--font-plex" });
// Yeni tasarimin baslik yazi tipi; govde Inter olarak kaliyor.
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin", "latin-ext"], variable: "--font-jakarta" });

/**
 * Google Analytics 4 olcum kimligi. Gizli bir deger DEGIL: sayfa
 * kaynaginda zaten herkese gorunur, bu yuzden ortam degiskenine
 * tasinmadi -- sunucuda ayrica bir adim gerektirmesin.
 */
const GA_KIMLIK = "G-RNYFZVXJT7";

export const metadata: Metadata = {
  title: "alıcam.net — Talebini yaz, teklifler sana gelsin",
  description: "İhtiyacını ücretsiz paylaş, doğrulanmış hizmet verenlerden sana özel teklifler al ve karşılaştır.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // suppressHydrationWarning <html> UZERINDE zorunlu: asagidaki betik
  // data-oturum oznitelıgini React hidrasyona baslamadan ONCE ekliyor, yani
  // sunucunun gonderdigi HTML ile tarayicidaki agac ayrisiyor. Isaret
  // yalnizca BU ogenin kendi oznitelikleri icin gecerli, alt agaca inmiyor.
  // (Next belgesi: "How to prevent flash before hydration".)
  return (
    <html
      className={`${inter.variable} ${fraunces.variable} ${plexMono.variable} ${jakarta.variable}`}
      data-scroll-behavior="smooth"
      lang="tr"
      suppressHydrationWarning
    >
      <head>
        {/*
          Ilk BOYAMADAN once calisan tek satir.

          Sunucu oturumu bilmiyor, /me cevabi da ilk cizimden sonra geliyor.
          Bu yuzden oturumu acik olan bir kullanici once MISAFIR cubugunu
          goruyordu: turuncu "Talep olustur" dugmesi bir gorunup, cevap
          gelince yerini hesap menusune birakip kayboluyordu. Telefonda
          cubugun yarisi oldugu icin gozden kacmasi mumkun degildi.

          <head> ICINDE olmali: <html>'in dogrudan cocugu olarak yazilinca
          "In HTML, <script> cannot be a child of <html>" hatasi veriyor ve
          tarayici onu govdeye tasidigi icin hidrasyon da kiriliyor.

          Iz onceki ziyaretten localStorage'da geliyor. Yetki DEGIL, yalnizca
          yerlesim tahmini -- yanlis cikarsa /me cevabi duzeltir.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: "try{if(localStorage.getItem('alicam:oturum-vardi')==='1')document.documentElement.dataset.oturum='1'}catch(e){}",
          }}
        />
      </head>
      {/* Alt bilgi ARTIK BURADA DEGIL. Eskiden PublicFooter yol adina
          bakan sabit bir listeden karar veriyordu ve yeni sayfa eklendiginde
          o liste guncellenmedigi icin alt bilgi 21 rotanin 15'inde yoktu.
          Karari artik sayfanin kendi PageShell'i veriyor.

          admin-standard.css de buradan kalkti: admin renk kurallari her
          genel sayfaya yukleniyordu, artik yalnizca admin sayfalari
          kendileri iceri aliyor. */}
      <body>
        {children}
        <MessagesDock />
        <AssistantWidget />

        {/* Google Analytics.
            next/script ile veriliyor: Next'in kendi belgesi analitigi
            "afterInteractive" icin ornek gosteriyor (02-components/script.md).
            Duz <script> olarak <head>'e yazilsaydi ilk boyamayi bekletirdi;
            bu haliyle sayfa cizildikten sonra yukleniyor ve olcum ayni
            sekilde calisiyor.

            YALNIZCA uretimde: yoksa her yerel gelistirme sayfasi gercek
            raporlara dusup sayilari kirletir. */}
        {process.env.NODE_ENV === "production" && <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_KIMLIK}`} strategy="afterInteractive" />
          <Script id="google-analytics" strategy="afterInteractive">
            {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA_KIMLIK}');`}
          </Script>
        </>}
      </body>
    </html>
  );
}
