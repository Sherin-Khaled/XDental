import { useLocation } from "wouter";
import { Navbar } from "@/components/dental/Navbar";
import { CategoryBar } from "@/components/dental/CategoryBar";
import { Footer } from "@/components/dental/Footer";
import { SEO } from "@/components/SEO";

// Wrapper component to provide common layout
export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const isAccountRoute = location.startsWith("/account");
  const isCheckoutRoute = location.startsWith("/checkout");
  const isOrderConfirmedRoute = location.startsWith("/order-confirmed");

  return (
    <div className="min-h-screen overflow-x-clip flex flex-col font-body text-[#5F5F5F] bg-[var(--xd-bg)]">
      {isAccountRoute && <SEO page="account" />}
      <Navbar />
      {!isAccountRoute && !isCheckoutRoute && !isOrderConfirmedRoute && <CategoryBar />}
      <main className="flex-grow">
        {children}
      </main>
      <Footer />
    </div>
  );
}
