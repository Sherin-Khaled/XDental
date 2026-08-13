import { lazy, Suspense, useEffect, type ElementType, type ReactNode } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "framer-motion";
import { Toaster }         from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { StoreProvider }   from "@/context/StoreContext";
import { NotificationProvider } from "@/context/NotificationContext";
import { useStore } from "@/context/StoreContext";
import { LanguageProvider } from "@/context/LanguageContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { CatalogProvider } from "@/context/CatalogContext";
import { Layout }          from "@/components/layout";
import { NotificationPermissionPrompt } from "@/components/NotificationPermissionPrompt";
import { DailyOfferAlert } from "@/components/DailyOfferAlert";
import { FloatingSupportChat } from "@/components/dental/FloatingSupportChat";
import { GoldIconGradientDefs } from "@/components/dental/GoldIconGradientDefs";
import { WelcomeRewardsPopup } from "@/components/WelcomeRewardsPopup";
import { SEO } from "@/components/SEO";

// Lazy-loaded route pages — each page becomes its own JS chunk
const Home                = lazy(() => import("@/pages/home"));
const Products            = lazy(() => import("@/pages/products"));
const Categories          = lazy(() => import("@/pages/categories"));
const ProductDetail       = lazy(() => import("@/pages/product-detail"));
const Cart                = lazy(() => import("@/pages/cart"));
const Checkout            = lazy(() => import("@/pages/checkout"));
const OrderConfirmed      = lazy(() => import("@/pages/order-confirmed"));
const Login               = lazy(() => import("@/pages/login"));
const Signup              = lazy(() => import("@/pages/signup"));
const AccountDashboard    = lazy(() => import("@/pages/account"));
const AccountDashboardHome = lazy(() => import("@/pages/account-dashboard"));
const AccountOrders       = lazy(() => import("@/pages/account-orders"));
const AccountOrderDetail  = lazy(() => import("@/pages/account-order-detail"));
const AccountWishlist     = lazy(() => import("@/pages/account-wishlist"));
// Address book and clinic branches retain their existing account routes.
const AccountAddress      = lazy(() => import("@/pages/account-address"));
const AccountSettings     = lazy(() => import("@/pages/account-settings"));
const AccountWallet       = lazy(() => import("@/pages/account-wallet"));
const AccountSupport      = lazy(() => import("@/pages/account-support-tickets"));
const AccountQuotes       = lazy(() => import("@/pages/account-quotes"));
const AccountQuoteDetail  = lazy(() => import("@/pages/account-quote-detail"));
const AccountSupplyLists  = lazy(() => import("@/pages/account-supply-lists"));
const AccountSupplyListDetail = lazy(() => import("@/pages/account-supply-list-detail"));
const AccountProductRequests = lazy(() => import("@/pages/account-product-requests"));
const AccountClinicBranches = lazy(() => import("@/pages/account-clinic-branches"));
const AccountNotifications = lazy(() => import("@/pages/account-notifications"));
const AccountProductRequestDetail = lazy(() => import("@/pages/account-product-request-detail"));
const About               = lazy(() => import("@/pages/about"));
const Contact             = lazy(() => import("@/pages/contact"));
const Faqs                = lazy(() => import("@/pages/faqs"));
const HowToOrder          = lazy(() => import("@/pages/how-to-order"));
const Privacy             = lazy(() => import("@/pages/privacy"));
const Terms               = lazy(() => import("@/pages/terms"));
const ShippingDelivery    = lazy(() => import("@/pages/shipping-delivery"));
const ReturnsPolicy       = lazy(() => import("@/pages/returns-policy"));
const TrackOrder          = lazy(() => import("@/pages/track-order"));
const Brands              = lazy(() => import("@/pages/brands"));
const NotFound            = lazy(() => import("@/pages/not-found"));
const AdminOverview       = lazy(() => import("@/pages/admin/index"));
const AdminProducts       = lazy(() => import("@/pages/admin/products"));
const AdminProductEditor  = lazy(() => import("@/pages/admin/product-editor"));
const AdminCatalogImport  = lazy(() => import("@/pages/admin/catalog-import"));
const AdminCatalogImportHistory = lazy(() => import("@/pages/admin/catalog-import-history"));
const AdminFlashSale      = lazy(() => import("@/pages/admin/flash-sale"));
const AdminCoupons        = lazy(() => import("@/pages/admin/coupons"));
const AdminScheduledPromotions = lazy(() => import("@/pages/admin/scheduled-promotions"));
const AdminHeroSlider      = lazy(() => import("@/pages/admin/hero-slider"));
const AdminDelivery       = lazy(() => import("@/pages/admin/delivery"));
const AdminCategories     = lazy(() => import("@/pages/admin/categories"));
const AdminBrands         = lazy(() => import("@/pages/admin/brands"));
const AdminOrders         = lazy(() => import("@/pages/admin/orders"));
const AdminQuotes         = lazy(() => import("@/pages/admin/quotes"));
const AdminProductRequests = lazy(() => import("@/pages/admin/product-requests"));
const AdminSupport         = lazy(() => import("@/pages/admin/support"));
const AdminAccountRequests = lazy(() => import("@/pages/admin/account-requests"));
const AdminLoyalty        = lazy(() => import("@/pages/admin/loyalty"));
const AdminUsers          = lazy(() => import("@/pages/admin/users"));
const AdminUserDetails    = lazy(() => import("@/pages/admin/user-details"));
const AdminSettings       = lazy(() => import("@/pages/admin/settings"));
const AdminNotFound       = lazy(() => import("@/pages/admin/not-found"));

const publicRoutePreloads = [
  () => import("@/pages/products"),
  () => import("@/pages/categories"),
  () => import("@/pages/product-detail"),
  () => import("@/pages/cart"),
  () => import("@/pages/login"),
  () => import("@/pages/signup"),
];

const accountRoutePreloads = [
  () => import("@/pages/account-dashboard"),
  () => import("@/pages/account-supply-lists"),
  () => import("@/pages/account-supply-list-detail"),
  () => import("@/pages/account-quotes"),
  () => import("@/pages/account-product-requests"),
];

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
    },
  },
});

function PageFallback() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-[var(--xd-gold-active)] border-t-transparent animate-spin" />
    </div>
  );
}

function ScrollToTop() {
  const [location] = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location]);

  return null;
}

function preloadRoutesWhenIdle(loaders: Array<() => Promise<unknown>>) {
  let isCancelled = false;
  const idleWindow = window as Window & {
    requestIdleCallback?: (
      callback: IdleRequestCallback,
      options?: IdleRequestOptions
    ) => number;
    cancelIdleCallback?: (handle: number) => void;
  };

  const preload = () => {
    if (isCancelled) return;

    loaders.forEach((load) => {
      void load();
    });
  };

  if (idleWindow.requestIdleCallback) {
    const idleId = idleWindow.requestIdleCallback(preload, { timeout: 2500 });

    return () => {
      isCancelled = true;
      idleWindow.cancelIdleCallback?.(idleId);
    };
  }

  if (document.readyState === "complete") {
    preload();
    return () => {
      isCancelled = true;
    };
  }

  window.addEventListener("load", preload, { once: true });

  return () => {
    isCancelled = true;
    window.removeEventListener("load", preload);
  };
}

function RoutePreloader() {
  const { isAuthenticated } = useStore();

  useEffect(() => preloadRoutesWhenIdle(publicRoutePreloads), []);

  useEffect(() => {
    if (!isAuthenticated) return;

    return preloadRoutesWhenIdle(accountRoutePreloads);
  }, [isAuthenticated]);

  return null;
}

function isAdminPath(location: string) {
  return location === "/admin" || location.startsWith("/admin/");
}

function getSignInPath(location: string) {
  return `/signin?redirect=${encodeURIComponent(location || "/account/dashboard")}`;
}

function RequireAccountAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated, isAuthLoading } = useStore();
  const [location, navigate] = useLocation();

  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) {
      navigate(getSignInPath(location));
    }
  }, [isAuthLoading, isAuthenticated, location, navigate]);

  if (isAuthLoading || !isAuthenticated) {
    return <PageFallback />;
  }

  return (
    <>
      <SEO page="account" path={location.split("?")[0]} />
      {children}
    </>
  );
}

function RequireAdminAuth({ children }: { children: ReactNode }) {
  const { currentUser, isAuthenticated, isAuthLoading } = useStore();
  const [location, navigate] = useLocation();
  const role = currentUser?.role?.trim().toLowerCase();
  const isAdmin = role === "admin";
  const adminPathname = location.split("?")[0];
  const isSupportRoute =
    ["/admin", "/admin/products", "/admin/flash-sale", "/admin/categories", "/admin/brands", "/admin/orders", "/admin/quotes", "/admin/support", "/admin/product-requests", "/admin/account-requests", "/admin/loyalty", "/admin/settings"].includes(adminPathname)
    || adminPathname.startsWith("/admin/products/");
  const hasSensitiveAccountAccess =
    adminPathname === "/admin/account-requests"
      ? currentUser?.permissions?.includes("ACCOUNT_REQUESTS_VIEW")
      : adminPathname === "/admin/loyalty"
        ? currentUser?.permissions?.includes("LOYALTY_VIEW")
      : true;
  const hasAdminAccess =
    isAdmin
    || (role === "support" && isSupportRoute && hasSensitiveAccountAccess);

  useEffect(() => {
    if (isAuthLoading) return;

    if (!isAuthenticated) {
      navigate(getSignInPath(location), { replace: true });
      return;
    }

    if (!hasAdminAccess) {
      navigate("/account/dashboard", { replace: true });
    }
  }, [hasAdminAccess, isAuthenticated, isAuthLoading, location, navigate]);

  if (isAuthLoading || !isAuthenticated || !hasAdminAccess) {
    return <PageFallback />;
  }

  return (
    <>
      <SEO page="account" path={adminPathname} />
      {children}
    </>
  );
}

function withAccountProtection(Component: ElementType) {
  return function ProtectedAccountPage() {
    return (
      <RequireAccountAuth>
        <Component />
      </RequireAccountAuth>
    );
  };
}

const ProtectedAccountDashboard = withAccountProtection(AccountDashboard);
const ProtectedAccountDashboardHome = withAccountProtection(AccountDashboardHome);
const ProtectedAccountOrders = withAccountProtection(AccountOrders);
const ProtectedAccountOrderDetail = withAccountProtection(AccountOrderDetail);
const ProtectedAccountWishlist = withAccountProtection(AccountWishlist);
const ProtectedAccountAddress = withAccountProtection(AccountAddress);
const ProtectedAccountSettings = withAccountProtection(AccountSettings);
const ProtectedAccountWallet = withAccountProtection(AccountWallet);
const ProtectedAccountSupport = withAccountProtection(AccountSupport);
const ProtectedAccountQuotes = withAccountProtection(AccountQuotes);
const ProtectedAccountQuoteDetail = withAccountProtection(AccountQuoteDetail);
const ProtectedAccountSupplyLists = withAccountProtection(AccountSupplyLists);
const ProtectedAccountSupplyListDetail = withAccountProtection(AccountSupplyListDetail);
const ProtectedAccountProductRequests = withAccountProtection(AccountProductRequests);
const ProtectedAccountClinicBranches = withAccountProtection(AccountClinicBranches);
const ProtectedAccountNotifications = withAccountProtection(AccountNotifications);
const ProtectedAccountProductRequestDetail = withAccountProtection(AccountProductRequestDetail);

function Router() {
  const [location] = useLocation();
  const isAdminRoute = isAdminPath(location);

  if (isAdminRoute) {
    return (
      <RequireAdminAuth>
        <ScrollToTop />
        <Suspense fallback={<PageFallback />}>
          <Switch>
            <Route path="/admin"                  component={AdminOverview} />
            <Route path="/admin/products"         component={AdminProducts} />
            <Route path="/admin/products/:id"     component={AdminProductEditor} />
            <Route path="/admin/catalog-import/history" component={AdminCatalogImportHistory} />
            <Route path="/admin/catalog-import"   component={AdminCatalogImport} />
            <Route path="/admin/flash-sale"       component={AdminFlashSale} />
            <Route path="/admin/coupons"          component={AdminCoupons} />
            <Route path="/admin/scheduled-promotions" component={AdminScheduledPromotions} />
            <Route path="/admin/hero-slider"     component={AdminHeroSlider} />
            <Route path="/admin/delivery"         component={AdminDelivery} />
            <Route path="/admin/categories"       component={AdminCategories} />
            <Route path="/admin/brands"           component={AdminBrands} />
            <Route path="/admin/orders"           component={AdminOrders} />
            <Route path="/admin/quotes"           component={AdminQuotes} />
            <Route path="/admin/product-requests" component={AdminProductRequests} />
            <Route path="/admin/support"          component={AdminSupport} />
            <Route path="/admin/account-requests" component={AdminAccountRequests} />
            <Route path="/admin/loyalty"          component={AdminLoyalty} />
            <Route path="/admin/users/:id"        component={AdminUserDetails} />
            <Route path="/admin/users"            component={AdminUsers} />
            <Route path="/admin/settings"         component={AdminSettings} />
            <Route                                component={AdminNotFound} />
          </Switch>
        </Suspense>
      </RequireAdminAuth>
    );
  }

  return (
    <Layout>
      <ScrollToTop />
      <Suspense fallback={<PageFallback />}>
        <Switch>
          <Route path="/"                    component={Home} />
          <Route path="/products"            component={Products} />
          <Route path="/categories"          component={Categories} />
          <Route path="/products/:id"        component={ProductDetail} />
          <Route path="/cart"                component={Cart} />
          <Route path="/checkout"            component={Checkout} />
          <Route path="/order-confirmed"     component={OrderConfirmed} />
          <Route path="/signin"              component={Login} />
          <Route path="/login"               component={Login} />
          <Route path="/signup"              component={Signup} />
          <Route path="/account"             component={ProtectedAccountDashboard} />
          <Route path="/account/profile"     component={ProtectedAccountDashboard} />
          <Route path="/account/dashboard"   component={ProtectedAccountDashboardHome} />
          <Route path="/account/orders"      component={ProtectedAccountOrders} />
          <Route path="/account/orders/:id"  component={ProtectedAccountOrderDetail} />
          <Route path="/account/order-details" component={ProtectedAccountOrders} />
          <Route path="/account/order-details/:id" component={ProtectedAccountOrderDetail} />
          <Route path="/account/wishlist"    component={ProtectedAccountWishlist} />
          <Route path="/account/address"     component={ProtectedAccountAddress} />
          <Route path="/account/address-book" component={ProtectedAccountAddress} />
          <Route path="/account/settings"    component={ProtectedAccountSettings} />
          <Route path="/account/wallet"      component={ProtectedAccountWallet} />
          <Route path="/account/support"     component={ProtectedAccountSupport} />
          <Route path="/account/quotes/:id"  component={ProtectedAccountQuoteDetail} />
          <Route path="/account/quotes"      component={ProtectedAccountQuotes} />
          <Route path="/account/clinic-branches" component={ProtectedAccountClinicBranches} />
          <Route path="/account/notifications" component={ProtectedAccountNotifications} />
          <Route path="/account/supply-lists/:id" component={ProtectedAccountSupplyListDetail} />
          <Route path="/account/supply-lists" component={ProtectedAccountSupplyLists} />
          <Route path="/account/product-requests/:id" component={ProtectedAccountProductRequestDetail} />
          <Route path="/account/product-requests" component={ProtectedAccountProductRequests} />
          <Route path="/about"               component={About} />
          <Route path="/contact"             component={Contact} />
          <Route path="/faqs"                component={Faqs} />
          <Route path="/how-to-order"        component={HowToOrder} />
          <Route path="/privacy"             component={Privacy} />
          <Route path="/terms"               component={Terms} />
          <Route path="/shipping-delivery"   component={ShippingDelivery} />
          <Route path="/returns-policy"      component={ReturnsPolicy} />
          <Route path="/track-order"         component={TrackOrder} />
          <Route path="/brands"              component={Brands} />
          <Route                             component={NotFound} />
        </Switch>
      </Suspense>
    </Layout>
  );
}

function RoutedAppChrome() {
  const [location] = useLocation();
  const isAdminRoute = isAdminPath(location);

  return (
    <>
      <Router />
      <RoutePreloader />
      {!isAdminRoute && (
        <>
          <NotificationPermissionPrompt />
          <DailyOfferAlert />
          <FloatingSupportChat />
          <WelcomeRewardsPopup />
        </>
      )}
      <Toaster />
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeProvider>
          <GoldIconGradientDefs />
          <LanguageProvider>
            <CatalogProvider>
              <StoreProvider>
                <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
                  <NotificationProvider>
                    <MotionConfig reducedMotion="user">
                      <RoutedAppChrome />
                    </MotionConfig>
                  </NotificationProvider>
                </WouterRouter>
              </StoreProvider>
            </CatalogProvider>
          </LanguageProvider>
        </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
