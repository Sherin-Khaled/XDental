import React from "react";
import { Link, useLocation } from "wouter";
import { Heart, MessageSquareText, ShoppingCart } from "lucide-react";
import { Button } from "@/components/dental/Button";
import { LowStockNotice, isLowStockProduct } from "@/components/dental/StockAvailability";
import { formatCurrency, calculateDiscount } from "@/utils";
import { useStore } from "@/context/StoreContext";
import { useLanguage } from "@/context/LanguageContext";
import { getCategoryTranslationKey, getLocalizedProductName } from "@/lib/catalogTranslations";
import { isProductPurchasable } from "@/lib/cartStock";
import { useImageFallback } from "@/hooks/use-image-fallback";
import type { Product } from "@/types/product";

interface ProductCardProps {
  product: Product;
  imageLoading?: React.ImgHTMLAttributes<HTMLImageElement>["loading"];
  imageFetchPriority?: React.ImgHTMLAttributes<HTMLImageElement>["fetchPriority"];
}

const PRODUCT_CARD_IMAGE = `${import.meta.env.BASE_URL}toothtools.webp`;

export function ProductCard({
  product,
  imageLoading = "lazy",
  imageFetchPriority = "auto",
}: ProductCardProps) {
  const { addToCart, toggleWishlist, isInWishlist } = useStore();
  const [, navigate] = useLocation();
  const { t, language } = useLanguage();
  const isWishlisted = isInWishlist(product.id);
  const isOutOfStock = !isProductPurchasable(product);
  const isLowStock = isLowStockProduct(product);
  const productHref = `/products/${encodeURIComponent(product.slug || product.id)}`;
  const discount = calculateDiscount(product.oldPrice ?? undefined, product.currentPrice);
  const productName = getLocalizedProductName(product, language, t);
  const productCategory = t(`products.items.${product.id}.category`, {
    fallback: t(getCategoryTranslationKey(product.category), { fallback: product.category }),
  });
  const cardImage = useImageFallback(product.image, PRODUCT_CARD_IMAGE);

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isOutOfStock) {
      navigate(productHref);
      return;
    }

    addToCart(product, 1, product.options?.[0]);
  };

  const handleToggleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleWishlist(product.id);
  };

  return (
    <Link
      href={productHref}
      className="product-card group block h-full min-w-0 overflow-visible rounded-[24px] outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-active)]"
      data-testid={`link-product-${product.id}`}
    >
      <div
        className="product-card-shell flex h-full min-w-0 flex-col rounded-[22px] border border-[var(--xd-gold-border-soft)] bg-[var(--xd-card-glass)] shadow-[var(--xd-shadow-card)] transition-[transform,border-color,box-shadow] duration-300 ease-out group-hover:-translate-y-[2px] group-hover:border-[var(--xd-gold-border-hover)] group-hover:shadow-[var(--xd-shadow-hover)] motion-reduce:transition-none motion-reduce:group-hover:translate-y-0 sm:rounded-[24px]"
      >
        {/* Image area */}
        <div className="product-card-image relative h-[180px] overflow-hidden rounded-t-[22px] bg-white sm:h-[200px] sm:rounded-t-[24px]">
          {/* Discount badge — top left */}
          {discount > 0 && (
            <div
              className="absolute left-3 top-3 z-10 px-2.5 py-1 text-[12px] font-bold sm:left-4 sm:top-4"
              style={{ background: "var(--xd-gold)", color: "#050505", borderRadius: 24 }}
            >
              -{discount}%
            </div>
          )}

          {/* Wishlist — top right, no background */}
          <Button
            type="button"
            onClick={handleToggleWishlist}
            variant="tertiary"
            size="icon"
            className="group/wishlist absolute right-3 top-3 z-10 h-8 w-8 transition-transform duration-200 hover:scale-105 hover:bg-transparent active:scale-95 motion-reduce:transition-none motion-reduce:hover:scale-100 motion-reduce:active:scale-100 sm:right-4 sm:top-4"
            data-testid={`button-wishlist-${product.id}`}
            aria-label={t("productDetail.toggleWishlist")}
          >
            <Heart
              size={18}
              strokeWidth={1.75}
              className={
                isWishlisted
                  ? "fill-[#C0392B] text-[#C0392B] transition-[color,fill] duration-200"
                  : "text-[#9A9A9A] transition-[color,fill] duration-200 group-hover/wishlist:text-[#C0392B]"
              }
            />
          </Button>

          {/* Product image */}
          <img
            src={cardImage.src}
            onError={cardImage.onError}
            alt={productName}
            width={2525}
            height={2582}
            className="product-card-img h-full w-full object-contain p-2.5 mix-blend-multiply transition-transform duration-500 ease-out group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100 sm:p-3"
            loading={imageLoading}
            fetchPriority={imageFetchPriority}
            decoding="async"
          />
        </div>

        {/* Content */}
        <div className="product-card-content flex min-w-0 flex-1 flex-col gap-1 px-4 py-4 sm:p-4 sm:pt-3">
          {/* Category */}
          <div className="truncate text-[12px] font-medium text-[#9A9A9A]">{productCategory}</div>

          {/* Product name */}
          <h3
            className="product-card-title block w-full min-w-0 truncate whitespace-nowrap font-display font-semibold leading-snug text-[#050505]"
            style={{ fontSize: 15 }}
            title={productName}
          >
            {productName}
          </h3>

          {/* Price row */}
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[16px] font-bold" style={{ color: "var(--xd-gold-text)" }}>
              {formatCurrency(product.currentPrice)}
            </span>
            {product.oldPrice && product.oldPrice > product.currentPrice && (
              <span className="text-[13px] text-[#B0B0B0] line-through">
                {formatCurrency(product.oldPrice)}
              </span>
            )}
          </div>

          <div className="mt-1 flex min-h-7 items-center">
            {isLowStock ? (
              <LowStockNotice product={product} />
            ) : isOutOfStock ? (
              <p className="text-[12px] font-bold text-[#C0392B]">
                {t("productDetail.outOfStock")}
              </p>
            ) : null}
          </div>

          {/* Stock-aware primary action */}
          <div className="mt-auto pt-3">
            <Button
              type="button"
              onClick={handleAddToCart}
              variant="primary"
              size="sm"
              className="product-card-action h-10 w-full gap-1 text-[13px] font-semibold sm:h-[42px]"
              data-testid={`${isOutOfStock ? "button-request-product" : "button-add-cart"}-${product.id}`}
            >
              {isOutOfStock ? <MessageSquareText size={15} strokeWidth={2} /> : <ShoppingCart size={15} strokeWidth={2} />}
              {isOutOfStock ? t("productDetail.requestProduct") : t("common.addToCart")}
            </Button>
          </div>
        </div>
      </div>
    </Link>
  );
}
