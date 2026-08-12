import { useState, type FormEvent } from "react";
import { Link, useLocation } from "wouter";
import {
  Facebook,
  Instagram,
  Linkedin,
  MessageCircle,
  Phone,
  Twitter,
} from "lucide-react";
import { DirectionalIcon } from "@/components/DirectionalIcon";
import { BrandLogo } from "@/components/dental/BrandLogo";
import { Button } from "@/components/dental/Button";
import { Container } from "@/components/dental/Container";
import { useLanguage } from "@/context/LanguageContext";
import { subscribeToNewsletter } from "@/services/contact";
import { ApiError } from "@/services/http";

const FOOTER_LINKS = {
  shop: [
    { labelKey: "footer.links.allProducts", href: "/products" },
    { labelKey: "footer.links.weeklyOffers", href: "/products?isWeeklyOffer=true" },
    { labelKey: "footer.links.newArrivals", href: "/products?isNewArrival=true" },
    { labelKey: "footer.links.bestSellers", href: "/products?isBestSeller=true" },
    { labelKey: "footer.links.requestQuote", href: "/contact" },
  ],
  categories: [
    // Slugs come from the backend category tree (owner Excel).
    { labelKey: "footer.links.endodontics", href: "/products?category=endodontics" },
    { labelKey: "footer.links.dentalInstruments", href: "/products?category=instruments" },
    { labelKey: "footer.links.restorativeMaterials", href: "/products?category=restorative" },
    { labelKey: "footer.links.infectionControl", href: "/products?category=disinfection-steralization" },
    { labelKey: "footer.links.orthodontics", href: "/products?category=orthodontics" },
    { labelKey: "footer.links.implantology", href: "/products?category=implant" },
  ],
  company: [
    { labelKey: "footer.links.aboutUs", href: "/about" },
    { labelKey: "footer.links.trustedBrands", href: "/brands" },
    { labelKey: "footer.links.ourPartners", href: "/brands" },
    { labelKey: "footer.links.blog", href: "/about" },
    { labelKey: "footer.links.contactUs", href: "/contact" },
  ],
  support: [
    { labelKey: "footer.links.howToOrder", href: "/how-to-order" },
    { labelKey: "footer.links.shippingDelivery", href: "/shipping-delivery" },
    { labelKey: "footer.links.returnsPolicy", href: "/returns-policy" },
    { labelKey: "footer.links.faqs", href: "/faqs" },
    { labelKey: "footer.links.trackYourOrder", href: "/track-order" },
  ],
};

const CONTACT = [
  {
    Icon: MessageCircle,
    labelKey: "footer.contact.ordersWhatsApp",
    value: "01035777335",
    href: "https://wa.me/201035777335",
  },
  { Icon: Phone, labelKey: "footer.contact.mainSupport", value: "01552229405", href: "tel:+201552229405" },
  { Icon: Phone, labelKey: "footer.contact.branch", value: "01065057035", href: "tel:+201065057035" },
];

const SOCIAL = [
  { Icon: Instagram, label: "Instagram" },
  { Icon: Twitter, label: "Twitter" },
  { Icon: Facebook, label: "Facebook" },
  { Icon: Linkedin, label: "LinkedIn" },
];

export function Footer() {
  const { t, language } = useLanguage();
  const [location] = useLocation();
  const isHomePage = location === "/" || location === "/home";
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [subscribeError, setSubscribeError] = useState<string | null>(null);

  // Stores the subscriber via POST /api/newsletter/subscribe; the "subscribed"
  // confirmation is only shown after the backend saves the email.
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubscribing) return;
    const website = String(new FormData(event.currentTarget).get("website") ?? "").trim();

    setIsSubscribing(true);
    setSubscribeError(null);
    try {
      await subscribeToNewsletter({ email, source: "footer", locale: language, website });
      setSubmitted(true);
      setEmail("");
    } catch (error) {
      setSubscribeError(
        error instanceof ApiError && error.status !== 0
          ? error.message
          : t("footer.subscribeError", {
              fallback: "The subscription could not be completed. Please try again.",
            })
      );
    } finally {
      setIsSubscribing(false);
    }
  };

  return (
    <footer className=" bg-[var(--xd-bg)]">
      <Container className="pb-10 pt-8 lg:pb-14 lg:pt-10">
        {!isHomePage && (
          <div className="grid gap-10 border-b border-[#050505]/[0.07] pb-12 lg:grid-cols-[1fr_470px] lg:gap-20">
          <div className="max-w-[520px]">
            <BrandLogo className="mb-5 w-fit" textClassName="font-bold text-[#050505]" />
            <p className="max-w-[430px] text-[14px] leading-[24px] text-[#717182]">
              {t("footer.description")}
            </p>

            {!isHomePage && (
              <div className="mt-7 flex flex-col gap-3">
                {CONTACT.map(({ Icon, labelKey, value, href }) => (
                  <div key={value} className="flex items-center gap-3">
                    <span className="xd-icon-amber xd-icon-card-surface flex h-8 w-8 items-center justify-center rounded-[8px] bg-[var(--xd-gold-bg-soft)]">
                      <Icon size={15} />
                    </span>
                    {href ? (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[13px] text-[#3A3A3A] transition hover:text-[#050505]"
                      >
                        {labelKey ? `${t(labelKey)}: ` : ""}
                        <span dir="ltr">{value}</span>
                      </a>
                    ) : (
                      <span className="text-[13px] text-[#3A3A3A]">{value}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {!isHomePage && (
            <div className="rounded-[20px] border border-[var(--xd-gold-border-soft)] bg-white/60 p-6 shadow-[0_12px_34px_rgba(5,5,5,0.04)] backdrop-blur lg:rounded-[24px] lg:p-8">
              <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--xd-gold-active)]">
                {t("common.newsletter")}
              </p>
              <h3 className="font-display text-[22px] font-bold leading-[1.3] text-[#050505]">
                {t("footer.newsletterTitle")}
              </h3>
              <p className="mt-3 max-w-[390px] text-[14px] leading-[22px] text-[#717182]">
                {t("footer.newsletterBody")}
              </p>

              {submitted ? (
                <div className="mt-6 rounded-[12px] border border-[var(--xd-gold-border-soft)] bg-[var(--xd-gold-bg-soft)] px-4 py-3 text-[13px] font-semibold text-[#050505]">
                  {t("footer.subscribed")}
                </div>
              ) : (
                <>
                  <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3 sm:flex-row">
                    <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute left-[-10000px] h-px w-px overflow-hidden" />
                    <input
                      type="email"
                      value={email}
                      onChange={(event) => {
                        setEmail(event.target.value);
                        setSubscribeError(null);
                      }}
                      placeholder={t("footer.emailPlaceholder")}
                      required
                      className="h-12 min-w-0 flex-1 rounded-[12px] border border-[#050505]/10 bg-[var(--xd-bg)]/80 px-4 text-[14px] text-[#050505] outline-none transition focus:border-[var(--xd-gold-border-hover)] focus:ring-4 focus:ring-[var(--xd-gold-active)]/10"
                    />
                    <Button
                      type="submit"
                      variant="primary"
                      disabled={isSubscribing}
                      className="shrink-0 gap-2 px-5 text-[14px]"
                    >
                      {t("common.subscribe")}
                      <DirectionalIcon direction="forward" size={15} />
                    </Button>
                  </form>
                  {subscribeError && (
                    <p role="alert" className="mt-3 text-[13px] font-semibold text-[#B42318]">
                      {subscribeError}
                    </p>
                  )}
                </>
              )}
            </div>
          )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-9 border-b border-[#050505]/[0.07] py-12 sm:grid-cols-4 lg:gap-16">
          {(Object.entries(FOOTER_LINKS) as [keyof typeof FOOTER_LINKS, { labelKey: string; href: string }[]][]).map(
            ([title, links]) => (
              <div key={title}>
                <h3 className="mb-5 text-[12px] font-bold uppercase tracking-[0.08em] text-[#050505]">
                  {t(`footer.sections.${title}`)}
                </h3>
                <ul className="flex flex-col gap-3">
                  {links.map(({ labelKey, href }) => (
                    <li key={labelKey}>
                      <Link href={href} className="text-[13px] text-[#717182] transition hover:text-[#050505]">
                        {t(labelKey)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )
          )}
        </div>

        <div className="flex flex-col items-center justify-between gap-6 pt-8 lg:flex-row">
          <p className="text-center text-[13px] text-[#717182] lg:text-left">
            {t("footer.copyright")}{" "}
            <span className="block sm:inline">
              {t("footer.creditPrefix")}{" "}
              <a
                href="https://www.behance.net/SK-sherinkhaled"
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t("footer.creditAriaLabel")}
                className="font-semibold text-[#D4A72C] transition hover:text-[#B88B18] hover:underline"
                dir="ltr"
                style={{ direction: "ltr", unicodeBidi: "isolate" }}
              >
                SK
              </a>
            </span>
          </p>

          <div className="flex items-center gap-2">
            {SOCIAL.map(({ Icon, label }) => (
              <a
                key={label}
                href="#"
                aria-label={label}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-[#050505]/10 text-[#717182] transition hover:border-[var(--xd-gold-border-hover)] hover:bg-[var(--xd-gold-bg-soft)] hover:text-[#050505]"
              >
                <Icon size={15} />
              </a>
            ))}
          </div>

          <div className="flex items-center gap-6">
            <Link href="/privacy" className="text-[13px] text-[#717182] transition hover:text-[#050505]">
              {t("footer.privacy")}
            </Link>
            <Link href="/terms" className="text-[13px] text-[#717182] transition hover:text-[#050505]">
              {t("footer.terms")}
            </Link>
          </div>
        </div>
      </Container>
    </footer>
  );
}
