import { useEffect, useState } from "react";
import { Link } from "wouter";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/dental/Button";
import { Container } from "@/components/dental/Container";
import { SEO } from "@/components/SEO";
import { OrderPricingBreakdown } from "@/components/dental/OrderPricingBreakdown";
import { useLanguage } from "@/context/LanguageContext";
import { getMyOrder, type CustomerOrder } from "@/services/orders";

export default function OrderConfirmed() {
  const { t } = useLanguage();
  const [order, setOrder] = useState<CustomerOrder | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const orderId = new URLSearchParams(window.location.search).get("orderId");
    if (!orderId) {
      setHasError(true);
      setIsLoading(false);
      return;
    }

    let active = true;
    getMyOrder(orderId)
      .then((result) => {
        if (active) setOrder(result);
      })
      .catch(() => {
        if (active) setHasError(true);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-[var(--xd-bg)] px-5 text-center">
        <p role="status" className="text-[14px] font-semibold text-[#717182]">
          {t("orderConfirmation.loading")}
        </p>
      </div>
    );
  }

  if (hasError || !order) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-[var(--xd-bg)] px-5 text-center">
        <div>
          <p role="alert" className="text-[15px] font-semibold text-[#717182]">
            {t("orderConfirmation.notFound")}
          </p>
          <Link href="/account/orders" className="mt-4 inline-block text-[14px] font-bold text-[var(--xd-gold-text)] underline">
            {t("orderConfirmation.viewOrders")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[var(--xd-bg)] py-14 lg:py-20">
      <SEO page="orderConfirmed" />
      <Container>
        <section className="mx-auto max-w-[680px] rounded-[28px] border border-[var(--xd-gold-border-soft)] bg-white/85 p-8 text-center shadow-[0_18px_44px_rgba(5,5,5,0.06)] sm:p-10">
          <CheckCircle2 size={54} className="mx-auto text-[#16803C]" aria-hidden="true" />
          <h1 className="mt-5 font-display text-[34px] font-bold text-[#050505]">
            {t("orderConfirmation.title")}
          </h1>
          <p className="mt-3 text-[15px] leading-7 text-[#717182]">
            {t("orderConfirmation.message")}
          </p>
          <div className="mx-auto mt-6 max-w-[360px] rounded-[16px] bg-[var(--xd-bg)] px-5 py-4">
            <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#8A8D9A]">
              {t("orderConfirmation.orderNumber")}
            </p>
            <p className="mt-1 font-display text-[22px] font-bold text-[#050505]">{order.orderNumber}</p>
          </div>
          <div className="mx-auto mt-6 max-w-[440px] rounded-[18px] border border-[var(--xd-gold-border-soft)] bg-[var(--xd-bg)] p-5 text-start">
            <h2 className="mb-4 font-display text-lg font-bold text-[#050505] dark:text-[#F7F2E6]">
              {t("orderConfirmation.pricingTitle")}
            </h2>
            <OrderPricingBreakdown
              order={order}
              deliveryLabel={t(`checkout.shippingMethods.${order.deliveryMethod}.title`, { fallback: order.deliveryMethod })}
            />
          </div>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild>
              <Link href={`/account/orders/${order.id}`}>{t("orderConfirmation.viewOrder")}</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/products">{t("orderConfirmation.continueShopping")}</Link>
            </Button>
          </div>
        </section>
      </Container>
    </div>
  );
}
