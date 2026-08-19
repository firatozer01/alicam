"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, apiRequest, firstApiError } from "@/lib/api";

type Category = {
  id: number;
  name: string;
  slug: string;
  icon: string;
  color: string;
};

type City = {
  id: number;
  name: string;
  districts: { id: number; name: string }[];
};

type SellerLocation = {
  city_id: number;
  city_name?: string;
  district_id: number;
  district_name?: string;
};

type SellerWorkspace = {
  user: {
    id: number;
    name: string;
    email: string;
    phone: string;
    verification: { email: boolean; phone: boolean; complete: boolean };
  };
  profile: null | {
    profile_type: "individual" | "company";
    company_name: string | null;
    tax_no: string | null;
    description: string;
    approval_status: "draft" | "pending" | "approved" | "rejected" | "suspended";
    rejection_reason: string | null;
    submitted_at: string | null;
    reviewed_at: string | null;
  };
  categories: Category[];
  locations: SellerLocation[];
  completion: {
    profile: boolean;
    categories: boolean;
    locations: boolean;
    verification: boolean;
    can_submit: boolean;
  };
};

const steps = [
  { number: "01", title: "Profil", label: "Seni tanıyalım" },
  { number: "02", title: "Kategoriler", label: "Uzmanlığını seç" },
  { number: "03", title: "Bölgeler", label: "Nerede çalışırsın?" },
  { number: "04", title: "Kontrol", label: "Başvurunu gönder" },
];

const categoryDescriptions: Record<string, string> = {
  hizmet: "Bakım, danışmanlık ve profesyonel hizmetler",
  nakliye: "Ev, ofis ve parça eşya taşıma",
  tadilat: "Boya, dekorasyon ve yenileme işleri",
};

function statusCopy(status: NonNullable<SellerWorkspace["profile"]>["approval_status"]) {
  if (status === "approved") {
    return {
      icon: "✓",
      eyebrow: "BAŞVURU ONAYLANDI",
      title: "Hizmet veren profilin hazır.",
      text: "Profilin yönetici incelemesini geçti. Eşleşme ve teklif ekranı sonraki ürün paketinde hesabına açılacak.",
    };
  }

  if (status === "suspended") {
    return {
      icon: "!",
      eyebrow: "PROFİL ASKIYA ALINDI",
      title: "Profilin şu anda kullanıma kapalı.",
      text: "Ayrıntılı inceleme için destek ekibiyle iletişime geçebilirsin.",
    };
  }

  return {
    icon: "⌛",
    eyebrow: "İNCELEMEDE",
    title: "Başvurun bize ulaştı.",
    text: "Bilgilerini manuel olarak inceliyoruz. Sonuçlandığında hesabındaki durum burada güncellenecek.",
  };
}

export function SellerWizard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [workspace, setWorkspace] = useState<SellerWorkspace | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [step, setStep] = useState(1);
  const [profileType, setProfileType] = useState<"individual" | "company">("individual");
  const [companyName, setCompanyName] = useState("");
  const [taxNo, setTaxNo] = useState("");
  const [description, setDescription] = useState("");
  const [categoryIds, setCategoryIds] = useState<number[]>([]);
  const [locations, setLocations] = useState<SellerLocation[]>([]);
  const [activeCityId, setActiveCityId] = useState<number | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    Promise.all([
      apiRequest<{ data: SellerWorkspace }>("/seller/profile"),
      apiRequest<{ data: Category[] }>("/categories"),
      apiRequest<{ data: City[] }>("/locations"),
    ])
      .then(([workspaceResponse, categoryResponse, locationResponse]) => {
        if (!active) return;

        const current = workspaceResponse.data;
        setWorkspace(current);
        setCategories(categoryResponse.data);
        setCities(locationResponse.data);
        setActiveCityId(locationResponse.data[0]?.id ?? null);
        setProfileType(current.profile?.profile_type ?? "individual");
        setCompanyName(current.profile?.company_name ?? "");
        setTaxNo(current.profile?.tax_no ?? "");
        setDescription(current.profile?.description ?? "");
        setCategoryIds(current.categories.map((category) => category.id));
        setLocations(current.locations);
      })
      .catch((requestError: unknown) => {
        if (requestError instanceof ApiError && requestError.status === 401) {
          router.replace("/giris?devam=%2Fsatici-ol");
          return;
        }

        setError("Başvuru ekranı yüklenemedi. Lütfen sayfayı yenileyerek tekrar dene.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [router]);

  const activeCity = useMemo(
    () => cities.find((city) => city.id === activeCityId) ?? null,
    [activeCityId, cities],
  );

  const selectedCategories = useMemo(
    () => categories.filter((category) => categoryIds.includes(category.id)),
    [categories, categoryIds],
  );

  const selectedLocationGroups = useMemo(
    () => cities
      .map((city) => ({
        city,
        districts: city.districts.filter((district) =>
          locations.some((location) => location.district_id === district.id),
        ),
      }))
      .filter((group) => group.districts.length > 0),
    [cities, locations],
  );

  const resetError = () => setError("");

  const toggleCategory = (categoryId: number) => {
    setCategoryIds((current) => current.includes(categoryId)
      ? current.filter((id) => id !== categoryId)
      : [...current, categoryId]);
    resetError();
  };

  const toggleDistrict = (cityId: number, districtId: number) => {
    setLocations((current) => current.some((location) => location.district_id === districtId)
      ? current.filter((location) => location.district_id !== districtId)
      : [...current, { city_id: cityId, district_id: districtId }]);
    resetError();
  };

  const selectAllActiveDistricts = () => {
    if (!activeCity) return;

    setLocations((current) => {
      const outsideCity = current.filter((location) => location.city_id !== activeCity.id);
      const activeLocations = activeCity.districts.map((district) => ({
        city_id: activeCity.id,
        district_id: district.id,
      }));
      return [...outsideCity, ...activeLocations];
    });
    resetError();
  };

  const clearActiveCity = () => {
    if (!activeCity) return;
    setLocations((current) => current.filter((location) => location.city_id !== activeCity.id));
    resetError();
  };

  const validateStep = () => {
    if (step === 1) {
      if (description.trim().length < 50) {
        setError("Kendini ve hizmet yaklaşımını en az 50 karakterle anlatmalısın.");
        return false;
      }
      if (profileType === "company" && (!companyName.trim() || !/^\d{10,11}$/.test(taxNo))) {
        setError("Firma unvanını ve 10 veya 11 haneli vergi/T.C. kimlik numaranı kontrol et.");
        return false;
      }
    }

    if (step === 2 && categoryIds.length === 0) {
      setError("En az bir hizmet kategorisi seçmelisin.");
      return false;
    }

    if (step === 3 && locations.length === 0) {
      setError("En az bir hizmet bölgesi seçmelisin.");
      return false;
    }

    return true;
  };

  const nextStep = () => {
    if (!validateStep()) return;
    setStep((current) => Math.min(4, current + 1));
    resetError();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!workspace || !validateStep()) return;

    if (!workspace.user.verification.complete) {
      router.push("/giris?dogrulama=1&devam=%2Fsatici-ol");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      await apiRequest("/seller/profile", {
        method: "PUT",
        body: JSON.stringify({
          profile_type: profileType,
          company_name: profileType === "company" ? companyName.trim() : null,
          tax_no: profileType === "company" ? taxNo : null,
          description: description.trim(),
        }),
      });
      await apiRequest("/seller/categories", {
        method: "PUT",
        body: JSON.stringify({ category_ids: categoryIds }),
      });
      await apiRequest("/seller/locations", {
        method: "PUT",
        body: JSON.stringify({ locations: locations.map(({ city_id, district_id }) => ({ city_id, district_id })) }),
      });
      const response = await apiRequest<{ data: SellerWorkspace }>("/seller/submit", { method: "POST" });
      setWorkspace(response.data);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (requestError: unknown) {
      if (requestError instanceof ApiError && requestError.status === 409) {
        router.push("/giris?dogrulama=1&devam=%2Fsatici-ol");
        return;
      }
      setError(firstApiError(requestError));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="seller-page seller-loading">
        <Link className="brand" href="/">alıcam<span>.net</span></Link>
        <div className="seller-loader"><i /><p>Başvuru alanın hazırlanıyor…</p></div>
      </main>
    );
  }

  const profileStatus = workspace?.profile?.approval_status;
  if (profileStatus && ["pending", "approved", "suspended"].includes(profileStatus)) {
    const copy = statusCopy(profileStatus);

    return (
      <main className={`seller-page seller-status-page status-${profileStatus}`}>
        <nav className="seller-nav shell">
          <Link className="brand" href="/">alıcam<span>.net</span></Link>
          <Link className="seller-home-link" href="/">Ana sayfaya dön <span>↗</span></Link>
        </nav>
        <section className="seller-status-card">
          <div className="seller-status-icon">{copy.icon}</div>
          <span className="seller-kicker">{copy.eyebrow}</span>
          <h1>{copy.title}</h1>
          <p>{copy.text}</p>
          <div className="seller-status-meta">
            <div><span>HESAP</span><strong>{workspace?.user.name}</strong></div>
            <div><span>KATEGORİ</span><strong>{workspace?.categories.length ?? 0}</strong></div>
            <div><span>HİZMET BÖLGESİ</span><strong>{workspace?.locations.length ?? 0}</strong></div>
          </div>
          <Link className="button button-primary button-large" href={profileStatus === "approved" ? "/satici-paneli" : "/"}>{profileStatus === "approved" ? "Gelen taleplere git" : "Ana sayfaya dön"} <span>→</span></Link>
        </section>
      </main>
    );
  }

  return (
    <main className="seller-page">
      <div className="seller-glow seller-glow-one" />
      <div className="seller-glow seller-glow-two" />
      <nav className="seller-nav shell">
        <Link className="brand" href="/">alıcam<span>.net</span></Link>
        <span className="seller-nav-note"><b>HİZMET VEREN BAŞVURUSU</b> Ücretsiz katılım</span>
        <Link className="seller-home-link" href="/">Çıkış <span>×</span></Link>
      </nav>

      <div className="seller-progress"><span style={{ width: `${step * 25}%` }} /></div>

      <div className="seller-shell shell">
        <aside className="seller-aside">
          <span className="seller-kicker">UZMANLIĞINI BÜYÜT</span>
          <h1>Yeni müşteriler<br /><em>seni bulsun.</em></h1>
          <p>Profilini tamamla, çalışma alanlarını belirle ve doğrulanmış taleplerle buluş.</p>
          <ol>
            {steps.map((item, index) => (
              <li className={step === index + 1 ? "active" : step > index + 1 ? "complete" : ""} key={item.number}>
                <span>{step > index + 1 ? "✓" : item.number}</span>
                <div><small>{item.title}</small><strong>{item.label}</strong></div>
              </li>
            ))}
          </ol>
          <div className="seller-trust-note">
            <b>⌁</b>
            <p><strong>Kontrol sende</strong><span>Hizmet bölgelerini ve kategorilerini dilediğin zaman güncelleyebilirsin.</span></p>
          </div>
        </aside>

        <form className="seller-card" onSubmit={submit}>
          <div className="seller-card-head">
            <span>ADIM {step} / 4</span>
            <strong>{steps[step - 1].title}</strong>
          </div>

          {workspace?.profile?.approval_status === "rejected" && (
            <div className="seller-rejection">
              <b>Başvurunu güncellemen gerekiyor.</b>
              <span>{workspace.profile.rejection_reason}</span>
            </div>
          )}

          <fieldset className="seller-fields">
            {step === 1 && (
              <>
                <legend>Nasıl hizmet veriyorsun?</legend>
                <p className="seller-field-help">Hesap türünü seç ve müşterilerin seni neden tercih etmesi gerektiğini anlat.</p>
                <div className="seller-profile-types">
                  <label className={profileType === "individual" ? "selected" : ""}>
                    <input type="radio" name="profileType" checked={profileType === "individual"} onChange={() => { setProfileType("individual"); resetError(); }} />
                    <i>◎</i><span><strong>Bireysel uzman</strong><small>Kendi adımla hizmet veriyorum</small></span><b>✓</b>
                  </label>
                  <label className={profileType === "company" ? "selected" : ""}>
                    <input type="radio" name="profileType" checked={profileType === "company"} onChange={() => { setProfileType("company"); resetError(); }} />
                    <i>▦</i><span><strong>Firma</strong><small>Kurumsal unvanımla hizmet veriyorum</small></span><b>✓</b>
                  </label>
                </div>
                {profileType === "company" && (
                  <div className="seller-field-grid">
                    <label className="seller-field">Firma unvanı<input value={companyName} onChange={(event) => { setCompanyName(event.target.value); resetError(); }} placeholder="Örn. Ada Yapı Ltd. Şti." /></label>
                    <label className="seller-field">Vergi / T.C. kimlik no<input value={taxNo} onChange={(event) => { setTaxNo(event.target.value.replace(/\D/g, "").slice(0, 11)); resetError(); }} inputMode="numeric" placeholder="10 veya 11 hane" /></label>
                  </div>
                )}
                <label className="seller-field">Profil açıklaması
                  <textarea rows={7} maxLength={2000} value={description} onChange={(event) => { setDescription(event.target.value); resetError(); }} placeholder="Deneyimini, çalışma biçimini ve sunduğun hizmetleri anlat…" />
                  <small>{description.trim().length}/2000 · En az 50 karakter</small>
                </label>
              </>
            )}

            {step === 2 && (
              <>
                <legend>Hangi alanlarda uzmansın?</legend>
                <p className="seller-field-help">Birden fazla kategori seçebilirsin. Yalnızca seçtiğin alanlardaki taleplerle eşleşirsin.</p>
                <div className="seller-category-grid">
                  {categories.map((category) => (
                    <label className={categoryIds.includes(category.id) ? "selected" : ""} key={category.id}>
                      <input type="checkbox" checked={categoryIds.includes(category.id)} onChange={() => toggleCategory(category.id)} />
                      <i style={{ background: category.color }}>{category.icon}</i>
                      <span><strong>{category.name}</strong><small>{categoryDescriptions[category.slug] ?? "Profesyonel hizmet kategorisi"}</small></span>
                      <b>✓</b>
                    </label>
                  ))}
                </div>
                <div className="seller-selection-count"><strong>{categoryIds.length}</strong><span>kategori seçildi</span></div>
              </>
            )}

            {step === 3 && (
              <>
                <legend>Nerelerde hizmet verirsin?</legend>
                <p className="seller-field-help">81 il ve tüm ilçeler arasından çalışma bölgelerini seç. İstersen bir ilin tamamını ekleyebilirsin.</p>
                <label className="seller-field seller-city-select">İl seç
                  <select value={activeCityId ?? ""} onChange={(event) => { setActiveCityId(Number(event.target.value)); resetError(); }}>
                    {cities.map((city) => <option value={city.id} key={city.id}>{city.name}</option>)}
                  </select>
                </label>
                {activeCity && (
                  <div className="seller-district-panel">
                    <div className="seller-district-head">
                      <span><strong>{activeCity.name}</strong>{activeCity.districts.length} ilçe</span>
                      <div><button type="button" onClick={selectAllActiveDistricts}>Tümünü seç</button><button type="button" onClick={clearActiveCity}>Temizle</button></div>
                    </div>
                    <div className="seller-district-grid">
                      {activeCity.districts.map((district) => {
                        const selected = locations.some((location) => location.district_id === district.id);
                        return (
                          <label className={selected ? "selected" : ""} key={district.id}>
                            <input type="checkbox" checked={selected} onChange={() => toggleDistrict(activeCity.id, district.id)} />
                            <span>{district.name}</span><b>✓</b>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div className="seller-location-summary">
                  <span>SEÇİLEN BÖLGELER · {locations.length} İLÇE</span>
                  {selectedLocationGroups.length === 0 ? <p>Henüz hizmet bölgesi seçmedin.</p> : selectedLocationGroups.map(({ city, districts }) => (
                    <div key={city.id}><strong>{city.name}</strong><small>{districts.map((district) => district.name).join(", ")}</small></div>
                  ))}
                </div>
              </>
            )}

            {step === 4 && (
              <>
                <legend>Son bir kontrol</legend>
                <p className="seller-field-help">Başvurun manuel incelemeye alınacak. Onay sonrasında yalnızca sana uygun talepleri göreceksin.</p>
                <div className="seller-review-profile">
                  <span>{profileType === "company" ? "FİRMA PROFİLİ" : "BİREYSEL PROFİL"}</span>
                  <h3>{profileType === "company" ? companyName : workspace?.user.name}</h3>
                  <p>{description}</p>
                </div>
                <div className="seller-review-grid">
                  <div><span>KATEGORİLER</span><strong>{selectedCategories.map((category) => category.name).join(", ")}</strong></div>
                  <div><span>HİZMET ALANI</span><strong>{selectedLocationGroups.length} il · {locations.length} ilçe</strong></div>
                  <div><span>İLETİŞİM</span><strong className={workspace?.user.verification.complete ? "verified" : "unverified"}>{workspace?.user.verification.complete ? "✓ Doğrulandı" : "! Doğrulama gerekli"}</strong></div>
                </div>
                {!workspace?.user.verification.complete && (
                  <div className="seller-verify-note"><b>İletişim bilgilerini doğrula</b><span>Başvurunu göndermeden önce e-posta ve telefon doğrulamasını tamamlamalısın.</span><Link href="/giris?dogrulama=1&devam=%2Fsatici-ol">Şimdi doğrula →</Link></div>
                )}
                <div className="seller-review-note"><b>⌁</b><p><strong>Manuel kalite kontrolü</strong><span>Her hizmet veren başvurusu profil bütünlüğü ve iletişim doğrulaması açısından incelenir.</span></p></div>
              </>
            )}
          </fieldset>

          {error && <p className="seller-error">{error}</p>}

          <div className="seller-card-foot">
            <button className="button button-ghost" type="button" disabled={step === 1 || submitting} onClick={() => { setStep((current) => Math.max(1, current - 1)); resetError(); }}>← Geri</button>
            {step < 4 ? (
              <button className="button button-primary" type="button" onClick={nextStep}>Devam et <span>→</span></button>
            ) : (
              <button className="button button-primary" type="submit" disabled={submitting}>{submitting ? "Gönderiliyor…" : "Başvuruyu gönder"} <span>→</span></button>
            )}
          </div>
        </form>
      </div>
    </main>
  );
}
