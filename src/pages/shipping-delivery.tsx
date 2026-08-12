import { useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  CheckCircle2,
  ClipboardCheck,
  PackageCheck,
  PackageSearch,
  ShoppingCart,
  Truck,
} from "lucide-react";
import { Link } from "wouter";
import { DirectionalIcon } from "@/components/DirectionalIcon";
import { Button } from "@/components/dental/Button";
import { SectionReveal } from "@/components/dental/SectionReveal";
import { SEO } from "@/components/SEO";
import { useLanguage } from "@/context/LanguageContext";
import { getLocalizedProductName } from "@/lib/catalogTranslations";
import { useStore } from "@/context/StoreContext";
import { CATALOG_FALLBACK_IMAGE, fetchPublicProducts } from "@/services/catalog";
import type { Product } from "@/types/product";
import { formatCurrency } from "@/utils";

type DeliverySection = {
  id: string;
  paragraphs: string[];
  bullets?: string[];
  cta?: { href: string };
};

type DeliveryStep = {
  id: string;
  Icon: LucideIcon;
};

const FAST_DELIVERY_LIMIT = 8;

const DELIVERY_STEPS: DeliveryStep[] = [
  {
    id: "confirmOrder",
    Icon: ClipboardCheck,
  },
  {
    id: "prepareDispatch",
    Icon: PackageCheck,
  },
  {
    id: "receiveDelivery",
    Icon: Truck,
  },
];

const DELIVERY_SECTIONS: DeliverySection[] = [
  {
    id: "coverage",
    paragraphs: ["paragraph1", "paragraph2"],
  },
  {
    id: "confirmation",
    paragraphs: ["paragraph1", "paragraph2"],
  },
  {
    id: "standard",
    paragraphs: ["paragraph1", "paragraph2"],
  },
  {
    id: "fastDelivery",
    paragraphs: ["paragraph1", "paragraph2"],
    bullets: ["bullet1", "bullet2", "bullet3", "bullet4", "bullet5"],
  },
  {
    id: "fees",
    paragraphs: ["paragraph1", "paragraph2"],
  },
  {
    id: "cashOnDelivery",
    paragraphs: ["paragraph1", "paragraph2"],
  },
  {
    id: "specialProducts",
    paragraphs: ["paragraph1", "paragraph2"],
    cta: { href: "/contact" },
  },
  {
    id: "failedDelivery",
    paragraphs: ["paragraph1", "paragraph2"],
  },
  {
    id: "orderIssues",
    paragraphs: ["paragraph1", "paragraph2"],
  },
  {
    id: "delays",
    paragraphs: ["paragraph1"],
  },
  {
    id: "updates",
    paragraphs: ["paragraph1"],
  },
];

function isFastDeliveryProduct(product: Product) {
  return Boolean(product.isFastDelivery) || product.deliveryLabel?.trim().toLowerCase() === "fast delivery";
}

function getProductHref(product: Product) {
  return `/products/${encodeURIComponent(product.slug || product.id)}`;
}

export default function ShippingDelivery() {
  const { isRtl, t } = useLanguage();
  const [candidateProducts, setCandidateProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Small, bounded fetch — this section only ever needs a handful of
  // fast-delivery products, never the full catalogue.
  useEffect(() => {
    const controller = new AbortController();
    fetchPublicProducts({ limit: FAST_DELIVERY_LIMIT * 3, signal: controller.signal })
      .then(({ products: page }) => {
        if (!controller.signal.aborted) setCandidateProducts(page);
      })
      .catch(() => {})
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, []);

  const fastDeliveryProducts = useMemo(
    () => candidateProducts.filter(isFastDeliveryProduct),
    [candidateProducts]
  );
  const visibleFastDeliveryProducts = fastDeliveryProducts.slice(0, FAST_DELIVERY_LIMIT);
  const hasMoreFastDeliveryProducts = fastDeliveryProducts.length > visibleFastDeliveryProducts.length;

  return (
    <main dir={isRtl ? "rtl" : "ltr"} className="box-border min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-[var(--xd-bg)] text-[var(--xd-text)]">
      <SEO
        page="shippingDelivery"
        title={t("shippingDeliveryPage.seoTitle")}
        titleFormat="exact"
        description={t("shippingDeliveryPage.seoDescription")}
      />

      <section className="box-border w-full max-w-[100vw] px-5 pb-16 pt-14 sm:px-8 sm:pt-16 lg:px-12 lg:pb-24 lg:pt-20">
        <div className="mx-auto w-full max-w-[1344px]">
          <SectionReveal className="border-b border-[#050505]/10 pb-10 lg:pb-12">
            <div className="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0 max-w-[780px]">
                <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-[var(--xd-gold-text)]">
                  {t("shippingDeliveryPage.eyebrow")}
                </p>
                <h1 className="mt-4 font-display text-[40px] font-semibold leading-[1.04] tracking-[-0.035em] sm:text-[52px] lg:text-[64px]">
                  {t("shippingDeliveryPage.title")}
                </h1>
                <p className="mt-5 max-w-[680px] text-[15px] leading-[26px] text-[var(--xd-muted-2)] sm:text-[16px]">
                  {t("shippingDeliveryPage.description")}
                </p>
              </div>

              <div className="flex shrink-0 flex-col items-start gap-5 lg:items-end">
                <div className="text-start lg:text-end">
                  <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--xd-muted-2)]">
                    {t("shippingDeliveryPage.lastUpdatedLabel")}
                  </p>
                  <p className="mt-1 text-[15px] font-semibold text-[var(--xd-text)]">
                    {t("shippingDeliveryPage.lastUpdatedDate")}
                  </p>
                </div>
                <Button asChild variant="primary" size="sm" className="w-fit gap-2 px-5 text-[13px]">
                  <Link href="/contact">
                    {t("shippingDeliveryPage.contactSupport")}
                    <DirectionalIcon size={15} aria-hidden="true" />
                  </Link>
                </Button>
              </div>
            </div>
          </SectionReveal>

          <SectionReveal delay={0.04} className="border-b border-[#050505]/10 py-12 lg:py-14">
            <div className="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-[720px]">
                <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--xd-gold-text)]">
                  {t("shippingDeliveryPage.fastProducts.eyebrow")}
                </p>
                <h2 className="mt-3 font-display text-[30px] font-semibold leading-[1.14] tracking-[-0.025em] sm:text-[38px]">
                  {t("shippingDeliveryPage.fastProducts.title")}
                </h2>
                <p className="mt-3 text-[15px] leading-[26px] text-[var(--xd-muted-2)]">
                  {t("shippingDeliveryPage.fastProducts.description")}
                </p>
              </div>

              {hasMoreFastDeliveryProducts && (
                <Button asChild variant="primary" size="sm" className="w-fit shrink-0 gap-2 px-5 text-[13px]">
                  <Link href="/products?isFastDelivery=true">
                    {t("shippingDeliveryPage.fastProducts.viewAll")}
                    <DirectionalIcon size={15} aria-hidden="true" />
                  </Link>
                </Button>
              )}
            </div>

            {isLoading ? (
              <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 4 }, (_, index) => (
                  <div key={index} className="h-[340px] animate-pulse rounded-[22px] border border-[var(--xd-gold-border-soft)] bg-white/70" />
                ))}
              </div>
            ) : visibleFastDeliveryProducts.length > 0 ? (
              <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {visibleFastDeliveryProducts.map((product) => (
                  <FastDeliveryProductCard key={product.id} product={product} />
                ))}
              </div>
            ) : (
              <div className="mt-8 rounded-[22px] border border-[var(--xd-gold-border-soft)] bg-white/70 px-6 py-10 text-center">
                <PackageSearch className="mx-auto text-[var(--xd-gold-text)]" size={30} strokeWidth={1.8} />
                <p className="mt-4 text-[15px] font-semibold text-[var(--xd-text)]">
                  {t("shippingDeliveryPage.fastProducts.emptyTitle")}
                </p>
                <p className="mx-auto mt-2 max-w-[520px] text-[14px] leading-[23px] text-[var(--xd-muted-2)]">
                  {t("shippingDeliveryPage.fastProducts.emptyDescription")}
                </p>
              </div>
            )}
          </SectionReveal>

          <SectionReveal delay={0.08} className="border-b border-[#050505]/10 py-12 lg:py-14">
            <div className="grid gap-5 md:grid-cols-3">
              {DELIVERY_STEPS.map(({ id, Icon }, index) => (
                <article key={id} className="rounded-[22px] border border-[var(--xd-gold-border-soft)] bg-white/70 p-6 shadow-[0_12px_34px_rgba(5,5,5,0.04)]">
                  <div className="flex items-center justify-between gap-4">
                    <span className="flex h-11 w-11 items-center justify-center rounded-[12px] bg-[var(--xd-gold-bg-soft)] text-[var(--xd-gold-text)]">
                      <Icon size={19} strokeWidth={1.9} aria-hidden="true" />
                    </span>
                    <span className="text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--xd-gold-text)]">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <h2 className="mt-5 font-display text-[22px] font-semibold leading-[1.24] tracking-[-0.02em]">
                    {t(`shippingDeliveryPage.steps.${id}.title`)}
                  </h2>
                  <p className="mt-3 text-[14px] leading-[24px] text-[var(--xd-muted-2)]">
                    {t(`shippingDeliveryPage.steps.${id}.description`)}
                  </p>
                </article>
              ))}
            </div>
          </SectionReveal>

          <div className="grid gap-12 pt-12 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-16 lg:pt-14">
            <div className="space-y-12">
              {DELIVERY_SECTIONS.map((section, index) => (
                <section key={section.id} className="grid min-w-0 gap-4 border-b border-[#050505]/[0.07] pb-10 last:border-b-0 last:pb-0 sm:grid-cols-[72px_minmax(0,1fr)] sm:gap-8">
                  <div className="text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--xd-gold-text)]">
                    {String(index + 1).padStart(2, "0")}
                  </div>
                  <div className="min-w-0">
                    <h2 className="font-display text-[22px] font-semibold leading-[1.22] tracking-[-0.02em] text-[var(--xd-text)] sm:text-[26px]">
                      {t(`shippingDeliveryPage.sections.${section.id}.title`)}
                    </h2>
                    <div className="mt-4 space-y-4">
                      {section.paragraphs.map((paragraphKey) => (
                        <p key={paragraphKey} className="max-w-[860px] break-words text-[15px] leading-[27px] text-[var(--xd-muted-2)]">
                          {t(`shippingDeliveryPage.sections.${section.id}.${paragraphKey}`)}
                        </p>
                      ))}
                    </div>
                    {section.bullets && (
                      <ul className="mt-5 grid gap-3">
                        {section.bullets.map((bulletKey) => (
                          <li key={bulletKey} className="flex max-w-[860px] items-start gap-3 text-[14px] leading-[24px] text-[var(--xd-muted-2)]">
                            <CheckCircle2 className="mt-0.5 shrink-0 text-[var(--xd-gold-text)]" size={17} strokeWidth={2} aria-hidden="true" />
                            <span>{t(`shippingDeliveryPage.sections.${section.id}.${bulletKey}`)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {section.cta && (
                      <Button asChild variant="primary" size="sm" className="mt-6 w-fit gap-2 px-5 text-[13px]">
                        <Link href={section.cta.href}>
                          {t(`shippingDeliveryPage.sections.${section.id}.cta`)}
                          <DirectionalIcon size={15} aria-hidden="true" />
                        </Link>
                      </Button>
                    )}
                  </div>
                </section>
              ))}
            </div>

            <aside className="lg:sticky lg:top-32 lg:h-fit">
              <SectionReveal delay={0.1} className="border-s-2 border-[var(--xd-gold)] ps-5">
                <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--xd-gold-text)]">
                  {t("shippingDeliveryPage.sidebar.title")}
                </p>
                <p className="mt-3 text-[14px] leading-[24px] text-[var(--xd-muted-2)]">
                  {t("shippingDeliveryPage.sidebar.description")}
                </p>
                <Button asChild variant="primary" size="sm" className="mt-6 w-fit gap-2 px-5 text-[13px]">
                  <Link href="/contact">
                    {t("shippingDeliveryPage.contactSupport")}
                    <DirectionalIcon size={15} aria-hidden="true" />
                  </Link>
                </Button>
              </SectionReveal>
            </aside>
          </div>
        </div>
      </section>
    </main>
  );
}

function FastDeliveryProductCard({ product }: { product: Product }) {
  const { addToCart } = useStore();
  const { t, language } = useLanguage();
  const productHref = getProductHref(product);
  const productName = getLocalizedProductName(product, language, t);
  const isOutOfStock = product.available === false || product.stockStatus === "Out of Stock";

  const handleAddToCart = () => {
    if (isOutOfStock) return;
    addToCart(product, 1, product.options?.[0]);
  };

  return (
    <article className="flex min-w-0 flex-col overflow-hidden rounded-[22px] border border-[var(--xd-gold-border-soft)] bg-[var(--xd-card-glass)] shadow-[var(--xd-shadow-card)] transition-[transform,border-color,box-shadow] duration-300 hover:-translate-y-[2px] hover:border-[var(--xd-gold-border-hover)] hover:shadow-[var(--xd-shadow-hover)]">
      <Link href={productHref} className="relative block h-[180px] bg-white outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-focus-ring)]">
        <span className="absolute left-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-full border border-[var(--xd-gold-border-soft)] bg-[var(--xd-gold-bg-soft)] px-2.5 py-1 text-[11px] font-bold text-[var(--xd-gold-text)]">
          <Truck size={13} strokeWidth={2} aria-hidden="true" />
          {t("shippingDeliveryPage.fastProducts.badge")}
        </span>
        <img
          src={product.image || CATALOG_FALLBACK_IMAGE}
          alt={productName}
          className="h-full w-full object-contain p-4 mix-blend-multiply"
          loading="lazy"
          decoding="async"
        />
      </Link>

      <div className="flex flex-1 flex-col p-4">
        <p className="text-[12px] font-semibold text-[#8A8D9A]">
          {product.brand || "X Dental"}
        </p>
        <Link href={productHref} className="mt-1 outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-focus-ring)]">
          <h3 className="line-clamp-2 font-display text-[15px] font-semibold leading-snug text-[#050505]">
            {productName}
          </h3>
        </Link>
        <p className="mt-2 text-[12px] leading-[19px] text-[var(--xd-muted-2)]">
          {t("shippingDeliveryPage.fastProducts.cardDescription")}
        </p>
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-[16px] font-bold text-[var(--xd-gold-text)]">
            {formatCurrency(product.currentPrice)}
          </span>
          {isOutOfStock && (
            <span className="rounded-full bg-[#B42318]/10 px-2 py-1 text-[11px] font-bold text-[#B42318]">
              {t("shippingDeliveryPage.fastProducts.outOfStock")}
            </span>
          )}
        </div>

        {isOutOfStock ? (
          <Button asChild variant="secondary" size="sm" className="mt-4 h-10 w-full gap-1 text-[13px]">
            <Link href={productHref}>
              {t("shippingDeliveryPage.fastProducts.viewProduct")}
              <DirectionalIcon size={14} aria-hidden="true" />
            </Link>
          </Button>
        ) : (
          <Button type="button" onClick={handleAddToCart} variant="primary" size="sm" className="mt-4 h-10 w-full gap-1 text-[13px]">
            <ShoppingCart size={15} strokeWidth={2} aria-hidden="true" />
            {t("common.addToCart")}
          </Button>
        )}
      </div>
    </article>
  );
}
