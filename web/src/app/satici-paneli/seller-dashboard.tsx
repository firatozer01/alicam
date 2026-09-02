"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AccountMenu } from "@/components/account-menu";
import { FilterRail } from "@/components/listing/filter-rail";
import { NavMenuBar } from "@/components/listing/nav-menu";
import { Modal } from "@/components/modal/modal";
import { WorkViewer } from "@/components/portfolio/work-viewer";
import { ActiveChips, ListSkeleton, Pagination, ResultBar } from "@/components/listing/listing-chrome";
import list from "@/components/listing/listing.module.css";
import { ApiError, apiRequest, firstApiError } from "@/lib/api";
import styles from "./satici-paneli.module.css";

type CurrentUser = { id: number; name: string; email: string; roles: string[] };
type Category = { id: number; name: string; slug: string; icon: string; color: string };
type RequestAttribute = { key: string; label: string; value: string | number | boolean | string[] | null; unit: string | null; is_private?: boolean };
type SellerRequest = {
  id: number; reference: string; title: string; summary: string; status: string; offer_count: number;
  budget: { min: string; max: string }; category: Category;
  location: { city: { id: number; name: string }; district: { id: number; name: string } };
  summary_attributes: RequestAttribute[]; is_unlocked: boolean; is_favorite: boolean; unlock_cost: number | null;
  expires_at: string | null; created_at: string;
  details?: { description: string; full_address: string | null; attributes: RequestAttribute[]; contact: { name: string; email: string; phone: string } };
};
type Offer = { id: number; request_id: number; price: string; message: string; status: string; created_at: string; updated_at: string };
type SellerOfferItem = { offer: Offer; request: SellerRequest };
type CreditTransaction = { id: number; type: string; amount: number; balance_after: number; reference_type: string | null; metadata: { public_reference?: string; merchant_oid?: string; days?: number } | null; created_at: string };
type CreditWorkspace = { balance: number; spent_this_month: number; transactions: CreditTransaction[] };
type SellerService = { id: number; title: string; description: string; price_from: string | null; delivery_time: string | null; cover_url: string | null; is_active: boolean; category: Category };
type FeaturedWorkspace = { is_featured: boolean; featured_until: string | null; packages: Record<string, { label: string; days: number; credits: number }> };
type ProfileWorkspace = {
  categories: Category[];
  locations: { city_id: number; city_name: string; district_id: number; district_name: string }[];
  profile: {
    profile_type: "individual" | "company"; company_name: string | null; tax_no: string | null;
    description: string; approval_status: string; reviewed_at: string | null;
  } | null;
};
type RequestFacets = {
  categories: { slug: string; name: string; icon: string; color: string; count: number }[];
  cities: { id: number; name: string; count: number }[];
  budget: { min: number; max: number };
};
type ListMeta = { current_page: number; last_page: number; per_page: number; total: number };
type PortfolioImage = { id: number; url: string };
type PortfolioItem = {
  id: number; title: string; description: string; location: string | null;
  completed_at: string | null; is_published: boolean; category: Category | null; images: PortfolioImage[];
};
type Scope = "all" | "unlocked" | "favorite";
type View = "requests" | "performance" | "offers" | "services" | "visibility" | "profile" | "portfolio";

const sortOptions = [
  { value: "latest", label: "En yeni" },
  { value: "budget_high", label: "Bütçe: yüksekten" },
  { value: "budget_low", label: "Bütçe: düşükten" },
  { value: "competition", label: "En az rekabet" },
  { value: "popular", label: "En çok teklif alan" },
];

const money = (value: string | number) => new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(Number(value));
const date = (value: string) => new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
const statusLabel: Record<string, string> = { pending: "Yanıt bekliyor", accepted: "Kabul edildi", rejected: "Reddedildi" };

function relativeTime(value: string) {
  const minutes = Math.max(1, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 60) return `${minutes} dk önce`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} saat önce`;
  return `${Math.round(hours / 24)} gün önce`;
}

function attributeValue(attribute: RequestAttribute) {
  if (Array.isArray(attribute.value)) return attribute.value.join(", ");
  if (typeof attribute.value === "boolean") return attribute.value ? "Evet" : "Hayır";
  if (attribute.value === null || attribute.value === "") return "Belirtilmedi";
  return `${attribute.value}${attribute.unit ? ` ${attribute.unit}` : ""}`;
}

function BrandMark() {
  return <svg aria-hidden="true" className={styles.brandMark} viewBox="0 0 30 30" fill="none"><path d="M4 10 L14 4 L14 10 Z" fill="#7C3AED" /><path d="M26 20 L16 26 L16 20 Z" fill="#06B6D4" /><path d="M14 7 H16 V23 H14 Z" fill="#4F46E5" opacity=".9" /></svg>;
}

export function SellerDashboard() {
  const router = useRouter();
  const chartRef = useRef<HTMLElement>(null);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [requests, setRequests] = useState<SellerRequest[]>([]);
  const [offers, setOffers] = useState<SellerOfferItem[]>([]);
  const [credits, setCredits] = useState<CreditWorkspace>({ balance: 0, spent_this_month: 0, transactions: [] });
  const [services, setServices] = useState<SellerService[]>([]);
  const [featured, setFeatured] = useState<FeaturedWorkspace>({ is_featured: false, featured_until: null, packages: {} });
  const [profile, setProfile] = useState<ProfileWorkspace>({ categories: [], locations: [], profile: null });
  const [view, setView] = useState<View>("requests");
  const [filter, setFilter] = useState<Scope>("all");
  const [offerFilter, setOfferFilter] = useState<"all" | "pending" | "accepted" | "rejected">("all");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [sort, setSort] = useState("latest");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [budget, setBudget] = useState({ min: "", max: "" });
  const [appliedBudget, setAppliedBudget] = useState({ min: "", max: "" });
  const [page, setPage] = useState(1);
  const [facets, setFacets] = useState<RequestFacets>({ categories: [], cities: [], budget: { min: 0, max: 0 } });
  const [meta, setMeta] = useState<ListMeta>({ current_page: 1, last_page: 1, per_page: 15, total: 0 });
  const [loadedQuery, setLoadedQuery] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [railOpen, setRailOpen] = useState(false);
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [portfolioForm, setPortfolioForm] = useState({ id: 0, title: "", description: "", location: "", completed_at: "", category_id: "" });
  const [showPortfolioForm, setShowPortfolioForm] = useState(false);
  const [uploadingFor, setUploadingFor] = useState<number | null>(null);
  const [openWork, setOpenWork] = useState<PortfolioItem | null>(null);
  const [coverUploading, setCoverUploading] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [offerRequest, setOfferRequest] = useState<number | null>(null);
  const [editingOffer, setEditingOffer] = useState<number | null>(null);
  const [price, setPrice] = useState("");
  const [message, setMessage] = useState("");
  const [serviceForm, setServiceForm] = useState({ id: 0, category_id: "", title: "", description: "", price_from: "", delivery_time: "", is_active: true });
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [chartsReady, setChartsReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [unlockingId, setUnlockingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  // Talep listesi sunucuda filtrelenir; sayaclar ve sayfalama da oradan gelir.
  const requestQuery = useMemo(() => {
    const params = new URLSearchParams();
    if (filter === "unlocked") params.set("unlocked", "1");
    if (filter === "favorite") params.set("favorite", "1");
    if (search) params.set("q", search);
    if (categoryFilter) params.set("category", categoryFilter);
    if (cityFilter) params.set("city_id", cityFilter);
    if (appliedBudget.min) params.set("budget_min", appliedBudget.min);
    if (appliedBudget.max) params.set("budget_max", appliedBudget.max);
    if (sort !== "latest") params.set("sort", sort);
    if (page > 1) params.set("page", String(page));
    const query = params.toString();
    return query ? `?${query}` : "";
  }, [appliedBudget, categoryFilter, cityFilter, filter, page, search, sort]);

  // Yuklenen sorgu ile istenen sorgu farkliysa liste beklemededir.
  const listLoading = loadedQuery !== requestQuery;

  const fetchWorkspace = useCallback(async () => {
    const [offerResponse, creditResponse, serviceResponse, featuredResponse, profileResponse, portfolioResponse] = await Promise.all([
      apiRequest<{ data: SellerOfferItem[] }>("/seller/offers"),
      apiRequest<{ data: CreditWorkspace }>("/seller/credits"),
      apiRequest<{ data: SellerService[] }>("/seller/services"),
      apiRequest<{ data: FeaturedWorkspace }>("/seller/featured"),
      apiRequest<{ data: ProfileWorkspace }>("/seller/profile"),
      apiRequest<{ data: PortfolioItem[] }>("/seller/portfolio"),
    ]);
    return { offerResponse, creditResponse, serviceResponse, featuredResponse, profileResponse, portfolioResponse };
  }, []);

  const applyWorkspace = useCallback((workspace: Awaited<ReturnType<typeof fetchWorkspace>>) => {
    setOffers(workspace.offerResponse.data); setCredits(workspace.creditResponse.data);
    setServices(workspace.serviceResponse.data); setFeatured(workspace.featuredResponse.data);
    setProfile(workspace.profileResponse.data); setPortfolio(workspace.portfolioResponse.data);
  }, []);

  // Liste yuklemesi efektin sorumlulugunda; yenileme bu jetonu artirir.
  const refreshWorkspace = useCallback(async () => {
    applyWorkspace(await fetchWorkspace());
    setReloadToken((current) => current + 1);
  }, [applyWorkspace, fetchWorkspace]);

  useEffect(() => {
    let active = true;
    Promise.all([apiRequest<{ data: CurrentUser }>("/me"), fetchWorkspace()])
      .then(([userResponse, workspace]) => { if (active) { setUser(userResponse.data); applyWorkspace(workspace); } })
      .catch((requestError: unknown) => {
        if (!active) return;
        if (requestError instanceof ApiError && requestError.status === 401) return router.replace("/giris?devam=%2Fsatici-paneli");
        if (requestError instanceof ApiError && requestError.status === 403) return router.replace("/satici-ol");
        setError(firstApiError(requestError));
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [applyWorkspace, fetchWorkspace, router]);

  // Filtre/sayfa degistikce yalnizca liste yeniden cekilir.
  useEffect(() => {
    let active = true;
    apiRequest<{ data: SellerRequest[]; facets: RequestFacets; meta: ListMeta }>(`/seller/requests${requestQuery}`)
      .then((response) => {
        if (!active) return;
        setRequests(response.data); setFacets(response.facets); setMeta(response.meta); setLoadedQuery(requestQuery);
      })
      .catch((requestError: unknown) => { if (active) setError(firstApiError(requestError)); });
    return () => { active = false; };
  }, [reloadToken, requestQuery]);

  // Butce alanlari her tusta istek atmasin.
  useEffect(() => {
    const timer = setTimeout(() => { setAppliedBudget(budget); setPage(1); }, 450);
    return () => clearTimeout(timer);
  }, [budget]);

  useEffect(() => {
    const element = chartRef.current;
    if (!element || view !== "performance") return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) { setChartsReady(true); observer.disconnect(); }
    }, { threshold: 0.25 });
    observer.observe(element);
    return () => observer.disconnect();
  }, [loading, view]);

  // Filtre degisimleri her zaman ilk sayfaya doner.
  const selectCategory = (value: string) => { setCategoryFilter(value); setPage(1); };
  const selectCity = (value: string) => { setCityFilter(value); setPage(1); };
  const applySearch = () => { setSearch(searchInput.trim()); setPage(1); };
  const changeSort = (value: string) => { setSort(value); setPage(1); };
  const changeScope = (value: Scope) => { setFilter(value); setPage(1); };
  const clearSearch = () => { setSearch(""); setSearchInput(""); setPage(1); };

  const resetFilters = () => {
    setSearch(""); setSearchInput(""); setCategoryFilter(""); setCityFilter("");
    setBudget({ min: "", max: "" }); setFilter("all"); setSort("latest"); setPage(1);
  };

  const activeChips = useMemo(() => {
    const chips: { key: string; label: string; onClear: () => void }[] = [];
    if (search) chips.push({ key: "q", label: `“${search}”`, onClear: clearSearch });
    if (categoryFilter) chips.push({ key: "category", label: facets.categories.find((item) => item.slug === categoryFilter)?.name ?? categoryFilter, onClear: () => selectCategory("") });
    if (cityFilter) chips.push({ key: "city", label: facets.cities.find((item) => String(item.id) === cityFilter)?.name ?? cityFilter, onClear: () => selectCity("") });
    if (appliedBudget.min || appliedBudget.max) chips.push({ key: "budget", label: `Bütçe ${appliedBudget.min || "0"}–${appliedBudget.max || "∞"} ₺`, onClear: () => setBudget({ min: "", max: "" }) });
    if (filter === "unlocked") chips.push({ key: "unlocked", label: "Sadece açtıklarım", onClear: () => changeScope("all") });
    if (filter === "favorite") chips.push({ key: "favorite", label: "Sadece favorilerim", onClear: () => changeScope("all") });
    return chips;
  }, [appliedBudget, categoryFilter, cityFilter, facets, filter, search]);

  const offerByRequest = useMemo(() => new Map(offers.map((item) => [item.offer.request_id, item.offer])), [offers]);
  const acceptedOffers = offers.filter((item) => item.offer.status === "accepted").length;
  const pendingOffers = offers.filter((item) => item.offer.status === "pending").length;
  const unlockedCount = requests.filter((item) => item.is_unlocked).length;
  const favoriteCount = requests.filter((item) => item.is_favorite).length;
  const publishedWorks = portfolio.filter((item) => item.is_published).length;
  const totalWorkImages = portfolio.reduce((total, item) => total + item.images.length, 0);
  const workCategories = new Set(portfolio.map((item) => item.category?.name).filter(Boolean)).size;
  const wonAmount = offers.filter((item) => item.offer.status === "accepted").reduce((total, item) => total + Number(item.offer.price), 0);
  const averageOffer = offers.length ? offers.reduce((total, item) => total + Number(item.offer.price), 0) / offers.length : 0;
  const visibleOffers = offerFilter === "all" ? offers : offers.filter((item) => item.offer.status === offerFilter);
  const successRate = offers.length ? Math.round((acceptedOffers / offers.length) * 100) : 0;
  const monthSpend = credits.spent_this_month;
  const categoryDistribution = useMemo(() => {
    const counts = offers.reduce<Record<string, { count: number; color: string }>>((result, item) => {
      const name = item.request.category.name;
      result[name] = { count: (result[name]?.count ?? 0) + 1, color: item.request.category.color };
      return result;
    }, {});
    return Object.entries(counts).sort((a, b) => b[1].count - a[1].count).slice(0, 3);
  }, [offers]);
  const topCategoryShare = offers.length && categoryDistribution.length ? categoryDistribution[0][1].count / offers.length : 0;
  const barPairs = [45, 60, 52, 78, 68, Math.max(36, Math.min(94, 46 + offers.length * 3))];

  const selectView = (next: View) => { setView(next); setNotice(""); setError(""); };
  const openOffer = (requestId: number, offer?: Offer) => { setOfferRequest(requestId); setEditingOffer(offer?.id ?? null); setPrice(offer?.price ?? ""); setMessage(offer?.message ?? ""); setError(""); };

  const submitOffer = async (requestId: number) => {
    setBusy(true); setError(""); setNotice("");
    try {
      const updating = editingOffer !== null;
      const response = await apiRequest<{ message: string }>(updating ? `/seller/offers/${editingOffer}` : "/seller/offers", { method: updating ? "PUT" : "POST", body: JSON.stringify({ ...(updating ? {} : { request_id: requestId }), price, message }) });
      setNotice(response.message); setOfferRequest(null); setEditingOffer(null); setPrice(""); setMessage(""); await refreshWorkspace(); if (!updating) setView("offers");
    } catch (requestError: unknown) { setError(firstApiError(requestError)); }
    finally { setBusy(false); }
  };

  const unlock = async (item: SellerRequest) => {
    setBusy(true); setUnlockingId(item.id); setError(""); setNotice("");
    try { const response = await apiRequest<{ message: string }>(`/seller/requests/${item.id}/unlock`, { method: "POST" }); setNotice(response.message); await refreshWorkspace(); setExpanded(item.id); }
    catch (requestError: unknown) { setError(firstApiError(requestError)); }
    finally { setBusy(false); setUnlockingId(null); }
  };

  const editService = (service?: SellerService) => {
    setServiceForm(service ? { id: service.id, category_id: String(service.category.id), title: service.title, description: service.description, price_from: service.price_from ?? "", delivery_time: service.delivery_time ?? "", is_active: service.is_active } : { id: 0, category_id: String(profile.categories[0]?.id ?? ""), title: "", description: "", price_from: "", delivery_time: "", is_active: true });
    setShowServiceForm(true); setError("");
  };

  const submitService = async () => {
    setBusy(true); setError(""); setNotice("");
    try {
      const updating = serviceForm.id > 0;
      const response = await apiRequest<{ message: string }>(updating ? `/seller/services/${serviceForm.id}` : "/seller/services", { method: updating ? "PUT" : "POST", body: JSON.stringify({ ...serviceForm, category_id: Number(serviceForm.category_id), price_from: serviceForm.price_from || null }) });
      setNotice(response.message); setShowServiceForm(false); await refreshWorkspace();
    } catch (requestError: unknown) { setError(firstApiError(requestError)); }
    finally { setBusy(false); }
  };

  const uploadServiceCover = async (service: SellerService, file: File) => {
    setCoverUploading(service.id); setError(""); setNotice("");
    const body = new FormData();
    body.append("image", file);
    const token = document.cookie.split("; ").find((row) => row.startsWith("XSRF-TOKEN="))?.split("=")[1];
    try {
      const response = await fetch(`/api/seller/services/${service.id}/cover`, {
        method: "POST", body, credentials: "include",
        headers: { Accept: "application/json", ...(token ? { "X-XSRF-TOKEN": decodeURIComponent(token) } : {}) },
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.message ?? "Kapak yüklenemedi.");
      setNotice(payload?.message ?? "Kapak güncellendi."); await refreshWorkspace();
    } catch (requestError: unknown) { setError(requestError instanceof Error ? requestError.message : "Kapak yüklenemedi."); }
    finally { setCoverUploading(null); }
  };

  const removeServiceCover = async (service: SellerService) => {
    setError("");
    try { const response = await apiRequest<{ message: string }>(`/seller/services/${service.id}/cover`, { method: "DELETE" }); setNotice(response.message); await refreshWorkspace(); }
    catch (requestError: unknown) { setError(firstApiError(requestError)); }
  };

  const deleteService = async (serviceId: number) => {
    setBusy(true); setError("");
    try { const response = await apiRequest<{ message: string }>(`/seller/services/${serviceId}`, { method: "DELETE" }); setNotice(response.message); await refreshWorkspace(); }
    catch (requestError: unknown) { setError(firstApiError(requestError)); }
    finally { setBusy(false); }
  };

  const toggleFavorite = async (item: SellerRequest) => {
    setError("");
    // Iyimser guncelleme: yanit beklemeden rozet doner, hata olursa geri alinir.
    setRequests((current) => current.map((row) => row.id === item.id ? { ...row, is_favorite: !row.is_favorite } : row));
    try {
      await apiRequest<{ is_favorite: boolean }>(`/seller/requests/${item.id}/favorite`, { method: "POST" });
      if (filter === "favorite") setReloadToken((current) => current + 1);
    } catch (requestError: unknown) {
      setRequests((current) => current.map((row) => row.id === item.id ? { ...row, is_favorite: item.is_favorite } : row));
      setError(firstApiError(requestError));
    }
  };

  const openPortfolioForm = (item?: PortfolioItem) => {
    setPortfolioForm(item
      ? { id: item.id, title: item.title, description: item.description, location: item.location ?? "", completed_at: item.completed_at ?? "", category_id: item.category ? String(item.category.id) : "" }
      : { id: 0, title: "", description: "", location: "", completed_at: "", category_id: "" });
    setShowPortfolioForm(true); setError(""); setNotice("");
  };

  const savePortfolio = async () => {
    setBusy(true); setError(""); setNotice("");
    const payload = {
      title: portfolioForm.title,
      description: portfolioForm.description,
      location: portfolioForm.location || null,
      completed_at: portfolioForm.completed_at || null,
      category_id: portfolioForm.category_id ? Number(portfolioForm.category_id) : null,
    };
    try {
      const response = portfolioForm.id
        ? await apiRequest<{ message: string }>(`/seller/portfolio/${portfolioForm.id}`, { method: "PUT", body: JSON.stringify(payload) })
        : await apiRequest<{ message: string }>("/seller/portfolio", { method: "POST", body: JSON.stringify(payload) });
      setNotice(response.message); setShowPortfolioForm(false); await refreshWorkspace();
    } catch (requestError: unknown) { setError(firstApiError(requestError)); }
    finally { setBusy(false); }
  };

  const togglePublished = async (item: PortfolioItem) => {
    setBusy(true); setError("");
    try {
      const response = await apiRequest<{ message: string; data: PortfolioItem }>(`/seller/portfolio/${item.id}`, {
        method: "PUT",
        body: JSON.stringify({ title: item.title, description: item.description, location: item.location, completed_at: item.completed_at, category_id: item.category?.id ?? null, is_published: !item.is_published }),
      });
      setNotice(item.is_published ? "Çalışma vitrinden gizlendi." : "Çalışma vitrinde yayında.");
      setOpenWork((current) => current && current.id === item.id ? response.data : current);
      await refreshWorkspace();
    } catch (requestError: unknown) { setError(firstApiError(requestError)); }
    finally { setBusy(false); }
  };

  const deletePortfolio = async (item: PortfolioItem) => {
    setBusy(true); setError("");
    try { const response = await apiRequest<{ message: string }>(`/seller/portfolio/${item.id}`, { method: "DELETE" }); setNotice(response.message); setOpenWork(null); await refreshWorkspace(); }
    catch (requestError: unknown) { setError(firstApiError(requestError)); }
    finally { setBusy(false); }
  };

  // Gorsel yuklemesi cok parcali govde ister; JSON gonderen apiRequest kullanilmaz.
  const uploadPortfolioImage = async (item: PortfolioItem, file: File) => {
    setUploadingFor(item.id); setError(""); setNotice("");
    const body = new FormData();
    body.append("image", file);
    const token = document.cookie.split("; ").find((row) => row.startsWith("XSRF-TOKEN="))?.split("=")[1];
    try {
      const response = await fetch(`/api/seller/portfolio/${item.id}/images`, {
        method: "POST", body, credentials: "include",
        headers: { Accept: "application/json", ...(token ? { "X-XSRF-TOKEN": decodeURIComponent(token) } : {}) },
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.message ?? "Görsel yüklenemedi.");
      setNotice(payload?.message ?? "Görsel yüklendi.");
      const fresh = await apiRequest<{ data: PortfolioItem[] }>("/seller/portfolio");
      setPortfolio(fresh.data);
      setOpenWork((current) => current ? fresh.data.find((row) => row.id === current.id) ?? null : null);
    } catch (requestError: unknown) { setError(requestError instanceof Error ? requestError.message : "Görsel yüklenemedi."); }
    finally { setUploadingFor(null); }
  };

  const deletePortfolioImage = async (image: PortfolioImage) => {
    setError("");
    try {
      await apiRequest<{ message: string }>(`/seller/portfolio-images/${image.id}`, { method: "DELETE" });
      const fresh = await apiRequest<{ data: PortfolioItem[] }>("/seller/portfolio");
      setPortfolio(fresh.data);
      setOpenWork((current) => current ? fresh.data.find((row) => row.id === current.id) ?? null : null);
    }
    catch (requestError: unknown) { setError(firstApiError(requestError)); }
  };

  const buyPromotion = async (packageKey: string) => {
    setBusy(true); setError(""); setNotice("");
    try { const response = await apiRequest<{ message: string }>("/seller/featured", { method: "POST", body: JSON.stringify({ package: packageKey }) }); setNotice(response.message); await refreshWorkspace(); }
    catch (requestError: unknown) { setError(firstApiError(requestError)); }
    finally { setBusy(false); }
  };

  if (loading && !user) return <main className={styles.loading}><i /><p>Hizmet veren çalışma alanı hazırlanıyor…</p></main>;

  return <main className={styles.page}>
    <header className={styles.topbar}><div className={styles.topbarInner}><Link className={styles.brand} href="/"><BrandMark />alıcam<span>.net</span></Link>
      <nav>
        <NavMenuBar activeKey={view === "requests" ? (filter === "all" ? "requests" : filter) : view} menus={[
          { key: "requests", label: "Talepler", panelTitle: "Talepler", panelHint: "Talep akışın ve teklif portföyün", items: [
            { key: "requests", label: "Gelen talepler", icon: "📥", hint: "Sana eşleşen açık talepler", count: meta.total, onSelect: () => { changeScope("all"); selectView("requests"); } },
            { key: "unlocked", label: "Açtıklarım", icon: "🔓", hint: "Kontörle detayını açtıkların", count: unlockedCount, onSelect: () => { changeScope("unlocked"); selectView("requests"); } },
            { key: "favorite", label: "Favorilerim", icon: "★", hint: "Takip etmek için işaretlediklerin", count: favoriteCount, onSelect: () => { changeScope("favorite"); selectView("requests"); } },
            { key: "offers", label: "Tekliflerim", icon: "📨", hint: "Gönderdiğin teklifler ve sonuçları", count: offers.length, onSelect: () => selectView("offers") },
            { key: "performance", label: "Performans", icon: "📊", hint: "Kabul oranı ve kontör harcaman", onSelect: () => selectView("performance") },
          ] },
          { key: "company", label: "Firma", panelTitle: "Firma", panelHint: "Vitrinini ve profilini yönet", items: [
            { key: "services", label: "Hizmetlerim", icon: "▦", hint: "Hizmet kataloğunu yönet", count: services.length, onSelect: () => selectView("services") },
            { key: "portfolio", label: "Galerim", icon: "🖼", hint: "Yaptığın işler ve görseller", count: portfolio.length, onSelect: () => selectView("portfolio") },
            { key: "profile", label: "Firma profilim", icon: "🏢", hint: "Firma bilgileri, kategori ve bölge", onSelect: () => selectView("profile") },
            { key: "visibility", label: "Öne çık", icon: "⭐", hint: "Vitrin paketleri ve görünürlük", onSelect: () => selectView("visibility") },
          ] },
        ]}><Link href="/">Ana sayfa</Link></NavMenuBar>
      </nav>
      <div><Link className={styles.creditPill} href="/kontor-yukle">⚡ {credits.balance} kontör</Link><button aria-label="Yeni eşleşen talepleri göster" className={styles.notification} onClick={() => { changeScope("all"); selectView("requests"); }} type="button">🔔<i /></button>{user && <AccountMenu compact displayName={profile.profile?.company_name} user={user} workspace="seller" />}</div></div></header>
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <div className={styles.creditCard}><i /><span>KONTÖR BAKİYEN</span><strong>{credits.balance}</strong><p>Bu ay {monthSpend} kontör harcandı</p><div><i style={{ width: `${Math.min(100, monthSpend)}%` }} /></div><Link href="/kontor-yukle">Kontör yükle</Link></div>

        {view === "requests" && <>
          <button className={list.railToggle} onClick={() => setRailOpen(!railOpen)} type="button">☰ Filtreler{activeChips.length ? ` (${activeChips.length})` : ""}</button>
          <div className={railOpen ? "" : list.railHidden}>
            <FilterRail
              activeCount={activeChips.length}
              budget={{ min: budget.min, max: budget.max, bounds: facets.budget, onChange: setBudget }}
              groups={[
                { key: "category", title: "KATEGORİ", selected: categoryFilter, onSelect: selectCategory, options: facets.categories.map((item) => ({ value: item.slug, label: item.name, count: item.count, color: item.color, icon: item.icon })) },
                { key: "city", title: "ŞEHİR", selected: cityFilter, onSelect: selectCity, options: facets.cities.map((item) => ({ value: String(item.id), label: item.name, count: item.count })) },
              ]}
              onReset={resetFilters}
              search={{ value: searchInput, placeholder: "Talep, konum, referans…", onChange: setSearchInput, onSubmit: applySearch }}
            />
          </div>
        </>}
      </aside>

      <section className={styles.content}>
        {notice && <p className={styles.notice}>✓ {notice}</p>}{error && <p className={styles.error}>{error}</p>}

        {view === "requests" && <section className={styles.viewEnter}>
          <div className={styles.listWithRail}>
          <div>
            <ResultBar noun="eşleşen talep" onSort={changeSort} sort={sort} sortOptions={sortOptions} total={meta.total}>
              <label>Görünüm<select onChange={(event) => changeScope(event.target.value as Scope)} value={filter}><option value="all">Tümü</option><option value="unlocked">Açtıklarım</option><option value="favorite">Favorilerim</option></select></label>
            </ResultBar>
            <ActiveChips chips={activeChips} />

            {listLoading ? <ListSkeleton /> : requests.length === 0 ? <div className={list.table}><div className={list.empty}>Bu filtrede eşleşen talep bulunmuyor.</div></div> : <div className={list.cards}>
              {requests.map((item, index) => {
                const existingOffer = offerByRequest.get(item.id);
                const competition = item.offer_count > 7 ? "compHigh" : item.offer_count > 3 ? "compMid" : "compLow";
                const open = expanded === item.id || (offerRequest === item.id && !existingOffer);
                return <article className={`${list.card} ${item.is_unlocked ? list.cardOpen : ""} ${open ? list.cardExtra : ""}`} key={item.id} style={{ animationDelay: `${Math.min(index, 10) * 30}ms` }}>
                  <div className={list.cardTop}>
                    <span className={list.cat} style={{ color: item.category.color, background: `${item.category.color}15` }}>{item.category.icon} {item.category.name}</span>
                    <span className={`${list.competition} ${list[competition]}`}>{competition === "compHigh" ? "Yoğun" : competition === "compMid" ? "Orta" : "Düşük"} rekabet</span>
                    <button aria-label={item.is_favorite ? "Favorilerden çıkar" : "Favorilere ekle"} aria-pressed={item.is_favorite} className={`${styles.favButton} ${item.is_favorite ? styles.favOn : ""}`} onClick={() => toggleFavorite(item)} type="button">{item.is_favorite ? "★" : "☆"}</button>
                  </div>
                  <h2 className={list.cardTitle}>{item.title}</h2>
                  <div className={list.cardTags}>
                    <span>📍 <b>{item.location.city.name}, {item.location.district.name}</b></span>
                    {item.summary_attributes.slice(0, 2).map((attribute) => <span key={attribute.key}>{attribute.label}: <b>{attributeValue(attribute)}</b></span>)}
                  </div>
                  <div className={list.cardMeta}>
                    <span>📨 <b>{item.offer_count}</b> teklif</span>
                    <span>👁 <b>{Math.max(12, item.offer_count * 7 + 5)}</b></span>
                    <span>{relativeTime(item.created_at)}</span>
                    {item.is_unlocked ? <span className={list.openFlag}>🔓 açık</span> : <span>🔒 gizli</span>}
                  </div>
                  <div className={list.cardFoot}>
                    <div className={list.cardPrice}><small>TAHMİNİ BÜTÇE</small><strong>{money(item.budget.min)} – {money(item.budget.max)}</strong></div>
                    {existingOffer ? <button className={`${list.act} ${list.actQuiet}`} onClick={() => selectView("offers")} type="button">{statusLabel[existingOffer.status]}</button>
                      : item.is_unlocked ? <button className={`${list.act} ${list.actAccent}`} onClick={() => openOffer(item.id)} type="button">Teklif ver</button>
                      : <button className={`${list.act} ${list.actPrimary}`} disabled={busy} onClick={() => unlock(item)} type="button">{unlockingId === item.id ? "Açılıyor…" : `Aç · ${item.unlock_cost} ⚡`}</button>}
                  </div>
                  {item.is_unlocked && item.details && <button className={list.detailToggle} onClick={() => setExpanded(expanded === item.id ? null : item.id)} type="button">{expanded === item.id ? "Detayı kapat" : "Tüm detayı gör"}</button>}
                  {expanded === item.id && item.details && <div className={styles.details}><section><span>TALEP DETAYI</span><p>{item.details.description}</p><div>{item.details.attributes.map((attribute) => <p key={attribute.key}><small>{attribute.label}</small><strong>{attributeValue(attribute)}</strong></p>)}</div></section><aside><span>İLETİŞİM VE ADRES</span><strong>{item.details.contact.name}</strong><a href={`tel:${item.details.contact.phone}`}>{item.details.contact.phone}</a><a href={`mailto:${item.details.contact.email}`}>{item.details.contact.email}</a><p>{item.details.full_address || "Açık adres belirtilmedi"}</p></aside></div>}
                  {offerRequest === item.id && !existingOffer && <div className={styles.offerForm}><div><span>TEKLİFİNİ HAZIRLA</span><strong>Bu talep açıldı; teklif gönderirken ek kontör düşmez.</strong></div><label>Fiyat<input inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} placeholder="Örn. 12500" /></label><label>Teklif notu<textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Kapsamı ve teslim süresini açıkla…" /></label><aside><button onClick={() => setOfferRequest(null)}>Vazgeç</button><button disabled={busy} onClick={() => submitOffer(item.id)}>{busy ? "Gönderiliyor…" : "Teklifi gönder"}</button></aside></div>}
                </article>;
              })}</div>}
            <Pagination lastPage={meta.last_page} onPage={setPage} page={meta.current_page} />
          </div>

          <aside className={styles.sideRail}>
            <section className={styles.widget}>
              <header><strong>BEKLEYEN TEKLİFLERİN</strong><button onClick={() => selectView("offers")} type="button">Tümü →</button></header>
              {pendingOffers === 0 ? <p className={styles.widgetEmpty}>Yanıt bekleyen teklifin yok.</p> : <div className={styles.widgetBody}>
                {offers.filter((item) => item.offer.status === "pending").slice(0, 4).map(({ offer, request: item }) => <button className={styles.miniRow} key={offer.id} onClick={() => selectView("offers")} type="button">
                  <i style={{ background: `${item.category.color}15`, color: item.category.color }}>{item.category.icon}</i>
                  <div><strong>{item.title}</strong><small>{item.location.district.name} · {relativeTime(offer.created_at)}</small></div>
                  <b>{money(offer.price)}</b>
                </button>)}
              </div>}
            </section>

            <section className={styles.widget}>
              <header><strong>KONTÖR HAREKETLERİ</strong><Link href="/kontor-yukle">Yükle →</Link></header>
              {credits.transactions.length === 0 ? <p className={styles.widgetEmpty}>Henüz hareket yok.</p> : <div className={styles.widgetBody}>
                {credits.transactions.slice(0, 4).map((transaction) => <div className={styles.miniRow} key={transaction.id}>
                  <i>{transaction.amount < 0 ? "−" : "+"}</i>
                  <div><strong>{transaction.reference_type === "seller_promotion" ? "Vitrinde öne çıkarma" : transaction.type === "spend" ? "Detay / teklif bedeli" : transaction.type === "bonus" ? "Paket bonusu" : "Kontör yükleme"}</strong><small>{date(transaction.created_at)}</small></div>
                  <b className={transaction.amount < 0 ? styles.miniNeg : styles.miniPos}>{transaction.amount > 0 ? "+" : ""}{transaction.amount}</b>
                </div>)}
              </div>}
            </section>

            <section className={styles.widget}>
              <header><strong>HİZMET KAPSAMIN</strong><button onClick={() => selectView("profile")} type="button">Düzenle →</button></header>
              <div className={styles.widgetBody}>
                <div className={styles.scopeChips}>{profile.categories.length === 0 ? <span>Kategori seçilmemiş</span> : profile.categories.map((item) => <span key={item.id}>{item.icon} {item.name}</span>)}</div>
                <div className={styles.scopeChips}>{profile.locations.length === 0 ? <span>Bölge seçilmemiş</span> : profile.locations.slice(0, 5).map((item) => <span key={item.district_id}>📍 {item.district_name}</span>)}{profile.locations.length > 5 && <span>+{profile.locations.length - 5}</span>}</div>
              </div>
            </section>

            <section className={styles.widget}>
              <div className={styles.promoBox}>
                <span>{featured.is_featured ? "VİTRİNDESİN" : "GÖRÜNÜRLÜĞÜNÜ ARTIR"}</span>
                <strong>{featured.is_featured ? "Profilin öne çıkanlarda" : "Öne çıkanlara katıl"}</strong>
                <p>{featured.is_featured ? `${featured.featured_until ? new Date(featured.featured_until).toLocaleDateString("tr-TR") : "Süresiz"} tarihine kadar ana sayfa vitrinindesin.` : "Ana sayfa vitrininde görünerek daha çok talebe ilk sen ulaş."}</p>
                <button onClick={() => selectView("visibility")} type="button">{featured.is_featured ? "Vitrini yönet" : "Paketleri gör"}</button>
              </div>
            </section>
          </aside>
          </div>
        </section>}

        {view === "performance" && <section className={`${styles.workspaceView} ${styles.viewEnter}`}>
          <header><div><span>ÖLÇÜM VE ANALİZ</span><h1>Performansın</h1><p>Teklif üretimini, kabul oranını ve kontör harcamanı takip et.</p></div><button onClick={() => { changeScope("all"); selectView("requests"); }}>Talepleri gör →</button></header>
          <section className={styles.stats}><article><i>📥</i><div><strong>{meta.total}</strong><span>eşleşen talep</span></div><b>+{Math.min(5, meta.total)}</b></article><article><i>📨</i><div><strong>{offers.length}</strong><span>verilen teklif</span></div><b>toplam</b></article><article><i>✅</i><div><strong>%{successRate}</strong><span>kabul oranı</span></div><b>+{acceptedOffers}</b></article><article><i>⚡</i><div><strong>{monthSpend}</strong><span>bu ay harcanan</span></div><Link href="/kontor-yukle">yükle</Link></article></section>
          <section className={styles.dashboard} ref={chartRef}><article><header><strong>📊 Teklif performansın</strong><span>Son 6 hafta</span></header><div className={styles.bars}>{barPairs.map((height, index) => <div key={index}><span><i className={styles.barOffer} style={{ height: chartsReady ? `${height}%` : 0 }} /><i className={styles.barAccepted} style={{ height: chartsReady ? `${Math.max(8, Math.round(height * (successRate || 28) / 100))}%` : 0 }} /></span><small>{index + 1}. hafta</small></div>)}</div><footer><span><i className={styles.offerSwatch} /> Verilen teklif</span><span><i className={styles.acceptedSwatch} /> Kabul edilen</span></footer></article><article><header><strong>🎯 Kategori dağılımın</strong><span>Tekliflerin</span></header><div className={styles.donutWrap}><div className={styles.donut}><svg viewBox="0 0 120 120"><defs><linearGradient id="seller-donut" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#7C3AED" /><stop offset="1" stopColor="#06B6D4" /></linearGradient></defs><circle className={styles.donutTrack} cx="60" cy="60" r="50" /><circle className={styles.donutProgress} cx="60" cy="60" r="50" style={{ strokeDashoffset: chartsReady ? 314 - (314 * topCategoryShare) : 314 }} /></svg><span><b>{offers.length}</b><small>teklif</small></span></div><div className={styles.donutLegend}>{categoryDistribution.length ? categoryDistribution.map(([name, data]) => <p key={name}><i style={{ background: data.color }} /><span><b>{name}</b><small>{data.count} teklif</small></span></p>) : <p><i /><span><b>Henüz veri yok</b><small>İlk teklifinle oluşur</small></span></p>}</div></div></article></section>
        </section>}

        {view === "portfolio" && <section className={`${styles.workspaceView} ${styles.viewEnter}`}>
          <header>
            <div><span>VİTRİN GALERİSİ</span><h1>Galerim</h1><p>Tamamladığın işleri görselleriyle paylaş; müşteriler profilinde görsün.</p></div>
            <div className={styles.headActions}>
              {user && <Link className={styles.ghostLink} href={`/satici/${user.id}`} target="_blank">Vitrinimi gör ↗</Link>}
              <button onClick={() => openPortfolioForm()}>＋ Çalışma ekle</button>
            </div>
          </header>

          <div className={list.summary}>
            <div className={list.summaryItem}><span>ÇALIŞMA</span><strong>{portfolio.length}</strong><small>galerinde</small></div>
            <div className={list.summaryItem}><span>YAYINDA</span><strong>{publishedWorks}</strong><small>vitrinde görünüyor</small></div>
            <div className={list.summaryItem}><span>GÖRSEL</span><strong>{totalWorkImages}</strong><small>toplam yüklenen</small></div>
            <div className={list.summaryItem}><span>KATEGORİ</span><strong>{workCategories}</strong><small>farklı alan</small></div>
          </div>

          {portfolio.length === 0 ? <div className={list.table}><div className={list.empty}>Galerinde henüz çalışma yok. İlk işini ekleyerek vitrinini oluştur.</div></div> : <div className={styles.portfolioGrid}>
            {portfolio.map((item) => <article className={`${styles.portfolioCard} ${item.is_published ? "" : styles.draftCard}`} key={item.id}>
              <button className={styles.coverButton} onClick={() => setOpenWork(item)} type="button">
                {item.images.length > 0
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img alt={item.title} loading="lazy" src={item.images[0].url} />
                  : <span className={styles.noCover}>Görsel yok</span>}
                <em className={styles.coverCount}>🖼 {item.images.length}</em>
                {!item.is_published && <b className={styles.draftFlag}>TASLAK</b>}
                <span className={styles.coverHint}>Detayı gör</span>
              </button>
              <div className={styles.portfolioBody}>
                <div className={styles.portfolioTop}>
                  {item.category && <span className={list.cat} style={{ background: `${item.category.color}15`, color: item.category.color }}>{item.category.icon} {item.category.name}</span>}
                  {item.completed_at && <small>{new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric" }).format(new Date(item.completed_at))}</small>}
                  {item.location && <small>📍 {item.location}</small>}
                </div>
                <h2>{item.title}</h2>
                <p>{item.description}</p>
                <footer>
                  <button className={styles.detailButton} onClick={() => setOpenWork(item)} type="button">Detayı gör →</button>
                  <div><button onClick={() => openPortfolioForm(item)}>Düzenle</button><button className={styles.dangerLink} disabled={busy} onClick={() => deletePortfolio(item)}>Sil</button></div>
                </footer>
              </div>
            </article>)}
          </div>}
        </section>}

        {view === "offers" && <section className={`${styles.workspaceView} ${styles.viewEnter}`}>
          <header><div><span>TEKLİF PORTFÖYÜ</span><h1>Tekliflerim</h1><p>Gönderdiğin teklifleri, sonuçlarını ve kazanç potansiyelini takip et.</p></div><button onClick={() => { changeScope("all"); selectView("requests"); }}>Yeni fırsat bul →</button></header>

          <div className={list.summary}>
            <div className={list.summaryItem}><span>TOPLAM TEKLİF</span><strong>{offers.length}</strong><small>gönderilen</small></div>
            <div className={list.summaryItem}><span>YANIT BEKLEYEN</span><strong>{pendingOffers}</strong><small>alıcı değerlendiriyor</small></div>
            <div className={list.summaryItem}><span>KABUL EDİLEN</span><strong>{acceptedOffers}</strong><small>%{successRate} kabul oranı</small></div>
            <div className={list.summaryItem}><span>KAZANILAN TUTAR</span><strong>{money(wonAmount)}</strong><small>kabul edilen tekliflerden</small></div>
            <div className={list.summaryItem}><span>ORTALAMA TEKLİF</span><strong>{money(averageOffer)}</strong><small>tüm tekliflerinde</small></div>
          </div>

          <div className={styles.offerTabs}>
            {([["all", "Tümü", offers.length], ["pending", "Yanıt bekleyen", pendingOffers], ["accepted", "Kabul edilen", acceptedOffers], ["rejected", "Reddedilen", offers.length - pendingOffers - acceptedOffers]] as const).map(([value, label, count]) =>
              <button className={offerFilter === value ? styles.tabActive : ""} key={value} onClick={() => setOfferFilter(value)} type="button">{label} <b>{count}</b></button>)}
          </div>

          {visibleOffers.length === 0 ? <div className={list.table}><div className={list.empty}>{offers.length === 0 ? "Henüz teklif göndermedin." : "Bu durumda teklif yok."}</div></div> : <div className={list.cards}>
            {visibleOffers.map(({ offer, request: item }, index) => <article className={list.card} key={offer.id} style={{ animationDelay: `${Math.min(index, 10) * 30}ms` }}>
              <div className={list.cardTop}>
                <span className={list.cat} style={{ color: item.category.color, background: `${item.category.color}15` }}>{item.category.icon} {item.category.name}</span>
                <span className={`${list.competition} ${offer.status === "accepted" ? list.compLow : offer.status === "rejected" ? list.compHigh : list.compMid}`}>{statusLabel[offer.status]}</span>
              </div>
              <h2 className={list.cardTitle}>{item.title}</h2>
              <div className={list.cardTags}>
                <span>📍 <b>{item.location.city.name}, {item.location.district.name}</b></span>
                <span>№ <b>{item.reference}</b></span>
              </div>
              <p className={list.cardSummary}>{offer.message}</p>
              <div className={list.cardMeta}>
                <span>📨 <b>{item.offer_count}</b> rakip teklif</span>
                <span>{relativeTime(offer.created_at)}</span>
                {offer.updated_at !== offer.created_at && <span>düzenlendi</span>}
              </div>
              <div className={list.cardFoot}>
                <div className={list.cardPrice}><small>TEKLİFİN</small><strong>{money(offer.price)}</strong></div>
                {offer.status === "pending"
                  ? <button className={`${list.act} ${list.actAccent}`} onClick={() => openOffer(item.id, offer)} type="button">Teklifi düzenle</button>
                  : <span className={`${list.act} ${list.actQuiet}`}>{statusLabel[offer.status]}</span>}
              </div>
              {offerRequest === item.id && editingOffer === offer.id && <div className={styles.offerForm}><label>Fiyat<input inputMode="decimal" onChange={(event) => setPrice(event.target.value)} value={price} /></label><label>Teklif notu<textarea onChange={(event) => setMessage(event.target.value)} value={message} /></label><aside><button onClick={() => setOfferRequest(null)}>Vazgeç</button><button disabled={busy} onClick={() => submitOffer(item.id)}>{busy ? "Güncelleniyor…" : "Güncelle"}</button></aside></div>}
            </article>)}
          </div>}
        </section>}

        {view === "services" && <section className={`${styles.workspaceView} ${styles.viewEnter}`}>
          <header>
            <div><span>HİZMET KATALOĞU</span><h1>Vereceğin hizmetler</h1><p>Her hizmete kapak görseli ekle; müşteriler vitrininde ve ana sayfada bu kartları görür.</p></div>
            <div className={styles.headActions}>
              {user && <Link className={styles.ghostLink} href={`/satici/${user.id}`} target="_blank">Vitrinimi gör ↗</Link>}
              <button onClick={() => editService()}>＋ Hizmet ekle</button>
            </div>
          </header>

          <div className={list.summary}>
            <div className={list.summaryItem}><span>HİZMET</span><strong>{services.length}</strong><small>kataloğunda</small></div>
            <div className={list.summaryItem}><span>YAYINDA</span><strong>{services.filter((item) => item.is_active).length}</strong><small>müşteriye görünür</small></div>
            <div className={list.summaryItem}><span>KAPAKLI</span><strong>{services.filter((item) => item.cover_url).length}</strong><small>görselli kart</small></div>
            <div className={list.summaryItem}><span>BAŞLANGIÇ</span><strong>{services.some((item) => item.price_from) ? money(Math.min(...services.filter((item) => item.price_from).map((item) => Number(item.price_from)))) : "—"}</strong><small>en düşük fiyatın</small></div>
          </div>

          {services.length === 0 ? <div className={list.table}><div className={list.empty}>Henüz hizmet eklemedin. İlk hizmetini ekleyerek kataloğunu oluştur.</div></div> : <div className={styles.serviceCards}>
            {services.map((service) => <article className={`${styles.serviceCard} ${service.is_active ? "" : styles.draftCard}`} key={service.id}>
              <div className={styles.serviceCover} style={!service.cover_url ? { background: `linear-gradient(135deg, ${service.category.color}22, ${service.category.color}55)` } : undefined}>
                {service.cover_url
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img alt={service.title} loading="lazy" src={service.cover_url} />
                  : <span className={styles.coverIcon}>{service.category.icon}</span>}
                {!service.is_active && <b className={styles.draftFlag}>TASLAK</b>}
                <label className={styles.coverAction}>
                  <input accept="image/jpeg,image/png,image/webp" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) uploadServiceCover(service, file); event.target.value = ""; }} type="file" />
                  <span>{coverUploading === service.id ? "Yükleniyor…" : service.cover_url ? "Kapağı değiştir" : "＋ Kapak ekle"}</span>
                </label>
                {service.cover_url && <button aria-label="Kapağı kaldır" className={styles.coverRemove} onClick={() => removeServiceCover(service)} type="button">✕</button>}
              </div>
              <div className={styles.serviceBody}>
                <span className={list.cat} style={{ background: `${service.category.color}15`, color: service.category.color }}>{service.category.icon} {service.category.name}</span>
                <h2>{service.title}</h2>
                <p>{service.description}</p>
                <footer>
                  <div className={list.cardPrice}><small>BAŞLANGIÇ</small><strong>{service.price_from ? money(service.price_from) : "Teklife göre"}</strong></div>
                  {service.delivery_time && <span className={styles.delivery}>◷ {service.delivery_time}</span>}
                  <div className={styles.serviceActions}><button onClick={() => editService(service)} type="button">Düzenle</button><button className={styles.dangerLink} disabled={busy} onClick={() => deleteService(service.id)} type="button">Sil</button></div>
                </footer>
              </div>
            </article>)}
          </div>}
        </section>}

        {view === "profile" && <section className={`${styles.workspaceView} ${styles.viewEnter}`}><header><div><span>DOĞRULANMIŞ FİRMA KARTI</span><h1>Firma profilim</h1><p>Müşterilerin vitrinde gördüğü kimlik, hizmet ve bölge özeti.</p></div><b className={styles.featuredBadge}>✓ Profil onaylı</b></header><div className={styles.profileHero}><div className={styles.profileAvatar}>{(profile.profile?.company_name || user?.name || "A").slice(0, 2).toLocaleUpperCase("tr-TR")}</div><div><span>{profile.profile?.profile_type === "company" ? "FİRMA HESABI" : "BİREYSEL PROFESYONEL"}</span><h2>{profile.profile?.company_name || user?.name}</h2><p>{profile.profile?.description || "Firma açıklaması henüz eklenmedi."}</p><div><b>✓ Kimlik doğrulandı</b><b>✓ Yönetici onaylı</b></div></div><aside><small>HESAP SAHİBİ</small><strong>{user?.name}</strong><span>{user?.email}</span>{profile.profile?.reviewed_at && <em>Onay: {new Date(profile.profile.reviewed_at).toLocaleDateString("tr-TR")}</em>}</aside></div><div className={styles.profileGrid}><article><header><i>▦</i><div><span>HİZMET KATEGORİLERİ</span><strong>{profile.categories.length} kategori</strong></div></header><div>{profile.categories.map((item) => <b key={item.id} style={{ color: item.color, background: `${item.color}14` }}>{item.icon} {item.name}</b>)}</div><button onClick={() => selectView("services")}>Hizmet kataloğunu yönet →</button></article><article><header><i>📍</i><div><span>HİZMET BÖLGELERİ</span><strong>{new Set(profile.locations.map((item) => item.city_id)).size} il · {profile.locations.length} ilçe</strong></div></header><div>{profile.locations.slice(0, 8).map((item) => <b key={item.district_id}>📍 {item.city_name}, {item.district_name}</b>)}</div><button onClick={() => { setFilter("all"); selectView("requests"); }}>Bölgedeki talepleri gör →</button></article><article><header><i>✦</i><div><span>VİTRİN DURUMU</span><strong>{featured.is_featured ? "Öne çıkan profil" : "Standart görünürlük"}</strong></div></header><p>{featured.is_featured ? "Profilin ana sayfa vitrininde daha görünür durumda." : "Kontör kullanarak profilini ana sayfadaki öne çıkanlara taşıyabilirsin."}</p><button onClick={() => selectView("visibility")}>Görünürlüğü yönet →</button></article></div></section>}

        {view === "visibility" && <section className={`${styles.workspaceView} ${styles.viewEnter}`}><header><div><span>VİTRİN VE GÖRÜNÜRLÜK</span><h1>Öne çıkanlarda yer al</h1><p>Profilini ana sayfadaki öne çıkan profesyoneller bölümüne taşı.</p></div>{featured.is_featured && <b className={styles.featuredBadge}>★ {featured.featured_until ? new Date(featured.featured_until).toLocaleDateString("tr-TR") : "Aktif"} tarihine kadar</b>}</header><div className={styles.visibilityHero}><div><span>KONTÖRLE GÖRÜNÜRLÜK</span><h2>Daha çok müşteri tarafından keşfedil.</h2><p>Öne çıkarılan profiller ana sayfa vitrininde sponsorlu etiketiyle gösterilir.</p><ul><li>✓ Ana sayfa profesyonel vitrini</li><li>✓ Şeffaf sponsorlu ibaresi</li><li>✓ Puan ve hizmet görünürlüğü</li></ul></div><aside><small>MEVCUT BAKİYE</small><strong>⚡ {credits.balance}</strong><Link href="/kontor-yukle">Kontör yükle →</Link></aside></div><div className={styles.packageGrid}>{Object.entries(featured.packages).map(([key, item], index) => <article className={index === 1 ? styles.popular : ""} key={key}>{index === 1 && <b>EN AVANTAJLI</b>}<span>{item.label.toUpperCase()}</span><strong>{item.credits}<small> kontör</small></strong><p>{item.days} gün boyunca vitrin görünürlüğü</p><button disabled={busy || credits.balance < item.credits} onClick={() => buyPromotion(key)}>{credits.balance < item.credits ? "Bakiye yetersiz" : "Paketi etkinleştir"}</button></article>)}</div><section className={styles.ledger}><header><div><span>HESAP HAREKETLERİ</span><h2>Kontör geçmişi</h2></div><Link href="/kontor-yukle">Kontör yükle →</Link></header>{credits.transactions.length === 0 ? <p>Henüz kontör hareketi bulunmuyor.</p> : credits.transactions.map((transaction) => <div key={transaction.id}><i className={transaction.amount < 0 ? styles.spend : ""}>{transaction.amount < 0 ? "−" : "+"}</i><p><strong>{transaction.reference_type === "seller_promotion" ? "Vitrinde öne çıkarma" : transaction.type === "spend" ? "Teklif / detay bedeli" : transaction.type === "bonus" ? "Paket bonusu" : "Kontör yükleme"}</strong><small>{transaction.metadata?.public_reference ?? transaction.metadata?.merchant_oid ?? (transaction.metadata?.days ? `${transaction.metadata.days} gün` : "Hesap hareketi")} · {date(transaction.created_at)}</small></p><b>{transaction.amount > 0 ? "+" : ""}{transaction.amount}<small>kalan {transaction.balance_after}</small></b></div>)}</section></section>}
      </section>
    </div>
    <Modal onClose={() => setShowPortfolioForm(false)} open={showPortfolioForm} size="lg" subtitle="Müşteriler bu bilgileri vitrininde görür." title={portfolioForm.id ? "Çalışmayı düzenle" : "Yeni çalışma ekle"} footer={<>
      <button className={styles.modalGhost} onClick={() => setShowPortfolioForm(false)} type="button">Vazgeç</button>
      <button className={styles.modalPrimary} disabled={busy || !portfolioForm.title.trim() || !portfolioForm.description.trim()} onClick={savePortfolio} type="button">{busy ? "Kaydediliyor…" : portfolioForm.id ? "Güncelle" : "Çalışmayı ekle"}</button>
    </>}>
      <div className={styles.portfolioForm}>
        <label>Başlık<input data-autofocus maxLength={140} onChange={(event) => setPortfolioForm({ ...portfolioForm, title: event.target.value })} placeholder="Örn. Kadıköy 3+1 komple daire boyası" value={portfolioForm.title} /></label>
        <label>Kategori<select onChange={(event) => setPortfolioForm({ ...portfolioForm, category_id: event.target.value })} value={portfolioForm.category_id}><option value="">Seçilmedi</option>{profile.categories.map((item) => <option key={item.id} value={item.id}>{item.icon} {item.name}</option>)}</select></label>
        <label>Konum<input maxLength={120} onChange={(event) => setPortfolioForm({ ...portfolioForm, location: event.target.value })} placeholder="İstanbul, Kadıköy" value={portfolioForm.location} /></label>
        <label>Tamamlanma<input onChange={(event) => setPortfolioForm({ ...portfolioForm, completed_at: event.target.value })} type="date" value={portfolioForm.completed_at} /></label>
        <label className={styles.wide}>Açıklama<textarea maxLength={2000} onChange={(event) => setPortfolioForm({ ...portfolioForm, description: event.target.value })} placeholder="Kapsamı, kullanılan malzemeleri ve süreyi anlat…" value={portfolioForm.description} /><small>{portfolioForm.description.length} / 2000</small></label>
      </div>
    </Modal>

    {openWork && <Modal onClose={() => setOpenWork(null)} open size="lg" subtitle={openWork.is_published ? "Vitrinde yayında" : "Taslak — vitrinde görünmüyor"} title={openWork.title} footer={<>
      <button className={styles.modalGhost} disabled={busy} onClick={() => togglePublished(openWork)} type="button">{openWork.is_published ? "Vitrinden gizle" : "Vitrinde yayınla"}</button>
      <button className={styles.modalGhost} onClick={() => { setOpenWork(null); openPortfolioForm(openWork); }} type="button">Düzenle</button>
      {user && <Link className={styles.modalPrimary} href={`/satici/${user.id}`} target="_blank">Vitrinde gör ↗</Link>}
    </>}>
      <WorkViewer work={openWork} actions={<>
        <label className={styles.uploadInline}>
          <input accept="image/jpeg,image/png,image/webp" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) uploadPortfolioImage(openWork, file); event.target.value = ""; }} type="file" />
          <span>{uploadingFor === openWork.id ? "Yükleniyor…" : "＋ Görsel ekle"}</span>
        </label>
        <span className={styles.uploadHint}>{openWork.images.length} / 8 görsel · JPEG, PNG veya WebP · en fazla 4 MB</span>
        {openWork.images.length > 0 && <div className={styles.imageManager}>{openWork.images.map((image) => <button key={image.id} onClick={() => deletePortfolioImage(image)} type="button">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt="" loading="lazy" src={image.url} /><em>✕</em>
        </button>)}</div>}
      </>} />
    </Modal>}
    <Modal onClose={() => setShowServiceForm(false)} open={showServiceForm} size="lg" subtitle="Kapak görselini kaydettikten sonra kart üzerinden ekleyebilirsin." title={serviceForm.id ? "Hizmeti düzenle" : "Yeni hizmet ekle"} footer={<>
      <button className={styles.modalGhost} onClick={() => setShowServiceForm(false)} type="button">Vazgeç</button>
      <button className={styles.modalPrimary} disabled={busy} onClick={submitService} type="button">{busy ? "Kaydediliyor…" : "Hizmeti kaydet"}</button>
    </>}>
      <div className={styles.portfolioForm}>
        <label>Kategori<select onChange={(event) => setServiceForm({ ...serviceForm, category_id: event.target.value })} value={serviceForm.category_id}>{profile.categories.map((item) => <option key={item.id} value={item.id}>{item.icon} {item.name}</option>)}</select></label>
        <label>Hizmet başlığı<input data-autofocus onChange={(event) => setServiceForm({ ...serviceForm, title: event.target.value })} placeholder="Örn. Anahtar teslim banyo yenileme" value={serviceForm.title} /></label>
        <label className={styles.wide}>Açıklama<textarea onChange={(event) => setServiceForm({ ...serviceForm, description: event.target.value })} placeholder="Hizmet kapsamını ve çalışma biçimini anlat…" value={serviceForm.description} /><small>{serviceForm.description.length} / 2000 · en az 30 karakter</small></label>
        <label>Başlangıç fiyatı (₺)<input inputMode="decimal" onChange={(event) => setServiceForm({ ...serviceForm, price_from: event.target.value })} placeholder="Örn. 5000" value={serviceForm.price_from} /></label>
        <label>Teslim süresi<input onChange={(event) => setServiceForm({ ...serviceForm, delivery_time: event.target.value })} placeholder="Örn. 3–5 gün" value={serviceForm.delivery_time} /></label>
        <label className={`${styles.wide} ${styles.toggleRow}`}><input checked={serviceForm.is_active} onChange={(event) => setServiceForm({ ...serviceForm, is_active: event.target.checked })} type="checkbox" /> Vitrinde yayında</label>
      </div>
    </Modal>
  </main>;
}
