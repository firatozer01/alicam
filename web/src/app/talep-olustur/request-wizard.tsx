"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiError, apiRequest, firstApiError } from "@/lib/api";

type Category = {
  id: number;
  slug: string;
  icon: string;
  name: string;
  color: string;
  schema_version: number;
  /** Hizmet talebi mi, urun/ilan talebi mi. */
  kind?: "service" | "listing";
  children?: Category[];
};

type CategoryAttribute = {
  id: number;
  key: string;
  label: string;
  type: "text" | "textarea" | "select" | "multiselect" | "number" | "range" | "boolean" | "date";
  options: string[] | null;
  unit: string | null;
  help_text: string | null;
  is_required: boolean;
};

type City = {
  id: number;
  name: string;
  districts: { id: number; name: string }[];
};

type AttributeValue = string | string[] | boolean;

type FormData = {
  category: string;
  /** Birincil disinda talebin listeleneceği kategoriler. */
  extraCategories: string[];
  title: string;
  description: string;
  attributes: Record<string, AttributeValue>;
  budgetMin: string;
  budgetMax: string;
  cityId: string;
  districtId: string;
};

const categoryDescriptions: Record<string, string> = {
  hizmet: "Bakım, danışmanlık ve profesyonel hizmetler",
  nakliye: "Ev, ofis ve parça eşya taşıma",
  tadilat: "Boya, dekorasyon ve yenileme işleri",
};

// Kategori agaci veritabanindan gelir; ilk boyamada liste bos, API yanitiyla dolar.
const fallbackCategories: Category[] = [];

const initialForm: FormData = {
  category: "",
  extraCategories: [],
  title: "",
  description: "",
  attributes: {},
  budgetMin: "",
  budgetMax: "",
  cityId: "",
  districtId: "",
};

const DRAFT_KEY = "alicam-request-draft";

/** Kategori listesi bu sayidan uzunsa sayfalanir. */
const CATEGORY_PAGE_SIZE = 5;

/** Agacta slug'a gore dugumu ve ona giden yolu bulur. */
function findPath(nodes: Category[], slug: string, trail: Category[] = []): Category[] | null {
  for (const node of nodes) {
    if (node.slug === slug) return trail;
    const deeper = findPath(node.children ?? [], slug, [...trail, node]);
    if (deeper) return deeper;
  }
  return null;
}

function findNode(nodes: Category[], slug: string): Category | undefined {
  for (const node of nodes) {
    if (node.slug === slug) return node;
    const deeper = findNode(node.children ?? [], slug);
    if (deeper) return deeper;
  }
  return undefined;
}

export function RequestWizard({ initialCategory }: { initialCategory?: string }) {
  const router = useRouter();
  // Derin baglanti herhangi bir kategori slug'i tasiyabilir; gecerliligini API dogrular.
  const normalizedCategory = (initialCategory ?? "").trim();
  const [step, setStep] = useState(normalizedCategory ? 2 : 1);
  const [form, setForm] = useState<FormData>({ ...initialForm, category: normalizedCategory });
  const [categories, setCategories] = useState<Category[]>(fallbackCategories);
  const [categoryAttributes, setCategoryAttributes] = useState<CategoryAttribute[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [loadingSchema, setLoadingSchema] = useState(Boolean(normalizedCategory));
  // Agacta hangi dalin icindeyiz; bos dizi kok seviyesidir.
  const [branch, setBranch] = useState<Category[]>([]);
  const [kind, setKind] = useState<"service" | "listing">("service");
  const [categoryPage, setCategoryPage] = useState(1);
  const [showOptional, setShowOptional] = useState(false);
  const [expandedOptions, setExpandedOptions] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successReference, setSuccessReference] = useState("");

  useEffect(() => {
    Promise.all([
      apiRequest<{ data: Category[] }>("/categories?tree=1"),
      apiRequest<{ data: City[] }>("/locations"),
    ])
      .then(([categoryResponse, locationResponse]) => {
        setCategories(categoryResponse.data);
        setCities(locationResponse.data);
      })
      .catch(() => setError("Form verileri alınamadı. Sayfayı yenileyerek tekrar deneyin."));

    const savedDraft = window.sessionStorage.getItem(DRAFT_KEY);
    if (savedDraft) {
      try {
        const restored = JSON.parse(savedDraft) as FormData;
        window.queueMicrotask(() => {
          setForm(restored);
          setStep(4);
          setLoadingSchema(Boolean(restored.category));
        });
      } catch {
        window.sessionStorage.removeItem(DRAFT_KEY);
      }
    }
  }, []);

  useEffect(() => {
    if (!form.category) return;

    let active = true;
    // effective_attributes ust kategorilerden miras alinanlari da icerir.
    apiRequest<{ data: Category & { attributes: CategoryAttribute[] }; effective_attributes?: CategoryAttribute[] }>(`/categories/${form.category}/attributes`)
      .then((response) => {
        if (active) setCategoryAttributes(response.effective_attributes ?? response.data.attributes);
      })
      .catch(() => {
        if (active) setError("Kategori soruları alınamadı. Lütfen tekrar deneyin.");
      })
      .finally(() => {
        if (active) setLoadingSchema(false);
      });

    return () => {
      active = false;
    };
  }, [form.category]);

  const selectedCategory = useMemo(
    () => findNode(categories, form.category),
    [categories, form.category],
  );

  const roots = useMemo(
    () => categories.filter((item) => (item.kind ?? "service") === kind),
    [categories, kind],
  );
  const current = branch.length > 0 ? branch[branch.length - 1] : null;
  const shown = current ? (current.children ?? []) : roots;
  const pageCount = Math.max(1, Math.ceil(shown.length / CATEGORY_PAGE_SIZE));
  const safePage = Math.min(categoryPage, pageCount);
  const visible = shown.slice((safePage - 1) * CATEGORY_PAGE_SIZE, safePage * CATEGORY_PAGE_SIZE);
  // Dal veya sayfa degisince liste yeniden baglanir; giris animasyonu tekrar oynar.
  const listKey = `${current?.slug ?? kind}-${safePage}`;

  // Taslaktan veya linkten gelen derin bir kategori icin kirinti yolu geri kurulur.
  // Efekt yerine render sirasinda ayarlanir; fazladan bir tur olusmaz.
  const [resolvedFor, setResolvedFor] = useState("");
  if (form.category && categories.length > 0 && resolvedFor !== form.category) {
    setResolvedFor(form.category);
    const trail = findPath(categories, form.category);
    if (trail) {
      setBranch(trail);
      const rootKind = (trail[0] ?? findNode(categories, form.category))?.kind;
      if (rootKind) setKind(rootKind);
    }
  }

  /**
   * Ek kategori onerileri: secilen basligin kardesleri. Talep bu basliklarda
   * da listelenir, o alanlardaki saticilar da gorur.
   */
  const extraSuggestions = useMemo(() => {
    if (!form.category || categories.length === 0) return [];

    const trail = findPath(categories, form.category);
    const parent = trail && trail.length > 0 ? trail[trail.length - 1] : null;
    const pool = parent ? (parent.children ?? []) : categories.filter((item) => (item.kind ?? "service") === kind);

    return pool.filter((item) => item.slug !== form.category).slice(0, 8);
  }, [categories, form.category, kind]);

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
    setError("");
  };

  const chooseNode = (node: Category) => {
    if ((node.children ?? []).length > 0) {
      setBranch((path) => [...path, node]);
      setCategoryPage(1);
      return;
    }
    setLoadingSchema(true);
    setShowOptional(false);
    update("category", node.slug);
    update("extraCategories", []);
    update("attributes", {});
  };
  const selectedCity = useMemo(
    () => cities.find((item) => String(item.id) === form.cityId),
    [cities, form.cityId],
  );
  const selectedDistrict = useMemo(
    () => selectedCity?.districts.find((item) => String(item.id) === form.districtId),
    [selectedCity, form.districtId],
  );

  const update = <K extends keyof FormData>(field: K, value: FormData[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
    setError("");
  };

  const updateAttribute = (key: string, value: AttributeValue) => {
    setForm((current) => ({
      ...current,
      attributes: { ...current.attributes, [key]: value },
    }));
    setError("");
  };

  const requiredAttributes = categoryAttributes.filter((attribute) => attribute.is_required);
  const optionalAttributes = categoryAttributes.filter((attribute) => !attribute.is_required);

  const requiredAttributesComplete = categoryAttributes
    .filter((attribute) => attribute.is_required)
    .every((attribute) => {
      const value = form.attributes[attribute.key];
      return Array.isArray(value) ? value.length > 0 : value !== undefined && value !== "";
    });

  const stepIsValid = step === 1
    ? Boolean(form.category)
    : step === 2
      ? form.title.trim().length >= 10 && form.description.trim().length >= 20 && requiredAttributesComplete
      : step === 3
        ? Boolean(form.budgetMin && form.budgetMax && form.cityId && form.districtId) && Number(form.budgetMax) >= Number(form.budgetMin)
        : true;

  const next = () => {
    if (!stepIsValid) {
      setError("Devam etmek için bu adımdaki zorunlu alanları tamamlayın.");
      return;
    }
    setError("");
    setStep((current) => Math.min(4, current + 1));
  };

  const back = () => {
    setError("");
    setStep((current) => Math.max(1, current - 1));
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const response = await apiRequest<{ data: { reference: string } }>("/requests", {
        method: "POST",
        body: JSON.stringify({
          category_slug: form.category,
          extra_category_slugs: form.extraCategories,
          title: form.title,
          description: form.description,
          attributes: form.attributes,
          budget_min: Number(form.budgetMin),
          budget_max: Number(form.budgetMax),
          city_id: Number(form.cityId),
          district_id: Number(form.districtId),
        }),
      });

      window.sessionStorage.removeItem(DRAFT_KEY);
      setSuccessReference(response.data.reference);
    } catch (requestError) {
      if (requestError instanceof ApiError && [401, 403].includes(requestError.status)) {
        window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(form));
        const verification = requestError.status === 403 ? "&dogrulama=1" : "";
        router.push(`/giris?devam=${encodeURIComponent("/talep-olustur?taslak=1")}${verification}`);
        return;
      }

      setError(firstApiError(requestError));
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * Alan genisligi icerige gore secilir: serbest metin ve coklu secim tam
   * satir; cip gruplari yalnizca secenek metinleri uzunsa tam satir kaplar,
   * kisa olanlar yan yana iki sutuna sigar.
   */
  const attributeWidth = (attribute: CategoryAttribute) => {
    if (attribute.type === "textarea" || attribute.type === "multiselect") return " attr-wide";

    const options = attribute.options ?? [];
    const rendersAsChips = attribute.type === "boolean"
      || (attribute.type === "select" && options.length > 0 && options.length <= 6);

    if (!rendersAsChips) return "";

    const weight = options.reduce((total, option) => total + option.length, 0) + attribute.label.length;

    return weight > 46 ? " attr-wide" : "";
  };

  /** Sekizden uzun secenek listeleri katlanir; sayfa gereksiz uzamaz. */
  const OPTION_LIMIT = 8;

  const visibleOptions = (attribute: CategoryAttribute, options: string[]) =>
    options.length > OPTION_LIMIT && !expandedOptions[attribute.key]
      ? options.slice(0, OPTION_LIMIT)
      : options;

  const optionToggle = (attribute: CategoryAttribute, options: string[]) =>
    options.length > OPTION_LIMIT ? (
      <button
        className="option-more"
        onClick={() => setExpandedOptions((current) => ({ ...current, [attribute.key]: !current[attribute.key] }))}
        type="button"
      >{expandedOptions[attribute.key] ? "Daha az göster" : `+${options.length - OPTION_LIMIT} seçenek`}</button>
    ) : null;

  const renderAttribute = (attribute: CategoryAttribute) => {
    const value = form.attributes[attribute.key];
    const suffix = attribute.unit ? ` (${attribute.unit})` : "";
    const wide = attributeWidth(attribute);
    const options = attribute.options ?? [];

    // Az secenekli sorular acilir menu yerine cip olarak gosterilir:
    // tek tikla secilir ve form gozle taranabilir kalir.
    if (attribute.type === "select" && options.length > 0 && options.length <= 6) {
      return (
        <fieldset className={`attribute-options${wide}`} key={attribute.key}>
          <legend><span className="fl-head">{attribute.label}{suffix}{attribute.is_required && <em className="req">*</em>}</span></legend>
          <div>
            {visibleOptions(attribute, options).map((option) => (
              <label className={value === option ? "selected" : ""} key={option}>
                <input
                  checked={value === option}
                  name={attribute.key}
                  onChange={() => updateAttribute(attribute.key, option)}
                  type="radio"
                />
                <span>{option}</span>
              </label>
            ))}
            {optionToggle(attribute, options)}
          </div>
          {attribute.help_text && <small className="attr-hint">{attribute.help_text}</small>}
        </fieldset>
      );
    }

    if (attribute.type === "boolean") {
      return (
        <fieldset className="attribute-options" key={attribute.key}>
          <legend>{attribute.label}{attribute.is_required && <em className="req">*</em>}</legend>
          <div>
            {([["true", "Evet"], ["false", "Hayır"]] as const).map(([raw, text]) => (
              <label className={String(value) === raw ? "selected" : ""} key={raw}>
                <input
                  checked={String(value) === raw}
                  name={attribute.key}
                  onChange={() => updateAttribute(attribute.key, raw === "true")}
                  type="radio"
                />
                <span>{text}</span>
              </label>
            ))}
          </div>
          {attribute.help_text && <small className="attr-hint">{attribute.help_text}</small>}
        </fieldset>
      );
    }

    if (attribute.type === "select") {
      return (
        <label className={`field-label${wide}`} key={attribute.key}>
          <span className="fl-head">{attribute.label}{suffix}</span>
          <select onChange={(event) => updateAttribute(attribute.key, event.target.value)} required={attribute.is_required} value={String(value ?? "")}>
            <option value="">Seç</option>
            {(attribute.options ?? []).map((option) => <option key={option}>{option}</option>)}
          </select>
          {attribute.help_text && <small>{attribute.help_text}</small>}
        </label>
      );
    }

    if (attribute.type === "multiselect") {
      const values = Array.isArray(value) ? value : [];
      return (
        <fieldset className={`attribute-options${wide}`} key={attribute.key}>
          <legend>{attribute.label}{suffix}</legend>
          <div>
            {visibleOptions(attribute, attribute.options ?? []).map((option) => (
              <label className={values.includes(option) ? "selected" : ""} key={option}>
                <input
                  checked={values.includes(option)}
                  onChange={(event) => updateAttribute(attribute.key, event.target.checked ? [...values, option] : values.filter((item) => item !== option))}
                  type="checkbox"
                />
                <span>{option}</span>
              </label>
            ))}
            {optionToggle(attribute, attribute.options ?? [])}
          </div>
        </fieldset>
      );
    }

    if (attribute.type === "textarea") {
      return (
        <label className={`field-label${wide}`} key={attribute.key}>
          <span className="fl-head">{attribute.label}{suffix}</span>
          <textarea
            maxLength={2000}
            onChange={(event) => updateAttribute(attribute.key, event.target.value)}
            placeholder={attribute.help_text ?? ""}
            required={attribute.is_required}
            rows={4}
            value={String(value ?? "")}
          />
          {attribute.help_text && <small>{attribute.help_text}</small>}
        </label>
      );
    }

    return (
      <label className={`field-label${wide}`} key={attribute.key}>
        <span className="fl-head">{attribute.label}{suffix}{attribute.is_required && <em className="req">*</em>}</span>
        <input
          onChange={(event) => updateAttribute(attribute.key, event.target.value)}
          placeholder={attribute.help_text ?? attribute.label}
          required={attribute.is_required}
          type={attribute.type === "number" || attribute.type === "range" ? "number" : attribute.type === "date" ? "date" : "text"}
          value={String(value ?? "")}
        />
      </label>
    );
  };

  if (successReference) {
    return (
      <main className="wizard-page">
        <nav className="wizard-nav shell"><Link className="brand" href="/">alıcam<span>.net</span></Link></nav>
        <section className="success-card">
          <span className="success-icon">✓</span>
          <span className="section-kicker">TALEBİN YAYINDA</span>
          <h1>Harika, talebini yayınladık.</h1>
          <p>Talebin ilgili hizmet verenlerle eşleştirilecek. Teklif geldiğinde sana haber vereceğiz.</p>
          <div className="success-reference"><span>TALEP NUMARASI</span><strong>{successReference}</strong></div>
          <Link className="button button-primary button-large" href="/">Ana sayfaya dön →</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="wizard-page">
      <nav className="wizard-nav shell">
        <Link className="brand" href="/">alıcam<span>.net</span></Link>
        <Link className="wizard-close" href="/">Vazgeç <b>×</b></Link>
      </nav>

      <div className="wizard-progress" aria-label={`4 adımın ${step}. adımı`}><span style={{ width: `${step * 25}%` }} /></div>

      <section className="wizard-shell shell">
        <aside className="wizard-aside">
          <span className="section-kicker">ÜCRETSİZ TALEP OLUŞTUR</span>
          <h1>İhtiyacını bize anlat.</h1>
          <p>Doğru hizmet verenlerle eşleşmen için yalnızca gerekli bilgileri soruyoruz.</p>
          <ol>
            {["Kategori", "Talep detayları", "Bütçe ve konum", "Kontrol ve yayınla"].map((label, index) => {
              const number = index + 1;
              return <li className={step === number ? "active" : step > number ? "complete" : ""} key={label}><span>{step > number ? "✓" : number}</span><div><small>ADIM {number}</small><strong>{label}</strong></div></li>;
            })}
          </ol>
          <div className="privacy-note"><b>⌁</b><p><strong>Bilgilerin güvende</strong><span>İletişim bilgilerin talep özetinde gösterilmez.</span></p></div>
        </aside>

        <form className="wizard-card" onSubmit={submit}>
          <div className="wizard-card-head">
            <span>ADIM {step} / 4</span>
            <strong>{step === 1 ? "Kategori seç" : step === 2 ? "Talebini anlat" : step === 3 ? "Bütçe ve konum" : "Son bir kontrol"}</strong>
          </div>

          {step === 1 && (
            <fieldset className="wizard-fields">
              <legend>Hangi konuda teklif almak istiyorsun?</legend>
              <p className="field-help">Kategoriye göre sana özel birkaç kısa soru hazırlayacağız.</p>
              <div className="cat-kinds">
                {([["service", "Hizmet arıyorum", "Usta, nakliye, ders, bakım"], ["listing", "Ürün / ilan arıyorum", "Emlak, vasıta, ikinci el"]] as const).map(([value, label, hint]) => (
                  <button
                    data-on={kind === value}
                    key={value}
                    onClick={() => { setKind(value); setBranch([]); setCategoryPage(1); update("category", ""); update("attributes", {}); }}
                    type="button"
                  ><strong>{label}</strong><small>{hint}</small></button>
                ))}
              </div>

              {branch.length > 0 && (
                <nav className="cat-crumbs">
                  <button onClick={() => { setBranch([]); setCategoryPage(1); update("category", ""); }} type="button">Tüm kategoriler</button>
                  {branch.map((node, index) => (
                    <button key={node.slug} onClick={() => { setBranch(branch.slice(0, index + 1)); setCategoryPage(1); }} type="button">{node.name}</button>
                  ))}
                </nav>
              )}

              {current && (
                <label className={`cat-self ${form.category === current.slug ? "selected" : ""}`}>
                  <input checked={form.category === current.slug} name="category" onChange={() => { setLoadingSchema(true); update("category", current.slug); update("attributes", {}); }} type="radio" />
                  <span><strong>{current.name} genelinde devam et</strong><small>Alt başlık seçmeden bu kategoride talep aç</small></span><b>✓</b>
                </label>
              )}

              <div className="wizard-categories" key={listKey}>
                {visible.map((category, index) => {
                  const childCount = (category.children ?? []).length;
                  return (
                    <label
                      className={form.category === category.slug ? "selected" : ""}
                      key={category.slug}
                      style={{ "--i": index } as React.CSSProperties}
                    >
                      <input checked={form.category === category.slug} name="category" onChange={() => chooseNode(category)} type="radio" />
                      <i style={{ background: category.color }}>{category.icon}</i>
                      <span>
                        <strong>{category.name}</strong>
                        <small>{categoryDescriptions[category.slug] ?? (childCount > 0 ? `${childCount} alt başlık` : "Bu kategoride talep aç")}</small>
                      </span>
                      <b>{childCount > 0 ? "›" : "✓"}</b>
                    </label>
                  );
                })}
                {shown.length === 0 && <p className="field-help">{categories.length === 0 ? "Kategoriler yükleniyor…" : "Bu başlıkta alt kategori yok."}</p>}
              </div>

              {form.category && extraSuggestions.length > 0 && (
                <section className="extra-cats">
                  <header>
                    <strong>Başka kategorilerde de listelensin mi?</strong>
                    <small>Seçtiğin her başlıktaki hizmet verenler de talebini görür. En fazla 4 tane.</small>
                  </header>
                  <div>
                    {extraSuggestions.map((item) => {
                      const on = form.extraCategories.includes(item.slug);
                      return (
                        <button
                          aria-pressed={on}
                          className={on ? "selected" : ""}
                          disabled={!on && form.extraCategories.length >= 4}
                          key={item.slug}
                          onClick={() => toggleExtra(item.slug)}
                          type="button"
                        >{on ? "✓ " : "＋ "}{item.name}</button>
                      );
                    })}
                  </div>
                </section>
              )}

              {pageCount > 1 && (
                <nav className="cat-pager">
                  <button
                    aria-label="Önceki sayfa"
                    disabled={safePage === 1}
                    onClick={() => setCategoryPage(safePage - 1)}
                    type="button"
                  >‹</button>
                  <div className="cat-pager-pages">
                    {Array.from({ length: pageCount }, (_, index) => index + 1)
                      .filter((number) => number === 1 || number === pageCount || Math.abs(number - safePage) <= 1)
                      .map((number, index, list) => (
                        <span key={number}>
                          {index > 0 && list[index - 1] !== number - 1 && <em>…</em>}
                          <button
                            data-on={number === safePage}
                            onClick={() => setCategoryPage(number)}
                            type="button"
                          >{number}</button>
                        </span>
                      ))}
                  </div>
                  <button
                    aria-label="Sonraki sayfa"
                    disabled={safePage === pageCount}
                    onClick={() => setCategoryPage(safePage + 1)}
                    type="button"
                  >›</button>
                  <small>{shown.length} başlık · sayfa {safePage} / {pageCount}</small>
                </nav>
              )}
            </fieldset>
          )}

          {step === 2 && (
            <fieldset className="wizard-fields">
              <legend>{selectedCategory?.name ?? "Talep"} detaylarını paylaş</legend>
              <p className="field-help">Kişisel iletişim bilgilerini açıklama alanına yazma.</p>
              <section className="form-section">
                <header><i>1</i><div><strong>Talebini tanımla</strong><small>Başlık ve kapsam</small></div></header>
                <div className="attr-grid">
                  <label className="field-label attr-wide"><span className="fl-head">Talep başlığı<em className="req">*</em></span><input maxLength={120} minLength={10} onChange={(event) => update("title", event.target.value)} placeholder="Örn. 2+1 daire için boya ustası arıyorum" required type="text" value={form.title} /><small>{form.title.length} / 120</small></label>
                  <label className="field-label attr-wide"><span className="fl-head">Açıklama<em className="req">*</em></span><textarea maxLength={3000} minLength={20} onChange={(event) => update("description", event.target.value)} placeholder="İşin kapsamını, beklentilerini ve varsa önemli detayları anlat." required rows={5} value={form.description} /><small>{form.description.length} / 3000 · en az 20 karakter</small></label>
                </div>
              </section>

              {loadingSchema ? <p className="schema-loading">Kategori soruları hazırlanıyor…</p> : <>
                {requiredAttributes.length > 0 && (
                  <section className="form-section">
                    <header><i>2</i><div><strong>Gerekli bilgiler</strong><small>Satıcıların isabetli teklif verebilmesi için</small></div></header>
                    <div className="attr-grid">{requiredAttributes.map(renderAttribute)}</div>
                  </section>
                )}

                {optionalAttributes.length > 0 && (
                  <section className="form-section" data-open={showOptional}>
                    <button className="form-section-toggle" onClick={() => setShowOptional((open) => !open)} type="button">
                      <i>{showOptional ? "−" : "＋"}</i>
                      <div><strong>İsteğe bağlı detaylar</strong><small>{optionalAttributes.length} alan · doldurdukça teklifler netleşir</small></div>
                      <b>{showOptional ? "Gizle" : "Göster"}</b>
                    </button>
                    {showOptional && <div className="attr-grid">{optionalAttributes.map(renderAttribute)}</div>}
                  </section>
                )}
              </>}
            </fieldset>
          )}

          {step === 3 && (
            <fieldset className="wizard-fields">
              <legend>Bütçe ve konum bilgileri</legend>
              <p className="field-help">Bütçe aralığı, hizmet verenlerin daha isabetli teklif hazırlamasını sağlar.</p>
              <div className="field-grid">
                <label className="field-label">Minimum bütçe<div className="money-input"><span>₺</span><input min="0" onChange={(event) => update("budgetMin", event.target.value)} placeholder="0" required type="number" value={form.budgetMin} /></div></label>
                <label className="field-label">Maksimum bütçe<div className="money-input"><span>₺</span><input min={form.budgetMin || "0"} onChange={(event) => update("budgetMax", event.target.value)} placeholder="0" required type="number" value={form.budgetMax} /></div></label>
              </div>
              <div className="field-grid">
                <label className="field-label">Şehir<select onChange={(event) => { update("cityId", event.target.value); update("districtId", ""); }} required value={form.cityId}><option value="">Şehir seç</option>{cities.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}</select></label>
                <label className="field-label">İlçe<select disabled={!selectedCity} onChange={(event) => update("districtId", event.target.value)} required value={form.districtId}><option value="">İlçe seç</option>{selectedCity?.districts.map((district) => <option key={district.id} value={district.id}>{district.name}</option>)}</select></label>
              </div>
              <div className="location-privacy"><span>⌖</span><p><strong>Açık adresin paylaşılmaz</strong><small>Hizmet verenler talebi açana kadar yalnızca şehir ve ilçe bilgisini görür.</small></p></div>
            </fieldset>
          )}

          {step === 4 && (
            <fieldset className="wizard-fields">
              <legend>Talep özetin</legend>
              <p className="field-help">Yayınlamadan önce bilgilerini kontrol et.</p>
              <div className="summary-category"><i style={{ background: selectedCategory?.color }}>{selectedCategory?.icon}</i><span><small>KATEGORİ</small><strong>{selectedCategory?.name}</strong></span><button onClick={() => setStep(1)} type="button">Değiştir</button></div>
              <div className="summary-block"><span>TALEP</span><h3>{form.title || "Başlık belirtilmedi"}</h3><p>{form.description || "Açıklama belirtilmedi"}</p></div>
              {categoryAttributes.length > 0 && <div className="attribute-summary">{categoryAttributes.map((attribute) => <div key={attribute.key}><span>{attribute.label}</span><strong>{Array.isArray(form.attributes[attribute.key]) ? (form.attributes[attribute.key] as string[]).join(", ") : String(form.attributes[attribute.key] ?? "—")}</strong></div>)}</div>}
              <div className="summary-grid"><div><span>BÜTÇE</span><strong>₺{form.budgetMin || "0"} – ₺{form.budgetMax || "0"}</strong></div><div><span>KONUM</span><strong>{selectedDistrict?.name ?? "—"}, {selectedCity?.name ?? "—"}</strong></div><div><span>YAYIN SÜRESİ</span><strong>30 gün</strong></div></div>
              <label className="consent"><input required type="checkbox" /><span>Talebimin ilgili hizmet verenlere anonim özet olarak gösterilmesini ve <a href="/kullanim-kosullari" target="_blank">kullanım koşullarını</a> kabul ediyorum.</span></label>
            </fieldset>
          )}

          {error && <p className="wizard-error" role="alert">{error}</p>}
          <div className="wizard-card-foot">
            {step > 1 ? <button className="button button-ghost" onClick={back} type="button">← Geri</button> : <span />}
            {step < 4 ? <button className="button button-primary" disabled={!stepIsValid || loadingSchema} onClick={next} type="button">Devam et <span>→</span></button> : <button className="button button-primary" disabled={submitting} type="submit">{submitting ? "Yayınlanıyor…" : "Talebi yayınla ✓"}</button>}
          </div>
        </form>
      </section>
    </main>
  );
}
