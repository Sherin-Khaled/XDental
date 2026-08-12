import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AlertTriangle, ImageOff } from "lucide-react";
import { Link, useLocation, useRoute, useSearch } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DirectionalIcon } from "@/components/DirectionalIcon";
import { useLanguage } from "@/context/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import {
  createAdminProduct,
  updateAdminProduct,
  getAdminCategories,
  type AdminCategory,
  type AdminProductInput,
  type AdminProductStatus,
} from "@/services/adminCatalog";
import { getAdminBrands, type AdminBrand } from "@/services/adminBrands";
import { getAdminProductCatalog, type AdminProductCatalog } from "@/services/adminProductCatalog";
import { ApiError, resolveApiAssetUrl } from "@/services/http";
import { summarizeProductCatalog } from "@/lib/adminProductSummary";
import {
  AdminCheckbox,
  AdminInput,
  AdminSelect,
  AdminTextarea,
} from "./_components/admin-form";
import { AdminLayout } from "./_components/AdminLayout";
import { AdminPanel, AdminStatusBadge } from "./_components/admin-ui";
import { ProductImagesPanel } from "./_components/ProductImagesPanel";
import { ProductVariantsPanel } from "./_components/ProductVariantsPanel";

const NONE_VALUE = "none";

type DetailsForm = {
  name: string;
  nameAr: string;
  sku: string;
  brandId: string;
  categoryId: string;
  price: string;
  stock: string;
  status: AdminProductStatus;
  featured: boolean;
  description: string;
  descriptionAr: string;
  shortDescription: string;
  shortDescriptionAr: string;
};

function emptyForm(): DetailsForm {
  return { name: "", nameAr: "", sku: "", brandId: NONE_VALUE, categoryId: NONE_VALUE, price: "", stock: "", status: "ACTIVE", featured: false, description: "", descriptionAr: "", shortDescription: "", shortDescriptionAr: "" };
}

function formFromCatalog(catalog: AdminProductCatalog): DetailsForm {
  return {
    name: catalog.name,
    nameAr: catalog.nameAr ?? "",
    sku: catalog.sku ?? "",
    brandId: catalog.brandId ?? NONE_VALUE,
    categoryId: catalog.categoryId ?? NONE_VALUE,
    price: catalog.price === null ? "" : String(catalog.price),
    stock: String(catalog.stockQuantity ?? 0),
    status: catalog.status,
    featured: catalog.featured,
    description: catalog.description ?? "",
    descriptionAr: catalog.descriptionAr ?? "",
    shortDescription: catalog.shortDescription ?? "",
    shortDescriptionAr: catalog.shortDescriptionAr ?? "",
  };
}

function SummaryPill({ label, value, tone }: { label: string; value: string; tone?: "warning" }) {
  return (
    <div
      className={`rounded-[14px] border px-4 py-3 ${
        tone === "warning"
          ? "border-[#F1C58F] bg-[#FFF5E8] dark:border-[#E78B37]/45 dark:bg-[#E78B37]/12"
          : "border-[#EFE2BC] bg-[#FBFAF7] dark:border-white/10 dark:bg-white/[0.03]"
      }`}
    >
      <p className="text-[11px] font-bold uppercase tracking-wide text-[#8A8D9A] dark:text-[#9A9DAE]">{label}</p>
      <p className={`mt-1 text-base font-bold ${tone === "warning" ? "text-[#A65300] dark:text-[#F5B675]" : "text-[#050505] dark:text-[#F5F1E7]"}`}>{value}</p>
    </div>
  );
}

function HeaderThumbnail({ imageUrl }: { imageUrl?: string | null }) {
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
    <ImageOff size={20} className="text-[#B88A44]" />
  );
}

export default function AdminProductEditor() {
  const [, params] = useRoute("/admin/products/:id");
  const routeId = params?.id ?? "new";
  const isNew = routeId === "new";
  const [productId, setProductId] = useState<string | null>(isNew ? null : routeId);
  const queryString = useSearch();
  const [, navigate] = useLocation();
  const { language, t } = useLanguage();
  const { toast } = useToast();

  const initialTab = new URLSearchParams(queryString).get("tab");
  const [activeTab, setActiveTab] = useState<"details" | "variants" | "images">(
    initialTab === "variants" || initialTab === "images" ? initialTab : "details"
  );

  const [catalog, setCatalog] = useState<AdminProductCatalog | null>(null);
  const [brands, setBrands] = useState<AdminBrand[]>([]);
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [isLoading, setIsLoading] = useState(!isNew);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);

  const [form, setForm] = useState<DetailsForm>(emptyForm());
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof DetailsForm, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([getAdminBrands({ signal: controller.signal }), getAdminCategories({ signal: controller.signal })])
      .then(([brandRows, categoryRows]) => {
        setBrands(brandRows);
        setCategories(categoryRows);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!productId) return;
    const controller = new AbortController();
    setIsLoading(true);
    setLoadError(null);
    getAdminProductCatalog(productId, controller.signal)
      .then((result) => {
        setCatalog(result);
        setForm(formFromCatalog(result));
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setLoadError(error instanceof Error ? error.message : t("admin.productEditor.loadError"));
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, [productId, refreshVersion, t]);

  const summary = useMemo(() => (catalog ? summarizeProductCatalog(catalog) : null), [catalog]);

  const updateField = <K extends keyof DetailsForm>(field: K, value: DetailsForm[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
    setFormErrors((current) => ({ ...current, [field]: undefined }));
    setFormError(null);
  };

  const validate = () => {
    const errors: typeof formErrors = {};
    const price = Number(form.price);
    const stock = Number(form.stock);
    if (!form.name.trim()) errors.name = t("admin.products.validation.name");
    if (!form.sku.trim()) errors.sku = t("admin.products.validation.sku");
    if (!form.price.trim() || !Number.isFinite(price) || price < 0) errors.price = t("admin.products.validation.price");
    if (!form.stock.trim() || !Number.isInteger(stock) || stock < 0) errors.stock = t("admin.products.validation.stock");
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const saveDetails = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validate()) return;
    setIsSaving(true);
    setFormError(null);
    const input: AdminProductInput = {
      name: form.name.trim(),
      nameAr: form.nameAr.trim() || undefined,
      sku: form.sku.trim(),
      brandId: form.brandId === NONE_VALUE ? "" : form.brandId,
      categoryId: form.categoryId === NONE_VALUE ? "" : form.categoryId,
      price: Number(form.price),
      stock: Number(form.stock),
      status: Number(form.stock) === 0 ? "OUT_OF_STOCK" : form.status,
      imageUrl: catalog?.imageUrl ?? undefined,
      description: form.description.trim() || undefined,
      descriptionAr: form.descriptionAr.trim() || undefined,
      shortDescription: form.shortDescription.trim() || undefined,
      shortDescriptionAr: form.shortDescriptionAr.trim() || undefined,
      featured: form.featured,
    };
    try {
      if (productId) {
        await updateAdminProduct(productId, input);
        toast({ title: t("admin.products.updatedSuccess") });
        setRefreshVersion((value) => value + 1);
      } else {
        const created = await createAdminProduct(input);
        toast({ title: t("admin.productEditor.createdSuccess") });
        navigate(`/admin/products/${created.id}`, { replace: true });
        setProductId(created.id);
      }
    } catch (error) {
      if (error instanceof ApiError && error.field && error.field in form) {
        setFormErrors((current) => ({
          ...current,
          [error.field as keyof DetailsForm]: error.status === 409 && error.field === "sku" ? t("admin.products.duplicateSku") : error.message,
        }));
      } else {
        setFormError(error instanceof Error ? error.message : t("admin.products.saveError"));
      }
    } finally {
      setIsSaving(false);
    }
  };

  const statusOptions = [
    { value: "ACTIVE", label: t("admin.products.statuses.active") },
    { value: "LOW_STOCK", label: t("admin.products.statuses.lowStock") },
    { value: "OUT_OF_STOCK", label: t("admin.products.statuses.outOfStock") },
    { value: "DRAFT", label: t("admin.products.statuses.draft") },
    { value: "INACTIVE", label: t("admin.products.statuses.inactive") },
  ];

  const formatPrice = (value: number | null) => value === null
    ? t("admin.products.notProvided")
    : new Intl.NumberFormat(language === "ar" ? "ar-EG" : "en-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 2 }).format(value);

  return (
    <AdminLayout>
      <div className="space-y-6" data-admin-product-editor={productId ?? "new"}>
        <Link href="/admin/products" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#8A651C] hover:text-[#5F430C]">
          <DirectionalIcon direction="back" family="chevron" size={16} />
          {t("admin.productEditor.backToProducts")}
        </Link>

        <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-[14px] border border-[#EFE2BC] bg-white">
              <HeaderThumbnail imageUrl={catalog?.imageUrl} />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#D4A72C]">{t("admin.shell.admin")}</p>
              <h1 className="mt-1 truncate text-2xl font-bold tracking-tight text-[#050505]">
                {isNew ? t("admin.productEditor.newProductTitle") : catalog?.name ?? t("admin.productEditor.loading")}
              </h1>
              {catalog && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <AdminStatusBadge tone={summary?.hasVariants ? "purple" : "slate"}>
                    {summary?.hasVariants ? t("admin.products.typeVariant") : t("admin.products.typeSimple")}
                  </AdminStatusBadge>
                  <AdminStatusBadge tone={catalog.status === "ACTIVE" ? "green" : catalog.status === "OUT_OF_STOCK" ? "red" : "slate"}>
                    {t(`admin.products.statuses.${catalog.status === "LOW_STOCK" ? "lowStock" : catalog.status === "OUT_OF_STOCK" ? "outOfStock" : catalog.status.toLowerCase()}`)}
                  </AdminStatusBadge>
                </div>
              )}
            </div>
          </div>
        </div>

        {loadError && <div role="alert" className="rounded-lg border border-[#F2C8C8] bg-[#FFF3F3] p-4 text-sm font-semibold text-[#B42318]">{loadError}</div>}

        {summary && (
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6" data-admin-product-summary>
            <SummaryPill label={t("admin.productEditor.summary.optionDimensions")} value={String(summary.optionDimensionCount)} />
            <SummaryPill label={t("admin.productEditor.summary.variants")} value={String(summary.variantCount)} />
            <SummaryPill
              label={t("admin.productEditor.summary.priceRange")}
              value={summary.priceMin === null ? t("admin.products.notProvided") : summary.priceMax && summary.priceMax !== summary.priceMin ? `${formatPrice(summary.priceMin)} – ${formatPrice(summary.priceMax)}` : formatPrice(summary.priceMin)}
            />
            <SummaryPill label={t("admin.productEditor.summary.totalStock")} value={String(summary.totalStock)} />
            <SummaryPill
              label={t("admin.productEditor.summary.missingImages")}
              value={String(summary.missingImageVariantLabels.length + (summary.hasProductImage ? 0 : summary.hasVariants ? 0 : 1))}
              tone={summary.missingImageVariantLabels.length > 0 ? "warning" : undefined}
            />
            <SummaryPill
              label={t("admin.productEditor.summary.incompleteIdentifiers")}
              value={String(summary.incompleteIdentifierVariantLabels.length)}
              tone={summary.incompleteIdentifierVariantLabels.length > 0 ? "warning" : undefined}
            />
          </section>
        )}

        {summary && summary.warnings.length > 0 && (
          <div className="flex flex-wrap gap-2" data-admin-product-warnings>
            {summary.warnings.map((warning) => (
              <span key={warning} className="inline-flex items-center gap-1.5 rounded-full border border-[#F1C58F] bg-[#FFF5E8] px-3 py-1.5 text-xs font-bold text-[#A65300]">
                <AlertTriangle size={13} />
                {t(`admin.productEditor.warnings.${warning}`)}
              </span>
            ))}
          </div>
        )}

        {isLoading && !catalog && !isNew && (
          <div className="rounded-lg border border-[#EFE2BC] bg-white p-10 text-center text-sm font-medium text-[#717182]" data-admin-product-editor-loading>
            {t("admin.productEditor.loading")}
          </div>
        )}

        {(isNew || catalog) && (
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)} data-admin-product-tabs>
          <TabsList className="h-11 w-full justify-start gap-1 rounded-lg bg-[#FFF9E8] p-1 sm:w-auto">
            <TabsTrigger value="details" className="h-9 rounded-lg px-4 font-bold data-[state=active]:bg-[#FFF3B0] data-[state=active]:text-[#050505] dark:data-[state=active]:bg-[#F9DC5C]">
              {t("admin.productEditor.tabs.details")}
            </TabsTrigger>
            <TabsTrigger value="variants" disabled={isNew} className="h-9 rounded-lg px-4 font-bold data-[state=active]:bg-[#FFF3B0] data-[state=active]:text-[#050505] dark:data-[state=active]:bg-[#F9DC5C]">
              {t("admin.productEditor.tabs.variants")}
            </TabsTrigger>
            <TabsTrigger value="images" disabled={isNew} className="h-9 rounded-lg px-4 font-bold data-[state=active]:bg-[#FFF3B0] data-[state=active]:text-[#050505] dark:data-[state=active]:bg-[#F9DC5C]">
              {t("admin.productEditor.tabs.images")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="mt-5">
            <AdminPanel title={t("admin.productEditor.detailsTitle")} description={t("admin.productEditor.detailsDescription")}>
              {summary?.hasVariants && (
                <p className="mb-4 rounded-lg border border-[#F1C58F] bg-[#FFF5E8] p-3 text-xs font-semibold leading-5 text-[#A65300]">
                  {t("admin.productEditor.variantParentPricingNotice")}
                </p>
              )}
              <form onSubmit={saveDetails} noValidate className="grid gap-4 sm:grid-cols-2">
                <AdminInput id="name" label={t("admin.products.productName")} value={form.name} maxLength={200} onChange={(event) => updateField("name", event.target.value)} error={formErrors.name} />
                <AdminInput id="nameAr" dir="rtl" label={t("admin.products.productNameAr")} value={form.nameAr} maxLength={200} onChange={(event) => updateField("nameAr", event.target.value)} optional={t("admin.variants.optional")} />
                <AdminInput id="sku" label={t("admin.products.sku")} value={form.sku} maxLength={120} onChange={(event) => updateField("sku", event.target.value)} error={formErrors.sku} disabled={summary?.hasVariants} optional={summary?.hasVariants ? t("admin.productEditor.simpleSkuOnly") : undefined} />
                <AdminSelect id="brandId" label={t("admin.products.brand")} value={form.brandId} onChange={(value) => updateField("brandId", value)} options={[{ value: NONE_VALUE, label: t("admin.products.noBrand") }, ...brands.map((brand) => ({ value: brand.id, label: brand.name }))]} />
                <AdminSelect id="categoryId" label={t("admin.products.category")} value={form.categoryId} onChange={(value) => updateField("categoryId", value)} options={[{ value: NONE_VALUE, label: t("admin.products.noCategory") }, ...categories.map((category) => ({ value: category.id, label: category.name }))]} />
                <AdminInput
                  id="price"
                  type="number"
                  min={0}
                  step={0.01}
                  label={summary?.hasVariants ? t("admin.productEditor.fallbackPrice") : t("admin.products.price")}
                  value={form.price}
                  onChange={(event) => updateField("price", event.target.value)}
                  error={formErrors.price}
                  optional={summary?.hasVariants ? t("admin.productEditor.fallbackPriceHint") : undefined}
                />
                <AdminInput
                  id="stock"
                  type="number"
                  min={0}
                  step={1}
                  label={t("admin.products.stock")}
                  value={form.stock}
                  onChange={(event) => updateField("stock", event.target.value)}
                  error={formErrors.stock}
                  disabled={summary?.hasVariants}
                  optional={summary?.hasVariants ? t("admin.productEditor.variantStockOnly") : undefined}
                />
                <AdminSelect id="status" label={t("admin.products.status")} value={form.status} onChange={(value) => updateField("status", value as AdminProductStatus)} options={statusOptions} />
                <div className="flex items-end">
                  <AdminCheckbox id="featured" checked={form.featured} onCheckedChange={(checked) => updateField("featured", checked)} label={t("admin.products.featured")} />
                </div>
                <AdminTextarea id="shortDescription" label={t("admin.products.shortDescriptionField")} value={form.shortDescription} maxLength={1000} onChange={(event) => updateField("shortDescription", event.target.value)} optional={t("admin.variants.optional")} />
                <AdminTextarea id="shortDescriptionAr" dir="rtl" label={t("admin.products.shortDescriptionArField")} value={form.shortDescriptionAr} maxLength={1000} onChange={(event) => updateField("shortDescriptionAr", event.target.value)} optional={t("admin.variants.optional")} />
                <AdminTextarea id="description" label={t("admin.products.descriptionField")} value={form.description} maxLength={4000} onChange={(event) => updateField("description", event.target.value)} wrapperClassName="sm:col-span-2" />
                <AdminTextarea id="descriptionAr" dir="rtl" label={t("admin.products.descriptionArField")} value={form.descriptionAr} maxLength={4000} onChange={(event) => updateField("descriptionAr", event.target.value)} wrapperClassName="sm:col-span-2" optional={t("admin.variants.optional")} />
                {formError && <p role="alert" className="sm:col-span-2 rounded-lg border border-[#F2C8C8] bg-[#FFF3F3] p-3 text-sm font-semibold text-[#B42318]">{formError}</p>}
                <div className="sm:col-span-2">
                  <button type="submit" disabled={isSaving} className="h-10 rounded-lg bg-[#F9DC5C] px-5 text-sm font-semibold text-[#050505] hover:bg-[#D4A72C] disabled:opacity-60">
                    {isSaving ? t("admin.products.saving") : t("admin.products.saveChanges")}
                  </button>
                </div>
              </form>
            </AdminPanel>
          </TabsContent>

          <TabsContent value="variants" className="mt-5">
            {productId && catalog && (
              <ProductVariantsPanel productId={productId} catalog={catalog} onChange={() => setRefreshVersion((value) => value + 1)} />
            )}
          </TabsContent>

          <TabsContent value="images" className="mt-5">
            {productId && catalog && (
              <ProductImagesPanel productId={productId} catalog={catalog} onChange={() => setRefreshVersion((value) => value + 1)} />
            )}
          </TabsContent>
        </Tabs>
        )}
      </div>
    </AdminLayout>
  );
}
