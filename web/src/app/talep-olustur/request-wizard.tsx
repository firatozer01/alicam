"use client";

import { Fragment, FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiError, apiRequest, firstApiError } from "@/lib/api";
import { BrandLogo } from "@/components/shell/brand";
import styles from "./wizard.module.css";

/* ==========================================================
   Tipler
   ========================================================== */

type Category = {
  id: number;
  parent_id: number | null;
  slug: string;
  name: string;
  icon: string | null;
  color: string | null;
  kind?: "service" | "listing";
  parent?: Category | null;
};

type CategoryAttribute = {
  key: string;
  label: string;
  listing_label: string | null;
  type: "text" | "textarea" | "select" | "multiselect" | "number" | "range" | "boolean" | "date";
  options: string[] | null;
  unit: string | null;
  help_text: string | null;
  is_required: boolean;
  is_private: boolean;
  sort_order: number;
};

type AttributesResponse = {
  data: Category & { attributes: CategoryAttribute[] };
  effective_attributes?: CategoryAttribute[];
};

type City = { id: number; name: string; districts: { id: number; name: string }[] };

type SearchHit = { id: number; slug: string; name: string; kind: string; path: string[] };

type Viewer = { id: number; name: string; email: string; phone: string | null };

type Timing = "urgent" | "this_week" | "this_month" | "flexible";

type ContactPreference = "message" | "phone" | "whatsapp";

type AttributeValue = string | string[] | boolean;

/** Anasayfadaki bulucunun urettigi sorgu parametreleri. */
export type WizardDeepLink = {
  tip?: string;
  kategori?: string;
  hizmet?: string;
  islem?: string;
  oda?: string;
  il?: string;
  butce?: string;
  marka?: string;
  yil?: string;
  durum?: string;
  urun?: string;
  satici?: string;
  taslak?: string;
};

type FormState = {
  vertical: string;
  category: string;
  categoryName: string;
  categoryPath: string[];
  extraCategories: string[];
  title: string;
  titleTouched: boolean;
  description: string;
  attributes: Record<string, AttributeValue>;
  cityId: string;
  districtId: string;
  budgetMin: string;
  budgetMax: string;
  budgetFlexible: boolean;
  timing: Timing;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  contactPreferences: ContactPreference[];
};

/* ==========================================================
   Sabitler
   ========================================================== */

const DRAFT_KEY = "alicam-request-draft";

const money = (v: string | number) =>
  new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(Number(v));

/** Binlik ayrimi; para birimi simgesi alanin kendi son ekinde duruyor. */
const grouped = (v: string | number) => new Intl.NumberFormat("tr-TR").format(Number(v));

/** Turkce arama icin harf katlama; aksansiz yazilan sorgu da eslessin. */
const fold = (value: string) =>
  value.toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i").replace(/ş/g, "s").replace(/ğ/g, "g")
    .replace(/ü/g, "u").replace(/ö/g, "o").replace(/ç/g, "c")
    .replace(/â/g, "a").replace(/î/g, "i").replace(/û/g, "u");

const cn = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");

type Vertical = { id: string; name: string; emoji: string; color: string; desc: string };

const VERTICALS: Vertical[] = [
  { id: "hizmet", name: "Hizmet", emoji: "🛠️", color: "var(--v-hizmet)", desc: "Usta, tamir, temizlik, nakliyat, ders" },
  { id: "emlak", name: "Emlak", emoji: "🏠", color: "var(--v-emlak)", desc: "Kiralık, satılık daire, ev, işyeri, arsa" },
  { id: "vasita", name: "Vasıta", emoji: "🚗", color: "var(--v-vasita)", desc: "Otomobil, SUV, motosiklet, ticari araç" },
  { id: "alisveris", name: "Alışveriş", emoji: "🛍️", color: "var(--v-alisveris)", desc: "Telefon, bilgisayar, beyaz eşya, mobilya" },
  { id: "makine", name: "İş Makineleri", emoji: "🚜", color: "var(--v-makine)", desc: "Kiralık / satılık iş makinesi, tarım, sanayi" },
  { id: "eleman", name: "Eleman", emoji: "💼", color: "var(--v-eleman)", desc: "Bakıcı, şoför, garson, usta eleman" },
  { id: "hayvan", name: "Hayvanlar", emoji: "🐾", color: "var(--v-hayvan)", desc: "Kedi, köpek, kuş, akvaryum, çiftlik" },
];

/**
 * Kok kategori -> tasarimdaki dikey. Listede olmayan bir kok
 * turune gore dagitilir, boylece yonetici yeni bir kok eklerse
 * sihirbazdan dusmez.
 */
const ROOT_VERTICAL: Record<string, string> = {
  emlak: "emlak",
  vasita: "vasita",
  "elektronik-teknoloji": "alisveris",
  "yasam-ve-hobi": "alisveris",
  "is-makineleri-sanayi": "makine",
  "is-ilanlari-yardimci-arayanlar": "eleman",
  "hayvanlar-alemi": "hayvan",
  "ustalar-hizmetler": "hizmet",
};

const verticalIdForRoot = (root: Category) =>
  ROOT_VERTICAL[root.slug] ?? ((root.kind ?? "service") === "service" ? "hizmet" : "alisveris");

/**
 * Bu kok listede gezilmez: "Ustalar, Hizmetler ve Ozel Ders" satici
 * ilanlarinin agaci ve on hizmet kokunun basliklarini birebir tekrar
 * ediyor. Derin baglantiyla gelinirse yine de dogru dikeye dusuyor.
 */
const HIDDEN_BROWSE_ROOTS = new Set(["ustalar-hizmetler"]);

const DESCRIPTION_PLACEHOLDER: Record<string, string> = {
  hizmet: "Örn. Kombim 4 yaşında, yıllık bakımı yapılacak. Hafta sonu da olur. Petek temizliği için de fiyat almak isterim.",
  emlak: "Örn. 2 kişilik aileyiz, evcil hayvanımız var. Okula ve metroya yakın, güneş alan bir daire arıyoruz.",
  vasita: "Örn. Aile aracı olarak kullanacağım. Ekspertiz raporu olsun, tramer kaydı düşük olsun.",
  alisveris: "Örn. Kutusu ve faturası olsun. İstanbul içi elden teslim tercihim, kargo da olur.",
  makine: "Örn. Bahçe kazısı için 3 günlük lazım. Nakliye dahil fiyat istiyorum.",
  eleman: "Örn. 2 yaşında kızım için hafta içi 14–19 arası bakıcı arıyorum.",
  hayvan: "Örn. Aşıları tam, sağlık karnesi olan bir yavru arıyorum.",
};

/** [etiket, en az, en fazla]; en fazla null ise ust sinir aciktir. */
type QuickBudget = [string, number, number | null];

const QUICK_BUDGET: Record<string, QuickBudget[]> = {
  hizmet: [["1.000 ₺'ye kadar", 0, 1000], ["1.000 – 5.000 ₺", 1000, 5000], ["5.000 – 20.000 ₺", 5000, 20000], ["20.000 ₺ ve üzeri", 20000, null]],
  emlak_kiralik: [["20.000 ₺'ye kadar", 0, 20000], ["20 – 35 bin ₺", 20000, 35000], ["35 – 50 bin ₺", 35000, 50000], ["50.000 ₺ ve üzeri", 50000, null]],
  emlak_satilik: [["3 milyona kadar", 0, 3000000], ["3 – 5 milyon ₺", 3000000, 5000000], ["5 – 10 milyon ₺", 5000000, 10000000], ["10 milyon ₺ ve üzeri", 10000000, null]],
  vasita: [["750 bine kadar", 0, 750000], ["750 bin – 1,2 milyon", 750000, 1200000], ["1,2 – 2 milyon ₺", 1200000, 2000000], ["2 milyon ₺ ve üzeri", 2000000, null]],
  alisveris: [["5.000 ₺'ye kadar", 0, 5000], ["5 – 20 bin ₺", 5000, 20000], ["20 – 50 bin ₺", 20000, 50000], ["50.000 ₺ ve üzeri", 50000, null]],
  makine: [["25.000 ₺'ye kadar", 0, 25000], ["25 – 100 bin ₺", 25000, 100000], ["100 – 500 bin ₺", 100000, 500000], ["500.000 ₺ ve üzeri", 500000, null]],
  eleman: [["25.000 ₺'ye kadar", 0, 25000], ["25 – 40 bin ₺", 25000, 40000], ["40 – 60 bin ₺", 40000, 60000], ["60.000 ₺ ve üzeri", 60000, null]],
};

const TIMINGS: [Timing, string][] = [
  ["urgent", "⚡ Acil"],
  ["this_week", "Bu hafta"],
  ["this_month", "Bu ay"],
  ["flexible", "Esnek"],
];

const CONTACT_PREFERENCES: [ContactPreference, string][] = [
  ["message", "💬 Mesaj"],
  ["phone", "📞 Telefon"],
  ["whatsapp", "🟢 WhatsApp"],
];

const STEP_LABELS = ["Ne istiyorsun?", "Detaylar", "Bütçe ve konum", "İletişim ve yayınla"];

/** Derin baglanti ipucu -> kategori alani. Anahtar setleri kategoriye gore
 *  degistigi icin ad kalibiyla eslestiriyoruz; eslesme yoksa hicbir sey
 *  doldurulmaz. */
const HINT_RULES: { param: keyof WizardDeepLink; pattern: RegExp }[] = [
  { param: "islem", pattern: /islem_turu|_islem$|^islem/ },
  { param: "oda", pattern: /oda_sayisi|odalar/ },
  { param: "marka", pattern: /marka/ },
  { param: "yil", pattern: /model_yili|_yili$/ },
  { param: "durum", pattern: /durum/ },
];

const emptyForm: FormState = {
  vertical: "",
  category: "",
  categoryName: "",
  categoryPath: [],
  extraCategories: [],
  title: "",
  titleTouched: false,
  description: "",
  attributes: {},
  cityId: "",
  districtId: "",
  budgetMin: "",
  budgetMax: "",
  budgetFlexible: false,
  timing: "flexible",
  contactName: "",
  contactPhone: "",
  contactEmail: "",
  contactPreferences: ["message"],
};

/* ==========================================================
   Bilesen
   ========================================================== */

export function RequestWizard({ deepLink }: { deepLink: WizardDeepLink }) {
  const router = useRouter();

  const [roots, setRoots] = useState<Category[]>([]);
  const [headings, setHeadings] = useState<Record<string, Category[]>>({});
  const [cities, setCities] = useState<City[]>([]);
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [attributes, setAttributes] = useState<CategoryAttribute[]>([]);
  const [attributesFor, setAttributesFor] = useState("");
  const [loadingAttributes, setLoadingAttributes] = useState(false);
  const [search, setSearch] = useState("");
  const [hits, setHits] = useState<{ query: string; items: SearchHit[]; failed: boolean }>({ query: "", items: [], failed: false });
  const [invitedSeller, setInvitedSeller] = useState<{ id: number; name: string } | null>(null);

  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(1);
  const [form, setForm] = useState<FormState>(() => ({ ...emptyForm, vertical: "" }));
  const [invalid, setInvalid] = useState<Record<string, boolean>>({});
  const [terms, setTerms] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [reference, setReference] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);

  /* ---------- Acilis: kok kategoriler, iller, oturum, davet ---------- */
  useEffect(() => {
    let active = true;

    apiRequest<{ data: Category[] }>("/categories")
      .then((response) => { if (active) setRoots(response.data); })
      .catch(() => { if (active) setError("Kategoriler alınamadı. Sayfayı yenileyerek tekrar deneyin."); });

    apiRequest<{ data: City[] }>("/locations")
      .then((response) => { if (active) setCities(response.data); })
      .catch(() => undefined);

    apiRequest<{ data: Viewer }>("/me")
      .then((response) => { if (active) { setViewer(response.data); setAuthChecked(true); } })
      .catch(() => { if (active) setAuthChecked(true); });

    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!deepLink.satici) return;
    let active = true;

    apiRequest<{ data: { id: number; company_name: string | null; name: string } }>(`/sellers/${deepLink.satici}`)
      .then(({ data }) => { if (active) setInvitedSeller({ id: data.id, name: data.company_name || data.name }); })
      .catch(() => undefined);

    return () => { active = false; };
  }, [deepLink.satici]);

  /* ---------- Taslak: giris turundan sonra kaldigi yerden devam ---------- */
  const linkedCategory = (deepLink.kategori ?? deepLink.hizmet ?? "").trim();

  useEffect(() => {
    // queueMicrotask: efekt govdesinde setState yok, taslak okuma
    // tarayiciya birakiliyor.
    window.queueMicrotask(() => {
      if (!linkedCategory) {
        try {
          const saved = window.sessionStorage.getItem(DRAFT_KEY);
          if (saved) {
            const draft = JSON.parse(saved) as { step?: number; form?: FormState };
            if (draft.form?.category) {
              setForm({ ...emptyForm, ...draft.form });
              setStep(deepLink.taslak === "1" ? 4 : Math.min(4, Math.max(1, draft.step ?? 1)));
              setLoadingAttributes(true);
            }
          }
        } catch {
          window.sessionStorage.removeItem(DRAFT_KEY);
        }
      }
      setHydrated(true);
    });
  }, [linkedCategory, deepLink.taslak]);

  /* ---------- Derin baglanti: kategoriyi cozup 2. adima gec ---------- */
  const [pendingRootId, setPendingRootId] = useState<number | null>(null);
  const [linkUnresolved, setLinkUnresolved] = useState(false);
  const linkedType = (deepLink.tip ?? "").trim();

  useEffect(() => {
    if (!linkedCategory) return;
    let active = true;

    const bySlug: Promise<AttributesResponse | null> = /^[a-z0-9-]+$/.test(linkedCategory)
      ? apiRequest<AttributesResponse>(`/categories/${linkedCategory}/attributes`).catch(() => null)
      : Promise.resolve(null);

    bySlug
      .then((direct) => {
        if (direct) return direct;
        const query = linkedCategory.replace(/-/g, " ").trim();
        if (query.length < 2) return null;

        // Adla gelen baglantida en iyi aday: once birebir ad, sonra
        // istenen turun altindaki, sonra agacta daha yukarida duran.
        const wantedKind = linkedType === "hizmet" ? "service" : linkedType ? "listing" : null;
        const score = (hit: SearchHit) =>
          (fold(hit.name) === fold(query) ? 4 : 0)
          + (wantedKind && hit.kind === wantedKind ? 2 : 0)
          + (hit.path.length <= 1 ? 1 : 0);

        return apiRequest<{ data: SearchHit[] }>(`/categories/search?q=${encodeURIComponent(query)}&limit=10`)
          .then((response) => {
            const picked = [...response.data].sort((a, b) => score(b) - score(a))[0];
            if (!picked) return null;

            return apiRequest<AttributesResponse>(`/categories/${picked.slug}/attributes`).catch(() => null);
          })
          .catch(() => null);
      })
      .then((resolved) => {
        if (!active) return;
        if (!resolved) { setLinkUnresolved(true); return; }

        const node = resolved.data;
        setForm((current) => ({
          ...current,
          category: node.slug,
          categoryName: node.name,
          categoryPath: node.parent ? [node.parent.name] : [],
          attributes: {},
        }));
        setAttributes((resolved.effective_attributes ?? node.attributes ?? []).filter((item) => !item.is_private));
        setAttributesFor(node.slug);
        setPendingRootId(node.parent?.parent_id ?? node.parent_id ?? node.id);
        setStep(2);
      })
      .catch(() => undefined);

    return () => { active = false; };
  }, [linkedCategory, linkedType]);

  /* ---------- Turetilen degerler ---------- */
  const verticalRoots = useMemo(() => {
    const map: Record<string, Category[]> = {};
    for (const root of roots) {
      const id = verticalIdForRoot(root);
      (map[id] ??= []).push(root);
    }
    return map;
  }, [roots]);

  const vertical = useMemo(() => VERTICALS.find((item) => item.id === form.vertical) ?? null, [form.vertical]);

  // Derin baglantidan gelen kategorinin koku, kok listesi geldiginde
  // dikeye cevrilir. Efekt yerine boyama sirasinda: fazladan tur olusmaz.
  if (pendingRootId !== null && roots.length > 0) {
    const root = roots.find((item) => item.id === pendingRootId);
    setPendingRootId(null);
    if (root) setForm((current) => ({ ...current, vertical: verticalIdForRoot(root) }));
  }

  // Sehir adi tasiyan derin baglanti, il listesi geldiginde eslestirilir.
  const [cityHintDone, setCityHintDone] = useState(false);
  if (!cityHintDone && cities.length > 0) {
    setCityHintDone(true);
    const wanted = (deepLink.il ?? "").trim();
    if (wanted) {
      const city = cities.find((item) => fold(item.name) === fold(wanted));
      if (city) setForm((current) => (current.cityId ? current : { ...current, cityId: String(city.id) }));
    }
  }

  // Butce ipucu yalnizca bir kere uygulanir.
  const [budgetHintDone, setBudgetHintDone] = useState(false);
  if (!budgetHintDone && hydrated) {
    setBudgetHintDone(true);
    const digits = (deepLink.butce ?? "").replace(/\D/g, "");
    if (digits) setForm((current) => (current.budgetMax ? current : { ...current, budgetMax: digits }));
  }

  // Tur ipucu: kategori cozulemediyse en azindan dogru sekme acilsin.
  const [verticalHintDone, setVerticalHintDone] = useState(false);
  if (!verticalHintDone && hydrated) {
    setVerticalHintDone(true);
    const wanted = (deepLink.tip ?? "").trim();
    if (wanted && VERTICALS.some((item) => item.id === wanted)) {
      setForm((current) => (current.vertical ? current : { ...current, vertical: wanted }));
    }
  }

  /* ---------- Dikeyin basliklari ---------- */
  useEffect(() => {
    const slugs = (verticalRoots[form.vertical] ?? [])
      .filter((root) => !HIDDEN_BROWSE_ROOTS.has(root.slug))
      .map((root) => root.slug);
    const missing = slugs.filter((slug) => !(slug in headings));
    if (missing.length === 0) return;

    let active = true;

    Promise.all(missing.map((slug) => apiRequest<{ data: Category[] }>(`/categories?parent=${slug}`)
      .then((response) => [slug, response.data] as const)
      .catch(() => [slug, [] as Category[]] as const)))
      .then((pairs) => { if (active) setHeadings((current) => ({ ...current, ...Object.fromEntries(pairs) })); })
      .catch(() => undefined);

    return () => { active = false; };
  }, [form.vertical, verticalRoots, headings]);

  /* ---------- Secili kategorinin alanlari ---------- */
  useEffect(() => {
    if (!form.category || attributesFor === form.category) return;
    let active = true;

    apiRequest<AttributesResponse>(`/categories/${form.category}/attributes`)
      .then((response) => {
        if (!active) return;
        setAttributes((response.effective_attributes ?? response.data.attributes ?? []).filter((item) => !item.is_private));
        setAttributesFor(form.category);
      })
      .catch(() => { if (active) setError("Kategori soruları alınamadı. Lütfen tekrar deneyin."); })
      .finally(() => { if (active) setLoadingAttributes(false); });

    return () => { active = false; };
  }, [form.category, attributesFor]);

  const fields = useMemo(
    () => [...attributes].sort((a, b) => a.sort_order - b.sort_order),
    [attributes],
  );

  // Derin baglantidaki islem / oda / marka / yil / durum ipuclari, alan
  // seti geldiginde bir kez uygulanir.
  const [hintsAppliedFor, setHintsAppliedFor] = useState("");
  if (linkedCategory && fields.length > 0 && attributesFor === form.category && hintsAppliedFor !== form.category) {
    setHintsAppliedFor(form.category);
    const patch: Record<string, AttributeValue> = {};

    for (const rule of HINT_RULES) {
      const raw = (deepLink[rule.param] ?? "").trim();
      if (!raw) continue;

      const field = fields.find((item) => rule.pattern.test(item.key));
      if (!field) continue;

      const options = field.options ?? [];
      if (options.length > 0) {
        const match = options.find((option) => fold(option) === fold(raw))
          ?? options.find((option) => fold(option).startsWith(fold(raw)));
        if (match) patch[field.key] = field.type === "multiselect" ? [match] : match;
        continue;
      }

      if (["text", "number", "range"].includes(field.type)) patch[field.key] = raw;
    }

    if (Object.keys(patch).length > 0) {
      setForm((current) => ({ ...current, attributes: { ...patch, ...current.attributes } }));
    }
  }

  /* ---------- Baslik arama ---------- */
  const query = search.trim();

  useEffect(() => {
    const trimmed = search.trim();
    if (trimmed.length < 2) return;

    let active = true;
    const timer = window.setTimeout(() => {
      apiRequest<{ data: SearchHit[] }>(`/categories/search?q=${encodeURIComponent(trimmed)}&limit=20`)
        .then((response) => { if (active) setHits({ query: trimmed, items: response.data, failed: false }); })
        // Arama ucu cevap vermezse liste yuklu basliklar uzerinden kurulur.
        .catch(() => { if (active) setHits({ query: trimmed, items: [], failed: true }); });
    }, 220);

    return () => { active = false; window.clearTimeout(timer); };
  }, [search]);

  /* ---------- Taslak kaydi ---------- */
  useEffect(() => {
    if (!hydrated || !form.category) return;

    const timer = window.setTimeout(() => {
      try {
        window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ step, form }));
        setDraftSaved(true);
      } catch {
        // Depolama kapali olabilir; taslak gostergesi de gorunmez kalir.
      }
    }, 400);

    return () => window.clearTimeout(timer);
  }, [form, step, hydrated]);

  /* ---------- Yardimcilar ---------- */
  const update = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
    setError("");
  };

  const clearInvalid = (key: string) =>
    setInvalid((current) => (current[key] ? { ...current, [key]: false } : current));

  const updateAttribute = (key: string, value: AttributeValue) => {
    setForm((current) => ({ ...current, attributes: { ...current.attributes, [key]: value } }));
    setError("");
    clearInvalid(`attr-${key}`);
  };

  const selectedCity = useMemo(
    () => cities.find((item) => String(item.id) === form.cityId),
    [cities, form.cityId],
  );
  const selectedDistrict = useMemo(
    () => selectedCity?.districts.find((item) => String(item.id) === form.districtId),
    [selectedCity, form.districtId],
  );

  /** Baslik onerisi: kullanici yazana kadar secimlerden kurulur. */
  const suggestedTitle = useMemo(() => {
    if (!form.categoryName) return "";

    const bits: string[] = [];
    const lead = (deepLink.urun ?? "").trim();
    if (lead) bits.push(lead);

    for (const field of fields) {
      if (bits.length >= 2) break;
      const value = form.attributes[field.key];
      const text = Array.isArray(value) ? value[0] : typeof value === "string" ? value : "";
      if (text && text.length <= 24 && !bits.includes(text)) bits.push(text);
    }

    return [...bits, form.categoryName].join(" ").slice(0, 120);
  }, [deepLink.urun, fields, form.attributes, form.categoryName]);

  const title = form.titleTouched ? form.title : suggestedTitle;

  /** Kiralik mi satilik mi: kategori adi ve verilen cevaplardan okunur. */
  const saleLike = useMemo(() => {
    const answers = Object.values(form.attributes)
      .flatMap((value) => (Array.isArray(value) ? value : typeof value === "string" ? [value] : []));
    const haystack = fold([form.categoryName, ...answers, deepLink.islem ?? ""].join(" "));

    return haystack.includes("satilik") && !haystack.includes("kiralik");
  }, [deepLink.islem, form.attributes, form.categoryName]);

  const monthly = (form.vertical === "emlak" && !saleLike) || form.vertical === "eleman";
  const budgetUnit = monthly ? "₺/ay" : "₺";
  const budgetLabel = form.vertical === "emlak" && !saleLike
    ? "Aylık kira bütçesi"
    : form.vertical === "eleman" ? "Aylık ücret bütçesi" : "Bütçe aralığı";

  const quickBudgets = useMemo(() => {
    if (form.vertical === "emlak") return QUICK_BUDGET[saleLike ? "emlak_satilik" : "emlak_kiralik"];
    return QUICK_BUDGET[form.vertical] ?? [];
  }, [form.vertical, saleLike]);

  /* ---------- Baslik listesi ---------- */
  type Choice = { slug: string; name: string; icon: string | null; path: string[] };
  type ChoiceGroup = { key: string; heading: string | null; items: Choice[] };

  const rootsOfVertical = useMemo(
    () => (verticalRoots[form.vertical] ?? []).filter((root) => !HIDDEN_BROWSE_ROOTS.has(root.slug)),
    [verticalRoots, form.vertical],
  );

  const browseGroups = useMemo<ChoiceGroup[]>(() => rootsOfVertical
    .map((root) => ({
      key: root.slug,
      heading: root.name,
      items: (headings[root.slug] ?? []).map((item) => ({
        slug: item.slug, name: item.name, icon: item.icon, path: [root.name],
      })),
    }))
    .filter((group) => group.items.length > 0),
    [rootsOfVertical, headings]);

  const searching = query.length >= 2 && hits.query !== query && !hits.failed;
  const showingSearch = query.length >= 2;

  /**
   * Arama sonucu iki kaynaktan kurulur: yuklu basliklarda anlik yerel
   * eslesme ve /categories/search'un yapraklari da kapsayan yaniti.
   * Uc cevap verene kadar (ya da veremezse) yerel liste gorunur.
   */
  const searchGroups = useMemo<ChoiceGroup[]>(() => {
    if (!showingSearch) return [];

    const needle = fold(query);
    const local = browseGroups
      .flatMap((group) => group.items)
      .filter((item) => fold(item.name).includes(needle) || fold(item.path.join(" ")).includes(needle));

    const allowed = new Set(rootsOfVertical.map((root) => root.name));
    const remote = hits.query === query && !hits.failed
      ? hits.items
        .filter((hit) => hit.path.length > 0 && allowed.has(hit.path[0]))
        .map((hit) => ({ slug: hit.slug, name: hit.name, icon: null as string | null, path: hit.path }))
      : [];

    const seen = new Set<string>();
    const items = [...remote, ...local]
      .filter((item) => (seen.has(item.slug) ? false : seen.add(item.slug)))
      .slice(0, 40);

    return items.length > 0 ? [{ key: "arama", heading: null, items }] : [];
  }, [browseGroups, hits, query, rootsOfVertical, showingSearch]);

  const listGroups = showingSearch ? searchGroups : browseGroups;
  const visibleCount = listGroups.reduce((total, group) => total + group.items.length, 0);

  const pickCategory = (choice: Choice) => {
    setLoadingAttributes(true);
    setAttributesFor("");
    setAttributes([]);
    setForm((current) => ({
      ...current,
      category: choice.slug,
      categoryName: choice.name,
      categoryPath: choice.path,
      extraCategories: [],
      attributes: {},
    }));
    setError("");
    setInvalid((current) => ({ ...current, category: false }));
  };

  // Adla gelen derin baglanti arama ucundan cozulemediyse, dikeyin yuklu
  // basliklarinda yerel olarak aranir; kullanici bos 1. adimda kalmasin.
  const [linkFallbackDone, setLinkFallbackDone] = useState(false);
  if (!linkFallbackDone && linkUnresolved && !form.category && browseGroups.length > 0) {
    setLinkFallbackDone(true);

    const needle = fold(linkedCategory.replace(/-/g, " ").trim());
    const pool = browseGroups.flatMap((group) => group.items);
    const match = pool.find((item) => fold(item.name) === needle)
      ?? pool.find((item) => fold(item.name).includes(needle) || needle.includes(fold(item.name)));

    if (match) {
      pickCategory(match);
      setStep(2);
    }
  }

  const clearCategory = () => {
    setLoadingAttributes(false);
    setAttributesFor("");
    setAttributes([]);
    setForm((current) => ({ ...current, category: "", categoryName: "", categoryPath: [], extraCategories: [], attributes: {} }));
  };

  const pickVertical = (id: string) => {
    setSearch("");
    setForm((current) => current.vertical === id
      ? current
      : { ...current, vertical: id, category: "", categoryName: "", categoryPath: [], extraCategories: [], attributes: {} });
    setError("");
  };

  /** Ek basliklar: secilen basligin kardesleri. Talep bunlarda da listelenir. */
  const extraSuggestions = useMemo(() => {
    if (!form.category) return [];
    const family = browseGroups.find((group) => group.items.some((item) => item.slug === form.category));

    return (family?.items ?? []).filter((item) => item.slug !== form.category).slice(0, 8);
  }, [browseGroups, form.category]);

  const toggleExtra = (slug: string) => {
    setForm((current) => {
      const picked = current.extraCategories.includes(slug);
      if (!picked && current.extraCategories.length >= 4) return current;

      return {
        ...current,
        extraCategories: picked
          ? current.extraCategories.filter((item) => item !== slug)
          : [...current.extraCategories, slug],
      };
    });
  };

  /* ---------- Dogrulama ---------- */
  const attributeFilled = (field: CategoryAttribute) => {
    const value = form.attributes[field.key];
    if (field.type === "boolean") return typeof value === "boolean";
    if (Array.isArray(value)) return value.length > 0;

    return value !== undefined && value !== "";
  };

  const requiredMissing = fields.filter((field) => field.is_required && !attributeFilled(field));

  const phoneDigits = form.contactPhone.replace(/\D/g, "");
  const anonymous = authChecked && !viewer;

  const validate = (target: number): boolean => {
    const marks: Record<string, boolean> = {};
    let message = "";

    if (target === 1 && !form.category) {
      message = "Devam etmek için bir tür ve başlık seç.";
      marks.category = true;
    }

    if (target === 2) {
      if (title.trim().length < 10) { marks.title = true; message = "Başlık en az 10 karakter olmalı."; }
      if (form.description.trim().length < 20) { marks.description = true; message = "Açıklamayı biraz daha anlat (en az 20 karakter)."; }
      for (const field of requiredMissing) marks[`attr-${field.key}`] = true;
      if (requiredMissing.length > 0) message = "Zorunlu soruları yanıtla.";
    }

    if (target === 3) {
      if (!form.cityId) { marks.city = true; message = "Bir il seç."; }
      if (!form.districtId) { marks.district = true; message = "Bir ilçe seç."; }
      if (!form.budgetMin) { marks.budgetMin = true; message = "En az bütçeyi yaz."; }
      if (!form.budgetMax) { marks.budgetMax = true; message = "En fazla bütçeyi yaz."; }
      if (form.budgetMin && form.budgetMax && Number(form.budgetMax) < Number(form.budgetMin)) {
        marks.budgetMax = true;
        message = "En fazla bütçe, en az bütçeden küçük olamaz.";
      }
    }

    if (target === 4) {
      if (anonymous) {
        if (form.contactName.trim().length < 2) { marks.contactName = true; message = "Adını yaz."; }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contactEmail.trim())) { marks.contactEmail = true; message = "Geçerli bir e-posta adresi yaz."; }
        if (phoneDigits && !/^05\d{9}$/.test(phoneDigits)) { marks.contactPhone = true; message = "Telefonu 05xx xxx xx xx biçiminde yaz."; }
      }
      if (!terms) { marks.terms = true; message = "Devam etmek için koşulları kabul et."; }
    }

    setInvalid((current) => ({ ...current, ...marks }));
    if (message) setError(message);

    return Object.values(marks).every((flag) => !flag);
  };

  const goTo = (target: number, way: number) => {
    setDirection(way);
    setStep(target);
    setError("");
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  /* ---------- Yayinla ---------- */
  const payload = () => {
    const answers: Record<string, AttributeValue> = {};
    for (const field of fields) {
      const value = form.attributes[field.key];
      if (value === undefined || value === "") continue;
      if (Array.isArray(value) && value.length === 0) continue;
      answers[field.key] = value;
    }

    return {
      category_slug: form.category,
      extra_category_slugs: form.extraCategories,
      invited_seller_ids: invitedSeller ? [invitedSeller.id] : [],
      title: title.trim(),
      description: form.description.trim(),
      attributes: answers,
      budget_min: Number(form.budgetMin),
      budget_max: Number(form.budgetMax),
      city_id: Number(form.cityId),
      district_id: Number(form.districtId),
      timing: form.timing,
      budget_flexible: form.budgetFlexible,
      contact_preferences: form.contactPreferences,
    };
  };

  const rememberAndSignIn = (needsVerification: boolean) => {
    try {
      window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ step: 4, form }));
    } catch {
      // Taslak yazilamadiysa da girise gonderiyoruz; kullanici formu
      // yeniden doldurmak zorunda kalabilir.
    }
    router.push(`/giris?devam=${encodeURIComponent("/talep-olustur?taslak=1")}${needsVerification ? "&dogrulama=1" : ""}`);
  };

  const publish = async () => {
    setSubmitting(true);
    setError("");

    try {
      const response = await apiRequest<{ data: { reference: string } }>("/requests", {
        method: "POST",
        body: JSON.stringify(payload()),
      });

      window.sessionStorage.removeItem(DRAFT_KEY);
      setReference(response.data.reference);
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (requestError) {
      if (requestError instanceof ApiError && [401, 403].includes(requestError.status)) {
        rememberAndSignIn(requestError.status === 403);
        return;
      }

      setError(firstApiError(requestError));
    } finally {
      setSubmitting(false);
    }
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validate(step)) return;

    if (step < 4) {
      goTo(step + 1, 1);
      return;
    }

    if (anonymous) {
      rememberAndSignIn(false);
      return;
    }

    void publish();
  };

  /* ---------- Onizleme ---------- */
  const previewSpecs = useMemo(() => {
    const out: string[] = [];

    for (const field of fields) {
      const value = form.attributes[field.key];
      if (value === undefined || value === "") continue;
      if (typeof value === "boolean") { if (value) out.push(field.label); continue; }

      const text = Array.isArray(value) ? value.join(", ") : value;
      if (!text || text.length > 40) continue;
      out.push(field.unit ? `${text} ${field.unit}` : text);
    }

    if (form.timing !== "flexible") {
      out.push(TIMINGS.find(([id]) => id === form.timing)?.[1] ?? "");
    }

    return out.filter(Boolean).slice(0, 7);
  }, [fields, form.attributes, form.timing]);

  const previewBudget = () => {
    // Alt sinir 0 ise "0 TL'den baslayan" demek anlamsiz; ust sinir yazilir.
    const min = Number(form.budgetMin) > 0 ? money(form.budgetMin) : "";
    const max = form.budgetMax ? money(form.budgetMax) : "";
    const suffix = monthly ? " / ay" : "";
    const base = min && max ? `${min} – ${max}` : max ? `En fazla ${max}` : min ? `En az ${min}` : "";

    if (!base) return form.budgetFlexible ? "Esnek" : "";

    return `${base}${suffix}${form.budgetFlexible ? " · esnek" : ""}`;
  };

  const descriptionTip = form.description.length === 0
    ? "İpucu: Beklentini, zamanlamayı ve önemli detayları yaz."
    : form.description.trim().length < 20
      ? `En az 20 karakter yaz, ${20 - form.description.trim().length} karakter kaldı.`
      : form.description.length < 90
        ? "Güzel. Bütçeni etkileyen ayrıntıları da eklersen teklifler netleşir."
        : "Harika — bu kadar ayrıntı isabetli teklif getirir.";

  /* ==========================================================
     Alan boyayici
     ========================================================== */

  const renderField = (field: CategoryAttribute) => {
    const value = form.attributes[field.key];
    const unit = field.unit ? ` (${field.unit})` : "";
    const options = field.options ?? [];
    const bad = invalid[`attr-${field.key}`];
    const head = (
      <span className={styles.label}>{field.label}{unit}{field.is_required && <em className={styles.req}>*</em>}</span>
    );

    if (field.type === "select" && options.length === 2) {
      return (
        <div className={cn(styles.field, styles.full, bad && styles.invalid)} key={field.key}>
          {head}
          <div className={styles.segbar}>
            {options.map((option) => (
              <label key={option}>
                <input
                  checked={value === option}
                  name={field.key}
                  onChange={() => updateAttribute(field.key, option)}
                  type="radio"
                />
                <span>{option}</span>
              </label>
            ))}
          </div>
          {field.help_text && <small>{field.help_text}</small>}
          <span className={styles.err}>Bu soruyu yanıtla.</span>
        </div>
      );
    }

    if (field.type === "select" && options.length > 0 && options.length <= 6) {
      return (
        <div className={cn(styles.field, styles.full, bad && styles.invalid)} key={field.key}>
          {head}
          <div className={styles.chips}>
            {options.map((option) => (
              <label className={cn(styles.chip, value === option && styles.on)} key={option}>
                <input
                  checked={value === option}
                  name={field.key}
                  onChange={() => updateAttribute(field.key, option)}
                  type="radio"
                />
                {option}
              </label>
            ))}
          </div>
          {field.help_text && <small>{field.help_text}</small>}
          <span className={styles.err}>Bu soruyu yanıtla.</span>
        </div>
      );
    }

    if (field.type === "select") {
      return (
        <label className={cn(styles.field, bad && styles.invalid)} key={field.key}>
          {head}
          <select
            className={styles.select}
            onChange={(event) => updateAttribute(field.key, event.target.value)}
            value={typeof value === "string" ? value : ""}
          >
            <option value="">Seç</option>
            {options.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
          {field.help_text && <small>{field.help_text}</small>}
          <span className={styles.err}>Bu soruyu yanıtla.</span>
        </label>
      );
    }

    if (field.type === "multiselect") {
      const values = Array.isArray(value) ? value : [];

      return (
        <div className={cn(styles.field, styles.full, bad && styles.invalid)} key={field.key}>
          {head}
          <div className={styles.chips}>
            {options.map((option) => (
              <label className={cn(styles.chip, values.includes(option) && styles.on)} key={option}>
                <input
                  checked={values.includes(option)}
                  onChange={(event) => updateAttribute(
                    field.key,
                    event.target.checked ? [...values, option] : values.filter((item) => item !== option),
                  )}
                  type="checkbox"
                />
                {option}
              </label>
            ))}
          </div>
          {field.help_text && <small>{field.help_text}</small>}
          <span className={styles.err}>En az bir seçenek işaretle.</span>
        </div>
      );
    }

    if (field.type === "boolean") {
      return (
        <div className={cn(styles.field, bad && styles.invalid)} key={field.key}>
          {head}
          <div className={styles.chips}>
            {([[true, "Evet"], [false, "Hayır"]] as const).map(([raw, text]) => (
              <label className={cn(styles.chip, value === raw && styles.on)} key={text}>
                <input
                  checked={value === raw}
                  name={field.key}
                  onChange={() => updateAttribute(field.key, raw)}
                  type="radio"
                />
                {text}
              </label>
            ))}
          </div>
          {field.help_text && <small>{field.help_text}</small>}
          <span className={styles.err}>Bu soruyu yanıtla.</span>
        </div>
      );
    }

    if (field.type === "textarea") {
      return (
        <label className={cn(styles.field, styles.full, bad && styles.invalid)} key={field.key}>
          {head}
          <textarea
            className={styles.textarea}
            maxLength={2000}
            onChange={(event) => updateAttribute(field.key, event.target.value)}
            placeholder={field.help_text ?? ""}
            value={typeof value === "string" ? value : ""}
          />
          <span className={styles.err}>Bu alanı doldur.</span>
        </label>
      );
    }

    const numeric = field.type === "number" || field.type === "range";

    return (
      <label className={cn(styles.field, bad && styles.invalid)} key={field.key}>
        {head}
        {field.unit ? (
          <div className={styles.inputGroup}>
            <input
              className={styles.input}
              inputMode={numeric ? "numeric" : undefined}
              onChange={(event) => updateAttribute(field.key, numeric ? event.target.value.replace(/[^\d.,]/g, "") : event.target.value)}
              placeholder={field.help_text ?? field.label}
              type={field.type === "date" ? "date" : "text"}
              value={typeof value === "string" ? value : ""}
            />
            <span className={styles.suffix}>{field.unit}</span>
          </div>
        ) : (
          <input
            className={styles.input}
            inputMode={numeric ? "numeric" : undefined}
            onChange={(event) => updateAttribute(field.key, numeric ? event.target.value.replace(/[^\d.,]/g, "") : event.target.value)}
            placeholder={field.help_text ?? field.label}
            type={field.type === "date" ? "date" : "text"}
            value={typeof value === "string" ? value : ""}
          />
        )}
        {field.help_text && field.unit && <small>{field.help_text}</small>}
        <span className={styles.err}>Bu alanı doldur.</span>
      </label>
    );
  };

  /* ==========================================================
     Boyama
     ========================================================== */

  const header = (
    <header className={styles.header}>
      <div className={styles.headerIn}>
        <Link aria-label="alıcam.net ana sayfa" className={styles.brand} href="/"><BrandLogo height={32} /></Link>
        <Link className={cn(styles.btn, styles.btnLine, styles.btnSm)} href="/">Vazgeç ✕</Link>
      </div>
    </header>
  );

  if (reference) {
    return (
      <div className={styles.page}>
        {header}
        <div className={styles.progress}><span className={styles.progressBar} style={{ width: "100%" }} /></div>
        <main className={styles.wz}>
          <div className={cn(styles.wzMain, styles.doneWide)}>
            <div className={styles.formCard}>
              <section className={styles.doneCard}>
                <div className={styles.doneIco}>✓</div>
                <h2>Talebin yayında!</h2>
                <p>Uygun teklif verenlere şimdi bildirim gidiyor. İlk teklifler genellikle aynı gün gelir.</p>
                <div className={styles.doneRef}><span>Talep numaran</span><b>{reference}</b></div>
                <ol className={styles.doneNext}>
                  <li><b>1</b><span><strong>Teklifler gelmeye başlasın</strong>Talebini gören onaylı hizmet verenler teklif bırakacak.</span></li>
                  <li><b>2</b><span><strong>Her teklifte haber verelim</strong>Yeni bir teklif düştüğünde bildirim alırsın.</span></li>
                  <li><b>3</b><span><strong>Karşılaştır ve seç</strong>Beğendiğin teklifi kabul et; diğerleri otomatik kapanır.</span></li>
                </ol>
                <div className={styles.doneActions}>
                  <Link className={cn(styles.btn, styles.btnBlue, styles.btnLg)} href="/musteri-panel">Tekliflerimi izle</Link>
                  <Link className={cn(styles.btn, styles.btnLine, styles.btnLg)} href="/">Ana sayfaya dön</Link>
                </div>
              </section>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <a className={styles.skip} href="#icerik">İçeriğe geç</a>
      {header}

      <div className={styles.progress} aria-hidden="true">
        <span className={styles.progressBar} style={{ width: `${step * 25}%` }} />
      </div>

      <main className={styles.wz} id="icerik">
        {/* Sol: adim listesi */}
        <aside className={styles.wzSteps} aria-label="Adımlar">
          <ol className={styles.stepList}>
            {STEP_LABELS.map((label, index) => {
              const number = index + 1;
              const state = step === number ? "active" : step > number ? "done" : "";

              return (
                <li key={label}>
                  <button
                    aria-current={step === number ? "step" : undefined}
                    className={cn(styles.stepRow, state === "active" && styles.active, state === "done" && styles.done)}
                    disabled={step <= number}
                    onClick={() => goTo(number, -1)}
                    type="button"
                  >
                    <b>{step > number ? "✓" : number}</b>
                    <span><small>Adım {number}</small>{label}</span>
                  </button>
                </li>
              );
            })}
          </ol>
          <div className={styles.wzHelp}>
            <strong>🔒 Bilgilerin güvende</strong>
            <p>Adın, telefonun ve açık adresin talep özetinde asla görünmez.</p>
            <a href="mailto:destek@alicam.net">Yardım mı lazım?</a>
          </div>
        </aside>

        {/* Orta: form */}
        <section className={styles.wzMain}>
          <form className={styles.formCard} noValidate onSubmit={submit}>
            {/* ADIM 1 */}
            {step === 1 && (
              <fieldset className={cn(styles.step, direction < 0 && styles.back)}>
                <legend className={styles.stepHead}>
                  <span className={styles.stepNo}>Adım 1 / 4</span>
                  <span className={styles.stepTitle}>Ne için teklif almak istiyorsun?</span>
                </legend>
                <p className={styles.stepLead}>Önce türü seç, sonra başlığı bul. Sana özel birkaç kısa soru soracağız.</p>

                {invitedSeller && (
                  <div className={styles.invited}>
                    <i>◈</i>
                    <div>
                      <strong>{invitedSeller.name} için teklif isteği</strong>
                      <small>Talebin doğrudan bu mağazaya iletilir. Diğer uygun hizmet verenler de görebilir.</small>
                    </div>
                    <button onClick={() => setInvitedSeller(null)} type="button">Kaldır</button>
                  </div>
                )}

                <div className={styles.vpick} role="radiogroup" aria-label="Talep türü">
                  {VERTICALS.map((item) => (
                    <label
                      className={cn(styles.vopt, form.vertical === item.id && styles.on)}
                      key={item.id}
                      style={{ "--c": item.color } as React.CSSProperties}
                    >
                      <input
                        checked={form.vertical === item.id}
                        name="tip"
                        onChange={() => pickVertical(item.id)}
                        type="radio"
                        value={item.id}
                      />
                      <i>{item.emoji}</i>
                      <strong>{item.name}</strong>
                      <small>{item.desc}</small>
                    </label>
                  ))}
                </div>

                {vertical && (
                  <div className={styles.catpick}>
                    <div className={styles.catpickHead}>
                      <h3>{vertical.emoji} {vertical.name}: hangi başlık?</h3>
                      <label className={styles.catSearch}>
                        <span aria-hidden="true">🔍</span>
                        <input
                          aria-label="Başlık ara"
                          onChange={(event) => setSearch(event.target.value)}
                          placeholder={form.vertical === "hizmet" ? "Ara… örn. kombi, boya, nakliyat" : "Başlıklarda ara…"}
                          type="search"
                          value={search}
                        />
                      </label>
                    </div>

                    {form.category && (
                      <div className={styles.chosen}>
                        <i>✓</i>
                        <div>
                          <strong>{form.categoryName}</strong>
                          {form.categoryPath.length > 0 && <small>{form.categoryPath.join(" › ")}</small>}
                        </div>
                        <button onClick={clearCategory} type="button">Değiştir</button>
                      </div>
                    )}

                    <div className={styles.catlist} role="radiogroup" aria-label="Başlıklar">
                      {listGroups.map((group) => (
                        <Fragment key={group.key}>
                          {group.heading && browseGroups.length > 1 && <div className={styles.cgroup}>{group.heading}</div>}
                          {group.items.map((item) => (
                            <label className={cn(styles.copt, form.category === item.slug && styles.on)} key={item.slug}>
                              <input
                                checked={form.category === item.slug}
                                name="kategori"
                                onChange={() => pickCategory(item)}
                                type="radio"
                              />
                              <i>{item.icon || vertical.emoji}</i>
                              <span>
                                {item.name}
                                {showingSearch && item.path.length > 0 && <em>{item.path.join(" › ")}</em>}
                              </span>
                            </label>
                          ))}
                        </Fragment>
                      ))}

                      {visibleCount === 0 && (
                        <div className={styles.catEmpty}>
                          {searching
                            ? "Aranıyor…"
                            : showingSearch
                              ? `“${query}” için ${vertical.name} altında başlık bulamadık.`
                              : "Başlıklar yükleniyor…"}
                        </div>
                      )}
                    </div>

                    {form.category && extraSuggestions.length > 0 && (
                      <div className={styles.extra}>
                        <strong>Başka başlıklarda da listelensin mi?</strong>
                        <small>Seçtiğin her başlıktaki hizmet verenler de talebini görür. En fazla 4 tane.</small>
                        <div className={styles.chips}>
                          {extraSuggestions.map((item) => {
                            const on = form.extraCategories.includes(item.slug);

                            return (
                              <button
                                aria-pressed={on}
                                className={cn(styles.chip, on && styles.on)}
                                disabled={!on && form.extraCategories.length >= 4}
                                key={item.slug}
                                onClick={() => toggleExtra(item.slug)}
                                type="button"
                              >{on ? "✓" : "＋"} {item.name}</button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {invalid.category && <p className={styles.errLine}>Devam etmek için bir tür ve başlık seç.</p>}
              </fieldset>
            )}

            {/* ADIM 2 */}
            {step === 2 && (
              <fieldset className={cn(styles.step, direction < 0 && styles.back)}>
                <legend className={styles.stepHead}>
                  <span className={styles.stepNo}>Adım 2 / 4</span>
                  <span className={styles.stepTitle}>{vertical ? `${vertical.emoji} ` : ""}{form.categoryName} — biraz detay ver</span>
                </legend>
                <p className={styles.stepLead}>Ne kadar net yazarsan, o kadar isabetli teklif alırsın.</p>

                {loadingAttributes && <p className={styles.loadingLine}>Kategori soruları hazırlanıyor…</p>}

                {!loadingAttributes && fields.length > 0 && (
                  <div className={styles.fgrid}>{fields.map(renderField)}</div>
                )}

                <div className={styles.fgrid}>
                  <label className={cn(styles.field, styles.full, invalid.title && styles.invalid)}>
                    <span>Talep başlığı<em className={styles.req}>*</em></span>
                    <input
                      className={styles.input}
                      maxLength={120}
                      onChange={(event) => {
                        setForm((current) => ({ ...current, title: event.target.value, titleTouched: event.target.value.length > 0 }));
                        setError("");
                        clearInvalid("title");
                      }}
                      placeholder="Örn. 3+1 kiralık daire, site içinde"
                      value={title}
                    />
                    <small className={styles.counter}>
                      <span>Teklif verenler ilk bunu görür. Kısa ve net tut.</span>
                      <b>{title.length} / 120</b>
                    </small>
                    <span className={styles.err}>Bir başlık yaz (en az 10 karakter).</span>
                  </label>

                  <label className={cn(styles.field, styles.full, invalid.description && styles.invalid)}>
                    <span>Açıklama<em className={styles.req}>*</em></span>
                    <textarea
                      className={styles.textarea}
                      maxLength={1000}
                      onChange={(event) => { update("description", event.target.value); clearInvalid("description"); }}
                      placeholder={DESCRIPTION_PLACEHOLDER[form.vertical] ?? ""}
                      value={form.description}
                    />
                    <small className={styles.counter}>
                      <span>{descriptionTip}</span>
                      <b>{form.description.length} / 1000</b>
                    </small>
                    <span className={styles.err}>Biraz daha anlat (en az 20 karakter).</span>
                  </label>
                </div>
              </fieldset>
            )}

            {/* ADIM 3 */}
            {step === 3 && (
              <fieldset className={cn(styles.step, direction < 0 && styles.back)}>
                <legend className={styles.stepHead}>
                  <span className={styles.stepNo}>Adım 3 / 4</span>
                  <span className={styles.stepTitle}>Bütçen ve konumun</span>
                </legend>
                <p className={styles.stepLead}>Talebin yalnızca bu bölgedeki teklif verenlere gösterilir.</p>

                <div className={styles.fgrid}>
                  <label className={cn(styles.field, invalid.city && styles.invalid)}>
                    <span>İl<em className={styles.req}>*</em></span>
                    <select
                      className={styles.select}
                      onChange={(event) => {
                        setForm((current) => ({ ...current, cityId: event.target.value, districtId: "" }));
                        setError("");
                        clearInvalid("city");
                      }}
                      value={form.cityId}
                    >
                      <option value="">İl seç</option>
                      {cities.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}
                    </select>
                    <span className={styles.err}>Bir il seç.</span>
                  </label>

                  <label className={cn(styles.field, invalid.district && styles.invalid)}>
                    <span>İlçe<em className={styles.req}>*</em></span>
                    <select
                      className={styles.select}
                      disabled={!selectedCity}
                      onChange={(event) => { update("districtId", event.target.value); clearInvalid("district"); }}
                      value={form.districtId}
                    >
                      <option value="">{selectedCity ? "İlçe seç" : "Önce il seç"}</option>
                      {(selectedCity?.districts ?? []).map((district) => <option key={district.id} value={district.id}>{district.name}</option>)}
                    </select>
                    <small>Tam adres istemiyoruz.</small>
                    <span className={styles.err}>Bir ilçe seç.</span>
                  </label>

                  <div className={cn(styles.field, styles.full, (invalid.budgetMin || invalid.budgetMax) && styles.invalid)}>
                    <span className={styles.label}>{budgetLabel}<em className={styles.req}>*</em></span>
                    <div className={styles.budget}>
                      <div className={styles.inputGroup}>
                        <input
                          aria-label="En az bütçe"
                          className={styles.input}
                          inputMode="numeric"
                          onChange={(event) => {
                            update("budgetMin", event.target.value.replace(/\D/g, "").slice(0, 11));
                            clearInvalid("budgetMin");
                          }}
                          placeholder="En az"
                          value={form.budgetMin ? grouped(form.budgetMin) : ""}
                        />
                        <span className={styles.suffix}>{budgetUnit}</span>
                      </div>
                      <span className={styles.budgetSep}>–</span>
                      <div className={styles.inputGroup}>
                        <input
                          aria-label="En fazla bütçe"
                          className={styles.input}
                          inputMode="numeric"
                          onChange={(event) => {
                            update("budgetMax", event.target.value.replace(/\D/g, "").slice(0, 11));
                            clearInvalid("budgetMax");
                          }}
                          placeholder="En fazla"
                          value={form.budgetMax ? grouped(form.budgetMax) : ""}
                        />
                        <span className={styles.suffix}>{budgetUnit}</span>
                      </div>
                    </div>

                    {quickBudgets.length > 0 && (
                      <div className={cn(styles.chips, styles.budgetQuick)}>
                        {quickBudgets.map(([label, min, max]) => {
                          // Ust siniri acik olan cipte yalnizca alt sinir yazilir;
                          // API ust siniri zorunlu tuttugu icin kullanici tamamlar.
                          const on = String(min) === form.budgetMin && String(max ?? "") === form.budgetMax;

                          return (
                            <button
                              aria-pressed={on}
                              className={cn(styles.chip, on && styles.on)}
                              key={label}
                              onClick={() => {
                                setForm((current) => ({
                                  ...current,
                                  budgetMin: String(min),
                                  budgetMax: max === null ? "" : String(max),
                                }));
                                setError("");
                                setInvalid((current) => ({ ...current, budgetMin: false, budgetMax: false }));
                              }}
                              type="button"
                            >{label}</button>
                          );
                        })}
                      </div>
                    )}

                    <label className={styles.check}>
                      <input
                        checked={form.budgetFlexible}
                        onChange={(event) => update("budgetFlexible", event.target.checked)}
                        type="checkbox"
                      />
                      Bütçem esnek, iyi teklifleri görmek isterim
                    </label>
                    <span className={styles.err}>Alt ve üst sınırı yaz; üst sınır alttan küçük olamaz.</span>
                  </div>

                  <div className={cn(styles.field, styles.full)}>
                    <span className={styles.label}>Ne zamana kadar?</span>
                    <div className={styles.chips} role="radiogroup" aria-label="Zamanlama">
                      {TIMINGS.map(([id, label]) => (
                        <label className={cn(styles.chip, form.timing === id && styles.on)} key={id}>
                          <input
                            checked={form.timing === id}
                            name="zaman"
                            onChange={() => update("timing", id)}
                            type="radio"
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </fieldset>
            )}

            {/* ADIM 4 */}
            {step === 4 && (
              <fieldset className={cn(styles.step, direction < 0 && styles.back)}>
                <legend className={styles.stepHead}>
                  <span className={styles.stepNo}>Adım 4 / 4</span>
                  <span className={styles.stepTitle}>Son adım: sana nasıl ulaşalım?</span>
                </legend>
                <p className={styles.stepLead}>Bu bilgiler talep özetinde görünmez. Yalnızca talebini açan onaylı teklif verenle paylaşılır.</p>

                {!authChecked && <p className={styles.loadingLine}>Oturum bilgin kontrol ediliyor…</p>}

                {authChecked && viewer && (
                  <div className={styles.identity}>
                    <strong>Hesabındaki bilgiler kullanılacak</strong>
                    <div className={styles.identityRows}>
                      <div><span>Ad soyad</span><b>{viewer.name}</b></div>
                      <div><span>E-posta</span><b>{viewer.email}</b></div>
                      <div><span>Telefon</span><b>{viewer.phone || "—"}</b></div>
                    </div>
                    <p>Değiştirmek istersen <Link href="/ayarlar">hesap ayarlarından</Link> güncelleyebilirsin.</p>
                  </div>
                )}

                {anonymous && (
                  <>
                    <div className={styles.already}>Zaten üye misin? <Link href="/giris">Giriş yap</Link>, bilgilerin otomatik dolsun.</div>
                    <div className={styles.fgrid}>
                      <label className={cn(styles.field, invalid.contactName && styles.invalid)}>
                        <span>Ad soyad<em className={styles.req}>*</em></span>
                        <input
                          autoComplete="name"
                          className={styles.input}
                          onChange={(event) => { update("contactName", event.target.value); clearInvalid("contactName"); }}
                          placeholder="Adın ve soyadın"
                          value={form.contactName}
                        />
                        <span className={styles.err}>Adını yaz.</span>
                      </label>

                      <label className={cn(styles.field, invalid.contactEmail && styles.invalid)}>
                        <span>E-posta<em className={styles.req}>*</em></span>
                        <input
                          autoComplete="email"
                          className={styles.input}
                          onChange={(event) => { update("contactEmail", event.target.value); clearInvalid("contactEmail"); }}
                          placeholder="ornek@eposta.com"
                          type="email"
                          value={form.contactEmail}
                        />
                        <small>Hesabını bu adresle açacağız; doğrulama kodu buraya gelir.</small>
                        <span className={styles.err}>E-posta adresi geçerli görünmüyor.</span>
                      </label>

                      <label className={cn(styles.field, styles.full, invalid.contactPhone && styles.invalid)}>
                        <span>Cep telefonu <em className={styles.opt}>(isteğe bağlı)</em></span>
                        <input
                          autoComplete="tel"
                          className={styles.input}
                          inputMode="tel"
                          onChange={(event) => {
                            const digits = event.target.value.replace(/\D/g, "").slice(0, 11);
                            const normalized = digits && digits[0] !== "0" ? `0${digits}`.slice(0, 11) : digits;
                            update("contactPhone", [normalized.slice(0, 4), normalized.slice(4, 7), normalized.slice(7, 9), normalized.slice(9, 11)].filter(Boolean).join(" "));
                            clearInvalid("contactPhone");
                          }}
                          placeholder="05xx xxx xx xx"
                          type="tel"
                          value={form.contactPhone}
                        />
                        <small>Teklif verenler seni arayabilsin diye. Doğrulama e-posta ile yapılır.</small>
                        <span className={styles.err}>Geçerli bir cep telefonu yaz (05xx xxx xx xx).</span>
                      </label>
                    </div>
                  </>
                )}

                <div className={styles.fgrid}>
                  <div className={cn(styles.field, styles.full)}>
                    <span className={styles.label}>Teklif verenler sana nasıl ulaşsın?</span>
                    <div className={styles.chips}>
                      {CONTACT_PREFERENCES.map(([id, label]) => {
                        const on = form.contactPreferences.includes(id);

                        return (
                          <label className={cn(styles.chip, on && styles.on)} key={id}>
                            <input
                              checked={on}
                              onChange={(event) => update(
                                "contactPreferences",
                                event.target.checked
                                  ? [...form.contactPreferences, id]
                                  : form.contactPreferences.filter((item) => item !== id),
                              )}
                              type="checkbox"
                            />
                            {label}
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <label className={cn(styles.check, styles.full)}>
                    <input
                      checked={terms}
                      onChange={(event) => { setTerms(event.target.checked); clearInvalid("terms"); setError(""); }}
                      type="checkbox"
                    />
                    <span>
                      <Link href="/kullanim-kosullari" target="_blank">Kullanım koşullarını</Link> ve{" "}
                      <Link href="/gizlilik" target="_blank">gizlilik politikasını</Link> okudum, kabul ediyorum.
                    </span>
                  </label>

                  {invalid.terms && <p className={cn(styles.errLine, styles.full)}>Devam etmek için koşulları kabul et.</p>}
                </div>

                {anonymous && (
                  <p className={styles.loadingLine}>
                    Talebi yayınlamak için ücretsiz bir hesap gerekiyor. “Talebimi yayınla” dediğinde bilgilerini
                    saklayıp seni giriş ekranına götürürüz; döndüğünde talebin kaldığı yerden yayınlanır.
                  </p>
                )}
              </fieldset>
            )}

            {error && <p className={cn(styles.errLine, styles.formError)} role="alert">{error}</p>}

            <div className={styles.wzFoot}>
              <button
                className={cn(styles.btn, styles.btnLine, step === 1 && styles.hidden)}
                onClick={() => goTo(Math.max(1, step - 1), -1)}
                type="button"
              >← Geri</button>
              <span aria-live="polite" className={cn(styles.draft, draftSaved && styles.saved)}>
                {draftSaved ? "Taslak kaydedildi" : ""}
              </span>
              <button
                className={cn(styles.btn, styles.btnCta, styles.btnLg, styles.next)}
                disabled={submitting || (step === 2 && loadingAttributes)}
                type="submit"
              >{step === 4 ? (submitting ? "Yayınlanıyor…" : "🚀 Talebimi yayınla") : "Devam et →"}</button>
            </div>
          </form>
        </section>

        {/* Sag: canli onizleme */}
        <aside className={styles.wzPreview} aria-label="Talep önizlemesi">
          <div className={styles.pvLabel}>👁️ Teklif verenler talebini böyle görecek</div>
          <article className={styles.pv}>
            <div className={styles.pvTop}>
              <span className={styles.pvType} style={{ "--c": vertical?.color ?? "#7A849C" } as React.CSSProperties}>
                {vertical ? `${vertical.emoji} ${vertical.name}` : "Tür seçilmedi"}
                {form.categoryName ? ` · ${form.categoryName}` : ""}
              </span>
              <span className={styles.pvNew}>Yeni</span>
            </div>
            <h3 className={title ? undefined : styles.ph}>{title || "Talep başlığın burada görünecek"}</h3>
            <div className={cn(styles.pvLoc, !selectedCity && styles.ph)}>
              📍 {[selectedDistrict?.name, selectedCity?.name].filter(Boolean).join(", ") || "Konum"}
            </div>
            {previewSpecs.length > 0 && (
              <div className={styles.pvSpecs}>{previewSpecs.map((spec, index) => <span key={`${spec}-${index}`}>{spec}</span>)}</div>
            )}
            {form.description && <p className={styles.pvDesc}>{form.description}</p>}
            <div className={styles.pvFoot}>
              <div>
                <small>Bütçe</small>
                <b className={previewBudget() ? undefined : styles.ph}>{previewBudget() || "Belirtilmedi"}</b>
              </div>
              <span className={styles.pvLock}>🔒 İletişim gizli</span>
            </div>
          </article>
          <ul className={styles.pvTips}>
            <li><b>💡</b> Net bir bütçe yazarsan <strong>daha isabetli</strong> teklifler alırsın.</li>
            <li><b>⏱️</b> Popüler kategorilerde ilk teklifler genellikle <strong>aynı gün</strong> gelir.</li>
          </ul>
        </aside>
      </main>
    </div>
  );
}
