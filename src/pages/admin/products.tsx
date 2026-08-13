import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Copy,
  Eye,
  Images,
  ImageOff,
  Layers,
  Package,
  Pencil,
  Plus,
  Power,
  PowerOff,
  RefreshCw,
  Search,
} from "lucide-react";
import { Link, useLocation, useSearch } from "wouter";
import { DentalSelect } from "@/components/dental/Select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLanguage } from "@/context/LanguageContext";
import { useStore } from "@/context/StoreContext";
import { useToast } from "@/hooks/use-toast";
import {
  createAdminProduct,
  getAdminCategories,
  getAdminProducts,
  uploadAdminProductImage,
  updateAdminProduct,
  type AdminCategory,
  type AdminProduct,
  type AdminProductInput,
  type AdminProductSortDirection,
  type AdminProductSortKey,
  type AdminProductStatus,
  type AdminProductPurchaseMode,
  type AdminProductStockFilter,
  type AdminProductTypeFilter,
} from "@/services/adminCatalog";
import { getAdminBrands, type AdminBrand } from "@/services/adminBrands";
import { ApiError, resolveApiAssetUrl } from "@/services/http";
import { effectivePrice, effectiveStock } from "@/lib/adminProductFilters";
import { AdminLayout } from "./_components/AdminLayout";
import { AdminPageHeader, AdminStatusBadge, AdminTableShell } from "./_components/admin-ui";
import { ProductImageUploader } from "./_components/ProductImageUploader";
import type { StatusTone } from "./admin-data";

type ProductForm = {
  name: string;
  sku: string;
  brandId: string;
  categoryId: string;
  price: string;
  stock: string;
  status: AdminProductStatus;
  imageUrl: string;
  description: string;
  featured: "true" | "false";
  isWeeklyOffer: "true" | "false";
  isBestSeller: "true" | "false";
  isNewArrival: "true" | "false";
  isHotDeal: "true" | "false";
  isFastDelivery: "true" | "false";
  purchaseMode: AdminProductPurchaseMode;
};

type ProductFormErrors = Partial<Record<keyof ProductForm, string>>;

const NONE_VALUE = "none";
const PAGE_SIZE = 20;
const EMPTY_FORM: ProductForm = {
  name: "",
  sku: "",
  brandId: NONE_VALUE,
  categoryId: NONE_VALUE,
  price: "",
  stock: "",
  status: "ACTIVE",
  imageUrl: "",
  description: "",
  featured: "false",
  isWeeklyOffer: "false",
  isBestSeller: "false",
  isNewArrival: "false",
  isHotDeal: "false",
  isFastDelivery: "false",
  purchaseMode: "STANDARD",
};
const STATUS_TONES: Record<AdminProductStatus, StatusTone> = {
  ACTIVE: "green",
  LOW_STOCK: "amber",
  OUT_OF_STOCK: "red",
  DRAFT: "slate",
  INACTIVE: "slate",
};

function validImageUrl(value: string) {
  if (!value.trim()) return true;
  if (
    /^\/api\/uploads\/product-images\/product-[a-f0-9-]+\.(?:jpg|png|webp)$/.test(
      value.trim()
    )
  ) {
    return true;
  }
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function toForm(product: AdminProduct): ProductForm {
  return {
    name: product.name,
    sku: product.sku,
    brandId: product.brand?.id ?? NONE_VALUE,
    categoryId: product.category?.id ?? NONE_VALUE,
    price: product.price === null ? "" : String(product.price),
    stock: String(product.stock),
    status: product.status,
    imageUrl: product.imageUrl ?? "",
    description: product.description ?? "",
    featured: product.featured ? "true" : "false",
    isWeeklyOffer: product.isWeeklyOffer ? "true" : "false",
    isBestSeller: product.isBestSeller ? "true" : "false",
    isNewArrival: product.isNewArrival ? "true" : "false",
    isHotDeal: product.isHotDeal ? "true" : "false",
    isFastDelivery: product.isFastDelivery ? "true" : "false",
    purchaseMode: product.purchaseMode,
  };
}

function ProductField({
  id,
  label,
  value,
  onChange,
  error,
  type = "text",
  min,
  step,
  maxLength,
}: {
  id: "name" | "sku" | "price" | "stock" | "imageUrl";
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  type?: string;
  min?: number;
  step?: number;
  maxLength?: number;
}) {
  return (
    <label htmlFor={`product-${id}`} className="block">
      <span className="text-sm font-bold text-[#050505]">{label}</span>
      <input
        id={`product-${id}`}
        type={type}
        min={min}
        step={step}
        value={value}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
        className={`mt-2 h-[50px] w-full rounded-[14px] border bg-white px-4 text-sm font-semibold outline-none transition focus:ring-4 ${error ? "border-[#B42318]/55 focus:border-[#B42318] focus:ring-[#B42318]/10" : "border-[#050505]/10 focus:border-[#D4A72C] focus:ring-[#D4A72C]/10"}`}
      />
      {error && <p className="mt-1.5 text-xs font-semibold text-[#B42318]">{error}</p>}
    </label>
  );
}

function IconActionButton({
  icon,
  label,
  onClick,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  href?: string;
}) {
  const classes = "inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#050505]/10 bg-white text-[#050505] transition hover:border-[#D4A72C]/60 hover:bg-[#FFF7D6] dark:hover:border-[#D4A72C]/40 dark:hover:bg-white/[0.05] dark:hover:text-[#F6D85D]";
  if (href) {
    return (
      <Link href={href} aria-label={label} title={label} className={classes}>
        {icon}
      </Link>
    );
  }
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className={classes}>
      {icon}
    </button>
  );
}

function ProductRowThumbnail({ imageUrl }: { imageUrl?: string | null }) {
  const [hasImageError, setHasImageError] = useState(false);
  const resolvedUrl = imageUrl ? resolveApiAssetUrl(imageUrl) ?? imageUrl : null;

  return resolvedUrl && !hasImageError ? (
    <img
      src={resolvedUrl}
      alt=""
      className="h-full w-full object-cover"
      onError={() => setHasImageError(true)}
    />
  ) : (
    <ImageOff size={16} className="text-[#B88A44]" />
  );
}

function SortableHeader({
  label,
  sortKey,
  activeKey,
  direction,
  onSort,
  align = "start",
}: {
  label: string;
  sortKey: AdminProductSortKey;
  activeKey: AdminProductSortKey;
  direction: AdminProductSortDirection;
  onSort: (key: AdminProductSortKey) => void;
  align?: "start" | "end";
}) {
  const isActive = activeKey === sortKey;
  return (
    <th className={`px-5 py-3 text-${align} font-bold`}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1.5 ${align === "end" ? "flex-row-reverse" : ""} hover:text-[#050505]`}
      >
        {label}
        {isActive ? (
          direction === "asc" ? <ArrowUp size={13} /> : <ArrowDown size={13} />
        ) : (
          <ArrowUpDown size={13} className="opacity-40" />
        )}
      </button>
    </th>
  );
}

export default function AdminProducts() {
  const queryString = useSearch();
  const [, navigate] = useLocation();
  const { currentUser } = useStore();
  const { language, t } = useLanguage();
  const { toast } = useToast();
  const initialSearch = useMemo(() => new URLSearchParams(queryString).get("search")?.trim() ?? "", [queryString]);
  const [search, setSearch] = useState(initialSearch);
  const [statusFilter, setStatusFilter] = useState<AdminProductStatus | "all">("all");
  const [brandFilter, setBrandFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState<AdminProductTypeFilter>("all");
  const [stockFilter, setStockFilter] = useState<AdminProductStockFilter>("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [sortKey, setSortKey] = useState<AdminProductSortKey>("updatedAt");
  const [sortDirection, setSortDirection] = useState<AdminProductSortDirection>("desc");
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);
  const [sourceSystems, setSourceSystems] = useState<string[]>([]);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [brands, setBrands] = useState<AdminBrand[]>([]);
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<AdminProduct | null>(null);
  const [form, setForm] = useState<ProductForm>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<ProductFormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [busyProductId, setBusyProductId] = useState<string | null>(null);
  const isAdmin = currentUser?.role?.trim().toLowerCase() === "admin";

  useEffect(() => setSearch(initialSearch), [initialSearch]);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      getAdminBrands({ signal: controller.signal }),
      getAdminCategories({ signal: controller.signal }),
    ])
      .then(([brandRows, categoryRows]) => {
        setBrands(brandRows);
        setCategories(categoryRows);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setLoadError(error instanceof Error ? error.message : t("admin.products.lookupError"));
      });
    return () => controller.abort();
  }, [refreshVersion, t]);

  useEffect(() => setPage(1), [search, statusFilter, brandFilter, categoryFilter, typeFilter, stockFilter, sourceFilter]);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      setIsLoading(true);
      setLoadError(null);
      getAdminProducts({
        search,
        status: statusFilter === "all" ? undefined : statusFilter,
        brandId: brandFilter === "all" ? undefined : brandFilter,
        categoryId: categoryFilter === "all" ? undefined : categoryFilter,
        productType: typeFilter === "all" ? undefined : typeFilter,
        stockFilter: stockFilter === "all" ? undefined : stockFilter,
        sourceSystem: sourceFilter === "all" ? undefined : sourceFilter,
        sort: sortKey,
        direction: sortDirection,
        page,
        limit: PAGE_SIZE,
        signal: controller.signal,
      })
        .then((result) => {
          setProducts(result.products);
          setPageCount(result.pagination.pages);
          setTotalProducts(result.pagination.total);
          setSourceSystems(result.sourceSystems);
        })
        .catch((error: unknown) => {
          if (!controller.signal.aborted) setLoadError(error instanceof Error ? error.message : t("admin.products.loadError"));
        })
        .finally(() => {
          if (!controller.signal.aborted) setIsLoading(false);
        });
    }, 250);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [brandFilter, categoryFilter, page, refreshVersion, search, sortDirection, sortKey, sourceFilter, statusFilter, stockFilter, typeFilter, t]);

  const toggleSort = (key: AdminProductSortKey) => {
    if (key === sortKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  };

  const statusOptions = useMemo(() => [
    { value: "ACTIVE", label: t("admin.products.statuses.active") },
    { value: "LOW_STOCK", label: t("admin.products.statuses.lowStock") },
    { value: "OUT_OF_STOCK", label: t("admin.products.statuses.outOfStock") },
    { value: "DRAFT", label: t("admin.products.statuses.draft") },
    { value: "INACTIVE", label: t("admin.products.statuses.inactive") },
  ], [t]);

  const formatPrice = (price: number | null) => price === null
    ? t("admin.products.notProvided")
    : new Intl.NumberFormat(language === "ar" ? "ar-EG" : "en-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 2 }).format(price);

  const formatPriceCell = (product: AdminProduct) => {
    const { min, max } = effectivePrice(product);
    if (min === null) return t("admin.products.notProvided");
    if (max !== null && max !== min) return `${formatPrice(min)} – ${formatPrice(max)}`;
    return formatPrice(min);
  };

  const formatDate = (value?: string | null) => {
    if (!value) return t("admin.products.notSynced");
    return new Intl.DateTimeFormat(language === "ar" ? "ar-EG" : "en-EG", { dateStyle: "medium" }).format(new Date(value));
  };

  const updateField = <K extends keyof ProductForm>(field: K, value: ProductForm[K]) => {
    setForm((current) => ({
      ...current,
      [field]: value,
      ...(field === "stock" && Number(value) === 0 ? { status: "OUT_OF_STOCK" as AdminProductStatus } : {}),
    }));
    setFormErrors((current) => ({ ...current, [field]: undefined }));
    setFormError(null);
  };

  const openCreate = () => {
    setEditingProduct(null);
    setForm(EMPTY_FORM);
    setFormErrors({});
    setFormError(null);
    setImageFile(null);
    setIsUploadingImage(false);
    setIsFormOpen(true);
  };

  const openEdit = (product: AdminProduct) => {
    setEditingProduct(product);
    setForm(toForm(product));
    setFormErrors({});
    setFormError(null);
    setImageFile(null);
    setIsUploadingImage(false);
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingProduct(null);
    setForm(EMPTY_FORM);
    setFormErrors({});
    setFormError(null);
    setImageFile(null);
    setIsUploadingImage(false);
  };

  const validateForm = () => {
    const errors: ProductFormErrors = {};
    const price = Number(form.price);
    const stock = Number(form.stock);
    if (!form.name.trim()) errors.name = t("admin.products.validation.name");
    if (!form.sku.trim()) errors.sku = t("admin.products.validation.sku");
    if (!form.price.trim() || !Number.isFinite(price) || price < 0) errors.price = t("admin.products.validation.price");
    if (!form.stock.trim() || !Number.isInteger(stock) || stock < 0) errors.stock = t("admin.products.validation.stock");
    if (!validImageUrl(form.imageUrl)) errors.imageUrl = t("admin.products.validation.imageUrl");
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const saveProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validateForm()) return;
    setIsSaving(true);
    setFormError(null);
    try {
      let imageUrl = form.imageUrl.trim();
      if (imageFile) {
        setIsUploadingImage(true);
        const uploadedImage = await uploadAdminProductImage(imageFile);
        imageUrl = uploadedImage.imageUrl;
        setForm((current) => ({ ...current, imageUrl }));
        setImageFile(null);
        setIsUploadingImage(false);
      }

      const input: AdminProductInput = {
        name: form.name.trim(),
        sku: form.sku.trim(),
        brandId: form.brandId === NONE_VALUE ? "" : form.brandId,
        categoryId: form.categoryId === NONE_VALUE ? "" : form.categoryId,
        price: Number(form.price),
        stock: Number(form.stock),
        status: Number(form.stock) === 0 ? "OUT_OF_STOCK" : form.status,
        imageUrl,
        description: form.description.trim() || undefined,
        featured: form.featured === "true",
        isWeeklyOffer: form.isWeeklyOffer === "true",
        isBestSeller: form.isBestSeller === "true",
        isNewArrival: form.isNewArrival === "true",
        isHotDeal: form.isHotDeal === "true",
        isFastDelivery: form.isFastDelivery === "true",
        purchaseMode: form.purchaseMode,
      };
      if (editingProduct) {
        await updateAdminProduct(editingProduct.id, input);
        toast({ title: t("admin.products.updatedSuccess") });
      } else {
        await createAdminProduct(input);
        toast({ title: t("admin.products.createdSuccess") });
      }
      closeForm();
      setRefreshVersion((value) => value + 1);
    } catch (error) {
      if (error instanceof ApiError && error.field) {
        const field = error.field === "brandId" || error.field === "categoryId" ? error.field : error.field as keyof ProductForm;
        if (field in EMPTY_FORM) {
          setFormErrors((current) => ({
            ...current,
            [field]: error.status === 409 && field === "sku" ? t("admin.products.duplicateSku") : error.message,
          }));
        } else {
          setFormError(error.message);
        }
      } else {
        setFormError(error instanceof Error ? error.message : t("admin.products.saveError"));
      }
    } finally {
      setIsUploadingImage(false);
      setIsSaving(false);
    }
  };

  const toggleActivation = async (product: AdminProduct) => {
    setBusyProductId(product.id);
    try {
      const nextStatus: AdminProductStatus = product.status === "INACTIVE" ? "ACTIVE" : "INACTIVE";
      await updateAdminProduct(product.id, {
        name: product.name,
        sku: product.sku,
        brandId: product.brand?.id ?? "",
        categoryId: product.category?.id ?? "",
        price: product.price ?? 0,
        stock: product.stock,
        status: nextStatus,
        imageUrl: product.imageUrl ?? undefined,
        description: product.description ?? undefined,
        featured: product.featured,
      });
      toast({
        title: nextStatus === "INACTIVE"
          ? t("admin.products.deactivatedSuccess")
          : t("admin.products.activatedSuccess"),
      });
      setRefreshVersion((value) => value + 1);
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : t("admin.products.saveError"),
        variant: "destructive",
      });
    } finally {
      setBusyProductId(null);
    }
  };

  const duplicateAsDraft = async (product: AdminProduct) => {
    setBusyProductId(product.id);
    try {
      const suffix = Date.now().toString(36).toUpperCase().slice(-4);
      await createAdminProduct({
        name: `${product.name} ${t("admin.products.duplicateSuffix")}`,
        sku: `${product.sku}-COPY-${suffix}`,
        brandId: product.brand?.id ?? "",
        categoryId: product.category?.id ?? "",
        price: product.price ?? 0,
        stock: 0,
        status: "DRAFT",
        imageUrl: product.imageUrl ?? undefined,
        description: product.description ?? undefined,
        featured: false,
        isWeeklyOffer: false,
        isBestSeller: false,
        isNewArrival: false,
        isHotDeal: false,
        isFastDelivery: false,
        purchaseMode: product.purchaseMode,
      });
      toast({ title: t("admin.products.duplicatedSuccess") });
      setRefreshVersion((value) => value + 1);
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : t("admin.products.saveError"),
        variant: "destructive",
      });
    } finally {
      setBusyProductId(null);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <AdminPageHeader title={t("admin.products.title")} description={t("admin.products.description")} action={isAdmin ? <button type="button" onClick={openCreate} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#F9DC5C] px-4 text-sm font-semibold text-[#050505] shadow-sm transition hover:-translate-y-px hover:bg-[#D4A72C] focus:outline-none focus:ring-2 focus:ring-[#D4A72C]/45"><Plus size={16} />{t("admin.products.addProduct")}</button> : undefined} />

        <section className="grid gap-3 rounded-lg border border-[#EFE2BC] bg-white p-4 shadow-sm sm:grid-cols-2 xl:grid-cols-4" data-admin-products-filters>
          <label className="xl:col-span-2"><span className="text-xs font-bold uppercase tracking-wide text-[#717182]">{t("admin.products.searchProducts")}</span><span className="mt-2 flex h-11 items-center gap-2 rounded-lg border border-[#050505]/10 bg-[#FBFAF7] px-3"><Search size={16} className="text-[#D4A72C]" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("admin.products.searchPlaceholder")} className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></span></label>
          <div><span className="text-xs font-bold uppercase tracking-wide text-[#717182]">{t("admin.products.status")}</span><DentalSelect label={t("admin.products.status")} value={statusFilter} onChange={(value) => setStatusFilter(value as AdminProductStatus | "all")} options={[{ value: "all", label: t("admin.products.allStatuses") }, ...statusOptions]} triggerClassName="mt-2 h-11 rounded-lg bg-[#FBFAF7]" /></div>
          <div><span className="text-xs font-bold uppercase tracking-wide text-[#717182]">{t("admin.products.brand")}</span><DentalSelect label={t("admin.products.brand")} value={brandFilter} onChange={setBrandFilter} options={[{ value: "all", label: t("admin.products.allBrands") }, ...brands.map((brand) => ({ value: brand.id, label: brand.name }))]} triggerClassName="mt-2 h-11 rounded-lg bg-[#FBFAF7]" /></div>
          <div><span className="text-xs font-bold uppercase tracking-wide text-[#717182]">{t("admin.products.category")}</span><DentalSelect label={t("admin.products.category")} value={categoryFilter} onChange={setCategoryFilter} options={[{ value: "all", label: t("admin.products.allCategories") }, ...categories.map((category) => ({ value: category.id, label: category.name }))]} triggerClassName="mt-2 h-11 rounded-lg bg-[#FBFAF7]" /></div>
          <div><span className="text-xs font-bold uppercase tracking-wide text-[#717182]">{t("admin.products.productType")}</span><DentalSelect label={t("admin.products.productType")} value={typeFilter} onChange={(value) => setTypeFilter(value as AdminProductTypeFilter)} options={[{ value: "all", label: t("admin.products.allTypes") }, { value: "simple", label: t("admin.products.typeSimple") }, { value: "variant", label: t("admin.products.typeVariant") }]} triggerClassName="mt-2 h-11 rounded-lg bg-[#FBFAF7]" /></div>
          <div><span className="text-xs font-bold uppercase tracking-wide text-[#717182]">{t("admin.products.stockFilter")}</span><DentalSelect label={t("admin.products.stockFilter")} value={stockFilter} onChange={(value) => setStockFilter(value as AdminProductStockFilter)} options={[{ value: "all", label: t("admin.products.allStock") }, { value: "lowStock", label: t("admin.products.statuses.lowStock") }, { value: "outOfStock", label: t("admin.products.statuses.outOfStock") }]} triggerClassName="mt-2 h-11 rounded-lg bg-[#FBFAF7]" /></div>
          <div><span className="text-xs font-bold uppercase tracking-wide text-[#717182]">{t("admin.products.sourceSystem")}</span><DentalSelect label={t("admin.products.sourceSystem")} value={sourceFilter} onChange={setSourceFilter} options={[{ value: "all", label: t("admin.products.allSources") }, ...sourceSystems.map((source) => ({ value: source, label: source }))]} triggerClassName="mt-2 h-11 rounded-lg bg-[#FBFAF7]" /></div>
          <button type="button" onClick={() => setRefreshVersion((value) => value + 1)} className="inline-flex h-11 items-center justify-center gap-2 self-end rounded-lg border border-[#EFE2BC] px-4 text-sm font-semibold text-[#717182] hover:bg-[#FFF9E8] dark:hover:border-[#D4A72C]/40 dark:hover:bg-white/[0.05] dark:hover:text-[#F6D85D]"><RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />{t("admin.products.refresh")}</button>
        </section>

        {loadError && <div role="alert" className="rounded-lg border border-[#F2C8C8] bg-[#FFF3F3] p-4 text-sm font-semibold text-[#B42318]">{loadError}</div>}

        <AdminTableShell><table className="min-w-full divide-y divide-[#EFE2BC] text-sm"><thead className="bg-[#FFF9E8] text-xs uppercase tracking-wide text-[#717182]"><tr>
          <th className="px-5 py-3 text-start font-bold">{t("admin.products.sku")}</th>
          <SortableHeader label={t("admin.products.productName")} sortKey="name" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
          <th className="px-5 py-3 text-start font-bold">{t("admin.products.brand")}</th><th className="px-5 py-3 text-start font-bold">{t("admin.products.category")}</th><th className="px-5 py-3 text-start font-bold">{t("admin.products.productType")}</th>
          <SortableHeader label={t("admin.products.price")} sortKey="price" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
          <SortableHeader label={t("admin.products.stock")} sortKey="stock" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
          <th className="px-5 py-3 text-start font-bold">{t("admin.products.status")}</th><th className="px-5 py-3 text-start font-bold">{t("admin.products.sourceSystem")}</th>
          <SortableHeader label={t("admin.products.lastSynced")} sortKey="updatedAt" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
          {isAdmin && <th className="px-5 py-3 text-end font-bold">{t("admin.products.actions")}</th>}
        </tr></thead><tbody className="divide-y divide-[#F3E8C8]">
          {products.map((product) => <tr key={product.id} data-admin-product-row={product.id}>
            <td className="whitespace-nowrap px-5 py-4 font-mono text-xs text-[#717182]">{product.sku}</td>
            <td className="min-w-[240px] px-5 py-4"><div className="flex items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[#EFE2BC] bg-[#FBFAF7]"><ProductRowThumbnail imageUrl={product.imageUrl} /></span><div className="min-w-0"><p className="truncate font-semibold text-[#050505]">{product.name}</p><p className="mt-1 truncate text-xs text-[#8A8D9A]">{product.slug}</p></div></div></td>
            <td className="px-5 py-4 text-[#717182]">{product.brand?.name ?? t("admin.products.notProvided")}</td><td className="px-5 py-4 text-[#717182]">{product.category?.name ?? t("admin.products.notProvided")}</td>
            <td className="px-5 py-4"><AdminStatusBadge tone={product.hasVariants ? "purple" : "slate"}>{product.hasVariants ? t("admin.products.typeVariant") : t("admin.products.typeSimple")}</AdminStatusBadge>{product.hasVariants && <p className="mt-1 text-xs text-[#8A8D9A]">{t("admin.products.variantCount", { values: { count: product.variantCount ?? 0 } })}</p>}</td>
            <td className="whitespace-nowrap px-5 py-4 font-semibold">{formatPriceCell(product)}</td>
            <td className="px-5 py-4 text-[#717182]">{effectiveStock(product)}</td>
            <td className="px-5 py-4"><AdminStatusBadge tone={STATUS_TONES[product.status]}>{t(`admin.products.statuses.${product.status === "LOW_STOCK" ? "lowStock" : product.status === "OUT_OF_STOCK" ? "outOfStock" : product.status.toLowerCase()}`)}</AdminStatusBadge></td>
            <td className="px-5 py-4">{product.sourceSystem ? <AdminStatusBadge tone="blue">{product.sourceSystem}</AdminStatusBadge> : <span className="text-xs text-[#8A8D9A]">{t("admin.products.manualEntry")}</span>}</td>
            <td className="whitespace-nowrap px-5 py-4 text-xs text-[#717182]">{formatDate(product.lastSyncedAt)}</td>
            {isAdmin && <td className="px-5 py-4"><div className="flex flex-wrap justify-end gap-1.5">
              <IconActionButton icon={<Eye size={14} />} label={t("admin.products.view")} href={`/admin/products/${product.id}`} />
              <IconActionButton icon={<Pencil size={14} />} label={t("admin.products.edit")} onClick={() => openEdit(product)} />
              <IconActionButton icon={<Layers size={14} />} label={t("admin.products.openVariants")} href={`/admin/products/${product.id}?tab=variants`} />
              <IconActionButton icon={<Images size={14} />} label={t("admin.products.openImages")} href={`/admin/products/${product.id}?tab=images`} />
              <IconActionButton
                icon={product.status === "INACTIVE" ? <Power size={14} /> : <PowerOff size={14} />}
                label={product.status === "INACTIVE" ? t("admin.products.activate") : t("admin.products.deactivate")}
                onClick={() => void toggleActivation(product)}
              />
              <IconActionButton icon={<Copy size={14} />} label={t("admin.products.duplicateAsDraft")} onClick={() => void duplicateAsDraft(product)} />
            </div></td>}
          </tr>)}
          {isLoading && products.length === 0 && <tr><td colSpan={isAdmin ? 10 : 9} className="px-5 py-10 text-center text-[#717182]">{t("admin.products.loading")}</td></tr>}
          {!isLoading && !loadError && products.length === 0 && <tr><td colSpan={isAdmin ? 10 : 9} className="px-5 py-10 text-center"><Package size={28} className="mx-auto text-[#D4A72C]" /><p className="mt-3 text-sm font-medium text-[#717182]">{t("admin.products.noProducts")}</p></td></tr>}
        </tbody></table></AdminTableShell>

        {totalProducts > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-[#717182]" data-admin-products-pagination>
            <p>{t("admin.products.paginationSummary", { values: { count: totalProducts, page, pages: pageCount } })}</p>
            <div className="flex gap-2">
              <button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="h-9 rounded-lg border border-[#EFE2BC] px-3 font-semibold disabled:opacity-40">{t("admin.products.previousPage")}</button>
              <button type="button" disabled={page >= pageCount} onClick={() => setPage((value) => value + 1)} className="h-9 rounded-lg border border-[#EFE2BC] px-3 font-semibold disabled:opacity-40">{t("admin.products.nextPage")}</button>
            </div>
          </div>
        )}
      </div>

      <Dialog open={isFormOpen} onOpenChange={(open) => open ? setIsFormOpen(true) : closeForm()}><DialogContent className="flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] min-w-0 flex-col overflow-hidden rounded-[22px] border-[#EFE2BC] bg-[#FFFEFB] p-0 sm:max-w-[760px]"><DialogHeader className="shrink-0 border-b border-[#EFE2BC] px-6 pb-5 pt-6"><DialogTitle className="text-2xl font-bold">{editingProduct ? t("admin.products.editProduct") : t("admin.products.addProduct")}</DialogTitle><DialogDescription>{t("admin.products.formDescription")}</DialogDescription></DialogHeader><form onSubmit={saveProduct} noValidate className="flex min-h-0 flex-1 flex-col overflow-hidden"><div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-6 py-5">{editingProduct?.hasVariants && (
        <p className="mb-4 rounded-lg border border-[#F1C58F] bg-[#FFF5E8] p-3 text-xs font-semibold leading-5 text-[#A65300]">{t("admin.products.variantParentWarning")}</p>
      )}<div className="grid gap-4 sm:grid-cols-2">
        <ProductField id="name" label={t("admin.products.productName")} value={form.name} onChange={(value) => updateField("name", value)} error={formErrors.name} maxLength={200} /><ProductField id="sku" label={t("admin.products.sku")} value={form.sku} onChange={(value) => updateField("sku", value)} error={formErrors.sku} maxLength={120} />
        <div><span className="text-sm font-bold">{t("admin.products.brand")}</span><DentalSelect label={t("admin.products.brand")} value={form.brandId} onChange={(value) => updateField("brandId", value)} options={[{ value: NONE_VALUE, label: t("admin.products.noBrand") }, ...brands.map((brand) => ({ value: brand.id, label: brand.name }))]} triggerClassName="mt-2 h-[50px] rounded-[14px]" />{formErrors.brandId && <p className="mt-1.5 text-xs font-semibold text-[#B42318]">{formErrors.brandId}</p>}</div>
        <div><span className="text-sm font-bold">{t("admin.products.category")}</span><DentalSelect label={t("admin.products.category")} value={form.categoryId} onChange={(value) => updateField("categoryId", value)} options={[{ value: NONE_VALUE, label: t("admin.products.noCategory") }, ...categories.map((category) => ({ value: category.id, label: category.name }))]} triggerClassName="mt-2 h-[50px] rounded-[14px]" />{formErrors.categoryId && <p className="mt-1.5 text-xs font-semibold text-[#B42318]">{formErrors.categoryId}</p>}</div>
        <ProductField id="price" label={t("admin.products.price")} value={form.price} onChange={(value) => updateField("price", value)} error={formErrors.price} type="number" min={0} step={0.01} /><ProductField id="stock" label={t("admin.products.stock")} value={form.stock} onChange={(value) => updateField("stock", value)} error={formErrors.stock} type="number" min={0} step={1} />
        <div><span className="text-sm font-bold">{t("admin.products.status")}</span><DentalSelect label={t("admin.products.status")} value={form.status} onChange={(value) => updateField("status", value as AdminProductStatus)} options={statusOptions} triggerClassName="mt-2 h-[50px] rounded-[14px]" />{form.stock === "0" && <p className="mt-1.5 text-xs font-semibold text-[#B88A44]">{t("admin.products.zeroStockWarning")}</p>}</div>
        <div><span className="text-sm font-bold">{t("admin.products.purchaseMode", { fallback: "Purchase mode" })}</span><DentalSelect label={t("admin.products.purchaseMode", { fallback: "Purchase mode" })} value={form.purchaseMode} onChange={(value) => updateField("purchaseMode", value as AdminProductPurchaseMode)} options={[{ value: "STANDARD", label: t("admin.products.purchaseModes.standard", { fallback: "Standard checkout" }) }, { value: "INQUIRY", label: t("admin.products.purchaseModes.inquiry", { fallback: "Product inquiry" }) }, { value: "QUOTE", label: t("admin.products.purchaseModes.quote", { fallback: "Quote request" }) }]} triggerClassName="mt-2 h-[50px] rounded-[14px]" /></div>
        {([['featured', 'featured'], ['isWeeklyOffer', 'weeklyOffer'], ['isBestSeller', 'bestSeller'], ['isNewArrival', 'newArrival'], ['isHotDeal', 'hotDeal'], ['isFastDelivery', 'fastDelivery']] as const).map(([field, label]) => (
          <div key={field}><span className="text-sm font-bold">{t(`admin.products.${label}`, { fallback: label })}</span><DentalSelect label={t(`admin.products.${label}`, { fallback: label })} value={form[field]} onChange={(value) => updateField(field, value as "true" | "false")} options={[{ value: "false", label: t("common.no", { fallback: "No" }) }, { value: "true", label: t("common.yes", { fallback: "Yes" }) }]} triggerClassName="mt-2 h-[50px] rounded-[14px]" /></div>
        ))}
        <ProductImageUploader
          value={form.imageUrl}
          file={imageFile}
          error={formErrors.imageUrl}
          isUploading={isUploadingImage}
          disabled={isSaving}
          onFileChange={(file) => {
            setImageFile(file);
            setFormErrors((current) => ({ ...current, imageUrl: undefined }));
            setFormError(null);
          }}
          onValueChange={(value) => updateField("imageUrl", value)}
          onError={(message) => {
            setFormErrors((current) => ({ ...current, imageUrl: message }));
            setFormError(null);
          }}
        />
        <label className="block sm:col-span-2"><span className="text-sm font-bold">{t("admin.products.descriptionField")}</span><textarea value={form.description} onChange={(event) => updateField("description", event.target.value)} maxLength={4000} className="mt-2 min-h-[110px] w-full resize-none rounded-[14px] border border-[#050505]/10 bg-white px-4 py-3 text-sm outline-none focus:border-[#D4A72C] focus:ring-4 focus:ring-[#D4A72C]/10" /></label>
      </div>{formError && <p role="alert" className="mt-4 rounded-lg border border-[#F2C8C8] bg-[#FFF3F3] p-3 text-sm font-semibold text-[#B42318]">{formError}</p>}</div><DialogFooter className="shrink-0 gap-2 border-t border-[#EFE2BC] bg-[#FFFEFB] px-6 py-4 sm:gap-2"><button type="button" onClick={closeForm} disabled={isSaving} className="h-10 rounded-lg border border-[#EFE2BC] bg-white px-4 text-sm font-semibold text-[#717182]">{t("common.cancel")}</button><button type="submit" disabled={isSaving} className="h-10 rounded-lg bg-[#F9DC5C] px-4 text-sm font-semibold hover:bg-[#D4A72C] disabled:opacity-60">{isSaving ? t("admin.products.saving") : editingProduct ? t("admin.products.saveChanges") : t("admin.products.createProduct")}</button></DialogFooter></form></DialogContent></Dialog>
    </AdminLayout>
  );
}
