import { useMemo, useState, type FormEvent } from "react";
import { Link, useLocation, useParams } from "wouter";
import {
  Heart,
  Minus,
  Plus,
  Share2,
  ShoppingCart,
} from "lucide-react";
import { DirectionalIcon } from "@/components/DirectionalIcon";
import { Button } from "@/components/dental/Button";
import { Container } from "@/components/dental/Container";
import { ProductCard } from "@/components/dental/ProductCard";
import { useStore } from "@/context/StoreContext";
import { mockProducts } from "@/data/products";
import { cn } from "@/lib/utils";
import { calculateDiscount, formatCurrency } from "@/utils";
import { SEO } from "@/components/SEO";
import { useLanguage } from "@/context/LanguageContext";
import { getCategoryTranslationKey } from "@/lib/catalogTranslations";
import { createProductRequest } from "@/services/productRequests";

type DetailTab = "description" | "specifications" | "reviews" | "shipping";

const PRODUCT_IMAGE = `${import.meta.env.BASE_URL}toothtools.png`;
const lengthOptions = ["21mm", "25mm", "31mm"];
const sizeOptions = ["K10", "K15", "K20", "K25"];
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

function OptionButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-9 rounded-full border px-4 text-[13px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-border)]",
        active
          ? "border-[var(--xd-gold-active)] bg-[var(--xd-gold-bg-soft)] text-[#7A5200]"
          : "border-[#050505]/10 bg-white text-[#8A8D9A] hover:border-[var(--xd-gold-border)] hover:text-[#050505]"
      )}
    >
      {label}
    </button>
  );
}

function QuantityControl({
  quantity,
  onChange,
}: {
  quantity: number;
  onChange: (quantity: number) => void;
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
      <span className="w-9 text-center text-[14px] font-bold text-[#050505]">{quantity}</span>
      <button
        type="button"
        onClick={() => onChange(Math.min(99, quantity + 1))}
        className="flex h-full w-10 items-center justify-center rounded-r-full text-[#8A8D9A] transition-colors hover:text-[#050505]"
        aria-label={t("cart.increaseQuantity")}
      >
        <Plus size={15} />
      </button>
    </div>
  );
}

function ProductSection({
  title,
  subtitle,
  products,
}: {
  title: string;
  subtitle: string;
  products: typeof mockProducts;
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
  const { t } = useLanguage();
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [selectedLength, setSelectedLength] = useState("25mm");
  const [selectedSize, setSelectedSize] = useState("K20");
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState<DetailTab>("description");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isRequestOpen, setIsRequestOpen] = useState(false);
  const [requestMessage, setRequestMessage] = useState("");
  const [isRequestSubmitting, setIsRequestSubmitting] = useState(false);
  const [createdThreadId, setCreatedThreadId] = useState<string | null>(null);

  const product = mockProducts.find((item) => item.id === id) ?? mockProducts[0];
  const productName = t(`products.items.${product.id}.name`, { fallback: product.name });
  const productCategory = t(`products.items.${product.id}.category`, {
    fallback: t(getCategoryTranslationKey(product.category), { fallback: product.category }),
  });
  const productDescription = t(`products.items.${product.id}.description`, {
    fallback: product.description ?? t("productDetail.defaultDescription"),
  });
  const discount = calculateDiscount(product.oldPrice ?? undefined, product.currentPrice);
  const isWishlisted = isInWishlist(product.id);
  const isOutOfStock = product.stockStatus === "Out of Stock";
  const selectedOption = `${selectedLength} / ${selectedSize}`;
  const galleryItems = [PRODUCT_IMAGE, PRODUCT_IMAGE, PRODUCT_IMAGE, PRODUCT_IMAGE];

  const relatedProducts = useMemo(() => {
    const sameCategory = mockProducts.filter(
      (item) => item.id !== product.id && item.category === product.category
    );
    const fallback = mockProducts.filter((item) => item.id !== product.id);

    return [...sameCategory, ...fallback]
      .filter(
        (item, index, products) =>
          products.findIndex((candidate) => candidate.id === item.id) === index
      )
      .slice(0, 4);
  }, [product]);

  const moreFromBrand = useMemo(() => {
    const sameBrand = mockProducts.filter(
      (item) => item.id !== product.id && item.brand === product.brand
    );
    const fallback = mockProducts.filter((item) => item.id !== product.id);

    return [...sameBrand, ...fallback]
      .filter(
        (item, index, products) =>
          products.findIndex((candidate) => candidate.id === item.id) === index
      )
      .slice(0, 4);
  }, [product]);

  const productTags = [
    productCategory,
    productName.split(" ")[0],
    t("productDetail.rootCanal"),
    t("productDetail.stainlessSteel"),
    selectedLength,
    t("productDetail.manualFiles"),
  ];

  const handleAddToCart = () => {
    if (isOutOfStock) {
      if (!isAuthenticated) {
        navigate(`/signin?redirect=${encodeURIComponent(`/products/${product.id}`)}`);
        return;
      }
      setCreatedThreadId(null);
      setIsRequestOpen(true);
      return;
    }

    addToCart(product, quantity, selectedOption);
    setStatusMessage(t("productDetail.addedToCart", { values: { name: productName } }));
  };

  const handleProductRequestSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsRequestSubmitting(true);
    setStatusMessage(null);
    try {
      const result = await createProductRequest({
        productId: product.id,
        productName,
        brand: product.brand,
        sku: product.sku ?? undefined,
        category: product.category,
        quantity,
        message: requestMessage,
        source: "PRODUCT_PAGE",
      });
      setCreatedThreadId(result.supportThread.id);
      setStatusMessage(t("productDetail.productRequestSent", { fallback: "Product request sent." }));
    } catch {
      setStatusMessage(t("productDetail.productRequestFailed", { fallback: "Failed to send request. Please try again." }));
    } finally {
      setIsRequestSubmitting(false);
    }
  };

  return (
    <div className="bg-[var(--xd-bg)] pb-16 pt-12 lg:pb-20">
      <SEO
        page="productDetail"
        path={`/products/${product.id}`}
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
            <div className={infoCardClassName("overflow-hidden bg-white")}>
              <div className="aspect-square p-8 sm:p-12">
                <img
                  src={galleryItems[selectedImageIndex]}
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
                    "aspect-[1.18] overflow-hidden rounded-[12px] border bg-white p-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-border)]",
                    selectedImageIndex === index
                      ? "border-[var(--xd-gold-active)]"
                      : "border-[var(--xd-gold-border-soft)] hover:border-[var(--xd-gold-border-hover)]"
                  )}
                  aria-label={t("productDetail.viewProductImage", { values: { number: index + 1 } })}
                >
                  <img
                    src={image}
                    alt=""
                    width={2525}
                    height={2582}
                    loading="lazy"
                    decoding="async"
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

            <div className="mt-6">
              <h2 className="text-[14px] font-bold text-[#050505]">{t("productDetail.productOptions")}</h2>

              <div className="mt-4">
                <p className="mb-2 text-[13px] font-bold text-[#050505]">{t("productDetail.length")}</p>
                <div className="flex flex-wrap gap-2">
                  {lengthOptions.map((option) => (
                    <OptionButton
                      key={option}
                      label={option}
                      active={selectedLength === option}
                      onClick={() => setSelectedLength(option)}
                    />
                  ))}
                </div>
              </div>

              <div className="mt-5">
                <p className="mb-2 text-[13px] font-bold text-[#050505]">{t("productDetail.size")}</p>
                <div className="flex flex-wrap gap-2">
                  {sizeOptions.map((option) => (
                    <OptionButton
                      key={option}
                      label={option}
                      active={selectedSize === option}
                      onClick={() => setSelectedSize(option)}
                    />
                  ))}
                </div>
              </div>
            </div>

            <p
              className={cn(
                "mt-6 text-[13px] font-bold",
                isOutOfStock ? "text-[#F44336]" : "text-[var(--xd-gold-text)]"
              )}
            >
              {isOutOfStock ? t("productDetail.stockNotify") : t("productDetail.stockReady")}
            </p>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
              <QuantityControl quantity={quantity} onChange={setQuantity} />
              <Button
                type="button"
                onClick={handleAddToCart}
                variant="primary"
                className="h-11 flex-1 gap-1 px-6 text-[14px]"
              >
                <ShoppingCart size={16} />
                {isOutOfStock ? t("productDetail.requestProduct", { fallback: "Request Product" }) : t("common.addToCart")}
              </Button>
            </div>

            <Button
              type="button"
              onClick={() => setStatusMessage(t("productDetail.quoteStarted", { values: { name: productName } }))}
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
                <p><span className="font-bold text-[#050505]">{t("productDetail.selectedOption")}</span> {selectedOption}</p>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4" role="dialog" aria-modal="true" aria-label={t("productDetail.requestProduct", { fallback: "Request Product" })}>
          <div className="w-full max-w-[460px] rounded-[22px] border border-[var(--xd-gold-border-soft)] bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-display text-[24px] font-bold text-[#050505]">{t("productDetail.requestProduct", { fallback: "Request Product" })}</h2>
                <p className="mt-2 text-[14px] leading-6 text-[#717182]">{productName}</p>
              </div>
              <button type="button" onClick={() => setIsRequestOpen(false)} className="rounded-full px-2 py-1 text-xl text-[#717182]" aria-label={t("common.close", { fallback: "Close" })}>×</button>
            </div>

            {createdThreadId ? (
              <div className="mt-6 space-y-3">
                <p className="rounded-[12px] bg-[var(--xd-gold-bg-soft)] px-4 py-3 text-[14px] font-semibold text-[#5F5F5F]">{t("productDetail.productRequestSent", { fallback: "Product request sent to support." })}</p>
                <div className="flex flex-wrap gap-3">
                  <Button asChild variant="primary" size="sm"><Link href="/account/product-requests">{t("account.productRequests")}</Link></Button>
                  <Button asChild variant="secondary" size="sm"><Link href={`/account/support?thread=${createdThreadId}`}>{t("productDetail.openSupportChat", { fallback: "Open Support Chat" })}</Link></Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleProductRequestSubmit} className="mt-6 space-y-4">
                <label className="block">
                  <span className="mb-2 block text-[13px] font-bold text-[#050505]">{t("common.quantity")}</span>
                  <input type="number" min={1} value={quantity} onChange={(event) => setQuantity(Math.max(1, Number(event.target.value)))} className="h-11 w-full rounded-[12px] border border-[#050505]/10 px-4 text-[14px] outline-none focus:border-[var(--xd-gold-border-hover)]" />
                </label>
                <label className="block">
                  <span className="mb-2 block text-[13px] font-bold text-[#050505]">{t("productDetail.messageSupport", { fallback: "Message Support" })}</span>
                  <textarea maxLength={2000} value={requestMessage} onChange={(event) => setRequestMessage(event.target.value)} className="min-h-[110px] w-full resize-none rounded-[12px] border border-[#050505]/10 px-4 py-3 text-[14px] outline-none focus:border-[var(--xd-gold-border-hover)]" />
                </label>
                <Button type="submit" disabled={isRequestSubmitting} variant="primary" className="w-full">
                  {isRequestSubmitting ? t("common.loading", { fallback: "Loading..." }) : t("productDetail.requestProduct", { fallback: "Request Product" })}
                </Button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
