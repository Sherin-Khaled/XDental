import { useLocation } from "wouter";
import { Navbar } from "@/components/dental/Navbar";
import { CategoryBar } from "@/components/dental/CategoryBar";
import { Footer } from "@/components/dental/Footer";
import { DeliveryOfferAlert } from "@/components/dental/DeliveryOfferAlert";
import { ScheduledPromotionPlacement } from "@/components/dental/ScheduledPromotionPlacement";
import { SEO } from "@/components/SEO";

// Wrapper component to provide common layout
export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const isAccountRoute = location.startsWith("/account");
  const isCheckoutRoute = location.startsWith("/checkout");
  const isOrderConfirmedRoute = location.startsWith("/order-confirmed");

  return (
    <div className="min-h-screen overflow-x-clip flex flex-col bg-[var(--xd-bg)] font-body text-[var(--xd-text-muted)]">
      {isAccountRoute && <SEO page="account" />}
      <Navbar />
      {!isAccountRoute && !isCheckoutRoute && !isOrderConfirmedRoute && <CategoryBar />}
      {!isCheckoutRoute && !isOrderConfirmedRoute && <DeliveryOfferAlert />}
      {!isCheckoutRoute && !isOrderConfirmedRoute && (
        <ScheduledPromotionPlacement
          placement="ANNOUNCEMENT_BANNER"
          className="mx-5 mt-3 sm:mx-8 lg:mx-12"
        />
      )}
      <main className="flex-grow">
        {children}
      </main>
      <Footer />
    </div>
  );
}
