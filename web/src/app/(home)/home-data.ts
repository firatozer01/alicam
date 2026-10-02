/**
 * Ana sayfanin veri sozlesmesi ve sabitleri.
 *
 * Tasarim kaynagi: alicam-yeni-tasarim/index.html + anasayfa.js + site.js.
 * Mockup'taki gomulu kategori listeleri BURADA YOK: kategori, il ve talep
 * verisinin tamami gercek API'den gelir. Burada yalnizca API'de karsiligi
 * olmayan seyler durur: dikey tanimlari, arama kartinin alan semasi,
 * SSS metinleri ve hero'daki ORNEK talep karti.
 */

/* ================= API TIPLERI ================= */

export type CurrentUser = { id: number; name: string; email: string; roles: string[] };

export type CatalogCard = {
  id: number;
  slug: string;
  name: string;
  icon: string;
  color: string;
  /** Gercek fotograf; yoksa kart emojiye duser. */
  image_url: string | null;
  root: { slug: string; name: string };
  leaf_samples: string[];
  child_count: number;
  request_count: number;
  seller_count: number | null;
  rating: number | null;
  review_count: number | null;
  badge: string | null;
};

export type CatalogChild = { id: number; slug: string; name: string; icon: string | null };

export type CatalogGroup = {
  id: number;
  slug: string;
  name: string;
  icon: string;
  color: string;
  image_url: string | null;
  child_count: number;
  children: CatalogChild[];
};

export type ListingRoot = {
  id: number;
  slug: string;
  name: string;
  icon: string;
  color: string;
  image_url: string | null;
};

export type CatalogStats = { service_roots: number; service_headings: number; cities: number; districts: number };

export type Catalog = {
  copy: Record<string, string>;
  popular: CatalogCard[];
  trending: { mode: "trend" | "seasonal"; window_days: number; items: CatalogCard[] };
  groups: CatalogGroup[];
  listing_roots: ListingRoot[];
  stats: CatalogStats;
};

export type Suggestion = { id: number; slug: string; name: string; kind: "service" | "listing"; path: string[] };

export type City = { id: number; name: string; districts: { id: number; name: string }[] };

export type MarketRequest = {
  id: number;
  reference: string;
  title: string;
  summary: string;
  budget: { min: string | null; max: string | null };
  category: { id: number; name: string; slug: string; icon: string | null; color: string | null };
  extra_categories: { name: string; slug: string; icon: string | null; color: string | null }[];
  location: { city: { id: number; name: string }; district: { id: number; name: string } };
  offer_count: number;
  status: string;
  created_at: string;
};

export type MarketPayload = {
  data: { requests: MarketRequest[]; stats: { active_requests: number; approved_sellers: number; reviews: number } };
  meta: { total: number };
};

/* ================= DIKEYLER ================= */

export type VerticalId = "hizmet" | "emlak" | "vasita" | "alisveris" | "makine" | "eleman" | "hayvan";

export type Vertical = {
  id: VerticalId;
  name: string;
  emoji: string;
  /** globals.css'teki dikey rengi. */
  color: string;
  desc: string;
  who: string;
  /**
   * Bu dikeyin gercek katalogdaki kok slug'lari. Hizmet bostur: on hizmet
   * kokunun tamami ona aittir ve katalog cagrisindan gelir.
   */
  roots: string[];
};

export const VERTICALS: Vertical[] = [
  { id: "hizmet", name: "Hizmet", emoji: "🛠️", color: "var(--v-hizmet)", desc: "Usta, tamir, temizlik, nakliyat, ders", who: "ustalar ve firmalar", roots: [] },
  { id: "emlak", name: "Emlak", emoji: "🏠", color: "var(--v-emlak)", desc: "Kiralık, satılık daire, ev, işyeri, arsa", who: "emlakçılar ve ev sahipleri", roots: ["emlak"] },
  { id: "vasita", name: "Vasıta", emoji: "🚗", color: "var(--v-vasita)", desc: "Otomobil, SUV, motosiklet, ticari araç", who: "galeriler ve araç sahipleri", roots: ["vasita"] },
  { id: "alisveris", name: "Alışveriş", emoji: "🛍️", color: "var(--v-alisveris)", desc: "Telefon, bilgisayar, beyaz eşya, mobilya", who: "mağazalar ve satıcılar", roots: ["elektronik-teknoloji", "yasam-ve-hobi"] },
  { id: "makine", name: "İş Makineleri", emoji: "🚜", color: "var(--v-makine)", desc: "Kiralık / satılık iş makinesi, tarım, sanayi", who: "makine firmaları", roots: ["is-makineleri-sanayi"] },
  { id: "eleman", name: "Eleman", emoji: "💼", color: "var(--v-eleman)", desc: "Bakıcı, şoför, garson, usta eleman", who: "iş arayanlar ve ajanslar", roots: ["is-ilanlari-yardimci-arayanlar"] },
  { id: "hayvan", name: "Hayvanlar", emoji: "🐾", color: "var(--v-hayvan)", desc: "Kedi, köpek, kuş, akvaryum, çiftlik", who: "üreticiler ve sahiplendirenler", roots: ["hayvanlar-alemi"] },
];

export function findVertical(id: VerticalId): Vertical {
  return VERTICALS.find((item) => item.id === id) ?? VERTICALS[0];
}

/**
 * Bir kategori slug'indan dikeyi bulur.
 *
 * Tohumlanan agacta her slug kendi kokunun slug'i ile baslar
 * ("emlak-konut-konut-daire"), bu yuzden on ek eslesmesi yeterli.
 * Eslesme yoksa hizmete duser: ana kutle hizmet talebi.
 */
export function verticalOfSlug(slug: string): Vertical {
  for (const vertical of VERTICALS) {
    for (const root of vertical.roots) {
      if (slug === root || slug.startsWith(`${root}-`)) return vertical;
    }
  }
  return VERTICALS[0];
}

/** Akis filtresi: dikeyin kok slug'lari, hizmette katalogdan gelen on kok. */
export function filterSlugs(id: VerticalId | "all" | "diger", serviceRoots: string[]): string {
  if (id === "all") return "";
  if (id === "hizmet") return serviceRoots.join(",");
  if (id === "diger") {
    return VERTICALS.filter((item) => ["makine", "eleman", "hayvan"].includes(item.id))
      .flatMap((item) => item.roots)
      .concat("ustalar-hizmetler")
      .join(",");
  }
  return findVertical(id).roots.join(",");
}

/* ================= ARAMA KARTI (FINDER) ================= */

export type FinderTabId = "hizmet" | "emlak" | "vasita" | "alisveris" | "makine";

export type FinderField = {
  id: string;
  label: string;
  /**
   * text     — serbest metin, istege bagli oneri listesi
   * select   — sabit secenekler
   * category — sekmenin kokunun GERCEK alt kategorileri
   * city     — GERCEK il listesi
   * seg      — iki dugmeli acma/kapama (Kiralık / Satılık)
   */
  kind: "text" | "select" | "category" | "city" | "seg";
  ph?: string;
  grow?: boolean;
  num?: boolean;
  /** Canli oneri: /categories/search?kind=… */
  suggest?: "service" | "listing";
  opts?: string[];
};

export const FINDER_TABS: FinderTabId[] = ["hizmet", "emlak", "vasita", "alisveris", "makine"];

const MARKALAR = [
  "Audi", "BMW", "Citroën", "Dacia", "Fiat", "Ford", "Honda", "Hyundai", "Kia", "Mercedes-Benz",
  "Nissan", "Opel", "Peugeot", "Renault", "Seat", "Skoda", "Tesla", "Togg", "Toyota", "Volkswagen", "Volvo", "Diğer",
];

/** 2026'dan 2008'e; sabit liste, sunucu ve tarayici ayni HTML'i uretsin. */
const YEARS = ["Farketmez", ...Array.from({ length: 19 }, (_, index) => String(2026 - index))];

export const FINDER: Record<FinderTabId, { fields: FinderField[] }> = {
  hizmet: {
    fields: [
      { id: "hizmet", label: "Ne lazım?", kind: "text", ph: "Örn. kombi bakımı, ev temizliği, nakliyat", grow: true, suggest: "service" },
      { id: "il", label: "Nerede?", kind: "city" },
    ],
  },
  emlak: {
    fields: [
      { id: "islem", label: "Ne arıyorsun?", kind: "seg", opts: ["Kiralık", "Satılık"] },
      { id: "kategori", label: "Emlak tipi", kind: "category" },
      { id: "oda", label: "Oda sayısı", kind: "select", opts: ["Farketmez", "1+0", "1+1", "2+1", "3+1", "4+1 ve üzeri"] },
      { id: "il", label: "Nerede?", kind: "city" },
      { id: "butce", label: "En fazla", kind: "text", ph: "Örn. 25.000 ₺", num: true },
    ],
  },
  vasita: {
    fields: [
      { id: "kategori", label: "Araç tipi", kind: "category" },
      { id: "marka", label: "Marka", kind: "select", opts: ["Farketmez", ...MARKALAR] },
      { id: "yil", label: "En az model yılı", kind: "select", opts: YEARS },
      { id: "butce", label: "En fazla", kind: "text", ph: "Örn. 1.200.000 ₺", num: true },
    ],
  },
  alisveris: {
    fields: [
      { id: "urun", label: "Ne almak istiyorsun?", kind: "text", ph: "Örn. iPhone 15, çamaşır makinesi, 3'lü koltuk", grow: true, suggest: "listing" },
      { id: "durum", label: "Durumu", kind: "select", opts: ["Farketmez", "Sıfır", "İkinci el"] },
      { id: "butce", label: "En fazla", kind: "text", ph: "Örn. 30.000 ₺", num: true },
    ],
  },
  makine: {
    fields: [
      { id: "urun", label: "Hangi makine?", kind: "text", ph: "Örn. mini ekskavatör, forklift, traktör", grow: true, suggest: "listing" },
      { id: "islem", label: "İşlem", kind: "seg", opts: ["Kiralık", "Satılık"] },
      { id: "il", label: "Nerede?", kind: "city" },
    ],
  },
};

/* ================= HERO: ORNEK TALEP ================= */

export type HeroSample = {
  vertical: VerticalId;
  title: string;
  loc: string;
  specs: string[];
  budget: string;
  offers: { initials: string; color: string; name: string; rating: string; note: string; price: string }[];
};

/**
 * Hero'daki canlandirma. ORNEKTIR ve ekranda da oyle etiketlenir:
 * gercek talep akisi "Son talepler" bolumunde, API'den gelir.
 */
export const HERO_SAMPLES: HeroSample[] = [
  {
    vertical: "emlak", title: "3+1 kiralık daire, site içinde", loc: "Ataşehir, İstanbul",
    specs: ["3+1", "120 m²+", "Otoparklı", "Metroya yakın"], budget: "35.000 – 42.000 ₺ / ay",
    offers: [
      { initials: "EG", color: "#0E9F5A", name: "Ekin Gayrimenkul", rating: "4,9", note: "Ataşehir · 3+1 · 125 m²", price: "39.500 ₺" },
      { initials: "MY", color: "#1B5CFF", name: "Mavi Yapı Emlak", rating: "4,7", note: "Kozyatağı · 3+1 · 130 m²", price: "41.000 ₺" },
      { initials: "SK", color: "#7A5AF8", name: "Site sahibi", rating: "5,0", note: "Ataşehir · 3+1 · 118 m²", price: "37.000 ₺" },
    ],
  },
  {
    vertical: "vasita", title: "Otomatik vites dizel otomobil", loc: "Çankaya, Ankara",
    specs: ["2019 ve sonrası", "Dizel", "Otomatik", "150.000 km altı"], budget: "900.000 – 1.150.000 ₺",
    offers: [
      { initials: "AO", color: "#F2600C", name: "Anka Otomotiv", rating: "4,8", note: "2020 · 98.000 km · Hasarsız", price: "1.090.000 ₺" },
      { initials: "BG", color: "#0A1433", name: "Başkent Galeri", rating: "4,6", note: "2019 · 121.000 km", price: "965.000 ₺" },
      { initials: "KT", color: "#0EA5B7", name: "Kuzey Trade", rating: "4,9", note: "2021 · 74.000 km", price: "1.140.000 ₺" },
    ],
  },
  {
    vertical: "hizmet", title: "Kombi yıllık bakımı", loc: "Kadıköy, İstanbul",
    specs: ["Bu hafta", "Duvar tipi", "Hafta sonu olur"], budget: "1.500 – 2.500 ₺",
    offers: [
      { initials: "IT", color: "#1B5CFF", name: "Isı Teknik Servis", rating: "4,9", note: "212 iş · 2 dk önce", price: "1.850 ₺" },
      { initials: "KU", color: "#0EA5B7", name: "Kadıköy Usta", rating: "4,8", note: "96 iş · 5 dk önce", price: "1.700 ₺" },
      { initials: "DG", color: "#0E9F5A", name: "Doğalgaz Garaj", rating: "5,0", note: "340 iş · 9 dk önce", price: "1.650 ₺" },
    ],
  },
  {
    vertical: "alisveris", title: "Telefon, 128 GB, garantili", loc: "Karşıyaka, İzmir",
    specs: ["Sıfır veya az kullanılmış", "Garantili", "Kargo olur"], budget: "38.000 – 45.000 ₺",
    offers: [
      { initials: "TM", color: "#7A5AF8", name: "Tekno Market", rating: "4,8", note: "Sıfır · 2 yıl garanti", price: "44.500 ₺" },
      { initials: "İK", color: "#F5A524", name: "İzmir Telekom", rating: "4,6", note: "Yenilenmiş · 1 yıl garanti", price: "39.900 ₺" },
      { initials: "SB", color: "#E8488A", name: "Bireysel satıcı", rating: "4,9", note: "3 aylık · kutulu", price: "38.500 ₺" },
    ],
  },
];

/* ================= TEKLIF VERENLER ================= */

export const PRO_EXAMPLES: Record<string, { label: string; lead: string; bold: string; tail: string }> = {
  usta: { label: "🛠️ Usta / Firma", lead: "Örnek: Kadıköy'de ", bold: "kombi bakımı", tail: " isteyen biri bütçesini ve zamanını yazdı. Sen sadece teklifini gönder." },
  emlak: { label: "🏠 Emlakçı", lead: "Örnek: Ataşehir'de ", bold: "3+1 kiralık daire", tail: " arayan bir aile, 42.000 ₺ bütçeyle portföyündeki uygun daireyi bekliyor." },
  galeri: { label: "🚗 Galeri", lead: "Örnek: Ankara'da ", bold: "otomatik dizel otomobil", tail: " arayan bir alıcı 1,15 milyon ₺'ye kadar teklif bekliyor." },
  magaza: { label: "🛍️ Mağaza", lead: "Örnek: İzmir'de ", bold: "çamaşır makinesi", tail: " almak isteyen biri, montaj dahil en iyi fiyatı arıyor." },
};

export const PRO_WHO_IDS = ["usta", "emlak", "galeri", "magaza"];

/* ================= SSS ================= */

export type FaqItem = { id: string; topics: string[]; q: string; a: string };

export const FAQ: FaqItem[] = [
  { id: "nedir", topics: ["kategori"], q: "alıcam.net nedir, ilan sitelerinden farkı ne?", a: "İlan sitelerinde sen satıcıları ararsın. alıcam.net'te ise sen ne istediğini yazarsın, satıcılar seni bulur. Bir usta, kiralık bir daire, ikinci el bir araç ya da yeni bir telefon; ihtiyacını bir kez yazman yeterli." },
  { id: "ucretsiz", topics: ["ucret"], q: "Talep oluşturmak gerçekten ücretsiz mi?", a: "Evet. Talep oluşturmak, teklif almak ve teklifleri karşılaştırmak tamamen ücretsizdir. Ücreti yalnızca teklif verenler, ilgilendikleri talebin detayını açarken kredi olarak öder." },
  { id: "gizlilik", topics: ["gizlilik"], q: "Telefon numaram ve adresim kimlere görünür?", a: "Hiç kimseye otomatik olarak görünmez. Talep özetinde yalnızca kategori, ilçe, bütçe ve kısa açıklama yer alır. İletişim bilgilerin yalnızca talebini açan onaylı teklif verenle, platform kurallarına göre paylaşılır." },
  { id: "kapsam", topics: ["kategori"], q: "Daire, araç veya ürün için de talep açabilir miyim?", a: "Evet. Hizmetin yanında kiralık/satılık emlak, vasıta, elektronik, beyaz eşya, mobilya, iş makinesi, eleman ve evcil hayvan için de talep oluşturabilirsin. Her kategori için sana özel birkaç kısa soru sorarız." },
  { id: "kabul", topics: ["ucret"], q: "Bir teklifi kabul etmek zorunda mıyım?", a: "Hayır. Teklifler seni hiçbir şekilde bağlamaz. Birini kabul edebilir, diğerlerini reddedebilir ya da hiçbirini seçmeyebilirsin." },
  { id: "kredi", topics: ["veren", "ucret"], q: "Teklif veren olarak kredi nasıl çalışır?", a: "Talep özetlerini ücretsiz görürsün. İlgilendiğin talebin detayını açarken kategoriye göre belirlenen kredi düşer; maliyet işlemden önce gösterilir. Teklif göndermek, güncellemek ve aynı talebi tekrar görmek ek ücret gerektirmez." },
  { id: "veren-ol", topics: ["veren"], q: "Teklif veren olmak için ne gerekiyor?", a: "Ücretsiz üye olup firma ya da kişisel profilini, hizmet verdiğin veya sattığın kategorileri ve çalıştığın il/ilçeleri eklemen yeterli. Başvurun incelenip onaylandıktan sonra bölgendeki talepleri görmeye başlarsın." },
  { id: "duzenle", topics: ["gizlilik"], q: "Talebimi sonradan düzenleyebilir veya kapatabilir miyim?", a: "Evet. Hesabından talebinin açıklamasını, bütçesini ve tarihini güncelleyebilir; ihtiyacın kalmadığında talebi kapatabilirsin. Kapatılan talep yeni teklif almaz." },
];

export const FAQ_TOPICS: { id: string; emoji: string; title: string; hint: string }[] = [
  { id: "ucret", emoji: "💸", title: "Ücretler", hint: "Ne ödersin, ne ödemezsin" },
  { id: "gizlilik", emoji: "🔒", title: "Gizlilik", hint: "Numaran kime görünür" },
  { id: "kategori", emoji: "🏠", title: "Emlak ve araç", hint: "Hizmet dışı talepler" },
  { id: "veren", emoji: "💼", title: "Teklif verenler", hint: "Kredi ve onay süreci" },
];

/* ================= YARDIMCILAR ================= */

/**
 * Turkce katlama: aramayi aksansiz yazanlar da bulsun.
 * search_name sunucuda ayni bicimde uretiliyor.
 */
export function fold(value: string): string {
  return String(value)
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i").replace(/ş/g, "s").replace(/ğ/g, "g")
    .replace(/ü/g, "u").replace(/ö/g, "o").replace(/ç/g, "c")
    .replace(/â/g, "a").replace(/î/g, "i").replace(/û/g, "u");
}

/**
 * Sihirbaz derin baglantisi.
 *
 * `kategori` sihirbazin bugun okudugu tek parametre; kalanlar yeni
 * sihirbazin on doldurmasi icin tasinir ve tanimayan surumde sessizce
 * yok sayilir.
 */
export function talepUrl(params: Record<string, string | number | null | undefined>): string {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === "") continue;
    query.set(key, String(value));
  }

  const text = query.toString();
  return `/talep-olustur${text ? `?${text}` : ""}`;
}

/** "4 dk önce" — akis kartlarindaki goreli zaman. */
export function sinceLabel(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.max(0, Math.round(diff / 60000));

  if (minutes < 1) return "az önce";
  if (minutes < 60) return `${minutes} dk önce`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} sa önce`;

  const days = Math.round(hours / 24);
  if (days < 30) return `${days} gün önce`;

  return `${Math.round(days / 30)} ay önce`;
}
