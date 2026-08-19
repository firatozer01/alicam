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
};

type CategoryAttribute = {
  id: number;
  key: string;
  label: string;
  type: "text" | "select" | "multiselect" | "number" | "range" | "boolean" | "date";
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

const fallbackCategories: Category[] = [
  { id: 1, slug: "hizmet", icon: "✦", name: "Hizmet", color: "#06B6D4", schema_version: 1 },
  { id: 2, slug: "nakliye", icon: "↗", name: "Nakliye", color: "#16A34A", schema_version: 1 },
  { id: 3, slug: "tadilat", icon: "⌂", name: "Tadilat", color: "#7C3AED", schema_version: 1 },
];

const initialForm: FormData = {
  category: "",
  title: "",
  description: "",
  attributes: {},
  budgetMin: "",
  budgetMax: "",
  cityId: "",
  districtId: "",
};

const DRAFT_KEY = "alicam-request-draft";

export function RequestWizard({ initialCategory }: { initialCategory?: string }) {
  const router = useRouter();
  const normalizedCategory = fallbackCategories.some((item) => item.slug === initialCategory)
    ? initialCategory ?? ""
    : "";
  const [step, setStep] = useState(normalizedCategory ? 2 : 1);
  const [form, setForm] = useState<FormData>({ ...initialForm, category: normalizedCategory });
  const [categories, setCategories] = useState<Category[]>(fallbackCategories);
  const [categoryAttributes, setCategoryAttributes] = useState<CategoryAttribute[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [loadingSchema, setLoadingSchema] = useState(Boolean(normalizedCategory));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successReference, setSuccessReference] = useState("");

  useEffect(() => {
    Promise.all([
      apiRequest<{ data: Category[] }>("/categories"),
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
    apiRequest<{ data: Category & { attributes: CategoryAttribute[] } }>(`/categories/${form.category}/attributes`)
      .then(({ data }) => {
        if (active) setCategoryAttributes(data.attributes);
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
    () => categories.find((item) => item.slug === form.category),
    [categories, form.category],
  );
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

  const renderAttribute = (attribute: CategoryAttribute) => {
    const value = form.attributes[attribute.key];
    const suffix = attribute.unit ? ` (${attribute.unit})` : "";

    if (attribute.type === "select") {
      return (
        <label className="field-label" key={attribute.key}>
          {attribute.label}{suffix}
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
        <fieldset className="attribute-options" key={attribute.key}>
          <legend>{attribute.label}{suffix}</legend>
          <div>
            {(attribute.options ?? []).map((option) => (
              <label className={values.includes(option) ? "selected" : ""} key={option}>
                <input
                  checked={values.includes(option)}
                  onChange={(event) => updateAttribute(attribute.key, event.target.checked ? [...values, option] : values.filter((item) => item !== option))}
                  type="checkbox"
                />
                <span>{option}</span>
              </label>
            ))}
          </div>
        </fieldset>
      );
    }

    if (attribute.type === "boolean") {
      return (
        <label className="field-label" key={attribute.key}>
          {attribute.label}
          <select onChange={(event) => updateAttribute(attribute.key, event.target.value === "true")} required={attribute.is_required} value={value === undefined ? "" : String(value)}>
            <option value="">Seç</option><option value="true">Evet</option><option value="false">Hayır</option>
          </select>
        </label>
      );
    }

    return (
      <label className="field-label" key={attribute.key}>
        {attribute.label}{suffix}
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
              <div className="wizard-categories">
                {categories.map((category) => (
                  <label className={form.category === category.slug ? "selected" : ""} key={category.slug}>
                    <input checked={form.category === category.slug} name="category" onChange={() => { setLoadingSchema(true); update("category", category.slug); update("attributes", {}); }} type="radio" />
                    <i style={{ background: category.color }}>{category.icon}</i><span><strong>{category.name}</strong><small>{categoryDescriptions[category.slug] ?? "Yeni talebin için teklif al"}</small></span><b>✓</b>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          {step === 2 && (
            <fieldset className="wizard-fields">
              <legend>{selectedCategory?.name ?? "Talep"} detaylarını paylaş</legend>
              <p className="field-help">Kişisel iletişim bilgilerini açıklama alanına yazma.</p>
              <label className="field-label">Talep başlığı<input maxLength={120} minLength={10} onChange={(event) => update("title", event.target.value)} placeholder="Örn. 2+1 daire için boya ustası arıyorum" required type="text" value={form.title} /></label>
              <label className="field-label">Açıklama<textarea maxLength={3000} minLength={20} onChange={(event) => update("description", event.target.value)} placeholder="İşin kapsamını, beklentilerini ve varsa önemli detayları anlat." required rows={5} value={form.description} /></label>
              {loadingSchema ? <p className="schema-loading">Kategori soruları hazırlanıyor…</p> : categoryAttributes.map(renderAttribute)}
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
