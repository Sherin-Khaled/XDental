import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, ImageOff, Loader2, Plus, Star, Trash2 } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import {
  createAdminProductGalleryImage,
  deleteAdminProductGalleryImage,
  reorderAdminProductGalleryImages,
  updateAdminProductGalleryImage,
  type AdminProductCatalog,
  type AdminProductImage,
} from "@/services/adminProductCatalog";
import { ApiError, resolveApiAssetUrl } from "@/services/http";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AdminCheckbox, AdminInput, AdminSelect } from "./admin-form";
import { AdminPanel, AdminStatusBadge } from "./admin-ui";

function isValidHttpUrl(value: string) {
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function safeErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) return error.message;
  return error instanceof Error ? error.message : fallback;
}

function GalleryThumbnail({ url, alt }: { url?: string | null; alt: string }) {
  const [hasImageError, setHasImageError] = useState(false);
  const resolvedUrl = url ? resolveApiAssetUrl(url) ?? url : null;

  return resolvedUrl && !hasImageError ? (
    <img
      src={resolvedUrl}
      alt={alt}
      className="h-full w-full object-cover"
      onError={() => setHasImageError(true)}
    />
  ) : (
    <div className="flex h-full items-center justify-center">
      <ImageOff size={22} className="text-[#B88A44]" />
    </div>
  );
}

function ImageGroup({
  productId,
  variantId,
  images,
  onChange,
}: {
  productId: string;
  variantId: string | null;
  images: AdminProductImage[];
  onChange: () => void;
}) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const sorted = useMemo(
    () => [...images].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.sortOrder - b.sortOrder),
    [images]
  );

  const [url, setUrl] = useState("");
  const [altEn, setAltEn] = useState("");
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [sourceUrl, setSourceUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [busyImageId, setBusyImageId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminProductImage | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const addImage = async () => {
    if (!url.trim() || !isValidHttpUrl(url)) {
      setError(t("admin.images.urlValidation"));
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await createAdminProductGalleryImage(productId, {
        url: url.trim(),
        variantId,
        altEn: altEn.trim() || undefined,
        rightsConfirmed,
        sourceUrl: sourceUrl.trim() || undefined,
        sortOrder: images.length,
      });
      setUrl("");
      setAltEn("");
      setSourceUrl("");
      setRightsConfirmed(false);
      toast({ title: t("admin.images.imageAdded") });
      onChange();
    } catch (err) {
      setError(safeErrorMessage(err, t("admin.images.saveError")));
    } finally {
      setIsSubmitting(false);
    }
  };

  const setPrimary = async (image: AdminProductImage) => {
    setBusyImageId(image.id);
    try {
      await updateAdminProductGalleryImage(image.id, { isPrimary: true });
      onChange();
    } catch (err) {
      toast({ title: safeErrorMessage(err, t("admin.images.saveError")), variant: "destructive" });
    } finally {
      setBusyImageId(null);
    }
  };

  const toggleRights = async (image: AdminProductImage) => {
    setBusyImageId(image.id);
    try {
      await updateAdminProductGalleryImage(image.id, { rightsConfirmed: !image.rightsConfirmed });
      onChange();
    } catch (err) {
      toast({ title: safeErrorMessage(err, t("admin.images.saveError")), variant: "destructive" });
    } finally {
      setBusyImageId(null);
    }
  };

  const move = async (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= sorted.length) return;
    const reordered = [...sorted];
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
    setBusyImageId(sorted[index].id);
    try {
      await reorderAdminProductGalleryImages(productId, reordered.map((image) => image.id));
      onChange();
    } catch (err) {
      toast({ title: safeErrorMessage(err, t("admin.images.saveError")), variant: "destructive" });
    } finally {
      setBusyImageId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteAdminProductGalleryImage(deleteTarget.id);
      toast({ title: t("admin.images.imageDeleted") });
      setDeleteTarget(null);
      onChange();
    } catch (err) {
      toast({ title: safeErrorMessage(err, t("admin.images.saveError")), variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-3">
      {sorted.length === 0 ? (
        <p className="text-sm text-[#717182]">{t("admin.images.noImages")}</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-admin-image-group={variantId ?? "product"}>
          {sorted.map((image, index) => (
            <div key={image.id} className="overflow-hidden rounded-[14px] border border-[#EFE2BC] bg-white" data-admin-image={image.id}>
              <div className="relative h-36 bg-[#FBFAF7]">
                <GalleryThumbnail url={image.url} alt={image.altEn ?? ""} />
                {image.isPrimary && (
                  <span className="absolute start-2 top-2 inline-flex items-center gap-1 rounded-full bg-[#F9DC5C] px-2 py-1 text-[10px] font-black text-[#050505]">
                    <Star size={11} /> {t("admin.images.primary")}
                  </span>
                )}
              </div>
              <div className="space-y-2 p-3">
                {!image.rightsConfirmed && (
                  <p className="rounded-md border border-[#F1C58F] bg-[#FFF5E8] px-2 py-1 text-[11px] font-bold text-[#A65300]">
                    {t("admin.images.reviewOnlyLabel")}
                  </p>
                )}
                {image.sourceUrl && <p className="truncate text-[11px] text-[#8A8D9A]">{t("admin.images.source")}: {image.sourceUrl}</p>}
                <div className="flex flex-wrap gap-1.5">
                  <button type="button" disabled={busyImageId === image.id || index === 0} onClick={() => void move(index, -1)} aria-label={t("admin.images.moveUp")} className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#050505]/10 bg-white disabled:opacity-30"><ArrowUp size={12} /></button>
                  <button type="button" disabled={busyImageId === image.id || index === sorted.length - 1} onClick={() => void move(index, 1)} aria-label={t("admin.images.moveDown")} className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#050505]/10 bg-white disabled:opacity-30"><ArrowDown size={12} /></button>
                  <button type="button" disabled={busyImageId === image.id || image.isPrimary} onClick={() => void setPrimary(image)} aria-label={t("admin.images.setPrimary")} title={t("admin.images.setPrimary")} className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#050505]/10 bg-white disabled:opacity-30"><Star size={12} /></button>
                  <button type="button" disabled={busyImageId === image.id} onClick={() => void toggleRights(image)} aria-label={image.rightsConfirmed ? t("admin.images.markReviewOnly") : t("admin.images.confirmRights")} title={image.rightsConfirmed ? t("admin.images.markReviewOnly") : t("admin.images.confirmRights")} className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#050505]/10 bg-white">
                    {image.rightsConfirmed ? <Eye size={12} /> : <EyeOff size={12} />}
                  </button>
                  <button type="button" onClick={() => setDeleteTarget(image)} aria-label={t("admin.products.delete")} title={t("admin.products.delete")} className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#F2C8C8] bg-white text-[#B42318]"><Trash2 size={12} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-end gap-2 rounded-[14px] border border-dashed border-[#E8D9AF] bg-[#FBFAF7] p-3">
        <AdminInput id={`image-url-${variantId ?? "product"}`} label={t("admin.images.imageUrl")} value={url} onChange={(event) => setUrl(event.target.value)} wrapperClassName="min-w-[220px] flex-1" placeholder="https://example.com/image.jpg" />
        <AdminInput id={`image-alt-${variantId ?? "product"}`} label={t("admin.images.altText")} value={altEn} onChange={(event) => setAltEn(event.target.value)} wrapperClassName="w-48" optional={t("admin.variants.optional")} />
        <AdminInput id={`image-source-${variantId ?? "product"}`} label={t("admin.images.sourceUrl")} value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} wrapperClassName="w-48" optional={t("admin.variants.optional")} />
        <AdminCheckbox id={`image-rights-${variantId ?? "product"}`} checked={rightsConfirmed} onCheckedChange={setRightsConfirmed} label={t("admin.images.rightsConfirmedLabel")} description={t("admin.images.rightsConfirmedHint")} />
        <button type="button" disabled={isSubmitting} onClick={() => void addImage()} className="inline-flex h-[50px] items-center gap-1.5 rounded-[14px] bg-[#F9DC5C] px-4 text-sm font-semibold text-[#050505] hover:bg-[#D4A72C] disabled:opacity-60">
          {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          {t("admin.images.addImage")}
        </button>
      </div>
      {error && <p className="text-xs font-semibold text-[#B42318]">{error}</p>}

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open && !isDeleting) setDeleteTarget(null); }}>
        <AlertDialogContent className="rounded-[20px] border-[#EFE2BC] bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.images.deleteImageTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("admin.images.deleteImageDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction disabled={isDeleting} onClick={(event) => { event.preventDefault(); void confirmDelete(); }} className="bg-[#B42318] text-white hover:bg-[#8F1C13]">
              {isDeleting ? t("admin.products.deleting") : t("admin.products.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function ProductImagesPanel({
  productId,
  catalog,
  onChange,
}: {
  productId: string;
  catalog: AdminProductCatalog;
  onChange: () => void;
}) {
  const { t } = useLanguage();
  const [selectedVariantId, setSelectedVariantId] = useState<string>(catalog.variants[0]?.id ?? "");
  const productImages = catalog.images.filter((image) => !image.variantId);
  const variantImages = catalog.images.filter((image) => image.variantId === selectedVariantId);

  return (
    <div className="space-y-6" data-admin-images-panel>
      <AdminPanel title={t("admin.images.productGalleryTitle")} description={t("admin.images.productGalleryDescription")}>
        <ImageGroup productId={productId} variantId={null} images={productImages} onChange={onChange} />
      </AdminPanel>

      {catalog.variants.length > 0 && (
        <AdminPanel title={t("admin.images.variantGalleryTitle")} description={t("admin.images.variantGalleryDescription")}>
          <div className="mb-4 max-w-sm">
            <AdminSelect
              id="image-variant-select"
              label={t("admin.images.selectVariant")}
              value={selectedVariantId}
              onChange={setSelectedVariantId}
              options={catalog.variants.map((variant) => ({
                value: variant.id,
                label: variant.selections.map((selection) => `${selection.option.nameEn} ${selection.optionValue.valueEn}`).join(" / ") || variant.sku || variant.id,
              }))}
            />
          </div>
          {selectedVariantId && <ImageGroup productId={productId} variantId={selectedVariantId} images={variantImages} onChange={onChange} />}
        </AdminPanel>
      )}

      {catalog.images.some((image) => !image.rightsConfirmed) && (
        <AdminStatusBadge tone="amber">{t("admin.images.reviewOnlyBanner")}</AdminStatusBadge>
      )}
    </div>
  );
}
