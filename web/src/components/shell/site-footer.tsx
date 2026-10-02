"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { apiRequest } from "@/lib/api";
import { BrandLogo } from "./brand";
import styles from "./site-footer.module.css";

/* ================= Simgeler ================= */

const socialIcons: Record<string, React.ReactNode> = {
  instagram: <svg aria-hidden="true" viewBox="0 0 24 24">
    <rect fill="none" height="18" rx="5" stroke="currentColor" strokeWidth="2" width="18" x="3" y="3" />
    <circle cx="12" cy="12" fill="none" r="4" stroke="currentColor" strokeWidth="2" />
    <circle cx="17.5" cy="6.5" fill="currentColor" r="1.3" />
  </svg>,
  youtube: <svg aria-hidden="true" viewBox="0 0 24 24">
    <path d="M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2 26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8ZM10 15V9l5.2 3L10 15Z" fill="currentColor" />
  </svg>,
  tiktok: <svg aria-hidden="true" viewBox="0 0 24 24">
    <path d="M16.6 5.8A4.3 4.3 0 0 1 15.5 3h-3.1v12.4a2.6 2.6 0 1 1-2.6-2.6c.3 0 .5 0 .8.1V9.7a5.8 5.8 0 1 0 5 5.7V9.1a7.4 7.4 0 0 0 4.3 1.4V7.4a4.3 4.3 0 0 1-3.3-1.6Z" fill="currentColor" />
  </svg>,
  x: <svg aria-hidden="true" viewBox="0 0 24 24">
    <path d="M17.8 3h3.1l-6.8 7.8L22 21h-6.2l-4.9-6.4L5.3 21H2.2l7.3-8.3L2 3h6.4l4.4 5.8L17.8 3Zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5Z" fill="currentColor" />
  </svg>,
  facebook: <svg aria-hidden="true" viewBox="0 0 24 24">
    <path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.8 3.7-3.8 1.1 0 2.2.2 2.2.2v2.4h-1.2c-1.2 0-1.6.8-1.6 1.6V12h2.7l-.4 2.9h-2.3v7A10 10 0 0 0 22 12Z" fill="currentColor" />
  </svg>,
  linkedin: <svg aria-hidden="true" viewBox="0 0 24 24">
    <path d="M5 3.4a2.3 2.3 0 1 0 0 4.6 2.3 2.3 0 0 0 0-4.6ZM3 9.3h4V21H3V9.3Zm6.4 0h3.8V11h.1c.5-1 1.9-2 3.8-2 4 0 4.9 2.4 4.9 5.7V21h-4v-5.6c0-1.4 0-3.1-2-3.1s-2.3 1.5-2.3 3V21h-4V9.3Z" fill="currentColor" />
  </svg>,
};

const storeIcons = {
  apple: <svg aria-hidden="true" viewBox="0 0 24 24">
    <path d="M16.4 12.6c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.4-.9-1.7 0-3.3 1-4.2 2.6-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.2 2.6 1.3-.1 1.8-.8 3.3-.8 1.6 0 2 .8 3.4.8 1.4 0 2.3-1.3 3.1-2.5 1-1.4 1.4-2.8 1.4-2.9 0 0-2.7-1-2.7-4.1ZM13.9 5.1c.7-.9 1.2-2.1 1.1-3.3-1 0-2.3.7-3 1.6-.7.8-1.3 2-1.1 3.2 1.1.1 2.3-.6 3-1.5Z" fill="currentColor" />
  </svg>,
  play: <svg aria-hidden="true" viewBox="0 0 24 24">
    <path d="M3.6 2.3c-.3.3-.4.7-.4 1.2v17c0 .5.2.9.4 1.2l9.6-9.7-9.6-9.7Z" fill="#34A853" />
    <path d="m16.4 15.2-3.2-3.2 3.2-3.2 3.7 2.1c1 .6 1 1.6 0 2.2l-3.7 2.1Z" fill="#FBBC04" />
    <path d="M16.4 15.2 13.2 12l-9.6 9.7c.4.4 1 .4 1.7 0l11.1-6.5Z" fill="#EA4335" />
    <path d="M16.4 8.8 5.3 2.3c-.7-.4-1.3-.4-1.7 0l9.6 9.7 3.2-3.2Z" fill="#4285F4" />
  </svg>,
  gallery: <svg aria-hidden="true" viewBox="0 0 24 24">
    <rect fill="#C8102E" height="21" rx="6" width="21" x="1.5" y="1.5" />
    <path d="M8 8.5a4 4 0 0 0 8 0" fill="none" stroke="#fff" strokeLinecap="round" strokeWidth="1.8" />
  </svg>,
};

/* ================= Veri ================= */

type TickerItem = { key: string; icon: string; title: string; district: string; offers: number };

type MarketplaceResponse = {
  data: {
    requests: {
      id: number;
      title: string;
      category: { icon: string | null };
      location: { district: { name: string } };
      offer_count: number;
    }[];
  };
};

type SocialLink = { platform: string; url: string };

type SiteSettingsResponse = { data: { social: SocialLink[] } };

/**
 * Serit hicbir zaman bos kalmasin: uc ulasilamazsa bu kucuk liste gosterilir.
 * Gercek veri geldiginde yerini birakir.
 */
const fallbackTicker: TickerItem[] = [
  { key: "f1", icon: "🏠", title: "3+1 kiralık daire", district: "Ataşehir", offers: 6 },
  { key: "f2", icon: "🔧", title: "Kombi bakımı", district: "Kadıköy", offers: 3 },
  { key: "f3", icon: "🚗", title: "Otomatik dizel otomobil", district: "Çankaya", offers: 4 },
  { key: "f4", icon: "📱", title: "iPhone 15 128 GB", district: "Karşıyaka", offers: 5 },
  { key: "f5", icon: "🚚", title: "Evden eve nakliyat", district: "Nilüfer", offers: 9 },
  { key: "f6", icon: "🧊", title: "Çamaşır makinesi", district: "Muratpaşa", offers: 7 },
  { key: "f7", icon: "🎨", title: "Boya badana 2+1", district: "Bornova", offers: 8 },
  { key: "f8", icon: "📘", title: "LGS matematik dersi", district: "Şahinbey", offers: 8 },
];

/**
 * Serit verisi modul duzeyinde saklanir: alt bilgi her sayfada duruyor,
 * her gezinmede yeniden istek atmasinin anlami yok.
 */
let tickerCache: TickerItem[] | null = null;

/** Simgenin yaninda okunan ad; aria-label buradan geliyor. */
const socialLabels: Record<string, string> = {
  instagram: "Instagram",
  youtube: "YouTube",
  tiktok: "TikTok",
  x: "X",
  facebook: "Facebook",
  linkedin: "LinkedIn",
};

/**
 * Adresler de serit gibi modul duzeyinde saklanir; nadiren degisiyorlar.
 *
 * Seritten farkli olarak burada GOMULU BIR YEDEK YOK. Yedek liste
 * yoneticinin kaldirdigi bir hesabi geri getirirdi: uc cevap vermediginde
 * ya da hesap listesi bosaldiginda ekranda eski adresler kalir ve
 * ziyaretci artik bize ait olmayan bir hesaba tiklardi. Hesap
 * gostermemek, yanlis hesap gostermekten iyidir.
 */
let socialCache: SocialLink[] | null = null;

/**
 * Tasarimin yedi dikeyi. Statik tasarimda "tip" kimlikleriydi; burada
 * gercek kategori agacinin kok slug'larina baglaniyorlar ki sihirbaz
 * dogrudan o dalda acilsin.
 */
const verticals = [
  { slug: "ustalar-hizmetler", name: "Hizmet", icon: "🛠️", color: "var(--v-hizmet)" },
  { slug: "emlak", name: "Emlak", icon: "🏠", color: "var(--v-emlak)" },
  { slug: "vasita", name: "Vasıta", icon: "🚗", color: "var(--v-vasita)" },
  { slug: "elektronik-teknoloji", name: "Alışveriş", icon: "🛍️", color: "var(--v-alisveris)" },
  { slug: "is-makineleri-sanayi", name: "İş Makineleri", icon: "🚜", color: "var(--v-makine)" },
  { slug: "is-ilanlari-yardimci-arayanlar", name: "Eleman", icon: "💼", color: "var(--v-eleman)" },
  { slug: "hayvanlar-alemi", name: "Hayvanlar", icon: "🐾", color: "var(--v-hayvan)" },
];

const stores = [
  { key: "apple", icon: storeIcons.apple, title: "App Store'dan", hint: "İndirebilirsiniz" },
  { key: "play", icon: storeIcons.play, title: "Google Play'den", hint: "İndirebilirsiniz" },
  { key: "gallery", icon: storeIcons.gallery, title: "AppGallery'den", hint: "İndirebilirsiniz" },
];

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ================= Alt bilgi ================= */

/**
 * Yeni tasarimin alt bilgisi: kayan acik talep seridi, buyuk soz ve hizli
 * baslatma kutusu, bag sutunlari, uygulama seridi, dev imza yazisi ve alt
 * cizgi. Serit gercek /marketplace ucundan beslenir.
 */
/**
 * Alt bilgi.
 *
 * compact: calisma ekranlarinda kullanilan kisa hal. Pazarlama bolumleri
 * (kayan talep seridi, "Sen iste onlar teklif versin" bolumu, hizli
 * baslatma kutusu, bag sutunlari, uygulama seridi ve dev imza) BASILMAZ.
 * Satici kendi tekliflerini yonetirken ekranin altinda ona talep
 * olusturmasini oneren bir tanitim blogu cikiyordu; calisma ekraniyla
 * pazarlama sayfasi birbirine giriyordu. Geriye yasal baglantilar,
 * iletisim ve telif satiri kaliyor.
 */
export function SiteFooter({ compact = false }: { compact?: boolean } = {}) {
  const router = useRouter();
  const [items, setItems] = useState<TickerItem[]>(() => tickerCache ?? fallbackTicker);
  const [social, setSocial] = useState<SocialLink[]>(() => socialCache ?? []);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const [markUp, setMarkUp] = useState(false);
  const [markLive, setMarkLive] = useState(false);
  const markRef = useRef<HTMLDivElement>(null);

  // Serit: herkese acik anonim talepler. Bir kez okunur, sonra onbellekten.
  useEffect(() => {
    if (tickerCache) return;
    let active = true;
    apiRequest<MarketplaceResponse>("/marketplace?sort=latest")
      .then((response) => {
        const next = response.data.requests.slice(0, 14).map((request) => ({
          key: String(request.id),
          icon: request.category.icon || "◆",
          title: request.title,
          district: request.location.district.name,
          offers: request.offer_count,
        }));
        if (next.length === 0) return;
        tickerCache = next;
        if (active) setItems(next);
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  // Sosyal hesaplar: yonetim panelinden degisebiliyor, o yuzden gomulu degil.
  useEffect(() => {
    if (socialCache) return;
    let active = true;
    apiRequest<SiteSettingsResponse>("/site-settings")
      .then((response) => {
        // Bos dizi gecerli bir cevap: seritteki gibi "veri yok" degil,
        // "yonetici butun hesaplari kaldirdi" demek. Es gecilirse hesaplar
        // hicbir zaman kapatilamazdi.
        socialCache = response.data.social;
        if (active) setSocial(socialCache);
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  // Bildirim balonu kendi kendini kapatir.
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  // Dev imza ekrana girince alt kenardan yukselir. Hareket azaltilmissa
  // sinif hic eklenmez; yazi CSS tarafinda zaten yerinde durur.
  useEffect(() => {
    const node = markRef.current;
    if (!node || prefersReducedMotion()) return;
    if (typeof IntersectionObserver === "undefined") {
      let active = true;
      Promise.resolve().then(() => { if (active) setMarkUp(true); });
      return () => { active = false; };
    }
    const watcher = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) { setMarkUp(true); watcher.disconnect(); }
    }, { threshold: .35 });
    watcher.observe(node);
    return () => watcher.disconnect();
  }, []);

  const trackPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    if (prefersReducedMotion()) return;
    const node = event.currentTarget;
    const box = node.getBoundingClientRect();
    node.style.setProperty("--mx", `${(((event.clientX - box.left) / box.width) * 100).toFixed(1)}%`);
    node.style.setProperty("--my", `${(((event.clientY - box.top) / box.height) * 100).toFixed(1)}%`);
    if (!markLive) setMarkLive(true);
  };

  /**
   * Hizli baslat: yazilan metni gercek kategori aramasindan gecirir, bulursa
   * sihirbazi o dalda acar. Bulamazsa metni baslik olarak tasir.
   */
  const startRequest = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = query.trim();
    if (!text) return;

    const go = (slug?: string) => {
      const params = new URLSearchParams();
      if (slug) params.set("kategori", slug);
      params.set("baslik", text);
      router.push(`/talep-olustur?${params.toString()}`);
    };

    if (text.length < 2) { go(); return; }

    setBusy(true);
    apiRequest<{ data: { slug: string }[] }>(`/categories/search?q=${encodeURIComponent(text)}&limit=1`)
      .then((response) => go(response.data[0]?.slug))
      .catch(() => go())
      .finally(() => setBusy(false));
  };

  // Adres dogrudan bir href'e giriyor: yonetim ucu kaydederken suzuyor
  // ama son kapi burada. Simgesi olmayan platform da basilmaz; eleme
  // cizimden once yapiliyor ki hicbiri kalmayinca kutu hic acilmasin.
  const visibleSocial = social.filter((link) => socialIcons[link.platform] && /^https?:\/\//i.test(link.url));

  const strip = (copy: number) => items.map((item) => <span className={styles.tk} key={`${copy}-${item.key}`}>
    <i>{item.icon}</i><b>{item.title}</b><em>{item.district}</em><u>{item.offers} teklif</u>
  </span>);

  return <footer className={styles.footer}>
    {/* 1) Kayan canli talep seridi */}
    {!compact && <div aria-label="Şu an açık talepler" className={styles.ticker}>
      <div className={styles.tickerLabel}><i className={styles.tickerDot} />Şu an açık</div>
      <div className={styles.tickerTrack}>
        <div className={styles.tickerMove}>{strip(0)}</div>
        <div aria-hidden="true" className={styles.tickerMove}>{strip(1)}</div>
      </div>
    </div>}

    {!compact && <>
      <div className={styles.wrap}>
        {/* 2) Buyuk soz + hizli baslat */}
        <div className={styles.hero}>
          <div className={styles.heroCopy}>
            <span className={styles.kicker}>Sen iste,</span>
            <h2>onlar teklif<br /><em>versin.</em></h2>
            <p>Usta, daire, araç ya da telefon. Ne istediğini bir kez yaz; gerisini alıcam.net halletsin.</p>
          </div>

          <form className={styles.quick} onSubmit={startRequest}>
            <label htmlFor="footer-quick">Ne istiyorsun?</label>
            <div className={styles.quickRow}>
              <input
                autoComplete="off"
                id="footer-quick"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Örn. 3+1 kiralık daire, kombi bakımı…"
                value={query}
              />
              <button className={styles.quickGo} disabled={busy} type="submit">
                {busy ? "Aranıyor…" : "Teklif al →"}
              </button>
            </div>
            <div className={styles.chips}>
              {verticals.map((vertical) => <Link
                href={`/talep-olustur?kategori=${vertical.slug}`}
                key={vertical.slug}
                style={{ "--c": vertical.color } as React.CSSProperties}
              ><i>{vertical.icon}</i>{vertical.name}</Link>)}
            </div>
          </form>
        </div>

        {/* 3) Bag sutunlari */}
        <div className={styles.columns}>
          <div className={styles.about}>
            {/* Zemin lacivert, o yuzden yazisi beyaz olan surum. */}
            <Link className={styles.brand} href="/"><BrandLogo height={36} tone="dark" /></Link>
            <p>Talep tabanlı pazaryeri. İlan aramak yok; ihtiyacını yaz, teklifler sana gelsin.</p>
            {visibleSocial.length > 0 && <div className={styles.social}>
              {visibleSocial.map((link) => <a
                aria-label={socialLabels[link.platform]}
                href={link.url}
                key={link.platform}
                rel="noopener noreferrer"
                target="_blank"
              >{socialIcons[link.platform]}</a>)}
            </div>}
          </div>

          <nav className={styles.column}>
            <h3>Talep oluştur</h3>
            <Link href="/talep-olustur?kategori=ustalar-hizmetler">Usta ve hizmet</Link>
            <Link href="/talep-olustur?kategori=konut">Kiralık ve satılık konut</Link>
            <Link href="/talep-olustur?kategori=tadilat-tamirat">Tadilat ve tamirat</Link>
            <Link href="/talep-olustur?kategori=vasita">Araç</Link>
            <Link href="/talep-olustur?kategori=elektronik-teknoloji">Ürün ve elektronik</Link>
          </nav>

          <nav className={styles.column}>
            <h3>Teklif verenler</h3>
            <Link href="/satici-ol">Teklif veren ol</Link>
            <Link href="/#teklif-ver">Nasıl kazanırım?</Link>
            <Link href="/kredi-yukle">Kredi paketleri</Link>
            <Link href="/#son-talepler">Açık talepler</Link>
          </nav>

          <nav className={styles.column}>
            <h3>alıcam.net</h3>
            <Link href="/#nasil-calisir">Nasıl çalışır?</Link>
            <Link href="/#guven">Neden alıcam.net?</Link>
            <Link href="/#sss">Sık sorulanlar</Link>
            <a href="mailto:destek@alicam.net">Destek</a>
          </nav>

          <nav className={styles.column}>
            <h3>Hesabın</h3>
            <Link href="/giris">Giriş yap</Link>
            <Link href="/giris">Ücretsiz üye ol</Link>
            <Link href="/talep-olustur">Talep oluştur</Link>
          </nav>

          {/* Kurumsal: isletme kimligi, iletisim ve yasal metinler bir arada.
              Yasal baglantilar eskiden en alttaki ince cizgideydi; tam alt
              bilgide artik burada duruyorlar. Kisa alt bilgide sutun yok,
              orada alt cizgide kalmaya devam ediyorlar. */}
          <nav className={styles.column}>
            <h3>Kurumsal</h3>
            <span className={styles.unvan}>SMN LIFE İnş. Tic. Ltd. Şti.</span>
            <a href="mailto:destek@alicam.net">destek@alicam.net</a>
            <Link href="/kullanim-kosullari">Kullanım koşulları</Link>
            <Link href="/gizlilik">Gizlilik politikası</Link>

          </nav>
        </div>

        {/* Uygulama seridi: magaza rozetleri henuz gercek bir baglanti degil. */}
        <div className={styles.appStrip}>
          <div className={styles.appCopy}>
            <span aria-hidden="true">📱</span>
            <div>
              <strong>Talebin cebinde</strong>
              <small>Yeni teklif gelince anında bildirim al, her yerden karşılaştır.</small>
            </div>
          </div>
          <div className={styles.stores}>
            {stores.map((store) => <button
              className={styles.store}
              key={store.key}
              onClick={() => setToast({ id: Date.now(), text: "alıcam.net uygulaması çok yakında mağazalarda!" })}
              type="button"
            >
              {store.icon}
              <span><b>{store.title}</b><small>{store.hint}</small></span>
            </button>)}
          </div>
        </div>
      </div>

      {/* 4) Dev imza yazisi: isik fareyi takip eder, yazi alttan yukselir. */}
      <div
        aria-hidden="true"
        className={`${styles.mark} ${markUp ? styles.markUp : ""} ${markLive ? styles.markLive : ""}`}
        onPointerLeave={() => setMarkLive(false)}
        onPointerMove={trackPointer}
        ref={markRef}
      ><span>alıcam<em>.net</em></span></div>
    </>}

    {/* 6) Alt cizgi: telif ve (kisa alt bilgide) yasal baglantilar. */}
    <div className={`${styles.wrap} ${styles.bottom}`}>
      <span>© 2026 alıcam.net · SMN LIFE İnş. Tic. Ltd. Şti. Her hakkı saklıdır.</span>
      {/* Yasal baglantilar tam alt bilgide Kurumsal sutununda duruyor; burada
          tekrar basmak ayni uc baglantiyi iki kez gostermek olurdu. Kisa alt
          bilgide sutun YOK, orada tek yerleri bu satir. */}
      {compact && <nav>
        <Link href="/kullanim-kosullari">Kullanım koşulları</Link>
        <Link href="/gizlilik">Gizlilik politikası</Link>
        <a href="mailto:destek@alicam.net">destek@alicam.net</a>
      </nav>}
      <button
        aria-label="Sayfanın başına dön"
        className={styles.toTop}
        onClick={() => window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" })}
        type="button"
      >↑</button>
      {/* Guven rozetleri telif yazisinin SAGINDA, ayni satirda. Yukari
          dugmesi akistan cikarilip katmanlandi (.toTop), yani rozetlerin
          sagina dusmuyor; satirin sag dolgusu ona yer ayiriyor. */}
      <div className={styles.rozetler}>
      <a href="https://etbis.ticaret.gov.tr/" rel="noopener noreferrer" target="_blank">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img alt="ETBİS'e kayıtlıdır" className={styles.etbis} height={120} loading="lazy" src="/odeme-marka/etbis.jpg" width={104} />
      </a>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt="SSL ile şifrelenmiş bağlantı" className={styles.ssl} height={52} loading="lazy" src="/odeme-marka/ssl.png" width={160} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt="Visa, Mastercard, troy ve PayTR ile ödeme" className={styles.kartBandi} height={26} loading="lazy" src="/odeme-marka/kart-bandi.png" width={349} />
      </div>
    </div>

    {toast && <div className={styles.toast} role="status">{toast.text}</div>}
  </footer>;
}

