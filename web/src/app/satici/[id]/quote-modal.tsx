"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/modal/modal";
import { ApiError, apiRequest, firstApiError } from "@/lib/api";
import styles from "./quote-modal.module.css";

export type QuoteCategory = {
  id: number;
  name: string;
  slug: string;
  icon: string;
  color: string;
  children?: QuoteCategory[];
};

type CategoryAttribute = {
  key: string;
  label: string;
  type: "text" | "textarea" | "select" | "multiselect" | "number" | "range" | "boolean" | "date";
  options: string[] | null;
  unit: string | null;
  help_text: string | null;
  is_required: boolean;
};

type City = { id: number; name: string; districts: { id: number; name: string }[] };

type AttributeValue = string | string[] | boolean | number;

const money = (value: number) =>
  new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 }).format(value);

/**
 * Vitrin icinden dogrudan teklif istegi. Alici magazayi terk etmeden
 * saticinin calistigi kategorilerden birini secip kisa bir brief birakir;
 * talep o saticiya yonlendirilir.
 */
export function QuoteModal({
  open,
  onClose,
  sellerId,
  sellerName,
  categories,
  initialCategorySlug,
}: {
  open: boolean;
  onClose: () => void;
  sellerId: number;
  sellerName: string;
  categories: QuoteCategory[];
  initialCategorySlug?: string;
}) {
  const [branch, setBranch] = useState<QuoteCategory[]>([]);
  const [picked, setPicked] = useState<QuoteCategory | null>(null);
  const [step, setStep] = useState<"category" | "brief">("category");
  const [attributes, setAttributes] = useState<CategoryAttribute[]>([]);
  const [loadingSchema, setLoadingSchema] = useState(false);
  const [cities, setCities] = useState<City[]>([]);
  const [form, setForm] = useState({
    title: "",
    description: "",
    budgetMin: "",
    budgetMax: "",
    cityId: "",
    districtId: "",
    values: {} as Record<string, AttributeValue>,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [needsLogin, setNeedsLogin] = useState(false);
  const [reference, setReference] = useState("");

  useEffect(() => {
    if (!open || cities.length > 0) return;
    apiRequest<{ data: City[] }>("/locations")
      .then(({ data }) => setCities(data))
      .catch(() => undefined);
  }, [open, cities.length]);

  // Hizmet kartindan acildiysa o kategori hazir secili gelir.
  const [resolvedFor, setResolvedFor] = useState<string | undefined>(undefined);
  if (open && initialCategorySlug && resolvedFor !== initialCategorySlug) {
    setResolvedFor(initialCategorySlug);
    const found = findBySlug(categories, initialCategorySlug);
    if (found) {
      setLoadingSchema(true);
      setPicked(found.node);
      setBranch(found.trail);
      setStep("brief");
    }
  }

  useEffect(() => {
    if (!picked) return;
    let active = true;
    apiRequest<{ effective_attributes?: CategoryAttribute[] }>(`/categories/${picked.slug}/attributes`)
      .then((response) => {
        if (active) setAttributes((response.effective_attributes ?? []).filter((item) => item.is_required));
      })
      .catch(() => { if (active) setAttributes([]); })
      .finally(() => { if (active) setLoadingSchema(false); });
    return () => { active = false; };
  }, [picked]);

  const current = branch.length > 0 ? branch[branch.length - 1] : null;
  const shown = current ? (current.children ?? []) : categories;
  const selectedCity = useMemo(
    () => cities.find((item) => String(item.id) === form.cityId),
    [cities, form.cityId],
  );

  const chooseNode = (node: QuoteCategory) => {
    if ((node.children ?? []).length > 0) {
      setBranch((path) => [...path, node]);
      return;
    }
    setLoadingSchema(true);
    setPicked(node);
    setStep("brief");
  };

  const setValue = (key: string, value: AttributeValue) => {
    setForm((current) => ({ ...current, values: { ...current.values, [key]: value } }));
    setError("");
  };

  const missingRequired = attributes.some((attribute) => {
    const value = form.values[attribute.key];
    return Array.isArray(value) ? value.length === 0 : value === undefined || value === "";
  });

  const canSubmit = form.title.trim().length >= 10
    && form.description.trim().length >= 20
    && Boolean(form.budgetMin && form.budgetMax && form.cityId && form.districtId)
    && Number(form.budgetMax) >= Number(form.budgetMin)
    && !missingRequired;

  const submit = async () => {
    if (!picked || !canSubmit) return;
    setBusy(true);
    setError("");
    setNeedsLogin(false);

    try {
      const response = await apiRequest<{ data: { reference: string } }>("/requests", {
        method: "POST",
        body: JSON.stringify({
          category_slug: picked.slug,
          invited_seller_ids: [sellerId],
          title: form.title,
          description: form.description,
          attributes: form.values,
          budget_min: Number(form.budgetMin),
          budget_max: Number(form.budgetMax),
          city_id: Number(form.cityId),
          district_id: Number(form.districtId),
        }),
      });
      setReference(response.data.reference);
    } catch (requestError: unknown) {
      if (requestError instanceof ApiError && requestError.status === 401) {
        setNeedsLogin(true);
      } else {
        setError(firstApiError(requestError));
      }
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setBranch([]); setPicked(null); setStep("category"); setAttributes([]);
    setForm({ title: "", description: "", budgetMin: "", budgetMax: "", cityId: "", districtId: "", values: {} });
    setError(""); setNeedsLogin(false); setReference(""); setResolvedFor(undefined);
  };

  const close = () => { reset(); onClose(); };

  if (reference) {
    return <Modal onClose={close} open={open} size="md" subtitle={`${sellerName} talebini görüntüleyebilecek.`} title="Teklif isteğin iletildi">
      <div className={styles.done}>
        <span className={styles.doneIcon}>✓</span>
        <p>Talebin oluşturuldu ve doğrudan <strong>{sellerName}</strong> mağazasına yönlendirildi.</p>
        <p className={styles.ref}><span>TALEP NUMARASI</span><strong>{reference}</strong></p>
        <div className={styles.doneActions}>
          <Link className={styles.primary} href="/musteri-panel">Taleplerime git →</Link>
          <button className={styles.ghost} onClick={close} type="button">Mağazada kal</button>
        </div>
      </div>
    </Modal>;
  }

  return <Modal
    onClose={close}
    open={open}
    size="lg"
    subtitle={picked ? `${picked.name} · ${sellerName}` : `${sellerName} hangi konuda teklif versin?`}
    title="Bu mağazadan teklif iste"
    footer={step === "brief" ? <>
      <button className={styles.ghost} onClick={() => { setStep("category"); setPicked(null); }} type="button">Kategoriyi değiştir</button>
      <button className={styles.primary} disabled={busy || !canSubmit} onClick={submit} type="button">
        {busy ? "Gönderiliyor…" : "Teklif isteğini gönder"}
      </button>
    </> : undefined}
  >
    {step === "category" ? (
      <div className={styles.picker}>
        <p className={styles.hint}>{sellerName} bu başlıklarda çalışıyor. Birini seçince kısa bir brief isteyeceğiz.</p>

        {branch.length > 0 && (
          <nav className={styles.crumbs}>
            <button onClick={() => setBranch([])} type="button">Tüm başlıklar</button>
            {branch.map((node, index) => (
              <button key={node.slug} onClick={() => setBranch(branch.slice(0, index + 1))} type="button">{node.name}</button>
            ))}
          </nav>
        )}

        {current && (
          <button className={styles.selfPick} onClick={() => { setLoadingSchema(true); setPicked(current); setStep("brief"); }} type="button">
            <span><strong>{current.name} genelinde iste</strong><small>Alt başlık seçmeden devam et</small></span><b>→</b>
          </button>
        )}

        <div className={styles.rows}>
          {shown.map((node, index) => {
            const childCount = (node.children ?? []).length;
            return (
              <button
                className={styles.row}
                key={node.slug}
                onClick={() => chooseNode(node)}
                style={{ "--i": index } as React.CSSProperties}
                type="button"
              >
                <i style={{ background: `${node.color}18`, color: node.color }}>{node.icon}</i>
                <span><strong>{node.name}</strong><small>{childCount > 0 ? `${childCount} alt başlık` : "Bu başlıkta teklif iste"}</small></span>
                <b>{childCount > 0 ? "›" : "→"}</b>
              </button>
            );
          })}
          {shown.length === 0 && <p className={styles.hint}>Bu başlıkta alt kategori yok.</p>}
        </div>
      </div>
    ) : (
      <div className={styles.brief}>
        {needsLogin && (
          <p className={styles.login}>
            Teklif isteği göndermek için giriş yapman gerekiyor.{" "}
            <Link href={`/giris?devam=%2Fsatici%2F${sellerId}`}>Giriş yap →</Link>
          </p>
        )}
        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.grid}>
          <label className={styles.wide}>
            <span>Talep başlığı</span>
            <input maxLength={120} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Örn. 2+1 daire için komple boya" value={form.title} />
          </label>
          <label className={styles.wide}>
            <span>Ne yaptırmak istiyorsun?</span>
            <textarea maxLength={3000} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Kapsamı ve beklentilerini kısaca anlat." rows={3} value={form.description} />
          </label>

          <label><span>Bütçe alt sınırı (₺)</span><input inputMode="numeric" onChange={(event) => setForm({ ...form, budgetMin: event.target.value })} placeholder="0" value={form.budgetMin} /></label>
          <label><span>Bütçe üst sınırı (₺)</span><input inputMode="numeric" onChange={(event) => setForm({ ...form, budgetMax: event.target.value })} placeholder={money(50000)} value={form.budgetMax} /></label>

          <label>
            <span>Şehir</span>
            <select onChange={(event) => setForm({ ...form, cityId: event.target.value, districtId: "" })} value={form.cityId}>
              <option value="">Seç</option>
              {cities.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}
            </select>
          </label>
          <label>
            <span>İlçe</span>
            <select disabled={!selectedCity} onChange={(event) => setForm({ ...form, districtId: event.target.value })} value={form.districtId}>
              <option value="">Seç</option>
              {(selectedCity?.districts ?? []).map((district) => <option key={district.id} value={district.id}>{district.name}</option>)}
            </select>
          </label>
        </div>

        {loadingSchema ? <p className={styles.hint}>Kategori soruları hazırlanıyor…</p> : attributes.length > 0 && (
          <div className={styles.questions}>
            <p className={styles.qHead}>{picked?.name} için gerekli bilgiler</p>
            {attributes.map((attribute) => {
              const value = form.values[attribute.key];
              const options = attribute.options ?? [];

              if ((attribute.type === "select" && options.length > 0 && options.length <= 8) || attribute.type === "boolean") {
                const list = attribute.type === "boolean" ? ["Evet", "Hayır"] : options;
                return (
                  <fieldset className={styles.chips} key={attribute.key}>
                    <legend>{attribute.label}{attribute.unit ? ` (${attribute.unit})` : ""}</legend>
                    <div>
                      {list.map((option) => {
                        const on = attribute.type === "boolean"
                          ? value === (option === "Evet")
                          : value === option;
                        return (
                          <button
                            className={on ? styles.chipOn : ""}
                            key={option}
                            onClick={() => setValue(attribute.key, attribute.type === "boolean" ? option === "Evet" : option)}
                            type="button"
                          >{option}</button>
                        );
                      })}
                    </div>
                  </fieldset>
                );
              }

              if (attribute.type === "multiselect") {
                const values = Array.isArray(value) ? value : [];
                return (
                  <fieldset className={styles.chips} key={attribute.key}>
                    <legend>{attribute.label}</legend>
                    <div>
                      {options.slice(0, 10).map((option) => (
                        <button
                          className={values.includes(option) ? styles.chipOn : ""}
                          key={option}
                          onClick={() => setValue(attribute.key, values.includes(option) ? values.filter((item) => item !== option) : [...values, option])}
                          type="button"
                        >{option}</button>
                      ))}
                    </div>
                  </fieldset>
                );
              }

              // Cok secenekli select cip olarak sigmaz; acilir menuye duser.
              // Serbest metne dusurulmesi API'deki Rule::in dogrulamasini kirardi.
              if (attribute.type === "select") {
                return (
                  <label className={styles.qField} key={attribute.key}>
                    <span>{attribute.label}{attribute.unit ? ` (${attribute.unit})` : ""}</span>
                    <select onChange={(event) => setValue(attribute.key, event.target.value)} value={String(value ?? "")}>
                      <option value="">Seç</option>
                      {options.map((option) => <option key={option}>{option}</option>)}
                    </select>
                  </label>
                );
              }

              return (
                <label className={styles.qField} key={attribute.key}>
                  <span>{attribute.label}{attribute.unit ? ` (${attribute.unit})` : ""}</span>
                  <input
                    onChange={(event) => setValue(attribute.key, event.target.value)}
                    placeholder={attribute.help_text ?? ""}
                    type={attribute.type === "number" || attribute.type === "range" ? "number" : attribute.type === "date" ? "date" : "text"}
                    value={String(value ?? "")}
                  />
                </label>
              );
            })}
          </div>
        )}

        <p className={styles.note}>Talebin {sellerName} mağazasına iletilir; uygun diğer hizmet verenler de görebilir.</p>
      </div>
    )}
  </Modal>;
}

/** Slug'a gore dugumu ve ona giden yolu bulur. */
function findBySlug(
  nodes: QuoteCategory[],
  slug: string,
  trail: QuoteCategory[] = [],
): { node: QuoteCategory; trail: QuoteCategory[] } | null {
  for (const node of nodes) {
    if (node.slug === slug) return { node, trail };
    const deeper = findBySlug(node.children ?? [], slug, [...trail, node]);
    if (deeper) return deeper;
  }
  return null;
}
