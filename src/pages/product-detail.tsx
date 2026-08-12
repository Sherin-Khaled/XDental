import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useParams } from "wouter";
import {
  Heart,
  Minus,
  Plus,
  Share2,
  MessageSquareText,
  ShoppingCart,
} from "lucide-react";
import { DirectionalIcon } from "@/components/DirectionalIcon";
import { Button } from "@/components/dental/Button";
import { Container } from "@/components/dental/Container";
import { ProductCard } from "@/components/dental/ProductCard";
import { ProductAutocomplete } from "@/components/dental/ProductAutocomplete";
import { LowStockNotice, isLowStockProduct } from "@/components/dental/StockAvailability";
import { useStore } from "@/context/StoreContext";
import { cn } from "@/lib/utils";
import { calculateDiscount, formatCurrency } from "@/utils";
import { SEO } from "@/components/SEO";
import { useLanguage } from "@/context/LanguageContext";
import { getCategoryTranslationKey, getLocalizedProductDescription, getLocalizedProductName } from "@/lib/catalogTranslations";
import { getProductStockLimit, isProductPurchasable } from "@/lib/cartStock";
import { createProductRequest, getMyProductRequests } from "@/services/productRequests";
import { createQuote, getMyQuote, type Quote } from "@/services/quotes";
import { fetchPublicProduct, fetchPublicProducts } from "@/services/catalog";
import { useImageFallback } from "@/hooks/use-image-fallback";
import type { Product } from "@/types/product";

type DetailTab = "description" | "specifications" | "reviews" | "shipping";

const PRODUCT_IMAGE = `${import.meta.env.BASE_URL}toothtools.webp`;
const tabs: { id: DetailTab; label: string }[] = [
  { id: "description", label: "productDetail.tabs.description" },
  { id: "specifications", label: "productDetail.tabs.specifications" },
  { id: "reviews", label: "productDetail.tabs.reviews" },
  { id: "shipping", label: "productDetail.tabs.shipping" },
];

function infoCardClassName(className?: string) {
  return cn(
    "rounded-[18px] border border-[var(--xd-gold-active)]/[0.16] bg-white/80 shadow-[0_12px_32px_rgba(5,5,5,0.04)] backdrop-blur",
    className
  );
}

function QuantityControl({
  quantity,
  max,
  onChange,
  onMaximumReached,
}: {
  quantity: number;
  max: number;
  onChange: (quantity: number) => void;
  onMaximumReached: () => void;
}) {
  const { t } = useLanguage();

  return (
    <div className="inline-flex h-10 items-center rounded-full border border-[#050505]/10 bg-white">
      <button
        type="button"
        onClick={() => onChange(Math.max(1, quantity - 1))}
        disabled={quantity <= 1}
        className="flex h-full w-10 items-center justify-center rounded-l-full text-[#8A8D9A] transition-colors hover:text-[#050505] disabled:opacity-45"
        aria-label={t("cart.decreaseQuantity")}
      >
        <Minus size={15} />
      </button>
      <input
        type="number"
        min={1}
        max={max}
        value={quantity}
        onChange={(event) => {
          const requested = Number(event.target.value);
          if (!Number.isFinite(requested)) return;
          const clamped = Math.max(1, Math.min(max, Math.floor(requested)));
          if (requested > max) onMaximumReached();
          onChange(clamped);
        }}
        className="h-8 w-11 bg-transparent text-center text-[14px] font-bold text-[#050505] outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        aria-label={t("common.quantity")}
      />
      <button
        type="button"
        onClick={() => {
          if (quantity >= max) {
            onMaximumReached();
            return;
          }
          const nextQuantity = Math.min(max, quantity + 1);
          onChange(nextQuantity);
          if (nextQuantity === max) onMaximumReached();
        }}
        disabled={quantity >= max}
        className="flex h-full w-10 items-center justify-center rounded-r-full text-[#8A8D9A] transition-colors hover:text-[#050505] disabled:cursor-not-allowed disabled:opacity-35"
        aria-label={t("cart.increaseQuantity")}
      >
        <Plus size={15} />
      </button>
    </div>
  );
}

function GalleryThumbnail({
  image,
  fallback,
  className,
}: {
  image: string;
  fallback: string;
  className?: string;
}) {
  const thumbnailImage = useImageFallback(image, fallback);

  return (
    <img
      src={thumbnailImage.src}
      onError={thumbnailImage.onError}
      alt=""
      width={2525}
      height={2582}
      loading="lazy"
      decoding="async"
      className={className}
    />
  );
}

function ProductSection({
  title,
  subtitle,
  products,
}: {
  title: string;
  subtitle: string;
  products: Product[];
}) {
  if (products.length === 0) return null;

  return (
    <section className="mt-16">
      <div className="mb-6">
        <h2 className="font-display text-[30px] font-bold leading-tight text-[#050505]">
          {title}
        </h2>
        <p className="mt-2 text-[14px] leading-6 text-[#8A8D9A]">{subtitle}</p>
      </div>
      <div className="grid grid-cols-1 gap-5 overflow-visible px-1 pb-6 pt-2 sm:grid-cols-2 lg:grid-cols-4">
        {products.map((item) => (
          <ProductCard key={item.id} product={item} />
        ))}
      </div>
    </section>
  );
}

export default function ProductDetail() {
  const { id } = useParams();
  const { addToCart, toggleWishlist, isInWishlist, isAuthenticated } = useStore();
  const [, navigate] = useLocation();
  const { t, language } = useLanguage();
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState<DetailTab>("description");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isRequestOpen, setIsRequestOpen] = useState(false);
  const [requestProductName, setRequestProductName] = useState("");
  const [requestSelectedProduct, setRequestSelectedProduct] = useState<Product | null>(null);
  const [requestMessage, setRequestMessage] = useState("");
  const [requestError, setRequestError] = useState<string | null>(null);
  const [isRequestSubmitting, setIsRequestSubmitting] = useState(false);
  const [createdRequestId, setCreatedRequestId] = useState<string | null>(null);
  const [createdThreadId, setCreatedThreadId] = useState<string | null>(null);
  const [isQuoteOpen, setIsQuoteOpen] = useState(false);
  const [quoteProductName, setQuoteProductName] = useState("");
  const [quoteSelectedProduct, setQuoteSelectedProduct] = useState<Product | null>(null);
  const [quoteNotes, setQuoteNotes] = useState("");
  const [isQuoteSubmitting, setIsQuoteSubmitting] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [createdQuote, setCreatedQuote] = useState<Quote | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [isProductLoading, setIsProductLoading] = useState(true);
  const [productError, setProductError] = useState<string | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [moreFromBrand, setMoreFromBrand] = useState<Product[]>([]);

  const productName = product ? getLocalizedProductName(product, language, t) : "";
  const productCategory = product ? t(`products.items.${product.id}.category`, {
    fallback: t(getCategoryTranslationKey(product.category), { fallback: product.category }),
  }) : "";
  const productDescription = product
    ? getLocalizedProductDescription(product, language, t, t("productDetail.defaultDescription"))
    : "";
  const discount = product ? calculateDiscount(product.oldPrice ?? undefined, product.currentPrice) : 0;
  const isWishlisted = product ? isInWishlist(product.id) : false;
  const isOutOfStock = product ? !isProductPurchasable(product) : false;
  const isLowStock = product ? isLowStockProduct(product) : false;
  const galleryItems = product ? [product.image || PRODUCT_IMAGE] : [PRODUCT_IMAGE];
  const mainGalleryImage = useImageFallback(galleryItems[selectedImageIndex], PRODUCT_IMAGE);

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    setIsProductLoading(true);
    setProductError(null);
    fetchPublicProduct(id, controller.signal)
      .then((nextProduct) => {
        if (!controller.signal.aborted) {
          setProduct(nextProduct);
          setSelectedOption(nextProduct?.options?.[0] ?? "");
          if (nextProduct) {
            setQuantity((current) =>
              Math.max(
                1,
                Math.min(getProductStockLimit(nextProduct) ?? 99, current)
              )
            );
          }
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) setProductError(error instanceof Error ? error.message : t("productDetail.catalogError", { fallback: "Product details could not be loaded." }));
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsProductLoading(false);
      });
    return () => controller.abort();
  }, [id, t]);

  useEffect(() => {
    if (!isRequestOpen && !isQuoteOpen) return;
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (isQuoteOpen) setIsQuoteOpen(false);
      else setIsRequestOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isQuoteOpen, isRequestOpen]);

  // Small, bounded lookups — a handful of same-category / same-brand
  // products, not a filter over the full catalogue. Falls back to any other
  // small page of products if the category/brand doesn't have enough.
  useEffect(() => {
    if (!product) {
      setRelatedProducts([]);
      return;
    }
    const controller = new AbortController();
    fetchPublicProducts({ category: product.category, limit: 5, signal: controller.signal })
      .then(async ({ products }) => {
        if (controller.signal.aborted) return;
        let related = products.filter((item) => item.id !== product.id).slice(0, 4);
        if (related.length < 4) {
          const fallback = await fetchPublicProducts({
            limit: 4 - related.length + 1,
            signal: controller.signal,
          });
          const excludedIds = new Set([product.id, ...related.map((item) => item.id)]);
          related = [...related, ...fallback.products.filter((item) => !excludedIds.has(item.id))].slice(0, 4);
        }
        if (!controller.signal.aborted) setRelatedProducts(related);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [product?.id, product?.category]);

  useEffect(() => {
    if (!product) {
      setMoreFromBrand([]);
      return;
    }
    const controller = new AbortController();
    fetchPublicProducts({ brand: product.brand, limit: 5, signal: controller.signal })
      .then(async ({ products }) => {
        if (controller.signal.aborted) return;
        let sameBrand = products.filter((item) => item.id !== product.id).slice(0, 4);
        if (sameBrand.length < 4) {
          const fallback = await fetchPublicProducts({
            limit: 4 - sameBrand.length + 1,
            signal: controller.signal,
          });
          const excludedIds = new Set([product.id, ...sameBrand.map((item) => item.id)]);
          sameBrand = [...sameBrand, ...fallback.products.filter((item) => !excludedIds.has(item.id))].slice(0, 4);
        }
        if (!controller.signal.aborted) setMoreFromBrand(sameBrand);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [product?.id, product?.brand]);

  if (isProductLoading) {
    return <Container className="py-20"><div className="h-[560px] animate-pulse rounded-[28px] border border-[var(--xd-gold-border-soft)] bg-white/65" /></Container>;
  }

  if (productError) {
    return <Container className="py-20"><div role="alert" className="rounded-[28px] border border-[#F2C8C8] bg-[#FFF3F3] p-10 text-center text-[#B42318]">{productError}</div></Container>;
  }

  if (!product) {
    return <Container className="py-20"><div className="rounded-[28px] border border-[var(--xd-gold-border-soft)] bg-white/70 p-10 text-center"><h1 className="text-2xl font-bold text-[#050505]">{t("productDetail.notFound", { fallback: "Product not found" })}</h1><Button asChild variant="primary" className="mt-6"><Link href="/products">{t("common.viewAllProducts", { fallback: "View all products" })}</Link></Button></div></Container>;
  }

  const productTags = [
    productCategory,
    productName.split(" ")[0],
    t("productDetail.rootCanal"),
    t("productDetail.stainlessSteel"),
    selectedOption,
    t("productDetail.manualFiles"),
  ];
  const stockLimit = getProductStockLimit(product);
  const maximumOrderQuantity = stockLimit ?? 99;

  const showMaximumAvailable = () => {
    setStatusMessage(
      t("cart.onlyCurrentlyAvailable", {
        fallback: "Only {count} currently available.",
        values: { count: maximumOrderQuantity },
      })
    );
  };

  const handleAddToCart = () => {
    if (isOutOfStock) {
      if (!isAuthenticated) {
        navigate(`/signin?redirect=${encodeURIComponent(`/products/${product.slug || product.id}`)}`);
        return;
      }
      setStatusMessage(null);
      setCreatedRequestId(null);
      setCreatedThreadId(null);
      setRequestProductName(productName);
      setRequestSelectedProduct(product);
      setRequestMessage("");
      setRequestError(null);
      setIsRequestOpen(true);
      return;
    }

    const result = addToCart(product, quantity, selectedOption || undefined);
    if (!result.ok) {
      if (typeof result.availableQuantity === "number") showMaximumAvailable();
      return;
    }
    setStatusMessage(t("productDetail.addedToCart", { values: { name: productName } }));
  };

  const handleProductRequestSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const requestedName = requestProductName.trim();
    if (!requestedName) {
      setRequestError(t("productAutocomplete.productRequired"));
      return;
    }
    if (!Number.isInteger(quantity) || quantity < 1) {
      setRequestError(t("productAutocomplete.quantityRequired"));
      return;
    }
    setIsRequestSubmitting(true);
    setStatusMessage(null);
    setRequestError(null);
    try {
      const result = await createProductRequest({
        productId: requestSelectedProduct?.id,
        productName: requestedName,
        brand: requestSelectedProduct?.brand,
        sku: requestSelectedProduct?.sku ?? undefined,
        category: requestSelectedProduct?.category,
        quantity,
        message: requestMessage,
        source: "PRODUCT_PAGE",
      });

      // Confirm the newly-created request is readable from the same persisted
      // customer collection used by the account page before showing success.
      const persistedRequests = await getMyProductRequests();
      if (!persistedRequests.some((request) => request.id === result.productRequest.id)) {
        throw new Error("Created product request is not available in the customer request list.");
      }

      setCreatedRequestId(result.productRequest.id);
      setCreatedThreadId(result.supportThread?.id ?? result.productRequest.chatThread?.id ?? null);
      setStatusMessage(t("productDetail.productRequestSent", { fallback: "Product request sent." }));
    } catch {
      setRequestError(t("productDetail.productRequestFailed", { fallback: "Failed to send request. Please try again." }));
    } finally {
      setIsRequestSubmitting(false);
    }
  };

  const openQuoteRequest = () => {
    if (!isAuthenticated) {
      navigate(`/signin?redirect=${encodeURIComponent(`/products/${product.slug || product.id}`)}`);
      return;
    }
    setQuoteError(null);
    setCreatedQuote(null);
    setQuoteNotes("");
    setQuoteProductName(productName);
    setQuoteSelectedProduct(product);
    setIsQuoteOpen(true);
  };

  const handleQuoteSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const requestedName = quoteProductName.trim();
    if (!requestedName) {
      setQuoteError(t("quoteWorkflow.productRequired"));
      return;
    }
    if (!Number.isInteger(quantity) || quantity < 1) {
      setQuoteError(t("productAutocomplete.quantityRequired"));
      return;
    }
    setIsQuoteSubmitting(true);
    setQuoteError(null);
    try {
      const quote = await createQuote({
        notes: quoteNotes.trim() || undefined,
        items: [{
          productId: quoteSelectedProduct?.id,
          productName: requestedName,
          brand: quoteSelectedProduct?.brand,
          sku: quoteSelectedProduct?.sku ?? undefined,
          quantity,
          selectedOptions: quoteSelectedProduct?.id === product.id && selectedOption ? selectedOption : undefined,
          requestedPrice: quoteSelectedProduct?.currentPrice,
        }],
      });
      const persisted = await getMyQuote(quote.id);
      setCreatedQuote(persisted);
    } catch (requestError) {
      setQuoteError(requestError instanceof Error ? requestError.message : t("quoteWorkflow.requestError"));
    } finally {
      setIsQuoteSubmitting(false);
    }
  };

  return (
    <div className="bg-[var(--xd-bg)] pb-16 pt-12 lg:pb-20">
      <SEO
        page="productDetail"
        path={`/products/${product.slug || product.id}`}
        values={{ name: productName, brand: product.brand }}
      />
      <Container>
        <nav className="mb-8 flex flex-wrap items-center gap-2 text-[12px] font-semibold text-[#8A8D9A]">
          <Link href="/" className="transition-colors hover:text-[#050505]">
            {t("nav.home")}
          </Link>
          <DirectionalIcon direction="forward" family="chevron" size={13} />
          <Link href="/products" className="transition-colors hover:text-[#050505]">
            {t("nav.products")}
          </Link>
          <DirectionalIcon direction="forward" family="chevron" size={13} />
          <Link
            href={`/products?category=${encodeURIComponent(product.category)}`}
            className="transition-colors hover:text-[#050505]"
          >
            {productCategory}
          </Link>
          <DirectionalIcon direction="forward" family="chevron" size={13} />
          <span className="text-[#050505]">{productName}</span>
        </nav>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,540px)_minmax(0,1fr)] xl:gap-12">
          <section>
            <div className={infoCardClassName("product-media-surface overflow-hidden bg-white")}>
              <div className="aspect-square p-8 sm:p-12">
                <img
                  src={mainGalleryImage.src}
                  onError={mainGalleryImage.onError}
                  alt={productName}
                  width={2525}
                  height={2582}
                  loading="eager"
                  fetchPriority="high"
                  decoding="async"
                  className="h-full w-full object-contain mix-blend-multiply"
                />
              </div>
            </div>

            <div className="mt-4 grid grid-cols-4 gap-3">
              {galleryItems.map((image, index) => (
                <button
                  key={`${image}-${index}`}
                  type="button"
                  onClick={() => setSelectedImageIndex(index)}
                  className={cn(
                    "product-media-surface aspect-[1.18] overflow-hidden rounded-[12px] border bg-white p-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-border)]",
                    selectedImageIndex === index
                      ? "border-[var(--xd-gold-active)]"
                      : "border-[var(--xd-gold-border-soft)] hover:border-[var(--xd-gold-border-hover)]"
                  )}
                  aria-label={t("productDetail.viewProductImage", { values: { number: index + 1 } })}
                >
                  <GalleryThumbnail
                    image={image}
                    fallback={PRODUCT_IMAGE}
                    className="h-full w-full object-contain mix-blend-multiply"
                  />
                </button>
              ))}
            </div>
          </section>

          <section className="min-w-0">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <span className="inline-flex rounded-full bg-[var(--xd-gold-bg-soft)] px-3 py-1.5 text-[12px] font-bold text-[var(--xd-gold-text)]">
                  {productCategory}
                </span>
                <h1 className="mt-4 font-display text-[36px] font-bold leading-tight text-[#050505] md:text-[42px]">
                  {productName}
                </h1>
                <p className="mt-2 text-[13px] font-semibold text-[#6A6A6A]">
                  {t("productDetail.brand")} <span className="text-[#050505]">{product.brand}</span>
                  <span className="mx-2 text-[#D8D8D8]">{t("productDetail.category")}</span>
                  <span className="text-[#050505]">{productCategory}</span>
                </p>
                <span className="mt-3 inline-flex rounded-[8px] bg-[#050505]/[0.06] px-3 py-1.5 text-[12px] font-bold text-[#5F5F5F]">
                  {t("productDetail.pack")}
                </span>
              </div>

              <div className="flex shrink-0 gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="h-10 w-10"
                  aria-label={t("productDetail.shareProduct")}
                >
                  <Share2 size={17} />
                </Button>
                <Button
                  type="button"
                  onClick={() => toggleWishlist(product.id)}
                  variant="secondary"
                  size="icon"
                  className="h-10 w-10"
                  aria-label={t("productDetail.toggleWishlist")}
                >
                  <Heart
                    size={17}
                    className={isWishlisted ? "fill-[#C0392B] text-[#C0392B]" : ""}
                  />
                </Button>
              </div>
            </div>

            <div className="my-6 h-px bg-[#050505]/[0.07]" />

            <div className="flex flex-wrap items-center gap-2">
              <span className="font-display text-[28px] font-bold text-[var(--xd-gold-active)]">
                {formatCurrency(product.currentPrice)}
              </span>
              {product.oldPrice && product.oldPrice > product.currentPrice && (
                <span className="text-[18px] font-bold text-[#9A9A9A] line-through">
                  {formatCurrency(product.oldPrice)}
                </span>
              )}
              {discount > 0 && (
                <span className="rounded-full bg-[var(--xd-gold)] px-2.5 py-1 text-[12px] font-bold text-[#050505]">
                  -{discount}%
                </span>
              )}
            </div>

            {product.options && product.options.length > 0 && <div className="mt-6">
              <h2 className="text-[14px] font-bold text-[#050505]">{t("productDetail.productOptions")}</h2>
              <div className="mt-4 flex flex-wrap gap-2">{product.options.map((option) => <button key={option} type="button" onClick={() => setSelectedOption(option)} className={cn("h-9 rounded-full border px-4 text-[13px] font-bold", selectedOption === option ? "xd-gradient-gold-border bg-[var(--xd-gold-bg-soft)] text-[#7A5200]" : "border-[#050505]/10 bg-white text-[#8A8D9A]")}>{option}</button>)}</div>
            </div>}

            {isLowStock ? (
              <LowStockNotice
                product={product}
                variant="detail"
                showAvailabilityNote
                className="mt-6"
              />
            ) : (
              <p
                className={cn(
                  "mt-6 text-[13px] font-bold",
                  isOutOfStock ? "text-[#F44336]" : "text-[var(--xd-gold-text)]"
                )}
              >
                {isOutOfStock ? t("productDetail.outOfStock") : t("productDetail.stockReady")}
              </p>
            )}

            {isOutOfStock && (
              <p className="mt-2 text-[13px] leading-5 text-[#717182]">
                {t("productDetail.outOfStockRequestHelp")}
              </p>
            )}

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
              {!isOutOfStock && maximumOrderQuantity > 0 && (
                <QuantityControl
                  quantity={quantity}
                  max={maximumOrderQuantity}
                  onChange={setQuantity}
                  onMaximumReached={showMaximumAvailable}
                />
              )}
              <Button
                type="button"
                onClick={handleAddToCart}
                variant="primary"
                className="h-11 flex-1 gap-1 px-6 text-[14px]"
              >
                {isOutOfStock ? <MessageSquareText size={16} /> : <ShoppingCart size={16} />}
                {isOutOfStock ? t("productDetail.requestProduct", { fallback: "Request Product" }) : t("common.addToCart")}
              </Button>
            </div>

            <Button
              type="button"
              onClick={openQuoteRequest}
              variant="secondary"
              size="sm"
              className="mt-3 h-11 w-full text-[13px]"
            >
              {t("common.requestQuote")}
            </Button>

            {statusMessage && (
              <div
                role="status"
                className="mt-4 rounded-[14px] border border-[var(--xd-gold-border-soft)] bg-[var(--xd-gold-active)]/[0.08] px-4 py-3 text-[13px] font-semibold text-[#5F5F5F]"
              >
                {statusMessage}
              </div>
            )}

            <div className={infoCardClassName("mt-7 p-5")}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-[14px] font-bold text-[#050505]">{t("productDetail.addSupplyTitle")}</h2>
                  <p className="mt-1 text-[12px] leading-5 text-[#8A8D9A]">
                    {t("productDetail.addSupplyBody")}
                  </p>
                </div>
                <Button
                  type="button"
                  onClick={() => setStatusMessage(t("productDetail.addedToSupplyList", { values: { name: productName } }))}
                  variant="secondary"
                  size="sm"
                  className="h-9 shrink-0 px-4 text-[12px]"
                >
                  {t("productDetail.addToList")}
                </Button>
              </div>
            </div>

            <div className={infoCardClassName("mt-6 p-5")}>
              <h2 className="text-[14px] font-bold text-[#050505]">{t("productDetail.aboutBrand")}</h2>
              <div className="mt-4 flex gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-[var(--xd-gold-active)] font-display text-[18px] font-bold text-white">
                  {product.brand.charAt(0)}
                </span>
                <div>
                  <h3 className="text-[14px] font-bold text-[#050505]">{product.brand}</h3>
                  <p className="mt-1 text-[12px] leading-5 text-[#8A8D9A]">
                    {t("productDetail.brandBody", { values: { brand: product.brand } })}
                  </p>
                  <Link
                    href={`/brands`}
                    className="mt-3 inline-flex items-center gap-1 text-[12px] font-bold leading-none text-[var(--xd-gold-text)] transition-colors hover:text-[#050505]"
                  >
                    {t("productDetail.viewBrandProducts")}
                    <DirectionalIcon direction="forward" family="chevron" size={13} className="shrink-0" />
                  </Link>
                </div>
              </div>
            </div>
          </section>
        </div>

        <section className="mt-16">
          <div className="flex gap-8 overflow-x-auto border-b border-[#050505]/[0.07]">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "shrink-0 border-b-2 px-0 pb-4 text-[13px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-border)]",
                  activeTab === tab.id
                    ? "border-[var(--xd-gold-active)] text-[#050505]"
                    : "border-transparent text-[#8A8D9A] hover:text-[#050505]"
                )}
              >
                {t(tab.label)}
              </button>
            ))}
          </div>

          <div className="mt-7 max-w-[1120px] text-[14px] leading-7 text-[#5F5F5F]">
            {activeTab === "description" && (
              <div>
                <p>
                  {productDescription}
                </p>
                <ul className="mt-5 grid gap-3 text-[13px] font-semibold text-[#5F5F5F] sm:grid-cols-2">
                  <li>{t("productDetail.bullets.control")}</li>
                  <li>{t("productDetail.bullets.cutting")}</li>
                  <li>{t("productDetail.bullets.routine")}</li>
                  <li>{t("productDetail.bullets.sizes")}</li>
                </ul>
              </div>
            )}
            {activeTab === "specifications" && (
              <div className="grid max-w-[620px] gap-3 text-[13px] sm:grid-cols-2">
                <p><span className="font-bold text-[#050505]">{t("productDetail.brand")}</span> {product.brand}</p>
                <p><span className="font-bold text-[#050505]">{t("productDetail.category")}</span> {productCategory}</p>
                <p><span className="font-bold text-[#050505]">{t("common.sku")}:</span> {product.sku || `SKU-${product.id}`}</p>
                {selectedOption && <p><span className="font-bold text-[#050505]">{t("productDetail.selectedOption")}</span> {selectedOption}</p>}
              </div>
            )}
            {activeTab === "reviews" && (
              <p>{t("productDetail.reviewsBody")}</p>
            )}
            {activeTab === "shipping" && (
              <p>
                {t("productDetail.shippingBody")}
              </p>
            )}
          </div>
        </section>

        <section className="mt-12">
          <h2 className="mb-5 text-[18px] font-bold text-[#050505]">{t("productDetail.tags")}</h2>
          <div className="flex flex-wrap gap-2">
            {productTags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-[#050505]/[0.08] bg-white/70 px-3 py-1.5 text-[12px] font-semibold text-[#8A8D9A]"
              >
                {tag}
              </span>
            ))}
          </div>
        </section>

        <ProductSection
          title={t("productDetail.relatedTitle")}
          subtitle={t("productDetail.relatedSubtitle")}
          products={relatedProducts}
        />

        <ProductSection
          title={t("productDetail.moreFromBrand", { values: { brand: product.brand } })}
          subtitle={t("productDetail.moreFromBrandSubtitle")}
          products={moreFromBrand}
        />
      </Container>

      {isRequestOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/35 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={t("productDetail.requestProduct", { fallback: "Request Product" })}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsRequestOpen(false);
          }}
        >
          <div className="w-full max-w-[460px] rounded-[22px] border border-[var(--xd-gold-border-soft)] bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-display text-[24px] font-bold text-[#050505]">{t("productDetail.requestProduct", { fallback: "Request Product" })}</h2>
                <p className="mt-2 text-[14px] leading-6 text-[#717182]">{productName}</p>
              </div>
              <button type="button" onClick={() => setIsRequestOpen(false)} className="rounded-full px-2 py-1 text-xl text-[#717182]" aria-label={t("common.close", { fallback: "Close" })}>×</button>
            </div>

            {createdRequestId ? (
              <div className="mt-6 space-y-3">
                <p className="rounded-[12px] bg-[var(--xd-gold-bg-soft)] px-4 py-3 text-[14px] font-semibold text-[#5F5F5F]">{t("productDetail.productRequestSent", { fallback: "Product request sent to support." })}</p>
                <div className="flex flex-wrap gap-3">
                  <Button asChild variant="primary" size="sm"><Link href="/account/product-requests">{t("productDetail.viewProductRequests")}</Link></Button>
                  <Button asChild variant="secondary" size="sm"><Link href={createdThreadId ? `/account/support?thread=${createdThreadId}` : "/account/support"}>{t("productDetail.openSupportChat", { fallback: "Open Support Chat" })}</Link></Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleProductRequestSubmit} className="mt-6 space-y-4">
                <ProductAutocomplete
                  id="detail-product-request-name"
                  label={t("productDetail.productName", { fallback: "Product Name" })}
                  value={requestProductName}
                  selectedProductId={requestSelectedProduct?.id}
                  error={!requestProductName.trim() ? requestError ?? undefined : undefined}
                  onValueChange={(value) => {
                    setRequestProductName(value);
                    setRequestSelectedProduct(null);
                    setRequestError(null);
                  }}
                  onSelect={(selectedProduct, displayName) => {
                    setRequestProductName(displayName);
                    setRequestSelectedProduct(selectedProduct);
                    setRequestError(null);
                  }}
                />
                <label className="block">
                  <span className="mb-2 block text-[13px] font-bold text-[#050505]">{t("common.quantity")}</span>
                  <input type="number" min={1} value={quantity} onChange={(event) => setQuantity(Math.max(1, Number(event.target.value)))} className="h-11 w-full rounded-[12px] border border-[#050505]/10 px-4 text-[14px] outline-none focus:border-[var(--xd-gold-border-hover)]" />
                </label>
                <label className="block">
                  <span className="mb-2 block text-[13px] font-bold text-[#050505]">{t("productDetail.messageSupport", { fallback: "Message Support" })}</span>
                  <textarea maxLength={2000} value={requestMessage} onChange={(event) => setRequestMessage(event.target.value)} className="min-h-[110px] w-full resize-none rounded-[12px] border border-[#050505]/10 px-4 py-3 text-[14px] outline-none focus:border-[var(--xd-gold-border-hover)]" />
                </label>
                {statusMessage && (
                  <p role="alert" className="rounded-[12px] border border-[#DA2B1E]/20 bg-[#DA2B1E]/[0.06] px-4 py-3 text-[13px] font-semibold text-[#B42318]">
                    {statusMessage}
                  </p>
                )}
                {requestError && requestProductName.trim() && (
                  <p role="alert" className="rounded-[12px] border border-[#DA2B1E]/20 bg-[#DA2B1E]/[0.06] px-4 py-3 text-[13px] font-semibold text-[#B42318]">
                    {requestError}
                  </p>
                )}
                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                  <Button type="button" disabled={isRequestSubmitting} onClick={() => setIsRequestOpen(false)} variant="secondary" size="sm">
                    {t("common.cancel")}
                  </Button>
                  <Button type="submit" disabled={isRequestSubmitting} variant="primary" size="sm">
                    {isRequestSubmitting ? t("common.loading", { fallback: "Loading..." }) : t("productDetail.submitRequest", { fallback: "Submit Request" })}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {isQuoteOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/35 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={t("quoteWorkflow.quoteRequest")}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsQuoteOpen(false);
          }}
        >
          <div className="w-full max-w-[500px] rounded-[22px] border border-[var(--xd-gold-border-soft)] bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4"><div><p className="text-[12px] font-bold uppercase tracking-[0.16em] text-[var(--xd-gold-active)]">{t("quoteWorkflow.quoteRequest")}</p><h2 className="mt-2 font-display text-[24px] font-bold text-[#050505]">{t("quoteWorkflow.requestQuote")}</h2></div><button type="button" onClick={() => setIsQuoteOpen(false)} className="rounded-full px-2 py-1 text-xl text-[#717182]" aria-label={t("common.close", { fallback: "Close" })}>×</button></div>
            {createdQuote ? (
              <div className="mt-6 space-y-4"><div className="rounded-[14px] border border-[#16803C]/20 bg-[#16803C]/10 px-4 py-4"><p className="text-[14px] font-semibold text-[#16803C]">{t("quoteWorkflow.requestSubmitted", { values: { quoteNumber: createdQuote.quoteNumber } })}</p><p className="mt-1 text-[13px] text-[#5F5F5F]">{createdQuote.quoteNumber}</p></div><div className="flex flex-wrap gap-3"><Button asChild variant="primary" size="sm"><Link href="/account/quotes">{t("quoteWorkflow.viewMyQuotes")}</Link></Button><Button asChild variant="secondary" size="sm"><Link href={createdQuote.supportThreadId ? `/account/support?thread=${createdQuote.supportThreadId}` : "/account/support"}>{t("quoteWorkflow.openSupportChat")}</Link></Button></div></div>
            ) : (
              <form onSubmit={handleQuoteSubmit} className="mt-6 space-y-4">
                <ProductAutocomplete
                  id="detail-quote-product"
                  label={t("quoteWorkflow.productOrRequest")}
                  value={quoteProductName}
                  selectedProductId={quoteSelectedProduct?.id}
                  error={!quoteProductName.trim() ? quoteError ?? undefined : undefined}
                  onValueChange={(value) => {
                    setQuoteProductName(value);
                    setQuoteSelectedProduct(null);
                    setQuoteError(null);
                  }}
                  onSelect={(selectedProduct, displayName) => {
                    setQuoteProductName(displayName);
                    setQuoteSelectedProduct(selectedProduct);
                    setQuoteError(null);
                  }}
                />
                <label className="block"><span className="mb-2 block text-[13px] font-bold text-[#050505]">{t("common.quantity")}</span><input type="number" min={1} max={10000} value={quantity} onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))} className="h-11 w-full rounded-[12px] border border-[#050505]/10 px-4 text-[14px] outline-none focus:border-[var(--xd-gold-border-hover)]" /></label>
                {quoteSelectedProduct?.id === product.id && selectedOption && <div><p className="mb-2 text-[13px] font-bold text-[#050505]">{t("quoteWorkflow.selectedOptions")}</p><p className="rounded-[12px] bg-[#FBFAF7] px-4 py-3 text-[14px] text-[#5F5F5F]">{selectedOption}</p></div>}
                <label className="block"><span className="mb-2 block text-[13px] font-bold text-[#050505]">{t("quoteWorkflow.customerMessage")}</span><textarea maxLength={4000} value={quoteNotes} onChange={(event) => setQuoteNotes(event.target.value)} className="min-h-[110px] w-full resize-none rounded-[12px] border border-[#050505]/10 px-4 py-3 text-[14px] outline-none focus:border-[var(--xd-gold-border-hover)]" /></label>
                {quoteError && quoteProductName.trim() && <p role="alert" className="rounded-[12px] border border-[#DA2B1E]/20 bg-[#DA2B1E]/[0.06] px-4 py-3 text-[13px] font-semibold text-[#B42318]">{quoteError}</p>}
                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                  <Button type="button" disabled={isQuoteSubmitting} onClick={() => setIsQuoteOpen(false)} variant="secondary" size="sm">{t("common.cancel")}</Button>
                  <Button type="submit" disabled={isQuoteSubmitting} variant="primary" size="sm">{isQuoteSubmitting ? t("quoteWorkflow.submitting") : t("quoteWorkflow.submitRequest")}</Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
