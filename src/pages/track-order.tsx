import { useState, type FormEvent } from "react";
import type { LucideIcon } from "lucide-react";
import {
  CheckCircle2,
  ClipboardList,
  LogIn,
  MessageCircle,
  PackageSearch,
  SearchCheck,
} from "lucide-react";
import { Link } from "wouter";
import { DirectionalIcon } from "@/components/DirectionalIcon";
import { Button } from "@/components/dental/Button";
import { SectionReveal } from "@/components/dental/SectionReveal";
import { SEO } from "@/components/SEO";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/context/LanguageContext";
import { accountValue } from "@/lib/accountI18n";
import { ApiError } from "@/services/http";
import {
  getOrderStatusLabel,
  trackPublicOrder,
  type PublicOrderTrackingResult,
} from "@/services/orders";

type TrackingStep = {
  id: string;
  Icon: LucideIcon;
};

type TrackingSection = {
  id: string;
  paragraphs: string[];
  bullets?: string[];
  cta?: {
    href: string;
  };
};

const TRACKING_STEPS: TrackingStep[] = [
  {
    id: "signIn",
    Icon: LogIn,
  },
  {
    id: "openOrders",
    Icon: ClipboardList,
  },
  {
    id: "checkStatus",
    Icon: SearchCheck,
  },
];

const TRACKING_SECTIONS: TrackingSection[] = [
  {
    id: "account",
    paragraphs: ["paragraph1"],
    cta: { href: "/account/orders" },
  },
  {
    id: "help",
    paragraphs: ["paragraph1"],
    cta: { href: "/contact" },
  },
];

function formatTrackingDate(value: string, language: string, includeTime = false) {
  return new Intl.DateTimeFormat(language === "ar" ? "ar-EG" : "en-EG", {
    dateStyle: "medium",
    ...(includeTime ? { timeStyle: "short" as const } : {}),
  }).format(new Date(value));
}

export default function TrackOrder() {
  const { isRtl, language, t } = useLanguage();
  const [orderNumber, setOrderNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ orderNumber?: string; phone?: string }>({});
  const [result, setResult] = useState<PublicOrderTrackingResult | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isTracking, setIsTracking] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isTracking) return;

    const nextErrors: { orderNumber?: string; phone?: string } = {};
    if (!orderNumber.trim()) nextErrors.orderNumber = t("trackOrderPage.form.orderNumberRequired");
    else if (orderNumber.trim().length > 80) nextErrors.orderNumber = t("trackOrderPage.form.orderNumberInvalid");
    if (!phone.trim()) nextErrors.phone = t("trackOrderPage.form.phoneRequired");
    else if (phone.trim().length > 80) nextErrors.phone = t("trackOrderPage.form.phoneInvalid");

    setFieldErrors(nextErrors);
    setErrorMessage("");
    setResult(null);
    if (Object.keys(nextErrors).length > 0) return;

    setIsTracking(true);
    try {
      setResult(await trackPublicOrder(orderNumber, phone));
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError && error.status === 429
          ? t("trackOrderPage.form.rateLimited")
          : t("trackOrderPage.form.notFound")
      );
    } finally {
      setIsTracking(false);
    }
  };

  return (
    <main dir={isRtl ? "rtl" : "ltr"} className="box-border min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-[var(--xd-bg)] text-[var(--xd-text)]">
      <SEO
        page="trackOrder"
        title={t("trackOrderPage.seoTitle")}
        titleFormat="exact"
        description={t("trackOrderPage.seoDescription")}
      />

      <section className="box-border w-full max-w-[100vw] px-5 pb-16 pt-14 sm:px-8 sm:pt-16 lg:px-12 lg:pb-24 lg:pt-20">
        <div className="mx-auto w-full max-w-[1344px]">
          <SectionReveal className="border-b border-[#050505]/10 pb-10 lg:pb-12">
            <div className="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0 max-w-[780px]">
                <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-[var(--xd-gold-text)]">
                  {t("trackOrderPage.eyebrow")}
                </p>
                <h1 className="mt-4 font-display text-[40px] font-semibold leading-[1.04] tracking-[-0.035em] sm:text-[52px] lg:text-[64px]">
                  {t("trackOrderPage.title")}
                </h1>
                <p className="mt-5 max-w-[680px] text-[15px] leading-[26px] text-[var(--xd-muted-2)] sm:text-[16px]">
                  {t("trackOrderPage.description")}
                </p>
              </div>

              <Button asChild variant="primary" size="sm" className="w-fit shrink-0 gap-2 px-5 text-[13px]">
                <Link href="/account/orders">
                  {t("trackOrderPage.viewOrders")}
                  <DirectionalIcon size={15} aria-hidden="true" />
                </Link>
              </Button>
            </div>
          </SectionReveal>

          <SectionReveal delay={0.03} className="border-b border-[#050505]/10 py-12 lg:py-14">
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-12">
              <div className="min-w-0">
                <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--xd-gold-text)]">
                  {t("trackOrderPage.form.eyebrow")}
                </p>
                <h2 className="mt-3 font-display text-[30px] font-semibold leading-[1.14] tracking-[-0.025em] sm:text-[38px]">
                  {t("trackOrderPage.form.title")}
                </h2>
                <p className="mt-3 max-w-[700px] text-[15px] leading-[26px] text-[var(--xd-muted-2)]">
                  {t("trackOrderPage.form.description")}
                </p>

                <form noValidate onSubmit={handleSubmit} className="mt-7 grid gap-5 sm:grid-cols-2">
                  <label className="block min-w-0">
                    <span className="text-[13px] font-bold text-[var(--xd-text)]">
                      {t("trackOrderPage.form.orderNumberLabel")}
                    </span>
                    <Input
                      value={orderNumber}
                      onChange={(event) => {
                        setOrderNumber(event.target.value);
                        setFieldErrors((current) => ({ ...current, orderNumber: undefined }));
                      }}
                      placeholder={t("trackOrderPage.form.orderNumberPlaceholder")}
                      autoComplete="off"
                      maxLength={81}
                      aria-invalid={Boolean(fieldErrors.orderNumber)}
                      aria-describedby={fieldErrors.orderNumber ? "tracking-order-number-error" : undefined}
                      className="mt-2 h-12 rounded-[14px] border-[#050505]/10 bg-white/75 px-4 text-[14px] text-[var(--xd-text)] shadow-none focus-visible:border-[var(--xd-gold-border-hover)] focus-visible:ring-4 focus-visible:ring-[var(--xd-gold-active)]/10"
                    />
                    {fieldErrors.orderNumber && (
                      <span id="tracking-order-number-error" role="alert" className="mt-2 block text-[12px] font-semibold text-[#B42318]">
                        {fieldErrors.orderNumber}
                      </span>
                    )}
                  </label>

                  <label className="block min-w-0">
                    <span className="text-[13px] font-bold text-[var(--xd-text)]">
                      {t("trackOrderPage.form.phoneLabel")}
                    </span>
                    <Input
                      type="tel"
                      value={phone}
                      onChange={(event) => {
                        setPhone(event.target.value);
                        setFieldErrors((current) => ({ ...current, phone: undefined }));
                      }}
                      placeholder={t("trackOrderPage.form.phonePlaceholder")}
                      autoComplete="tel"
                      inputMode="tel"
                      maxLength={81}
                      aria-invalid={Boolean(fieldErrors.phone)}
                      aria-describedby={fieldErrors.phone ? "tracking-phone-error" : "tracking-phone-note"}
                      className="mt-2 h-12 rounded-[14px] border-[#050505]/10 bg-white/75 px-4 text-[14px] text-[var(--xd-text)] shadow-none focus-visible:border-[var(--xd-gold-border-hover)] focus-visible:ring-4 focus-visible:ring-[var(--xd-gold-active)]/10"
                    />
                    <span id="tracking-phone-note" className="mt-2 block text-[12px] leading-5 text-[var(--xd-muted-2)]">
                      {t("trackOrderPage.form.phoneNote")}
                    </span>
                    {fieldErrors.phone && (
                      <span id="tracking-phone-error" role="alert" className="mt-2 block text-[12px] font-semibold text-[#B42318]">
                        {fieldErrors.phone}
                      </span>
                    )}
                  </label>

                  <div className="sm:col-span-2">
                    <Button type="submit" variant="primary" size="sm" disabled={isTracking} className="h-11 min-w-[150px] gap-2 px-5 text-[13px]">
                      <PackageSearch size={16} aria-hidden="true" />
                      {isTracking ? t("trackOrderPage.form.loading") : t("trackOrderPage.form.submit")}
                    </Button>
                  </div>
                </form>

                {errorMessage && (
                  <div role="alert" className="mt-6 rounded-[16px] border border-[#B42318]/20 bg-[#B42318]/[0.07] px-4 py-3 text-[13px] font-semibold leading-6 text-[#B42318]">
                    {errorMessage}
                  </div>
                )}
              </div>

              {result ? (
                <div role="status" aria-live="polite" className="rounded-[22px] border border-[var(--xd-gold-border-soft)] bg-white/75 p-6 shadow-[0_12px_34px_rgba(5,5,5,0.04)]">
                  <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--xd-gold-text)]">
                    {t("trackOrderPage.result.title")}
                  </p>
                  <dl className="mt-5 grid gap-4">
                    <div>
                      <dt className="text-[12px] font-semibold text-[var(--xd-muted-2)]">{t("trackOrderPage.result.orderNumber")}</dt>
                      <dd className="mt-1 break-words text-[15px] font-bold text-[var(--xd-text)]">{result.orderNumber}</dd>
                    </div>
                    <div>
                      <dt className="text-[12px] font-semibold text-[var(--xd-muted-2)]">{t("trackOrderPage.result.orderDate")}</dt>
                      <dd className="mt-1 text-[14px] font-semibold text-[var(--xd-text)]">{formatTrackingDate(result.createdAt, language)}</dd>
                    </div>
                    <div>
                      <dt className="text-[12px] font-semibold text-[var(--xd-muted-2)]">{t("trackOrderPage.result.currentStatus")}</dt>
                      <dd className="mt-1 text-[15px] font-bold text-[var(--xd-gold-text)]">
                        {accountValue(t, getOrderStatusLabel(result.status))}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[12px] font-semibold text-[var(--xd-muted-2)]">{t("trackOrderPage.result.lastUpdate")}</dt>
                      <dd className="mt-1 text-[14px] font-semibold text-[var(--xd-text)]">{formatTrackingDate(result.updatedAt, language, true)}</dd>
                    </div>
                  </dl>
                  <p className="mt-5 border-t border-[#050505]/[0.07] pt-4 text-[13px] leading-6 text-[var(--xd-muted-2)]">
                    {t("trackOrderPage.result.deliveryNote")}
                  </p>
                </div>
              ) : (
                <div className="rounded-[22px] border border-[var(--xd-gold-border-soft)] bg-[var(--xd-gold-bg-soft)] p-6">
                  <SearchCheck size={24} className="text-[var(--xd-gold-text)]" aria-hidden="true" />
                  <p className="mt-4 text-[14px] font-bold text-[var(--xd-text)]">{t("trackOrderPage.form.privacyTitle")}</p>
                  <p className="mt-2 text-[13px] leading-6 text-[var(--xd-muted-2)]">{t("trackOrderPage.form.privacyDescription")}</p>
                </div>
              )}
            </div>
          </SectionReveal>

          <SectionReveal delay={0.05} className="border-b border-[#050505]/10 py-12 lg:py-14">
            <div className="grid gap-5 md:grid-cols-3">
              {TRACKING_STEPS.map(({ id, Icon }, index) => (
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
                    {t(`trackOrderPage.steps.${id}.title`)}
                  </h2>
                  <p className="mt-3 text-[14px] leading-[24px] text-[var(--xd-muted-2)]">
                    {t(`trackOrderPage.steps.${id}.description`)}
                  </p>
                </article>
              ))}
            </div>
          </SectionReveal>

          <div className="grid gap-12 pt-12 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-16 lg:pt-14">
            <div className="space-y-12">
              {TRACKING_SECTIONS.map((section, index) => (
                <section key={section.id} className="grid min-w-0 gap-4 border-b border-[#050505]/[0.07] pb-10 last:border-b-0 last:pb-0 sm:grid-cols-[72px_minmax(0,1fr)] sm:gap-8">
                  <div className="text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--xd-gold-text)]">
                    {String(index + 1).padStart(2, "0")}
                  </div>
                  <div className="min-w-0">
                    <h2 className="font-display text-[22px] font-semibold leading-[1.22] tracking-[-0.02em] text-[var(--xd-text)] sm:text-[26px]">
                      {t(`trackOrderPage.sections.${section.id}.title`)}
                    </h2>
                    <div className="mt-4 space-y-4">
                      {section.paragraphs.map((paragraphKey) => (
                        <p key={paragraphKey} className="max-w-[860px] break-words text-[15px] leading-[27px] text-[var(--xd-muted-2)]">
                          {t(`trackOrderPage.sections.${section.id}.${paragraphKey}`)}
                        </p>
                      ))}
                    </div>

                    {section.bullets && (
                      <ul className="mt-5 grid gap-3">
                        {section.bullets.map((bulletKey) => (
                          <li key={bulletKey} className="flex max-w-[860px] items-start gap-3 text-[14px] leading-[24px] text-[var(--xd-muted-2)]">
                            <CheckCircle2 className="mt-0.5 shrink-0 text-[var(--xd-gold-text)]" size={17} strokeWidth={2} aria-hidden="true" />
                            <span>{t(`trackOrderPage.sections.${section.id}.${bulletKey}`)}</span>
                          </li>
                        ))}
                      </ul>
                    )}

                    {section.cta && (
                      <Button asChild variant="primary" size="sm" className="mt-6 w-fit gap-2 px-5 text-[13px]">
                        <Link href={section.cta.href}>
                          {t(`trackOrderPage.sections.${section.id}.cta`)}
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
                <span className="flex h-11 w-11 items-center justify-center rounded-[12px] bg-[var(--xd-gold-bg-soft)] text-[var(--xd-gold-text)]">
                  <PackageSearch size={19} strokeWidth={1.9} aria-hidden="true" />
                </span>
                <p className="mt-5 text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--xd-gold-text)]">
                  {t("trackOrderPage.sidebar.title")}
                </p>
                <p className="mt-3 text-[14px] leading-[24px] text-[var(--xd-muted-2)]">
                  {t("trackOrderPage.sidebar.description")}
                </p>
                <div className="mt-6 flex flex-col gap-3">
                  <Button asChild variant="primary" size="sm" className="w-fit gap-2 px-5 text-[13px]">
                    <Link href="/account/orders">
                      {t("trackOrderPage.viewOrders")}
                      <DirectionalIcon size={15} aria-hidden="true" />
                    </Link>
                  </Button>
                  <Button asChild variant="primary" size="sm" className="w-fit gap-2 px-5 text-[13px]">
                    <Link href="/contact">
                      {t("trackOrderPage.contactSupport")}
                      <MessageCircle size={15} aria-hidden="true" />
                    </Link>
                  </Button>
                </div>
              </SectionReveal>
            </aside>
          </div>
        </div>
      </section>
    </main>
  );
}
