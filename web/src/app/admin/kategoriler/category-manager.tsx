"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, apiRequest, firstApiError } from "@/lib/api";
import styles from "./category-manager.module.css";

type AdminUser = { name: string; email: string; roles: string[] };
type CategoryAttribute = {
  id: number; key: string; label: string;
  type: "text" | "select" | "multiselect" | "number" | "range" | "boolean" | "date";
  options: string[] | null; unit: string | null; help_text: string | null;
  is_required: boolean; is_filterable: boolean; show_in_summary: boolean; is_private: boolean; sort_order: number;
};
type AdminCategory = {
  id: number; name: string; slug: string; icon: string | null; color: string; schema_version: number;
  is_active: boolean; sort_order: number; attributes: CategoryAttribute[];
  credit_cost: { unlock_cost: number } | null;
  attributes_count: number; buyer_requests_count: number; sellers_count: number; seller_services_count: number;
};
type CategoryForm = { id: number; name: string; slug: string; icon: string; color: string; unlock_cost: number; is_active: boolean; sort_order: number };
type AttributeForm = { id: number; key: string; label: string; type: CategoryAttribute["type"]; options: string; unit: string; help_text: string; is_required: boolean; is_filterable: boolean; show_in_summary: boolean; is_private: boolean; sort_order: number };

const blankCategory: CategoryForm = { id: 0, name: "", slug: "", icon: "✦", color: "#7C3AED", unlock_cost: 1, is_active: true, sort_order: 1 };
const blankAttribute: AttributeForm = { id: 0, key: "", label: "", type: "text", options: "", unit: "", help_text: "", is_required: false, is_filterable: false, show_in_summary: true, is_private: false, sort_order: 1 };
const typeLabels: Record<CategoryAttribute["type"], string> = { text: "Kısa metin", select: "Tek seçim", multiselect: "Çoklu seçim", number: "Sayı", range: "Aralık", boolean: "Evet / Hayır", date: "Tarih" };

function slugify(value: string) {
  return value.toLocaleLowerCase("tr-TR").replaceAll("ı", "i").replaceAll("ş", "s").replaceAll("ğ", "g").replaceAll("ü", "u").replaceAll("ö", "o").replaceAll("ç", "c").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function keyify(value: string) {
  return slugify(value).replaceAll("-", "_");
}

export function CategoryManager() {
  const router = useRouter();
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [categoryForm, setCategoryForm] = useState<CategoryForm>(blankCategory);
  const [attributeForm, setAttributeForm] = useState<AttributeForm>(blankAttribute);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [showAttributeForm, setShowAttributeForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const selected = useMemo(() => categories.find((item) => item.id === selectedId) ?? categories[0] ?? null, [categories, selectedId]);

  const loadCategories = useCallback(async (preferredId?: number) => {
    const response = await apiRequest<{ data: AdminCategory[] }>("/admin/categories");
    setCategories(response.data);
    setSelectedId((current) => preferredId ?? current ?? response.data[0]?.id ?? null);
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([apiRequest<{ data: AdminUser }>("/me"), apiRequest<{ data: AdminCategory[] }>("/admin/categories")])
      .then(([userResponse, categoryResponse]) => {
        if (!active) return;
        setAdmin(userResponse.data);
        setCategories(categoryResponse.data);
        setSelectedId(categoryResponse.data[0]?.id ?? null);
      })
      .catch((requestError: unknown) => {
        if (!active) return;
        if (requestError instanceof ApiError && requestError.status === 401) return router.replace("/giris?devam=%2Fadmin%2Fkategoriler");
        if (requestError instanceof ApiError && requestError.status === 403) return router.replace("/?erisim=reddedildi");
        setError(firstApiError(requestError));
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [router]);

  const startCategory = (category?: AdminCategory) => {
    setCategoryForm(category ? { id: category.id, name: category.name, slug: category.slug, icon: category.icon ?? "", color: category.color, unlock_cost: category.credit_cost?.unlock_cost ?? 0, is_active: category.is_active, sort_order: category.sort_order } : { ...blankCategory, sort_order: categories.length + 1 });
    setShowCategoryForm(true); setShowAttributeForm(false); setError(""); setNotice("");
  };

  const saveCategory = async () => {
    setBusy(true); setError(""); setNotice("");
    try {
      const updating = categoryForm.id > 0;
      const response = await apiRequest<{ message: string; data: AdminCategory }>(updating ? `/admin/categories/${categoryForm.id}` : "/admin/categories", { method: updating ? "PUT" : "POST", body: JSON.stringify(categoryForm) });
      await loadCategories(response.data.id); setShowCategoryForm(false); setNotice(response.message);
    } catch (requestError: unknown) { setError(firstApiError(requestError)); }
    finally { setBusy(false); }
  };

  const toggleCategory = async (category: AdminCategory) => {
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await apiRequest<{ message: string }>(`/admin/categories/${category.id}`, { method: "PUT", body: JSON.stringify({ name: category.name, slug: category.slug, icon: category.icon, color: category.color, unlock_cost: category.credit_cost?.unlock_cost ?? 0, is_active: !category.is_active, sort_order: category.sort_order }) });
      await loadCategories(category.id); setNotice(response.message);
    } catch (requestError: unknown) { setError(firstApiError(requestError)); }
    finally { setBusy(false); }
  };

  const startAttribute = (attribute?: CategoryAttribute) => {
    setAttributeForm(attribute ? { id: attribute.id, key: attribute.key, label: attribute.label, type: attribute.type, options: attribute.options?.join(", ") ?? "", unit: attribute.unit ?? "", help_text: attribute.help_text ?? "", is_required: attribute.is_required, is_filterable: attribute.is_filterable, show_in_summary: attribute.show_in_summary, is_private: attribute.is_private, sort_order: attribute.sort_order } : { ...blankAttribute, sort_order: (selected?.attributes.length ?? 0) + 1 });
    setShowAttributeForm(true); setShowCategoryForm(false); setError(""); setNotice("");
  };

  const saveAttribute = async () => {
    if (!selected) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const updating = attributeForm.id > 0;
      const options = attributeForm.options.split(",").map((item) => item.trim()).filter(Boolean);
      const body = { ...attributeForm, options: ["select", "multiselect"].includes(attributeForm.type) ? options : null, unit: attributeForm.unit || null, help_text: attributeForm.help_text || null };
      const response = await apiRequest<{ message: string }>(updating ? `/admin/category-attributes/${attributeForm.id}` : `/admin/categories/${selected.id}/attributes`, { method: updating ? "PUT" : "POST", body: JSON.stringify(body) });
      await loadCategories(selected.id); setShowAttributeForm(false); setNotice(response.message);
    } catch (requestError: unknown) { setError(firstApiError(requestError)); }
    finally { setBusy(false); }
  };

  const removeAttribute = async (attribute: CategoryAttribute) => {
    if (!selected || !window.confirm(`“${attribute.label}” alanı kaldırılsın mı? Eski talepler etkilenmez.`)) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await apiRequest<{ message: string }>(`/admin/category-attributes/${attribute.id}`, { method: "DELETE" });
      await loadCategories(selected.id); setNotice(response.message);
    } catch (requestError: unknown) { setError(firstApiError(requestError)); }
    finally { setBusy(false); }
  };

  return <main className={`admin-page ${styles.page}`}>
    <aside className="admin-sidebar"><Link className="brand admin-brand" href="/">alıcam<span>.net</span></Link><div className="admin-product"><span>YÖNETİM MERKEZİ</span><strong>Operasyon</strong></div><nav><Link href="/admin"><i>◇</i> Genel bakış</Link><Link className="active" href="/admin/kategoriler"><i>▦</i> Kategoriler <b>{categories.length || ""}</b></Link><Link href="/admin/satici-onaylari"><i>✓</i> Satıcı onayları</Link></nav><div className="admin-account"><span>{admin?.name.slice(0, 2).toLocaleUpperCase("tr-TR") ?? "AD"}</span><p><strong>{admin?.name ?? "Yönetici"}</strong><small>{admin?.email ?? "Oturum doğrulanıyor"}</small></p></div></aside>
    <section className={`admin-content ${styles.content}`}>
      <header className={styles.header}><div><span>KODSÜZ FORM ALTYAPISI</span><h1>Kategori yönetimi</h1><p>Kategorileri, talep formu alanlarını ve teklif vermenin kontör bedelini buradan yönet.</p></div><button className={styles.primary} onClick={() => startCategory()}>＋ Yeni kategori</button></header>
      {notice && <p className={styles.notice}>✓ {notice}</p>}{error && <p className={styles.error}>{error}</p>}
      {loading ? <div className={styles.empty}><i className="admin-spinner" /><h2>Kategoriler hazırlanıyor…</h2></div> : <>
        <section className={styles.summary}><article><span>TOPLAM KATEGORİ</span><strong>{categories.length}</strong><small>{categories.filter((item) => item.is_active).length} yayında</small></article><article><span>FORM ALANI</span><strong>{categories.reduce((sum, item) => sum + item.attributes_count, 0)}</strong><small>Dinamik soru</small></article><article><span>BAĞLI TALEP</span><strong>{categories.reduce((sum, item) => sum + item.buyer_requests_count, 0)}</strong><small>Şema kopyaları korunur</small></article></section>
        {showCategoryForm && <section className={styles.editor}><header><div><span>KATEGORİ AYARLARI</span><h2>{categoryForm.id ? "Kategoriyi düzenle" : "Yeni kategori oluştur"}</h2></div><button onClick={() => setShowCategoryForm(false)}>×</button></header><div className={styles.categoryFields}><label>Ad<input value={categoryForm.name} onChange={(event) => setCategoryForm((current) => ({ ...current, name: event.target.value, slug: current.id ? current.slug : slugify(event.target.value) }))} placeholder="Örn. Eğitim" /></label><label>URL anahtarı<input value={categoryForm.slug} onChange={(event) => setCategoryForm({ ...categoryForm, slug: slugify(event.target.value) })} placeholder="egitim" /></label><label>İkon<input value={categoryForm.icon} onChange={(event) => setCategoryForm({ ...categoryForm, icon: event.target.value })} placeholder="✦" /></label><label>Renk<div className={styles.colorInput}><input type="color" value={categoryForm.color} onChange={(event) => setCategoryForm({ ...categoryForm, color: event.target.value.toUpperCase() })} /><input value={categoryForm.color} onChange={(event) => setCategoryForm({ ...categoryForm, color: event.target.value })} /></div></label><label>Teklif kontör bedeli<input type="number" min="0" value={categoryForm.unlock_cost} onChange={(event) => setCategoryForm({ ...categoryForm, unlock_cost: Number(event.target.value) })} /></label><label>Sıra<input type="number" min="0" value={categoryForm.sort_order} onChange={(event) => setCategoryForm({ ...categoryForm, sort_order: Number(event.target.value) })} /></label><label className={styles.check}><input type="checkbox" checked={categoryForm.is_active} onChange={(event) => setCategoryForm({ ...categoryForm, is_active: event.target.checked })} /> Kategori yayında</label></div><footer><button onClick={() => setShowCategoryForm(false)}>Vazgeç</button><button disabled={busy} onClick={saveCategory}>{busy ? "Kaydediliyor…" : "Kategoriyi kaydet"}</button></footer></section>}
        <div className={styles.split}>
          <aside className={styles.categoryList}><header><span>KATEGORİLER</span><b>{categories.length}</b></header>{categories.map((category) => <button className={`${selected?.id === category.id ? styles.selected : ""} ${!category.is_active ? styles.inactive : ""}`} key={category.id} onClick={() => { setSelectedId(category.id); setShowCategoryForm(false); setShowAttributeForm(false); }}><i style={{ color: category.color, background: `${category.color}14` }}>{category.icon || "✦"}</i><span><strong>{category.name}</strong><small>{category.attributes_count} alan · {category.buyer_requests_count} talep</small></span><b>›</b></button>)}</aside>
          {selected ? <section className={styles.panel}>
            <header className={styles.panelHead}><div><span>KATEGORİ ŞEMASI · v{selected.schema_version}</span><h2>{selected.icon} {selected.name}</h2><p><b>{selected.credit_cost?.unlock_cost ?? 0} kontör</b> ilk teklif bedeli · <code>{selected.slug}</code></p></div><aside><button onClick={() => startCategory(selected)}>Ayarları düzenle</button><button className={selected.is_active ? styles.pause : styles.publish} disabled={busy} onClick={() => toggleCategory(selected)}>{selected.is_active ? "Yayından al" : "Yayınla"}</button></aside></header>
            <div className={styles.usage}><span><b>{selected.buyer_requests_count}</b> talep</span><span><b>{selected.sellers_count}</b> satıcı</span><span><b>{selected.seller_services_count}</b> hizmet</span><button onClick={() => startAttribute()}>＋ Yeni form alanı</button></div>
            {showAttributeForm && <section className={styles.attributeEditor}><header><span>{attributeForm.id ? "FORM ALANINI DÜZENLE" : "YENİ FORM ALANI"}</span><button onClick={() => setShowAttributeForm(false)}>×</button></header><div><label>Alan anahtarı<input value={attributeForm.key} onChange={(event) => setAttributeForm({ ...attributeForm, key: keyify(event.target.value) })} placeholder="bina_yasi" /></label><label>Etiket<input value={attributeForm.label} onChange={(event) => setAttributeForm((current) => ({ ...current, label: event.target.value, key: current.id || current.key ? current.key : keyify(event.target.value) }))} placeholder="Bina yaşı" /></label><label>Alan tipi<select value={attributeForm.type} onChange={(event) => setAttributeForm({ ...attributeForm, type: event.target.value as CategoryAttribute["type"] })}>{Object.entries(typeLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label>Sıra<input type="number" min="0" value={attributeForm.sort_order} onChange={(event) => setAttributeForm({ ...attributeForm, sort_order: Number(event.target.value) })} /></label>{["select", "multiselect"].includes(attributeForm.type) && <label className={styles.wide}>Seçenekler<input value={attributeForm.options} onChange={(event) => setAttributeForm({ ...attributeForm, options: event.target.value })} placeholder="Seçenek 1, Seçenek 2, Seçenek 3" /><small>Seçenekleri virgülle ayır.</small></label>}<label>Birim<input value={attributeForm.unit} onChange={(event) => setAttributeForm({ ...attributeForm, unit: event.target.value })} placeholder="m², adet, gün…" /></label><label className={styles.wide}>Yardım metni<input value={attributeForm.help_text} onChange={(event) => setAttributeForm({ ...attributeForm, help_text: event.target.value })} placeholder="Kullanıcıya gösterilecek kısa açıklama" /></label></div><fieldset><label><input type="checkbox" checked={attributeForm.is_required} onChange={(event) => setAttributeForm({ ...attributeForm, is_required: event.target.checked })} /> Zorunlu</label><label><input type="checkbox" checked={attributeForm.is_filterable} onChange={(event) => setAttributeForm({ ...attributeForm, is_filterable: event.target.checked })} /> Filtrelenebilir</label><label><input type="checkbox" checked={attributeForm.show_in_summary} onChange={(event) => setAttributeForm({ ...attributeForm, show_in_summary: event.target.checked })} /> Özette göster</label><label><input type="checkbox" checked={attributeForm.is_private} onChange={(event) => setAttributeForm({ ...attributeForm, is_private: event.target.checked })} /> Satın alınana dek gizli</label></fieldset><footer><button onClick={() => setShowAttributeForm(false)}>Vazgeç</button><button disabled={busy} onClick={saveAttribute}>{busy ? "Kaydediliyor…" : "Alanı kaydet"}</button></footer></section>}
            <div className={styles.tableWrap}><table><thead><tr><th>Alan anahtarı</th><th>Etiket</th><th>Tip</th><th>Kullanım</th><th /></tr></thead><tbody>{selected.attributes.map((attribute) => <tr key={attribute.id}><td><code>{attribute.key}</code></td><td><strong>{attribute.label}</strong>{attribute.help_text && <small>{attribute.help_text}</small>}</td><td><span className={styles.type}>{typeLabels[attribute.type]}</span></td><td><div className={styles.tags}>{attribute.is_required && <b>Zorunlu</b>}{attribute.is_filterable && <b>Filtre</b>}{attribute.is_private && <b className={styles.private}>Gizli</b>}{!attribute.is_required && !attribute.is_filterable && !attribute.is_private && <em>Opsiyonel</em>}</div></td><td><button onClick={() => startAttribute(attribute)}>Düzenle</button><button disabled={busy} onClick={() => removeAttribute(attribute)}>Kaldır</button></td></tr>)}</tbody></table>{selected.attributes.length === 0 && <div className={styles.noAttributes}><span>◇</span><h3>Henüz form alanı yok.</h3><button onClick={() => startAttribute()}>İlk alanı ekle</button></div>}</div>
          </section> : <div className={styles.empty}><h2>Henüz kategori bulunmuyor.</h2><button className={styles.primary} onClick={() => startCategory()}>İlk kategoriyi oluştur</button></div>}
        </div>
      </>}
    </section>
  </main>;
}
