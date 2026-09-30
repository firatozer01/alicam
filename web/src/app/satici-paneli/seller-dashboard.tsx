"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FilterRail } from "@/components/listing/filter-rail";
import { PageShell } from "@/components/shell/page-shell";
import { Modal } from "@/components/modal/modal";
import { WorkViewer } from "@/components/portfolio/work-viewer";
import { ActiveChips, ListSkeleton, Pagination, ResultBar } from "@/components/listing/listing-chrome";
import list from "@/components/listing/listing.module.css";
import { ApiError, apiRequest, apiUpload, firstApiError } from "@/lib/api";
import styles from "./satici-paneli.module.css";

type CurrentUser = { id: number; name: string; email: string; roles: string[] };
type Category = { id: number; name: string; slug: string; icon: string; color: string };
type RequestAttribute = { key: string; label: string; value: string | number | boolean | string[] | null; unit: string | null; is_private?: boolean };
type SellerRequest = {
  id: number; reference: string; title: string; summary: string; status: string; offer_count: number;
  budget: { min: string; max: string }; category: Category;
  location: { city: { id: number; name: string }; district: { id: number; name: string } };
  summary_attributes: RequestAttribute[]; is_unlocked: boolean; is_favorite: boolean; is_invited: boolean; is_demo?: boolean; unlock_cost: number | null;
  expires_at: string | null; created_at: string;
  details?: { description: string; full_address: string | null; attributes: RequestAttribute[]; contact: { name: string; email: string; phone: string; avatar_url?: string | null } };
};
type Offer = { id: number; request_id: number; price: string; message: string; status: string; created_at: string; updated_at: string; listing?: OfferListing | null };
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
    logo_url: string | null; banner_url: string | null;
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
  duration: string | null; area: string | null; budget: string | null; client_type: string | null;
  highlights: string[]; completed_at: string | null; is_published: boolean;
  category: Category | null; images: PortfolioImage[];
};
type CategoryNode = { id: number; name: string; slug: string; icon: string; color: string; children?: CategoryNode[] };
type CityOption = { id: number; name: string; districts: { id: number; name: string }[] };
// Kategoriye bagli serbest alanlar; talep sihirbazindaki tanimin aynisi.
// listing_label: ayni alanin ilan tarafindaki bildirim kipi adi
// ("Oda Sayisi"). Bos ise o alan bir ilanda hic sorulmaz.
type CategoryAttributeField = {
  key: string; label: string; listing_label?: string | null;
  type: "text" | "textarea" | "select" | "multiselect" | "number" | "range" | "boolean" | "date";
  options: string[] | null; unit: string | null; help_text: string | null;
  is_required: boolean; is_private?: boolean; sort_order?: number;
};
type AttributeDraft = string | number | boolean | string[] | null;
type ListingStatus = "draft" | "published" | "sold" | "archived";
type ListingCategory = { id: number; name: string; slug: string; icon: string };
type ListingImage = { id: number; url: string };
type ListingCard = {
  id: number; reference: string; title: string; price: string | null; cover_url: string | null;
  category: ListingCategory | null; location: { city: string | null; district: string | null };
  image_count: number; created_at: string; status: ListingStatus; offer_count: number;
};
type ListingFull = ListingCard & { description: string; images: ListingImage[]; attributes: RequestAttribute[] };
type ListingMeta = { current_page: number; last_page: number; total: number; max_images: number };
// Teklifteki urun anlik goruntudur; listing_id yalnizca ilan hala duruyorsa dolu.
type OfferListing = {
  reference: string | null; title: string | null; price: string | null; cover_url: string | null;
  category: ListingCategory | null; location: { city: string | null; district: string | null } | null;
  attributes: RequestAttribute[]; is_available: boolean; listing_id: number | null;
};
type OfferAttachment = { id: number; title: string; price: string | null; cover_url: string | null };
type Scope = "all" | "unlocked" | "favorite";
type View = "requests" | "performance" | "offers" | "services" | "visibility" | "profile" | "portfolio" | "listings";

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
const listingStatusLabel: Record<ListingStatus, string> = { draft: "Taslak", published: "Yayında", sold: "Satıldı", archived: "Arşiv" };
// Dort durum dort ayri rozet; hepsi paletin icinden.
const listingChipClass: Record<ListingStatus, string> = { draft: styles.isDraft, published: styles.isLive, sold: styles.isSold, archived: styles.isArchived };
const emptyListingForm = { id: 0, category_slug: "", title: "", description: "", price: "", city_id: "", district_id: "" };

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
  // Talep birden fazla kategoride olabildigi icin filtre coklu secimli.
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
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
  const [portfolioForm, setPortfolioForm] = useState({ id: 0, title: "", description: "", location: "", completed_at: "", category_id: "", duration: "", area: "", budget: "", client_type: "", highlights: "" });
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
  // Vitrin urunleri: emlakci bir daireyi, galerici bir araci buraya koyar.
  const [listings, setListings] = useState<ListingCard[]>([]);
  const [listingMeta, setListingMeta] = useState<ListingMeta>(() => ({ current_page: 1, last_page: 1, total: 0, max_images: 15 }));
  const [listingScope, setListingScope] = useState<"all" | ListingStatus>("all");
  const [listingForm, setListingForm] = useState(() => ({ ...emptyListingForm }));
  const [listingValues, setListingValues] = useState<Record<string, AttributeDraft>>(() => ({}));
  // Alanlar hangi kategoriye aitse onunla birlikte tutulur; kategori
  // degisince eski sorular ekranda kalmasin.
  const [listingFields, setListingFields] = useState<{ slug: string; fields: CategoryAttributeField[] }>(() => ({ slug: "", fields: [] }));
  const [showListingForm, setShowListingForm] = useState(false);
  const [openListing, setOpenListing] = useState<ListingFull | null>(null);
  const [listingUploading, setListingUploading] = useState(false);
  const [catalog, setCatalog] = useState<{ categories: CategoryNode[]; cities: CityOption[] } | null>(null);
  // Kapak ve logo ayri ayri yuklenir; biri digerini kilitlemesin.
  const [bannerUploading, setBannerUploading] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  // Teklife iliklenen urun ve secicisi.
  const [offerListing, setOfferListing] = useState<OfferAttachment | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickable, setPickable] = useState<ListingCard[] | null>(null);
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
    if (categoryFilter.length) params.set("category", categoryFilter.join(","));
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
    const [offerResponse, creditResponse, serviceResponse, featuredResponse, profileResponse, portfolioResponse, listingResponse] = await Promise.all([
      apiRequest<{ data: SellerOfferItem[] }>("/seller/offers"),
      apiRequest<{ data: CreditWorkspace }>("/seller/credits"),
      apiRequest<{ data: SellerService[] }>("/seller/services"),
      apiRequest<{ data: FeaturedWorkspace }>("/seller/featured"),
      apiRequest<{ data: ProfileWorkspace }>("/seller/profile"),
      apiRequest<{ data: PortfolioItem[] }>("/seller/portfolio"),
      apiRequest<{ data: ListingCard[]; meta: ListingMeta }>("/seller/listings"),
    ]);
    return { offerResponse, creditResponse, serviceResponse, featuredResponse, profileResponse, portfolioResponse, listingResponse };
  }, []);

  const applyWorkspace = useCallback((workspace: Awaited<ReturnType<typeof fetchWorkspace>>) => {
    setOffers(workspace.offerResponse.data); setCredits(workspace.creditResponse.data);
    setServices(workspace.serviceResponse.data); setFeatured(workspace.featuredResponse.data);
    setProfile(workspace.profileResponse.data); setPortfolio(workspace.portfolioResponse.data);
    setListings(workspace.listingResponse.data); setListingMeta(workspace.listingResponse.meta);
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

  // Urun formunun kategori agaci ve il/ilce listesi yalnizca Urunlerim
  // ekranina girilince cekilir; panel acilisini agirlastirmasin.
  useEffect(() => {
    if (view !== "listings" || catalog) return;
    let active = true;
    Promise.all([
      apiRequest<{ data: CategoryNode[] }>("/categories?tree=1"),
      apiRequest<{ data: CityOption[] }>("/locations"),
    ])
      .then(([categoryResponse, locationResponse]) => { if (active) setCatalog({ categories: categoryResponse.data, cities: locationResponse.data }); })
      .catch((requestError: unknown) => { if (active) setError(firstApiError(requestError)); });
    return () => { active = false; };
  }, [catalog, view]);

  // Kategoriye bagli sorular taleple ayni uctan gelir; effective_attributes
  // ust kategorilerden miras alinanlari da icerir.
  useEffect(() => {
    const slug = listingForm.category_slug;
    if (!showListingForm || !slug) return;
    let active = true;
    apiRequest<{ data: { attributes: CategoryAttributeField[] }; effective_attributes?: CategoryAttributeField[] }>(`/categories/${slug}/attributes`)
      .then((response) => { if (active) setListingFields({ slug, fields: response.effective_attributes ?? response.data.attributes }); })
      .catch(() => { if (active) setListingFields({ slug, fields: [] }); });
    return () => { active = false; };
  }, [listingForm.category_slug, showListingForm]);

  // Secici her acilista tazelenir: arada yayina alinan urun de gorunsun.
  useEffect(() => {
    if (!pickerOpen) return;
    let active = true;
    apiRequest<{ data: ListingCard[] }>("/seller/listings/pickable")
      .then((response) => { if (active) setPickable(response.data); })
      .catch((requestError: unknown) => { if (active) setError(firstApiError(requestError)); });
    return () => { active = false; };
  }, [pickerOpen]);

  // Filtre degisimleri her zaman ilk sayfaya doner.
  const selectCategory = (value: string) => {
    setCategoryFilter((current) => value === ""
      ? []
      : current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
    setPage(1);
  };
  const selectCity = (value: string) => { setCityFilter(value); setPage(1); };
  const applySearch = () => { setSearch(searchInput.trim()); setPage(1); };
  const changeSort = (value: string) => { setSort(value); setPage(1); };
  const changeScope = (value: Scope) => { setFilter(value); setPage(1); };
  const clearSearch = () => { setSearch(""); setSearchInput(""); setPage(1); };

  const resetFilters = () => {
    setSearch(""); setSearchInput(""); setCategoryFilter([]); setCityFilter("");
    setBudget({ min: "", max: "" }); setFilter("all"); setSort("latest"); setPage(1);
  };

  const activeChips = useMemo(() => {
    const chips: { key: string; label: string; onClear: () => void }[] = [];
    if (search) chips.push({ key: "q", label: `“${search}”`, onClear: clearSearch });
    for (const slug of categoryFilter) {
      chips.push({ key: `category-${slug}`, label: facets.categories.find((item) => item.slug === slug)?.name ?? slug, onClear: () => selectCategory(slug) });
    }
    if (cityFilter) chips.push({ key: "city", label: facets.cities.find((item) => String(item.id) === cityFilter)?.name ?? cityFilter, onClear: () => selectCity("") });
    if (appliedBudget.min || appliedBudget.max) chips.push({ key: "budget", label: `Bütçe ${appliedBudget.min || "0"}–${appliedBudget.max || "∞"} ₺`, onClear: () => setBudget({ min: "", max: "" }) });
    if (filter === "unlocked") chips.push({ key: "unlocked", label: "Sadece açtıklarım", onClear: () => changeScope("all") });
    if (filter === "favorite") chips.push({ key: "favorite", label: "Sadece favorilerim", onClear: () => changeScope("all") });
    return chips;
  }, [appliedBudget, categoryFilter, cityFilter, facets, filter, search]);

  // Kategori agaci duz listeye acilir; secim kutusunda kok basliklari
  // optgroup, altlar tire ile girintilenir.
  const flatCategories = useMemo(() => {
    const rows: { slug: string; name: string; icon: string; color: string; depth: number; root: string }[] = [];
    const walk = (nodes: CategoryNode[], depth: number, root: string) => {
      for (const node of nodes) {
        rows.push({ slug: node.slug, name: node.name, icon: node.icon, color: node.color, depth, root });
        if (node.children?.length) walk(node.children, depth + 1, root);
      }
    };
    for (const root of catalog?.categories ?? []) walk([root], 0, root.name);
    return rows;
  }, [catalog]);

  const categoryGroups = useMemo(() => {
    const groups: { root: string; rows: typeof flatCategories }[] = [];
    for (const row of flatCategories) {
      const last = groups[groups.length - 1];
      if (last && last.root === row.root) last.rows.push(row);
      else groups.push({ root: row.root, rows: [row] });
    }
    return groups;
  }, [flatCategories]);

  // Iki elek birden: is_private alanlar alicinin talebindeki ozel notlar
  // icindir, listing_label'i bos olanlar ise hic ilan alani degildir
  // ("Butcen ne kadar?", "Ne zaman tasinmayi planliyorsun?"). Sunucu bu
  // anahtarlari zaten reddeder. Kalanlar ilan kipindeki adiyla sorulur.
  const visibleListingFields = useMemo(
    () => listingFields.fields
      .filter((field) => !field.is_private && Boolean(field.listing_label?.trim()))
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map((field) => ({ ...field, label: field.listing_label ?? field.label })),
    [listingFields],
  );

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
  const openOffer = (requestId: number, offer?: Offer) => {
    setOfferRequest(requestId); setEditingOffer(offer?.id ?? null); setPrice(offer?.price ?? ""); setMessage(offer?.message ?? "");
    // Duzenlemede daha once iliklenen urun secili gelir; ilan silinmisse
    // listing_id null olur ve ek bos baslar.
    setOfferListing(offer?.listing && offer.listing.listing_id
      ? { id: offer.listing.listing_id, title: offer.listing.title ?? "Ürün", price: offer.listing.price, cover_url: offer.listing.cover_url }
      : null);
    setError("");
  };

  const closeOffer = () => { setOfferRequest(null); setEditingOffer(null); setOfferListing(null); };

  const submitOffer = async (requestId: number) => {
    setBusy(true); setError(""); setNotice("");
    try {
      const updating = editingOffer !== null;
      const response = await apiRequest<{ message: string }>(updating ? `/seller/offers/${editingOffer}` : "/seller/offers", { method: updating ? "PUT" : "POST", body: JSON.stringify({ ...(updating ? {} : { request_id: requestId }), price, message, seller_listing_id: offerListing?.id ?? null }) });
      setNotice(response.message); closeOffer(); setPrice(""); setMessage(""); await refreshWorkspace(); if (!updating) setView("offers");
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
      ? { id: item.id, title: item.title, description: item.description, location: item.location ?? "", completed_at: item.completed_at ?? "", category_id: item.category ? String(item.category.id) : "", duration: item.duration ?? "", area: item.area ?? "", budget: item.budget ?? "", client_type: item.client_type ?? "", highlights: (item.highlights ?? []).join("\n") }
      : { id: 0, title: "", description: "", location: "", completed_at: "", category_id: "", duration: "", area: "", budget: "", client_type: "", highlights: "" });
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
      duration: portfolioForm.duration || null,
      area: portfolioForm.area || null,
      budget: portfolioForm.budget ? Number(portfolioForm.budget) : null,
      client_type: portfolioForm.client_type || null,
      highlights: portfolioForm.highlights.split("\n").map((line) => line.trim()).filter(Boolean).slice(0, 8),
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
  const uploadPortfolioImages = async (item: PortfolioItem, files: File[]) => {
    setUploadingFor(item.id); setError(""); setNotice("");
    const room = Math.max(0, 8 - item.images.length);
    const queue = files.slice(0, room);
    if (queue.length === 0) { setError("Bir çalışmaya en fazla 8 görsel eklenebilir."); setUploadingFor(null); return; }
    try {
      for (const file of queue) await sendPortfolioImage(item, file);
      setNotice(`${queue.length} görsel yüklendi.`);
      const fresh = await apiRequest<{ data: PortfolioItem[] }>("/seller/portfolio");
      setPortfolio(fresh.data);
      setOpenWork((current) => current ? fresh.data.find((row) => row.id === current.id) ?? null : null);
    } catch (requestError: unknown) { setError(requestError instanceof Error ? requestError.message : "Görsel yüklenemedi."); }
    finally { setUploadingFor(null); }
  };

  const sendPortfolioImage = async (item: PortfolioItem, file: File) => {
    const body = new FormData();
    body.append("image", file);
    const token = document.cookie.split("; ").find((row) => row.startsWith("XSRF-TOKEN="))?.split("=")[1];
    const response = await fetch(`/api/seller/portfolio/${item.id}/images`, {
      method: "POST", body, credentials: "include",
      headers: { Accept: "application/json", ...(token ? { "X-XSRF-TOKEN": decodeURIComponent(token) } : {}) },
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(payload?.message ?? "Görsel yüklenemedi.");
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

  const openListingForm = (item?: ListingFull) => {
    // Ilan konumu sunucudan yalnizca ad olarak geliyor; secim kutulari
    // icin il/ilce kimligi ad uzerinden geri bulunur.
    const city = item ? catalog?.cities.find((row) => row.name === item.location.city) ?? null : null;
    const district = city?.districts.find((row) => row.name === item?.location.district) ?? null;
    setListingForm(item
      ? { id: item.id, category_slug: item.category?.slug ?? "", title: item.title, description: item.description, price: item.price ?? "", city_id: city ? String(city.id) : "", district_id: district ? String(district.id) : "" }
      : { ...emptyListingForm });
    // Ozellik satirlari anahtar/deger haritasina geri cevrilir.
    setListingValues(item ? Object.fromEntries(item.attributes.map((row) => [row.key, row.value])) : {});
    setListingFields({ slug: "", fields: [] });
    // Duzenlemede urunun tam kaydi yanimizda kalir: formun FOTOGRAFLAR
    // blogu ayni galeriyi yerinde yonetir. Yeni urunde henuz kayit yok.
    setShowListingForm(true); setOpenListing(item ?? null); setError(""); setNotice("");
  };

  // Form kapanirken yanindaki kayit da birakilir; aksi halde forma
  // veda eder etmez fotograf penceresi acilirdi.
  const closeListingForm = () => { setShowListingForm(false); setOpenListing(null); };

  const updateListingValue = (key: string, value: AttributeDraft) => setListingValues((current) => ({ ...current, [key]: value }));

  const openListingDetail = async (listingId: number) => {
    setError(""); setNotice("");
    try { const response = await apiRequest<{ data: ListingFull }>(`/seller/listings/${listingId}`); setOpenListing(response.data); }
    catch (requestError: unknown) { setError(firstApiError(requestError)); }
  };

  const editListing = async (listingId: number) => {
    setError("");
    try { const response = await apiRequest<{ data: ListingFull }>(`/seller/listings/${listingId}`); openListingForm(response.data); }
    catch (requestError: unknown) { setError(firstApiError(requestError)); }
  };

  const reloadListing = async (listingId: number) => {
    const fresh = await apiRequest<{ data: ListingFull }>(`/seller/listings/${listingId}`);
    setOpenListing((current) => current && current.id === listingId ? fresh.data : current);
    await refreshWorkspace();
  };

  // Sunucu yalnizca gorunur alanlari bekler: tanimsiz anahtar gonderilirse
  // dogrulama tumden reddeder, bu yuzden liste alan setinden uretilir.
  const listingAttributePayload = () => {
    const payload: Record<string, unknown> = {};
    for (const field of visibleListingFields) {
      const raw = listingValues[field.key];
      if (field.type === "number" || field.type === "range") payload[field.key] = raw === "" || raw === undefined || raw === null ? null : Number(raw);
      else if (field.type === "boolean") payload[field.key] = typeof raw === "boolean" ? raw : null;
      else if (field.type === "multiselect") payload[field.key] = Array.isArray(raw) ? raw : [];
      else payload[field.key] = raw === "" || raw === undefined ? null : raw;
    }
    return payload;
  };

  const saveListing = async () => {
    setBusy(true); setError(""); setNotice("");
    const payload = {
      category_slug: listingForm.category_slug,
      title: listingForm.title.trim(),
      description: listingForm.description.trim(),
      // Bos fiyat "fiyat sorunuz" demektir.
      price: listingForm.price.trim() === "" ? null : Number(listingForm.price),
      city_id: listingForm.city_id ? Number(listingForm.city_id) : null,
      district_id: listingForm.district_id ? Number(listingForm.district_id) : null,
      attributes: listingAttributePayload(),
    };
    try {
      const response = listingForm.id
        ? await apiRequest<{ message: string; data: ListingFull }>(`/seller/listings/${listingForm.id}`, { method: "PUT", body: JSON.stringify(payload) })
        : await apiRequest<{ message: string; data: ListingFull }>("/seller/listings", { method: "POST", body: JSON.stringify(payload) });
      setNotice(response.message); setShowListingForm(false);
      // Yeni urun taslak baslar; fotograf yonetimi hemen acilsin.
      setOpenListing(response.data);
      await refreshWorkspace();
    } catch (requestError: unknown) { setError(firstApiError(requestError)); }
    finally { setBusy(false); }
  };

  const changeListingStatus = async (listingId: number, status: ListingStatus) => {
    setBusy(true); setError(""); setNotice("");
    try {
      // Fotografsiz yayin ve kabul edilmis teklife bagli urunun geri
      // cekilmesi sunucuda 422 doner; mesaji oldugu gibi gosteriyoruz.
      const response = await apiRequest<{ message: string; data: { status: ListingStatus } }>(`/seller/listings/${listingId}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
      setNotice(response.message);
      setOpenListing((current) => current && current.id === listingId ? { ...current, status: response.data.status } : current);
      await refreshWorkspace();
    } catch (requestError: unknown) { setError(firstApiError(requestError)); }
    finally { setBusy(false); }
  };

  const deleteListing = async (listingId: number) => {
    setBusy(true); setError(""); setNotice("");
    try { const response = await apiRequest<{ message: string }>(`/seller/listings/${listingId}`, { method: "DELETE" }); setNotice(response.message); setOpenListing(null); await refreshWorkspace(); }
    catch (requestError: unknown) { setError(firstApiError(requestError)); }
    finally { setBusy(false); }
  };

  // Dosyalar sirayla gider: sunucu kapak sirasini kilitle tahsis ediyor,
  // es zamanli istekler birbirini bekletir.
  const uploadListingImages = async (item: ListingFull, files: File[]) => {
    setListingUploading(true); setError(""); setNotice("");
    const room = Math.max(0, listingMeta.max_images - item.images.length);
    const queue = files.slice(0, room);
    if (queue.length === 0) { setError(`Bir ürüne en fazla ${listingMeta.max_images} fotoğraf eklenebilir.`); setListingUploading(false); return; }
    try {
      for (const file of queue) await apiUpload<{ message: string }>(`/seller/listings/${item.id}/images`, file);
      setNotice(`${queue.length} fotoğraf yüklendi.`);
      await reloadListing(item.id);
    } catch (requestError: unknown) { setError(firstApiError(requestError)); }
    finally { setListingUploading(false); }
  };

  const deleteListingImage = async (item: ListingFull, imageId: number) => {
    setError("");
    try { await apiRequest<{ message: string }>(`/seller/listing-images/${imageId}`, { method: "DELETE" }); await reloadListing(item.id); }
    catch (requestError: unknown) { setError(firstApiError(requestError)); }
  };

  const makeListingCover = async (item: ListingFull, imageId: number) => {
    setError("");
    try { const response = await apiRequest<{ message: string }>(`/seller/listing-images/${imageId}/cover`, { method: "PATCH" }); setNotice(response.message); await reloadListing(item.id); }
    catch (requestError: unknown) { setError(firstApiError(requestError)); }
  };

  const applyBranding = (data: { banner_url: string | null; logo_url: string | null }) =>
    setProfile((current) => current.profile
      ? { ...current, profile: { ...current.profile, banner_url: data.banner_url, logo_url: data.logo_url } }
      : current);

  type BrandingKind = "banner" | "logo";

  const uploadBranding = async (kind: BrandingKind, file: File) => {
    const mark = kind === "banner" ? setBannerUploading : setLogoUploading;
    mark(true); setError(""); setNotice("");
    try {
      const response = await apiUpload<{ message: string; data: { banner_url: string | null; logo_url: string | null } }>(`/seller/branding/${kind}`, file);
      setNotice(response.message); applyBranding(response.data);
    } catch (requestError: unknown) { setError(firstApiError(requestError)); }
    finally { mark(false); }
  };

  const removeBranding = async (kind: BrandingKind) => {
    const mark = kind === "banner" ? setBannerUploading : setLogoUploading;
    mark(true); setError(""); setNotice("");
    try {
      const response = await apiRequest<{ message: string; data: { banner_url: string | null; logo_url: string | null } }>(`/seller/branding/${kind}`, { method: "DELETE" });
      setNotice(response.message); applyBranding(response.data);
    } catch (requestError: unknown) { setError(firstApiError(requestError)); }
    finally { mark(false); }
  };

  const buyPromotion = async (packageKey: string) => {
    setBusy(true); setError(""); setNotice("");
    try { const response = await apiRequest<{ message: string }>("/seller/featured", { method: "POST", body: JSON.stringify({ package: packageKey }) }); setNotice(response.message); await refreshWorkspace(); }
    catch (requestError: unknown) { setError(firstApiError(requestError)); }
    finally { setBusy(false); }
  };

  // Yukleme ekraninda da ortak kabuk durur; sayfa gecisinde zipla olmaz.
  if (loading && !user) return <PageShell className={styles.page} header={{ workspace: "seller" }} tone="panel"><div className={styles.loading}><i /><p>Hizmet veren çalışma alanı hazırlanıyor…</p></div></PageShell>;

  // Urun ekranindan turetilenler.
  const visibleListings = listingScope === "all" ? listings : listings.filter((item) => item.status === listingScope);
  const publishedListings = listings.filter((item) => item.status === "published").length;
  const listingPhotos = listings.reduce((total, item) => total + item.image_count, 0);
  const listingOffers = listings.reduce((total, item) => total + item.offer_count, 0);
  const listingCategory = flatCategories.find((row) => row.slug === listingForm.category_slug) ?? null;
  const listingCity = catalog?.cities.find((row) => String(row.id) === listingForm.city_id) ?? null;
  const listingDistrict = listingCity?.districts.find((row) => String(row.id) === listingForm.district_id) ?? null;
  // Kategori alanlari yuklenmeden kaydetmek, onceki kategorinin
  // anahtarlarini gonderirdi ve sunucu tumunu reddederdi.
  const listingReady = Boolean(listingForm.category_slug) && listingFields.slug === listingForm.category_slug
    && listingForm.title.trim().length >= 10 && listingForm.description.trim().length >= 20;
  // Duzenlenen urunun tam kaydi: formun FOTOGRAFLAR blogu galeriyi
  // yerinde yonetsin. Yeni urunde henuz kayit olmadigi icin null.
  const editingListing = openListing && openListing.id === listingForm.id ? openListing : null;

  // Kategori alanlari talep formundaki tiplerin aynisini cizer.
  const renderListingField = (field: CategoryAttributeField) => {
    const raw = listingValues[field.key];
    const suffix = field.unit ? ` (${field.unit})` : "";
    const wide = field.type === "textarea" || field.type === "multiselect" ? styles.wide : "";
    const options = field.options ?? [];
    const required = field.is_required ? " *" : "";

    if (field.type === "boolean") return <label className={`${styles.wide} ${styles.toggleRow}`} key={field.key}>
      <input checked={raw === true} onChange={(event) => updateListingValue(field.key, event.target.checked)} type="checkbox" /> {field.label}{required}
    </label>;

    if (field.type === "multiselect") {
      const values = Array.isArray(raw) ? raw : [];
      return <div className={`${styles.wide} ${styles.checkField}`} key={field.key}>
        <span>{field.label}{suffix}{required}</span>
        <div>{options.map((option) => <label key={option}>
          <input checked={values.includes(option)} onChange={(event) => updateListingValue(field.key, event.target.checked ? [...values, option] : values.filter((row) => row !== option))} type="checkbox" /> {option}
        </label>)}</div>
        {field.help_text && <small>{field.help_text}</small>}
      </div>;
    }

    if (field.type === "select") return <label className={wide} key={field.key}>{field.label}{suffix}{required}
      <select onChange={(event) => updateListingValue(field.key, event.target.value)} value={typeof raw === "string" ? raw : ""}>
        <option value="">Seçilmedi</option>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
      {field.help_text && <small>{field.help_text}</small>}
    </label>;

    if (field.type === "textarea") return <label className={wide} key={field.key}>{field.label}{suffix}{required}
      <textarea maxLength={2000} onChange={(event) => updateListingValue(field.key, event.target.value)} placeholder={field.help_text ?? ""} value={typeof raw === "string" ? raw : ""} />
      {field.help_text && <small>{field.help_text}</small>}
    </label>;

    return <label className={wide} key={field.key}>{field.label}{suffix}{required}
      <input
        inputMode={field.type === "number" || field.type === "range" ? "decimal" : undefined}
        onChange={(event) => updateListingValue(field.key, event.target.value)}
        placeholder={field.help_text ?? field.label}
        type={field.type === "number" || field.type === "range" ? "number" : field.type === "date" ? "date" : "text"}
        value={raw === null || raw === undefined || Array.isArray(raw) || typeof raw === "boolean" ? "" : String(raw)}
      />
      {field.help_text && <small>{field.help_text}</small>}
    </label>;
  };

  // Modal onizlemeleri icin turetilen degerler.
  const workCategory = profile.categories.find((item) => String(item.id) === portfolioForm.category_id);
  const workHighlights = portfolioForm.highlights.split("\n").map((line) => line.trim()).filter(Boolean);
  const serviceCategory = profile.categories.find((item) => String(item.id) === serviceForm.category_id);

  return <PageShell
    className={styles.page}
    header={{
      activeKey: view === "requests" ? (filter === "all" ? "requests" : filter) : view,
      credits: credits.balance,
      links: [{ label: "Ana sayfa", href: "/" }, { label: "Gelen talepler", href: "/satici-paneli" }],
      cta: { label: "Vitrinim", href: user ? `/satici/${user.id}` : "/satici-paneli" },
      displayName: profile.profile?.company_name,
      sessionReady: !loading,
      user,
      workspace: "seller",
      menus: [
        {
          key: "requests", label: "Talepler",
          panelIcon: "📥", panelTitle: "Talep akışın", panelHint: "Sana düşen talepler ve teklif portföyün tek yerde",
          meta: `${meta.total} eşleşen talep`,
          sections: [
            { key: "flow", title: "TALEP AKIŞI", icon: "📥", color: "#7C3AED", description: "Kategori ve bölgene düşen açık talepler.", items: [
              { key: "requests", label: "Gelen talepler", icon: "📥", hint: "Sana eşleşen açık talepler", count: meta.total, onSelect: () => { changeScope("all"); selectView("requests"); } },
              { key: "unlocked", label: "Açtıklarım", icon: "🔓", hint: "Kontörle detayını açtıkların", count: unlockedCount, onSelect: () => { changeScope("unlocked"); selectView("requests"); } },
              { key: "favorite", label: "Favorilerim", icon: "★", hint: "Takip için işaretlediklerin", badge: "Yeni", tone: "new", count: favoriteCount, onSelect: () => { changeScope("favorite"); selectView("requests"); } },
            ], footer: { label: "Talep listesine git", onSelect: () => { changeScope("all"); selectView("requests"); } } },
            { key: "offers", title: "TEKLİF YÖNETİMİ", icon: "📨", color: "#06B6D4", description: "Gönderdiğin teklifler ve sonuçları.", items: [
              { key: "offers", label: "Tekliflerim", icon: "📨", hint: `${pendingOffers} yanıt bekliyor`, count: offers.length, onSelect: () => selectView("offers") },
              { key: "performance", label: "Performans", icon: "📊", hint: `%${successRate} kabul oranı`, onSelect: () => selectView("performance") },
            ], footer: { label: "Teklif portföyü", onSelect: () => selectView("offers") } },
          ],
          quickLinks: [
            { key: "new", label: "Yeni fırsat bul", icon: "🔍", onSelect: () => { changeScope("all"); selectView("requests"); } },
            { key: "credit", label: `${credits.balance} kontör`, icon: "⚡", href: "/kontor-yukle" },
            { key: "store", label: "Vitrinim", icon: "🏬", href: user ? `/satici/${user.id}` : "/satici-paneli", primary: true },
          ],
        },
        {
          key: "company", label: "Firma",
          panelIcon: "🏢", panelTitle: "Firma vitrinin", panelHint: "Hizmetlerin, galerin ve görünürlüğün",
          meta: `${listings.length} ürün · ${services.length} hizmet · ${portfolio.length} çalışma`,
          allLink: user ? { label: "Vitrinimi gör", href: `/satici/${user.id}` } : undefined,
          sections: [
            { key: "catalog", title: "VİTRİN", icon: "🏬", color: "#EC4899", description: "Müşterilerin profilinde gördüğü içerik.", accent: true, badge: "Yeni", items: [
              { key: "listings", label: "Ürünlerim", icon: "🏷", hint: "Vitrindeki ürün ve ilanların", badge: "Yeni", tone: "new", count: listings.length, onSelect: () => selectView("listings") },
              { key: "services", label: "Hizmetlerim", icon: "▦", hint: "Kapak görselli hizmet kartları", count: services.length, onSelect: () => selectView("services") },
              { key: "portfolio", label: "Galerim", icon: "🖼", hint: "Yaptığın işler ve fotoğrafları", badge: "Yeni", tone: "new", count: portfolio.length, onSelect: () => selectView("portfolio") },
            ], footer: { label: "Vitrini düzenle", onSelect: () => selectView("services") } },
            { key: "profile", title: "PROFİL VE GÖRÜNÜRLÜK", icon: "🏢", color: "#4F46E5", description: "Firma bilgileri ve öne çıkma.", items: [
              { key: "profile", label: "Firma profilim", icon: "🏢", hint: "Bilgiler, kategori ve bölge", onSelect: () => selectView("profile") },
              { key: "visibility", label: "Öne çık", icon: "⭐", hint: featured.is_featured ? "Vitrindesin" : "Vitrin paketleri", badge: featured.is_featured ? "Aktif" : undefined, tone: "hot", onSelect: () => selectView("visibility") },
            ], footer: { label: "Görünürlüğü yönet", onSelect: () => selectView("visibility") } },
          ],
          quickLinks: [
            { key: "add-listing", label: "Ürün ekle", icon: "🏷", onSelect: () => { selectView("listings"); openListingForm(); } },
            { key: "add-work", label: "Çalışma ekle", icon: "＋", onSelect: () => { selectView("portfolio"); openPortfolioForm(); } },
            { key: "add-service", label: "Hizmet ekle", icon: "▦", onSelect: () => { selectView("services"); editService(); } },
            { key: "public", label: "Vitrinimi gör", icon: "↗", href: user ? `/satici/${user.id}` : "/satici-paneli", primary: true },
          ],
        },
      ],
    }}
    tone="panel"
  >
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
                { key: "category", title: "KATEGORİ", multiple: true, selected: categoryFilter, onSelect: selectCategory, options: facets.categories.map((item) => ({ value: item.slug, label: item.name, count: item.count, color: item.color, icon: item.icon })) },
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

            {listLoading ? <ListSkeleton /> : requests.length === 0 ? <div className={list.table}><div className={list.empty}>Bu filtrede eşleşen talep bulunmuyor.</div></div> : <div className={list.cards} key={`${categoryFilter.join("-")}|${cityFilter}|${filter}|${search}|${sort}|${page}`}>
              {requests.map((item, index) => {
                const existingOffer = offerByRequest.get(item.id);
                const competition = item.offer_count > 7 ? "compHigh" : item.offer_count > 3 ? "compMid" : "compLow";
                const open = expanded === item.id || (offerRequest === item.id && !existingOffer);
                return <article className={`${list.card} ${item.is_invited ? list.cardInvited : ""} ${item.is_unlocked ? list.cardOpen : ""} ${open ? list.cardExtra : ""}`} key={item.id} style={{ animationDelay: `${Math.min(index, 10) * 30}ms` }}>
                  <div className={list.cardTop}>
                    <span className={list.cat} style={{ color: item.category.color, background: `${item.category.color}15` }}>{item.category.icon} {item.category.name}</span>
                    {item.is_invited && <span className={list.invited}>◈ Sana özel</span>}
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
                    {item.is_demo && <span className={styles.demoFlag} title="Vitrini canlı göstermek için eklenmiş örnek talep; açmak kontör düşürmez.">Örnek</span>}
                  </div>
                  <div className={list.cardFoot}>
                    <div className={list.cardPrice}><small>TAHMİNİ BÜTÇE</small><strong>{money(item.budget.min)} – {money(item.budget.max)}</strong></div>
                    {existingOffer ? <button className={`${list.act} ${list.actQuiet}`} onClick={() => selectView("offers")} type="button">{statusLabel[existingOffer.status]}</button>
                      : item.is_unlocked ? <button className={`${list.act} ${list.actAccent}`} onClick={() => openOffer(item.id)} type="button">Teklif ver</button>
                      : <button className={`${list.act} ${list.actPrimary}`} disabled={busy} onClick={() => unlock(item)} type="button">{unlockingId === item.id ? "Açılıyor…" : `Aç · ${item.unlock_cost} ⚡`}</button>}
                  </div>
                  {item.is_unlocked && item.details && <button className={list.detailToggle} onClick={() => setExpanded(expanded === item.id ? null : item.id)} type="button">{expanded === item.id ? "Detayı kapat" : "Tüm detayı gör"}</button>}
                  {expanded === item.id && item.details && <div className={styles.details}><section><span>TALEP DETAYI</span><p>{item.details.description}</p><div>{item.details.attributes.map((attribute) => <p key={attribute.key}><small>{attribute.label}</small><strong>{attributeValue(attribute)}</strong></p>)}</div></section><aside><span>İLETİŞİM VE ADRES</span>{item.details.contact.avatar_url && <i className={styles.contactAvatar}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img alt="" loading="lazy" src={item.details.contact.avatar_url} />
                  </i>}<strong>{item.details.contact.name}</strong><a href={`tel:${item.details.contact.phone}`}>{item.details.contact.phone}</a><a href={`mailto:${item.details.contact.email}`}>{item.details.contact.email}</a><p>{item.details.full_address || "Açık adres belirtilmedi"}</p></aside></div>}
                  {offerRequest === item.id && !existingOffer && <div className={styles.offerForm}><div><span>TEKLİFİNİ HAZIRLA</span><strong>Bu talep açıldı; teklif gönderirken ek kontör düşmez.</strong></div><label>Fiyat<input inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} placeholder="Örn. 12500" /><button className={styles.attachButton} onClick={() => setPickerOpen(true)} type="button">🏷 {offerListing ? "Ürünü değiştir" : "Ürün ekle"}</button></label><label>Teklif notu<textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Kapsamı ve teslim süresini açıkla…" /></label>{offerListing && <div className={styles.offerAttach}>
                      {offerListing.cover_url
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img alt="" loading="lazy" src={offerListing.cover_url} />
                        : <i>🏷</i>}
                      <span>Ürün: <b>{offerListing.title}</b> — {offerListing.price ? money(offerListing.price) : "Fiyat sorunuz"}</span>
                      <button aria-label="Ürünü tekliften çıkar" onClick={() => setOfferListing(null)} type="button">✕</button>
                    </div>}<aside><button onClick={closeOffer}>Vazgeç</button><button disabled={busy} onClick={() => submitOffer(item.id)}>{busy ? "Gönderiliyor…" : "Teklifi gönder"}</button></aside></div>}
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

        {view === "listings" && <section className={`${styles.workspaceView} ${styles.viewEnter}`}>
          <header>
            <div><span>VİTRİN ÜRÜNLERİ</span><h1>Ürünlerim</h1><p>Daire, araç ya da mağaza ürünlerini vitrine koy; teklif verirken bir ürünü teklifine ekleyip alıcıya gönder.</p></div>
            <div className={styles.headActions}>
              {user && <Link className={styles.ghostLink} href={`/satici/${user.id}`} target="_blank">Vitrinimi gör ↗</Link>}
              <button onClick={() => openListingForm()}>＋ Ürün ekle</button>
            </div>
          </header>

          <div className={list.summary}>
            <div className={list.summaryItem}><span>ÜRÜN</span><strong>{listings.length}</strong><small>vitrininde</small></div>
            <div className={list.summaryItem}><span>YAYINDA</span><strong>{publishedListings}</strong><small>teklife eklenebilir</small></div>
            <div className={list.summaryItem}><span>FOTOĞRAF</span><strong>{listingPhotos}</strong><small>toplam yüklenen</small></div>
            <div className={list.summaryItem}><span>TEKLİFTE</span><strong>{listingOffers}</strong><small>kez gönderildi</small></div>
          </div>

          <div className={styles.offerTabs}>
            {(["all", "draft", "published", "sold", "archived"] as const).map((value) =>
              <button className={listingScope === value ? styles.tabActive : ""} key={value} onClick={() => setListingScope(value)} type="button">
                {value === "all" ? "Tümü" : listingStatusLabel[value]} <b>{value === "all" ? listings.length : listings.filter((item) => item.status === value).length}</b>
              </button>)}
          </div>

          {visibleListings.length === 0 ? <div className={list.table}><div className={list.empty}>{listings.length === 0 ? "Vitrininde henüz ürün yok. İlk ürününü ekle, fotoğraflarını yükle ve yayına al." : "Bu durumda ürün bulunmuyor."}</div></div> : <div className={styles.listingGrid}>
            {visibleListings.map((item) => <article className={styles.listingCard} key={item.id}>
              <button className={styles.listingCover} onClick={() => openListingDetail(item.id)} type="button">
                {item.cover_url
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img alt={item.title} loading="lazy" src={item.cover_url} />
                  : <span className={styles.listingNoCover}>Fotoğraf yok</span>}
                <span className={styles.listingCoverHint}>Fotoğrafları yönet</span>
              </button>
              <div className={styles.listingBody}>
                <div className={styles.listingTop}>
                  {item.category && <span className={styles.listingCat}>{item.category.icon} {item.category.name}</span>}
                  <small>№ {item.reference}</small>
                </div>
                <h2>{item.title}</h2>
                <div className={styles.listingMeta}>
                  <span>📍 {[item.location.city, item.location.district].filter(Boolean).join(", ") || "Konum belirtilmedi"}</span>
                  {item.offer_count > 0 && <span>📨 {item.offer_count} teklifte</span>}
                </div>
                <div className={styles.listingPrice}><small>FİYAT</small><strong>{item.price ? money(item.price) : "Fiyat sorunuz"}</strong></div>
              </div>
              <footer className={styles.listingFoot}>
                <span className={`${styles.statusChip} ${listingChipClass[item.status]}`}>{listingStatusLabel[item.status]}</span>
                <span className={styles.listingCount}>📷 {item.image_count} fotoğraf</span>
                <div className={styles.listingActions}>
                  <button onClick={() => editListing(item.id)} type="button">Düzenle</button>
                  <button onClick={() => openListingDetail(item.id)} type="button">Fotoğraflar</button>
                  {item.status === "published"
                    ? <button disabled={busy} onClick={() => changeListingStatus(item.id, "draft")} type="button">Yayından kaldır</button>
                    : <button disabled={busy} onClick={() => changeListingStatus(item.id, "published")} type="button">Yayınla</button>}
                </div>
              </footer>
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
              {offerRequest === item.id && editingOffer === offer.id && <div className={styles.offerForm}><label>Fiyat<input inputMode="decimal" onChange={(event) => setPrice(event.target.value)} value={price} /><button className={styles.attachButton} onClick={() => setPickerOpen(true)} type="button">🏷 {offerListing ? "Ürünü değiştir" : "Ürün ekle"}</button></label><label>Teklif notu<textarea onChange={(event) => setMessage(event.target.value)} value={message} /></label>{offerListing && <div className={styles.offerAttach}>
                {offerListing.cover_url
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img alt="" loading="lazy" src={offerListing.cover_url} />
                  : <i>🏷</i>}
                <span>Ürün: <b>{offerListing.title}</b> — {offerListing.price ? money(offerListing.price) : "Fiyat sorunuz"}</span>
                <button aria-label="Ürünü tekliften çıkar" onClick={() => setOfferListing(null)} type="button">✕</button>
              </div>}<aside><button onClick={closeOffer}>Vazgeç</button><button disabled={busy} onClick={() => submitOffer(item.id)}>{busy ? "Güncelleniyor…" : "Güncelle"}</button></aside></div>}
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

        {view === "profile" && <section className={`${styles.workspaceView} ${styles.viewEnter}`}><header><div><span>DOĞRULANMIŞ FİRMA KARTI</span><h1>Firma profilim</h1><p>Müşterilerin vitrinde gördüğü kimlik, hizmet ve bölge özeti.</p></div><b className={styles.featuredBadge}>✓ Profil onaylı</b></header>
          <div className={styles.brandBanner}>
            {profile.profile?.banner_url
              // eslint-disable-next-line @next/next/no-img-element
              ? <img alt="Vitrin kapak görseli" loading="lazy" src={profile.profile.banner_url} />
              : <span className={styles.brandEmpty}>Vitrin kapağı ekle · geniş fotoğraf (3:1) müşteriyi karşılayan ilk görseldir</span>}
            <label className={styles.brandUpload}>
              <input accept="image/jpeg,image/png,image/webp" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) uploadBranding("banner", file); event.target.value = ""; }} type="file" />
              <span>{bannerUploading ? "Yükleniyor…" : profile.profile?.banner_url ? "Kapağı değiştir" : "＋ Kapak ekle"}</span>
            </label>
            {profile.profile?.banner_url && <button aria-label="Kapağı kaldır" className={styles.brandRemove} disabled={bannerUploading} onClick={() => removeBranding("banner")} type="button">✕</button>}
          </div>
          <div className={styles.profileHero}><div className={styles.logoSlot}><div className={styles.profileAvatar}>{profile.profile?.logo_url
            // eslint-disable-next-line @next/next/no-img-element
            ? <img alt="Firma logosu" className={styles.logoImage} loading="lazy" src={profile.profile.logo_url} />
            : (profile.profile?.company_name || user?.name || "A").slice(0, 2).toLocaleUpperCase("tr-TR")}</div>
            <label className={styles.logoUpload}>
              <input accept="image/jpeg,image/png,image/webp" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) uploadBranding("logo", file); event.target.value = ""; }} type="file" />
              <span>{logoUploading ? "…" : "✎"}</span>
            </label>
            {profile.profile?.logo_url && <button aria-label="Logoyu kaldır" className={styles.logoRemove} disabled={logoUploading} onClick={() => removeBranding("logo")} type="button">✕</button>}
          </div><div><span>{profile.profile?.profile_type === "company" ? "FİRMA HESABI" : "BİREYSEL PROFESYONEL"}</span><h2>{profile.profile?.company_name || user?.name}</h2><p>{profile.profile?.description || "Firma açıklaması henüz eklenmedi."}</p><div><b>✓ Kimlik doğrulandı</b><b>✓ Yönetici onaylı</b></div></div><aside><small>HESAP SAHİBİ</small><strong>{user?.name}</strong><span>{user?.email}</span>{profile.profile?.reviewed_at && <em>Onay: {new Date(profile.profile.reviewed_at).toLocaleDateString("tr-TR")}</em>}</aside></div><div className={styles.profileGrid}><article><header><i>▦</i><div><span>HİZMET KATEGORİLERİ</span><strong>{profile.categories.length} kategori</strong></div></header><div>{profile.categories.map((item) => <b key={item.id} style={{ color: item.color, background: `${item.color}14` }}>{item.icon} {item.name}</b>)}</div><button onClick={() => selectView("services")}>Hizmet kataloğunu yönet →</button></article><article><header><i>📍</i><div><span>HİZMET BÖLGELERİ</span><strong>{new Set(profile.locations.map((item) => item.city_id)).size} il · {profile.locations.length} ilçe</strong></div></header><div>{profile.locations.slice(0, 8).map((item) => <b key={item.district_id}>📍 {item.city_name}, {item.district_name}</b>)}</div><button onClick={() => { setFilter("all"); selectView("requests"); }}>Bölgedeki talepleri gör →</button></article><article><header><i>✦</i><div><span>VİTRİN DURUMU</span><strong>{featured.is_featured ? "Öne çıkan profil" : "Standart görünürlük"}</strong></div></header><p>{featured.is_featured ? "Profilin ana sayfa vitrininde daha görünür durumda." : "Kontör kullanarak profilini ana sayfadaki öne çıkanlara taşıyabilirsin."}</p><button onClick={() => selectView("visibility")}>Görünürlüğü yönet →</button></article></div></section>}

        {view === "visibility" && <section className={`${styles.workspaceView} ${styles.viewEnter}`}><header><div><span>VİTRİN VE GÖRÜNÜRLÜK</span><h1>Öne çıkanlarda yer al</h1><p>Profilini ana sayfadaki öne çıkan profesyoneller bölümüne taşı.</p></div>{featured.is_featured && <b className={styles.featuredBadge}>★ {featured.featured_until ? new Date(featured.featured_until).toLocaleDateString("tr-TR") : "Aktif"} tarihine kadar</b>}</header><div className={styles.visibilityHero}><div><span>KONTÖRLE GÖRÜNÜRLÜK</span><h2>Daha çok müşteri tarafından keşfedil.</h2><p>Öne çıkarılan profiller ana sayfa vitrininde sponsorlu etiketiyle gösterilir.</p><ul><li>✓ Ana sayfa profesyonel vitrini</li><li>✓ Şeffaf sponsorlu ibaresi</li><li>✓ Puan ve hizmet görünürlüğü</li></ul></div><aside><small>MEVCUT BAKİYE</small><strong>⚡ {credits.balance}</strong><Link href="/kontor-yukle">Kontör yükle →</Link></aside></div><div className={styles.packageGrid}>{Object.entries(featured.packages).map(([key, item], index) => <article className={index === 1 ? styles.popular : ""} key={key}>{index === 1 && <b>EN AVANTAJLI</b>}<span>{item.label.toUpperCase()}</span><strong>{item.credits}<small> kontör</small></strong><p>{item.days} gün boyunca vitrin görünürlüğü</p><button disabled={busy || credits.balance < item.credits} onClick={() => buyPromotion(key)}>{credits.balance < item.credits ? "Bakiye yetersiz" : "Paketi etkinleştir"}</button></article>)}</div><section className={styles.ledger}><header><div><span>HESAP HAREKETLERİ</span><h2>Kontör geçmişi</h2></div><Link href="/kontor-yukle">Kontör yükle →</Link></header>{credits.transactions.length === 0 ? <p>Henüz kontör hareketi bulunmuyor.</p> : credits.transactions.map((transaction) => <div key={transaction.id}><i className={transaction.amount < 0 ? styles.spend : ""}>{transaction.amount < 0 ? "−" : "+"}</i><p><strong>{transaction.reference_type === "seller_promotion" ? "Vitrinde öne çıkarma" : transaction.type === "spend" ? "Teklif / detay bedeli" : transaction.type === "bonus" ? "Paket bonusu" : "Kontör yükleme"}</strong><small>{transaction.metadata?.public_reference ?? transaction.metadata?.merchant_oid ?? (transaction.metadata?.days ? `${transaction.metadata.days} gün` : "Hesap hareketi")} · {date(transaction.created_at)}</small></p><b>{transaction.amount > 0 ? "+" : ""}{transaction.amount}<small>kalan {transaction.balance_after}</small></b></div>)}</section></section>}
      </section>
    </div>
    <Modal onClose={() => setShowPortfolioForm(false)} open={showPortfolioForm} size="xl" subtitle="Müşteriler bu bilgileri vitrininde görür." title={portfolioForm.id ? "Çalışmayı düzenle" : "Yeni çalışma ekle"} footer={<>
      <button className={styles.modalGhost} onClick={() => setShowPortfolioForm(false)} type="button">Vazgeç</button>
      <button className={styles.modalPrimary} disabled={busy || !portfolioForm.title.trim() || !portfolioForm.description.trim()} onClick={savePortfolio} type="button">{busy ? "Kaydediliyor…" : portfolioForm.id ? "Güncelle" : "Çalışmayı ekle"}</button>
    </>}>
      <div className={styles.builder}>
        <div className={styles.builderMain}>
          <section className={styles.formBlock}>
            <header><i>1</i><div><strong>Temel bilgiler</strong><small>Vitrin kartının üst kısmında görünür.</small></div></header>
            <div className={styles.formGrid}>
              <label className={styles.wide}>Başlık<input data-autofocus maxLength={140} onChange={(event) => setPortfolioForm({ ...portfolioForm, title: event.target.value })} placeholder="Örn. Kadıköy 3+1 komple daire boyası" value={portfolioForm.title} /><small>{portfolioForm.title.length} / 140</small></label>
              <label>Kategori<select onChange={(event) => setPortfolioForm({ ...portfolioForm, category_id: event.target.value })} value={portfolioForm.category_id}><option value="">Seçilmedi</option>{profile.categories.map((item) => <option key={item.id} value={item.id}>{item.icon} {item.name}</option>)}</select></label>
              <label>Konum<input maxLength={120} onChange={(event) => setPortfolioForm({ ...portfolioForm, location: event.target.value })} placeholder="İstanbul, Kadıköy" value={portfolioForm.location} /></label>
              <label>Tamamlanma<input onChange={(event) => setPortfolioForm({ ...portfolioForm, completed_at: event.target.value })} type="date" value={portfolioForm.completed_at} /></label>
            </div>
          </section>

          <section className={styles.formBlock}>
            <header><i>2</i><div><strong>İş künyesi</strong><small>Müşteri kapsamı tek bakışta anlasın.</small></div></header>
            <div className={styles.formGrid}>
              <label>Süre<input maxLength={60} onChange={(event) => setPortfolioForm({ ...portfolioForm, duration: event.target.value })} placeholder="Örn. 4 gün" value={portfolioForm.duration} /></label>
              <label>Alan / ölçü<input maxLength={60} onChange={(event) => setPortfolioForm({ ...portfolioForm, area: event.target.value })} placeholder="Örn. 120 m²" value={portfolioForm.area} /></label>
              <label>İş bedeli (₺)<input inputMode="decimal" onChange={(event) => setPortfolioForm({ ...portfolioForm, budget: event.target.value })} placeholder="Örn. 38000" value={portfolioForm.budget} /><small>Boş bırakabilirsin.</small></label>
              <label>Müşteri tipi<input maxLength={60} onChange={(event) => setPortfolioForm({ ...portfolioForm, client_type: event.target.value })} placeholder="Örn. Konut / Ofis" value={portfolioForm.client_type} /></label>
            </div>
          </section>

          <section className={styles.formBlock}>
            <header><i>3</i><div><strong>Anlatım</strong><small>Kapsam ve yapılan işlerin listesi.</small></div></header>
            <div className={styles.formGrid}>
              <label className={styles.wide}>Açıklama<textarea maxLength={2000} onChange={(event) => setPortfolioForm({ ...portfolioForm, description: event.target.value })} placeholder="Kapsamı, kullanılan malzemeleri ve süreyi anlat…" value={portfolioForm.description} /><small>{portfolioForm.description.length} / 2000</small></label>
              <label className={styles.wide}>Yapılan işler<textarea onChange={(event) => setPortfolioForm({ ...portfolioForm, highlights: event.target.value })} placeholder={"Her satıra bir madde yaz\nÖrn. Duvar hazırlığı ve astar\nÖrn. İki kat silikonlu boya"} rows={4} value={portfolioForm.highlights} /><small>{workHighlights.length} / 8 madde · her satır ayrı madde olur.</small></label>
            </div>
          </section>
        </div>

        <aside className={styles.builderSide}>
          <span className={styles.previewTag}>CANLI ÖNİZLEME</span>
          <article className={styles.previewCard}>
            <div className={styles.previewCover} style={workCategory ? { background: `linear-gradient(135deg, ${workCategory.color}, #4f46e5)` } : undefined}><span>{workCategory?.icon ?? "🖼"}</span></div>
            <div className={styles.previewBody}>
              <div className={styles.previewTop}>
                {workCategory && <b style={{ background: `${workCategory.color}18`, color: workCategory.color }}>{workCategory.icon} {workCategory.name}</b>}
                {portfolioForm.completed_at && <small>{new Date(portfolioForm.completed_at).toLocaleDateString("tr-TR", { month: "long", year: "numeric" })}</small>}
              </div>
              <h4>{portfolioForm.title || "Çalışma başlığı"}</h4>
              {portfolioForm.location && <small className={styles.previewPlace}>📍 {portfolioForm.location}</small>}
              <p>{portfolioForm.description || "Açıklaman burada görünecek."}</p>
              {(portfolioForm.duration || portfolioForm.area || portfolioForm.budget || portfolioForm.client_type) && <ul className={styles.previewSpecs}>
                {portfolioForm.duration && <li>⏱ {portfolioForm.duration}</li>}
                {portfolioForm.area && <li>◱ {portfolioForm.area}</li>}
                {portfolioForm.budget && <li>◆ ₺{portfolioForm.budget}</li>}
                {portfolioForm.client_type && <li>◇ {portfolioForm.client_type}</li>}
              </ul>}
              {workHighlights.length > 0 && <ul className={styles.previewDone}>{workHighlights.slice(0, 3).map((line, position) => <li key={position}>{line}</li>)}</ul>}
            </div>
          </article>
          <ul className={styles.previewTips}>
            <li>Kaydettikten sonra çalışmayı açıp <b>8 adede kadar fotoğraf</b> yükleyebilirsin.</li>
            <li>Künye alanlarını doldurmak vitrindeki kartı zenginleştirir.</li>
            <li>Yapılan işler listesi müşterinin kapsamı anlamasını kolaylaştırır.</li>
          </ul>
        </aside>
      </div>
    </Modal>

    {openWork && <Modal onClose={() => setOpenWork(null)} open size="lg" subtitle={openWork.is_published ? "Vitrinde yayında" : "Taslak — vitrinde görünmüyor"} title={openWork.title} footer={<>
      <button className={styles.modalGhost} disabled={busy} onClick={() => togglePublished(openWork)} type="button">{openWork.is_published ? "Vitrinden gizle" : "Vitrinde yayınla"}</button>
      <button className={styles.modalGhost} onClick={() => { setOpenWork(null); openPortfolioForm(openWork); }} type="button">Düzenle</button>
      {user && <Link className={styles.modalPrimary} href={`/satici/${user.id}`} target="_blank">Vitrinde gör ↗</Link>}
    </>}>
      <WorkViewer work={openWork} actions={<>
        <label className={styles.uploadInline}>
          <input accept="image/jpeg,image/png,image/webp" hidden multiple onChange={(event) => { const files = Array.from(event.target.files ?? []); if (files.length) uploadPortfolioImages(openWork, files); event.target.value = ""; }} type="file" />
          <span>{uploadingFor === openWork.id ? "Yükleniyor…" : "＋ Görsel ekle (çoklu seçebilirsin)"}</span>
        </label>
        <span className={styles.uploadHint}>{openWork.images.length} / 8 görsel · JPEG, PNG veya WebP · en fazla 4 MB</span>
        {openWork.images.length > 0 && <div className={styles.imageManager}>{openWork.images.map((image) => <button key={image.id} onClick={() => deletePortfolioImage(image)} type="button">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt="" loading="lazy" src={image.url} /><em>✕</em>
        </button>)}</div>}
      </>} />
    </Modal>}
    <Modal onClose={() => setShowServiceForm(false)} open={showServiceForm} size="xl" subtitle="Kapak görselini kaydettikten sonra kart üzerinden ekleyebilirsin." title={serviceForm.id ? "Hizmeti düzenle" : "Yeni hizmet ekle"} footer={<>
      <button className={styles.modalGhost} onClick={() => setShowServiceForm(false)} type="button">Vazgeç</button>
      <button className={styles.modalPrimary} disabled={busy} onClick={submitService} type="button">{busy ? "Kaydediliyor…" : "Hizmeti kaydet"}</button>
    </>}>
      <div className={styles.builder}>
        <div className={styles.builderMain}>
          <section className={styles.formBlock}>
            <header><i>1</i><div><strong>Hizmet tanımı</strong><small>Mağaza kartında görünen başlık ve kapsam.</small></div></header>
            <div className={styles.formGrid}>
              <label>Kategori<select onChange={(event) => setServiceForm({ ...serviceForm, category_id: event.target.value })} value={serviceForm.category_id}>{profile.categories.map((item) => <option key={item.id} value={item.id}>{item.icon} {item.name}</option>)}</select></label>
              <label>Hizmet başlığı<input data-autofocus onChange={(event) => setServiceForm({ ...serviceForm, title: event.target.value })} placeholder="Örn. Anahtar teslim banyo yenileme" value={serviceForm.title} /></label>
              <label className={styles.wide}>Açıklama<textarea onChange={(event) => setServiceForm({ ...serviceForm, description: event.target.value })} placeholder="Hizmet kapsamını ve çalışma biçimini anlat…" value={serviceForm.description} /><small>{serviceForm.description.length} / 2000 · en az 30 karakter</small></label>
            </div>
          </section>

          <section className={styles.formBlock}>
            <header><i>2</i><div><strong>Fiyat ve teslim</strong><small>Müşteri beklentisini baştan netleştirir.</small></div></header>
            <div className={styles.formGrid}>
              <label>Başlangıç fiyatı (₺)<input inputMode="decimal" onChange={(event) => setServiceForm({ ...serviceForm, price_from: event.target.value })} placeholder="Örn. 5000" value={serviceForm.price_from} /><small>Kartta &quot;başlangıç&quot; olarak gösterilir.</small></label>
              <label>Teslim süresi<input onChange={(event) => setServiceForm({ ...serviceForm, delivery_time: event.target.value })} placeholder="Örn. 3–5 gün" value={serviceForm.delivery_time} /></label>
              <label className={`${styles.wide} ${styles.toggleRow}`}><input checked={serviceForm.is_active} onChange={(event) => setServiceForm({ ...serviceForm, is_active: event.target.checked })} type="checkbox" /> Vitrinde yayında</label>
            </div>
          </section>
        </div>

        <aside className={styles.builderSide}>
          <span className={styles.previewTag}>CANLI ÖNİZLEME</span>
          <article className={styles.previewCard}>
            <div className={styles.previewCover} style={serviceCategory ? { background: `linear-gradient(135deg, ${serviceCategory.color}, #06b6d4)` } : undefined}><span>{serviceCategory?.icon ?? "▦"}</span></div>
            <div className={styles.previewBody}>
              <div className={styles.previewTop}>
                {serviceCategory && <b style={{ background: `${serviceCategory.color}18`, color: serviceCategory.color }}>{serviceCategory.icon} {serviceCategory.name}</b>}
                {!serviceForm.is_active && <small>Taslak</small>}
              </div>
              <h4>{serviceForm.title || "Hizmet başlığı"}</h4>
              <p>{serviceForm.description || "Hizmet kapsamın burada görünecek."}</p>
              {(serviceForm.price_from || serviceForm.delivery_time) && <ul className={styles.previewSpecs}>
                {serviceForm.price_from && <li>BAŞLANGIÇ ₺{serviceForm.price_from}</li>}
                {serviceForm.delivery_time && <li>◷ {serviceForm.delivery_time}</li>}
              </ul>}
            </div>
          </article>
          <ul className={styles.previewTips}>
            <li>Kaydettikten sonra hizmet kartına <b>kapak görseli</b> ekleyebilirsin.</li>
            <li>Başlangıç fiyatı yazan kartlar mağaza sıralamasında daha çok tıklanır.</li>
            <li>Yayından kaldırdığın hizmet vitrinde görünmez, panelde durur.</li>
          </ul>
        </aside>
      </div>
    </Modal>

    <Modal onClose={closeListingForm} open={showListingForm} size="xl" subtitle="Alıcılar bu bilgileri vitrininde ve gönderdiğin teklifte görür." title={listingForm.id ? "Ürünü düzenle" : "Yeni ürün ekle"} footer={<>
      <button className={styles.modalGhost} onClick={closeListingForm} type="button">Vazgeç</button>
      <button className={styles.modalPrimary} disabled={busy || !listingReady} onClick={saveListing} type="button">{busy ? "Kaydediliyor…" : listingForm.id ? "Güncelle" : "Ürünü ekle"}</button>
    </>}>
      <div className={`${styles.builder} ${styles.listingBuilder}`}>
        <div className={styles.builderMain}>
          <section className={styles.formSection}>
            <header><span>ÜRÜN BİLGİLERİ</span><small>Kategori seçimi hangi özelliklerin sorulacağını belirler.</small></header>
            <div className={styles.formGrid}>
              <label className={styles.wide}>Kategori
                <select data-autofocus onChange={(event) => { setListingForm({ ...listingForm, category_slug: event.target.value }); setListingValues({}); }} value={listingForm.category_slug}>
                  <option value="">Kategori seç</option>
                  {categoryGroups.map((group) => <optgroup key={group.root} label={group.root}>
                    {group.rows.map((row) => <option key={row.slug} value={row.slug}>{`${"— ".repeat(row.depth)}${row.icon ? `${row.icon} ` : ""}${row.name}`}</option>)}
                  </optgroup>)}
                </select>
                <small>{catalog ? `${flatCategories.length} kategori · daire, araç, mağaza ürünü hepsi buradan` : "Kategoriler yükleniyor…"}</small>
              </label>
              <label className={styles.wide}>Başlık<input maxLength={140} onChange={(event) => setListingForm({ ...listingForm, title: event.target.value })} placeholder="Örn. Kadıköy Moda'da 3+1 deniz manzaralı daire" value={listingForm.title} /><small>{listingForm.title.trim().length} / 140 · en az 10 karakter</small></label>
              <label className={styles.wide}>Açıklama<textarea maxLength={5000} onChange={(event) => setListingForm({ ...listingForm, description: event.target.value })} placeholder="Ürünün durumunu, kapsamını ve teslim koşullarını anlat…" value={listingForm.description} /><small>{listingForm.description.trim().length} / 5000 · en az 20 karakter</small></label>
            </div>
          </section>

          <section className={styles.formSection}>
            <header><span>FİYAT VE KONUM</span><small>Fiyat alıcıya en büyük puntoyla görünür; konum eşleşmeyi belirler.</small></header>
            <div className={styles.formGrid}>
              <label className={styles.wide}>Fiyat (₺)<input inputMode="decimal" onChange={(event) => setListingForm({ ...listingForm, price: event.target.value })} placeholder="Örn. 4750000" value={listingForm.price} /><small>Boş bırakırsan “Fiyat sorunuz” yazar.</small></label>
              <label>Şehir<select onChange={(event) => setListingForm({ ...listingForm, city_id: event.target.value, district_id: "" })} value={listingForm.city_id}><option value="">Seçilmedi</option>{(catalog?.cities ?? []).map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}</select></label>
              <label>İlçe<select disabled={!listingCity} onChange={(event) => setListingForm({ ...listingForm, district_id: event.target.value })} value={listingForm.district_id}><option value="">Seçilmedi</option>{(listingCity?.districts ?? []).map((district) => <option key={district.id} value={district.id}>{district.name}</option>)}</select></label>
            </div>
          </section>

          <section className={styles.formSection}>
            <header><span>İLAN ÖZELLİKLERİ</span><small>Alıcının ilanda gördüğü özellik tablosu buradan oluşur.</small></header>
            {!listingForm.category_slug ? <p className={styles.formHint}>Önce bir kategori seç; o kategorinin soruları burada açılır.</p>
              : listingFields.slug !== listingForm.category_slug ? <p className={styles.formHint}>Kategori soruları yükleniyor…</p>
              : visibleListingFields.length === 0 ? <p className={styles.formHint}>Bu kategoride ek özellik tanımlı değil.</p>
              : <div className={styles.formGrid}>{visibleListingFields.map(renderListingField)}</div>}
          </section>

          <section className={styles.formSection}>
            <header><span>FOTOĞRAFLAR</span><small>İlk sıradaki fotoğraf kapak olur; yayınlamak için en az bir tane gerekir.</small></header>
            {!editingListing ? <p className={styles.formHint}>Ürünü kaydettiğinde fotoğraf yöneticisi hemen açılır; {listingMeta.max_images} adede kadar fotoğraf yükleyebilirsin.</p>
              : <div className={styles.photoBlock}>
                {editingListing.images.length < listingMeta.max_images
                  ? <label className={styles.uploadInline}>
                    <input accept="image/jpeg,image/png,image/webp" hidden multiple onChange={(event) => { const files = Array.from(event.target.files ?? []); if (files.length) uploadListingImages(editingListing, files); event.target.value = ""; }} type="file" />
                    <span>{listingUploading ? "Yükleniyor…" : "＋ Fotoğraf ekle (çoklu seçebilirsin)"}</span>
                  </label>
                  : <span className={styles.uploadHint}>Fotoğraf sınırına ulaştın; yeni eklemek için birini kaldır.</span>}
                <span className={styles.uploadHint}>{editingListing.images.length} / {listingMeta.max_images} fotoğraf · JPEG, PNG veya WebP · en fazla 8 MB</span>
                {editingListing.images.length > 0 && <div className={styles.shotGrid}>
                  {editingListing.images.map((image, index) => <figure key={image.id}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img alt="" loading="lazy" src={image.url} />
                    {index === 0
                      ? <b>KAPAK</b>
                      : <button className={styles.shotCover} disabled={busy} onClick={() => makeListingCover(editingListing, image.id)} type="button">Kapak yap</button>}
                    <button aria-label="Fotoğrafı kaldır" className={styles.shotRemove} onClick={() => deleteListingImage(editingListing, image.id)} type="button">✕</button>
                  </figure>)}
                </div>}
              </div>}
          </section>
        </div>

        <aside className={styles.builderSide}>
          <span className={styles.previewTag}>CANLI ÖNİZLEME</span>
          <article className={styles.previewCard}>
            <div className={styles.previewCover} style={listingCategory ? { background: `linear-gradient(135deg, ${listingCategory.color}, #4f46e5)` } : undefined}><span>{listingCategory?.icon ?? "🏷"}</span></div>
            <div className={styles.previewBody}>
              <div className={styles.previewTop}>
                {listingCategory && <b style={{ background: `${listingCategory.color}18`, color: listingCategory.color }}>{listingCategory.icon} {listingCategory.name}</b>}
                <small>{listingForm.id ? "Düzenleniyor" : "Yeni"}</small>
              </div>
              <h4>{listingForm.title || "Ürün başlığı"}</h4>
              {(listingCity || listingDistrict) && <small className={styles.previewPlace}>📍 {[listingCity?.name, listingDistrict?.name].filter(Boolean).join(", ")}</small>}
              <p>{listingForm.description || "Ürün açıklaman burada görünecek."}</p>
              <ul className={styles.previewSpecs}>
                <li>{listingForm.price.trim() ? money(listingForm.price) : "Fiyat sorunuz"}</li>
                {visibleListingFields.slice(0, 5).map((field) => {
                  const raw = listingValues[field.key];
                  if (raw === undefined || raw === null || raw === "" || (Array.isArray(raw) && raw.length === 0)) return null;
                  return <li key={field.key}>{field.label}: {Array.isArray(raw) ? raw.join(", ") : typeof raw === "boolean" ? (raw ? "Evet" : "Hayır") : `${raw}${field.unit ? ` ${field.unit}` : ""}`}</li>;
                })}
              </ul>
            </div>
          </article>
          <ul className={styles.previewTips}>
            <li>Kaydettikten sonra ürüne <b>{listingMeta.max_images} adede kadar fotoğraf</b> yükleyebilirsin.</li>
            <li>Yayınlamak için en az bir fotoğraf gerekir; ürün önce taslak olarak kaydedilir.</li>
            <li>Yayındaki ürünleri teklif verirken <b>“Ürün ekle”</b> düğmesiyle alıcıya gönderirsin.</li>
          </ul>
        </aside>
      </div>
    </Modal>

    {openListing && !showListingForm && <Modal onClose={() => setOpenListing(null)} open size="lg" subtitle={`${listingStatusLabel[openListing.status]} · ${openListing.reference}`} title={openListing.title} footer={<>
      <button className={styles.modalGhost} disabled={busy} onClick={() => deleteListing(openListing.id)} type="button">Sil</button>
      <button className={styles.modalGhost} onClick={() => editListing(openListing.id)} type="button">Düzenle</button>
      {openListing.status === "published"
        ? <>
          <button className={styles.modalGhost} disabled={busy} onClick={() => changeListingStatus(openListing.id, "sold")} type="button">Satıldı olarak işaretle</button>
          <button className={styles.modalGhost} disabled={busy} onClick={() => changeListingStatus(openListing.id, "draft")} type="button">Yayından kaldır</button>
        </>
        : <button className={styles.modalPrimary} disabled={busy} onClick={() => changeListingStatus(openListing.id, "published")} type="button">Yayına al</button>}
    </>}>
      <div className={styles.listingViewer}>
        <div className={styles.listingShots}>
          {openListing.images.length < listingMeta.max_images
            ? <label className={styles.uploadInline}>
              <input accept="image/jpeg,image/png,image/webp" hidden multiple onChange={(event) => { const files = Array.from(event.target.files ?? []); if (files.length) uploadListingImages(openListing, files); event.target.value = ""; }} type="file" />
              <span>{listingUploading ? "Yükleniyor…" : "＋ Fotoğraf ekle (çoklu seçebilirsin)"}</span>
            </label>
            : <span className={styles.uploadHint}>Fotoğraf sınırına ulaştın; yeni eklemek için birini kaldır.</span>}
          <span className={styles.uploadHint}>{openListing.images.length} / {listingMeta.max_images} fotoğraf · JPEG, PNG veya WebP · en fazla 8 MB · ilk sıradaki kapaktır</span>
          {openListing.images.length === 0 ? <p className={styles.formHint}>Henüz fotoğraf yok. Yayınlamak için en az bir fotoğraf gerekir.</p> : <div className={styles.shotGrid}>
            {openListing.images.map((image, index) => <figure key={image.id}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt="" loading="lazy" src={image.url} />
              {index === 0
                ? <b>KAPAK</b>
                : <button className={styles.shotCover} disabled={busy} onClick={() => makeListingCover(openListing, image.id)} type="button">Kapak yap</button>}
              <button aria-label="Fotoğrafı kaldır" className={styles.shotRemove} onClick={() => deleteListingImage(openListing, image.id)} type="button">✕</button>
            </figure>)}
          </div>}
        </div>
        <aside className={styles.listingSide}>
          <div className={list.cardPrice}><small>FİYAT</small><strong>{openListing.price ? money(openListing.price) : "Fiyat sorunuz"}</strong></div>
          <p className={styles.listingText}>{openListing.description}</p>
          {openListing.attributes.length > 0 && <dl className={styles.listingSpecs}>
            {openListing.attributes.map((row) => <div key={row.key}><dt>{row.label}</dt><dd>{attributeValue(row)}</dd></div>)}
          </dl>}
        </aside>
      </div>
    </Modal>}

    <Modal onClose={() => setPickerOpen(false)} open={pickerOpen} size="lg" subtitle="Yayındaki ürünlerinden birini teklifine ekle; alıcı teklifin içinde görür." title="Ürün seç">
      {pickable === null ? <p className={styles.formHint}>Ürünlerin yükleniyor…</p>
        : pickable.length === 0 ? <div className={styles.pickerEmpty}>
          <strong>Yayında ürünün yok.</strong>
          <p>Teklife ekleyebilmek için önce “Ürünlerim” bölümünden bir ürün ekle, fotoğrafını yükle ve yayına al.</p>
          <button className={styles.modalPrimary} onClick={() => { setPickerOpen(false); selectView("listings"); }} type="button">Ürünlerime git</button>
        </div>
        : <div className={styles.pickerGrid}>
          {pickable.map((item) => <button aria-pressed={offerListing?.id === item.id} className={`${styles.pickerCard} ${offerListing?.id === item.id ? styles.pickerOn : ""}`} key={item.id} onClick={() => { setOfferListing({ id: item.id, title: item.title, price: item.price, cover_url: item.cover_url }); setPickerOpen(false); }} type="button">
            <span className={styles.pickerCover}>
              {item.cover_url
                // eslint-disable-next-line @next/next/no-img-element
                ? <img alt="" loading="lazy" src={item.cover_url} />
                : <i>🏷</i>}
              {offerListing?.id === item.id && <em className={styles.pickerCheck}>✓</em>}
            </span>
            <span className={styles.pickerText}><strong>{item.title}</strong><small>{item.price ? money(item.price) : "Fiyat sorunuz"}</small></span>
          </button>)}
        </div>}
    </Modal>
  </PageShell>;
}
