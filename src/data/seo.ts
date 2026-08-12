export type SeoPageKey =
  | "home"
  | "products"
  | "productDetail"
  | "categories"
  | "brands"
  | "about"
  | "contact"
  | "faqs"
  | "howToOrder"
  | "privacy"
  | "terms"
  | "shippingDelivery"
  | "returnsPolicy"
  | "trackOrder"
  | "cart"
  | "checkout"
  | "login"
  | "signup"
  | "account"
  | "orderConfirmed"
  | "notFound";

export type RobotsDirective = "index, follow" | "noindex, follow" | "noindex, nofollow";

export const SITE_URL = "https://xdentalstore.com";

export const seoPages: Record<SeoPageKey, { path: string; robots: RobotsDirective }> = {
  home: { path: "/", robots: "index, follow" },
  products: { path: "/products", robots: "index, follow" },
  productDetail: { path: "/products", robots: "index, follow" },
  categories: { path: "/categories", robots: "index, follow" },
  brands: { path: "/brands", robots: "index, follow" },
  about: { path: "/about", robots: "index, follow" },
  contact: { path: "/contact", robots: "index, follow" },
  faqs: { path: "/faqs", robots: "index, follow" },
  howToOrder: { path: "/how-to-order", robots: "index, follow" },
  privacy: { path: "/privacy", robots: "index, follow" },
  terms: { path: "/terms", robots: "index, follow" },
  shippingDelivery: { path: "/shipping-delivery", robots: "index, follow" },
  returnsPolicy: { path: "/returns-policy", robots: "index, follow" },
  trackOrder: { path: "/track-order", robots: "index, follow" },
  cart: { path: "/cart", robots: "noindex, nofollow" },
  checkout: { path: "/checkout", robots: "noindex, nofollow" },
  login: { path: "/login", robots: "noindex, nofollow" },
  signup: { path: "/signup", robots: "noindex, nofollow" },
  account: { path: "/account", robots: "noindex, nofollow" },
  orderConfirmed: { path: "/order-confirmed", robots: "noindex, nofollow" },
  notFound: { path: "/", robots: "noindex, nofollow" },
};
