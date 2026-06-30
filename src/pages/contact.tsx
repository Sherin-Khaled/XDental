import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  Building2,
  Mail,
  MessageCircle,
  Phone,
  type LucideIcon,
} from "lucide-react";
import { Link } from "wouter";
import { DirectionalIcon } from "@/components/DirectionalIcon";
import { Button } from "@/components/dental/Button";
import { SectionReveal } from "@/components/dental/SectionReveal";
import { useToast } from "@/hooks/use-toast";
import { SEO } from "@/components/SEO";
import { useLanguage } from "@/context/LanguageContext";

const CONTACT_ACTIONS: {
  Icon: LucideIcon;
  label: string;
  subtitle: string;
  contacts: {
    label?: string;
    value: string;
    href: string;
    external?: boolean;
  }[];
}[] = [
  {
    Icon: Phone,
    label: "Call Us",
    subtitle: "Support Numbers",
    contacts: [
      { label: "Main Support", value: "01552229405", href: "tel:+201552229405" },
      { label: "Office Landline", value: "0223955981", href: "tel:+20223955981" },
    ],
  },
  {
    Icon: Mail,
    label: "Email Us",
    subtitle: "Customer Email",
    contacts: [{ value: "orders@xdentalstore.com", href: "mailto:orders@xdentalstore.com" }],
  },
  {
    Icon: MessageCircle,
    label: "WhatsApp Support",
    subtitle: "Orders WhatsApp",
    contacts: [
      {
        label: "Orders WhatsApp",
        value: "01035777335",
        href: "https://wa.me/201035777335",
        external: true,
      },
    ],
  },
  {
    Icon: Building2,
    label: "Visit / Warehouse",
    subtitle: "Branch Contacts",
    contacts: [
      { label: "Branch Landline", value: "0223615151", href: "tel:+20223615151" },
      { label: "Branch Mobile", value: "01065057035", href: "tel:+201065057035" },
    ],
  },
];

const FAQS = [
  "quoteBeforeOrdering",
  "saveRepeatedLists",
  "sourceUnlistedProduct",
];

const FIELD_CLASS =
  "h-10 w-full rounded-[10px] border border-[#3D2518]/10 bg-white px-3 text-[13px] text-[#050505] outline-none transition focus:border-[var(--xd-gold-border-hover)] focus:ring-4 focus:ring-[var(--xd-gold-active)]/10";

export default function Contact() {
  const { toast } = useToast();
  const { t } = useLanguage();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    toast({
      title: t("contactPage.toastTitle"),
      description: t("contactPage.toastBody"),
    });
    event.currentTarget.reset();
  };

  return (
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-[var(--xd-bg)] text-[#050505] [&_*]:box-border">
      <SEO page="contact" />
      <HeroSection />
      <QuickActionsSection />
      <MessageSection onSubmit={handleSubmit} />
      <LocationSection />
      <FaqSection />
    </div>
  );
}

function HeroSection() {
  const { t } = useLanguage();
  const heroImage = `${import.meta.env.BASE_URL}contact-clinic-support.jpg`;

  return (
    <section className="pt-8 lg:pt-12">
      <ContactContainer>
        <SectionReveal className="relative mb-[58px] min-h-[640px] overflow-hidden rounded-[32px] border border-[var(--xd-gold-border-soft)] bg-white shadow-[0_24px_64px_rgba(5,5,5,0.08)] lg:min-h-[580px]">
          <img
            src={heroImage}
            alt="Dental clinic equipment and supply environment"
            width={3408}
            height={2434}
            loading="eager"
            fetchPriority="high"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover object-center"
          />

          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.94),rgba(255,255,255,0.78),rgba(255,255,255,0.35))]" />

          {/* Top-right badge */}
          <div className="absolute right-5 top-5 z-20 inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/25 px-4 py-2 text-[13px] font-semibold text-[var(--xd-text)] shadow-[0_8px_24px_rgba(5,5,5,0.08)] backdrop-blur-md sm:right-8 sm:top-8 lg:right-12 lg:top-12">
            <span className="h-2 w-2 rounded-full bg-[var(--xd-gold)]" />
            {t("contactPage.supplySupport")}
          </div>

          <div className="relative z-10 flex min-h-[560px] items-center px-6 py-12 sm:px-10 sm:py-14 lg:min-h-[580px] lg:px-14 lg:py-20 xl:px-16">
            <div className="max-w-[640px] min-w-0">
              <Eyebrow className="text-[var(--xd-gold-text)]">
                {t("nav.contact")}
              </Eyebrow>

              <h1 className="mt-3 max-w-[640px] font-display text-[42px] font-semibold leading-[1.06] tracking-[-0.035em] text-[var(--xd-text)] sm:text-[54px] lg:text-[62px]">
                {t("contactPage.heroTitle")}
              </h1>

              <p className="mt-5 max-w-[580px] text-[16px] leading-[27px] text-[var(--xd-muted-2)]">
                {t("contactPage.heroBody")}
              </p>

              <div className="mt-10 flex flex-col items-start gap-3 min-[420px]:flex-row min-[420px]:flex-wrap">
                <Button
                  asChild
                  variant="primary"
                  className="h-[50px] px-8 text-[15px] font-semibold"
                >
                  <a href="#message">{t("nav.contact")}</a>
                </Button>

                <Button
                  asChild
                  variant="secondary"
                  className="h-[50px] px-8 text-[15px] font-semibold"
                >
                  <a href="#message">{t("common.requestQuote")}</a>
                </Button>
              </div>
            </div>
          </div>
        </SectionReveal>
      </ContactContainer>
    </section>
  );
}

function QuickActionsSection() {
  const { t } = useLanguage();
  const [activeCard, setActiveCard] = useState<string | null>(null);
  const cardsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (cardsRef.current?.contains(event.target as Node)) return;

      setActiveCard(null);
      if (
        document.activeElement instanceof HTMLElement &&
        cardsRef.current?.contains(document.activeElement)
      ) {
        document.activeElement.blur();
      }
    };

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, []);

  return (
    <section className="pb-16 lg:pb-20">
      <ContactContainer>
        <SectionReveal className=" sm:px-10 lg:px-16 lg:py-20">
          <div className="mx-auto max-w-[760px] text-center">
            <Eyebrow className="justify-center">{t("contactPage.getInTouch")}</Eyebrow>
            <h2 className="mt-4 font-display text-[38px] font-light leading-[1.08] tracking-[-0.03em] text-[#050505] sm:text-[52px] lg:text-[58px]">
              {t("contactPage.reachTitle")}
              <span className="block">{t("contactPage.reachTitleSecond")}</span>
            </h2>
            <p className="mx-auto mt-6 max-w-[650px] text-[14px] leading-[24px] text-[#717182]">
              {t("contactPage.reachBody")}
            </p>
          </div>

          <div ref={cardsRef} className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {CONTACT_ACTIONS.map(({ Icon, label, subtitle, contacts }) => {
              const isFlipped = activeCard === label;
              const title = t(`contactPage.actions.${label}`, { fallback: label });
              const supportingText = t(`contactPage.cardSubtitles.${subtitle}`, {
                fallback: subtitle,
              });

              return (
                <article
                  key={label}
                  tabIndex={0}
                  role="group"
                  aria-label={`${title}. ${supportingText}`}
                  data-flipped={isFlipped ? "true" : "false"}
                  onClick={(event) => {
                    if ((event.target as HTMLElement).closest("a")) return;
                    if (isFlipped) event.currentTarget.blur();
                    setActiveCard(isFlipped ? null : label);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      setActiveCard(null);
                      (event.target as HTMLElement).blur();
                      return;
                    }
                    if (event.target !== event.currentTarget) return;
                    if (event.key !== "Enter" && event.key !== " ") return;

                    event.preventDefault();
                    if (isFlipped) event.currentTarget.blur();
                    setActiveCard(isFlipped ? null : label);
                  }}
                  onBlur={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                      setActiveCard((current) => (current === label ? null : current));
                    }
                  }}
                  className="group relative h-[170px] cursor-pointer rounded-[14px] [perspective:1000px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-border)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--xd-bg)]"
                >
                  <div
                    className={`relative h-full w-full [transform-style:preserve-3d] transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:[transform:rotateY(180deg)] group-focus-within:[transform:rotateY(180deg)] motion-reduce:transition-none ${
                      isFlipped ? "[transform:rotateY(180deg)]" : ""
                    }`}
                  >
                    <div className="absolute inset-0 flex flex-col items-center justify-center rounded-[14px] border border-[var(--xd-gold-border-soft)] bg-white/75 px-4 py-5 text-center shadow-[0_8px_22px_rgba(5,5,5,0.03)] [backface-visibility:hidden] transition-[border-color,box-shadow] duration-300 group-hover:border-[var(--xd-gold-border)] group-focus-within:border-[var(--xd-gold-border)]">
                      <span className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-[var(--xd-gold-bg-soft)] text-[var(--xd-gold-active)]">
                        <Icon size={18} strokeWidth={1.9} />
                      </span>
                      <span className="mt-3 text-[13px] font-semibold text-[#050505]">
                        {title}
                      </span>
                      <span className="mt-1.5 text-[12px] leading-[18px] text-[#717182]">
                        {supportingText}
                      </span>
                    </div>

                    <div className="absolute inset-0 flex flex-col items-center justify-center rounded-[14px] border border-[var(--xd-gold-border-soft)] bg-white/90 px-4 py-5 text-center shadow-[0_8px_22px_rgba(5,5,5,0.03)] [backface-visibility:hidden] [transform:rotateY(180deg)] transition-[border-color,box-shadow] duration-300 group-hover:border-[var(--xd-gold-border)] group-focus-within:border-[var(--xd-gold-border)]">
                      <div className="flex flex-col gap-2.5">
                        {contacts.map(({ label: contactLabel, value, href, external }) => (
                          <a
                            key={value}
                            href={href}
                            target={external ? "_blank" : undefined}
                            rel={external ? "noopener noreferrer" : undefined}
                            className="rounded-[8px] px-2 text-[12px] leading-[18px] text-[#717182] transition hover:text-[#050505] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-border)]"
                          >
                            {contactLabel && (
                              <span className="block font-semibold text-[#3A3A3A]">
                                {t(`contactPage.contactLabels.${contactLabel}`, {
                                  fallback: contactLabel,
                                })}
                              </span>
                            )}
                            <span dir="ltr" className="block">{value}</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </SectionReveal>
      </ContactContainer>
    </section>
  );
}

function MessageSection({ onSubmit }: { onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const { t } = useLanguage();

  return (
    <section id="message" className="pb-16 pt-14 lg:py-20">
      <ContactContainer>
        <SectionReveal className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-start lg:gap-14">
          <div className="max-w-[500px] lg:pt-3">
            <Eyebrow>{t("contactPage.sendMessage")}</Eyebrow>

            <h2 className="mt-4 font-display text-[38px] font-light leading-[1.08] tracking-[-0.03em] text-[var(--xd-text)] sm:text-[50px] lg:text-[54px]">
              {t("contactPage.messageTitle")}
            </h2>

            <p className="mt-5 max-w-[460px] text-[14px] leading-[24px] text-[var(--xd-muted-2)]">
              {t("contactPage.messageBody")}
            </p>
          </div>

          <form
            onSubmit={onSubmit}
            className="w-full  p-4 sm:p-5 lg:max-w-[760px]"
          >
            <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2">
              <Field label={t("auth.signup.fullName")} name="name" required />
              <Field label={t("contactPage.phoneNo")} name="phone" type="tel" />
              <Field
                label={t("checkout.email")}
                name="email"
                type="email"
                required
                icon={<Mail size={14} />}
              />
              <Field label={t("contactPage.productInterest")} name="interest" />
            </div>

            <div className="mt-4">
              <label className="mb-2 block text-[13px] font-bold text-[var(--xd-text)]">
                {t("contactPage.message")}
              </label>

              <textarea
                name="message"
                required
                className="min-h-[150px] w-full resize-none rounded-[12px] border border-[#3D2518]/10 bg-white px-3 py-3 text-[13px] text-[var(--xd-text)] outline-none transition focus:border-[var(--xd-gold-border-hover)] focus:ring-4 focus:ring-[var(--xd-gold-active)]/10 sm:min-h-[160px]"
              />
            </div>

            <div className="mt-5 flex">
              <Button
                type="submit"
                variant="primary"
                size="sm"
                className="h-11 w-full px-7 text-[13px] sm:ms-auto sm:w-auto sm:min-w-[118px]"
              >
                {t("contactPage.send")}
              </Button>
            </div>
          </form>
        </SectionReveal>
      </ContactContainer>
    </section>
  );
}

function LocationSection() {
  const { t } = useLanguage();

  return (
    <section
      id="location"
      className="bg-[var(--xd-bg)] pb-16 pt-8 lg:pb-20 lg:pt-10"
    >
      <ContactContainer>
        <SectionReveal className="grid gap-10 lg:grid-cols-[1.08fr_0.92fr] lg:items-center lg:gap-14">
          <div className="order-2 w-full overflow-hidden rounded-[22px] border border-[var(--xd-gold-border-soft)] bg-white shadow-[0_18px_46px_rgba(5,5,5,0.08)] lg:order-1 lg:rounded-[24px]">
            <iframe
              title={t("contactPage.locationTitle")}
              src="https://www.google.com/maps?q=Cairo,%20Egypt&output=embed"
              className="h-[320px] w-full border-0 sm:h-[360px] lg:h-[410px]"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
          </div>

          <div className="order-1 max-w-[520px] lg:order-2 lg:ms-auto">
            <Eyebrow>{t("contactPage.locationEyebrow")}</Eyebrow>

            <h2 className="mt-4 font-display text-[38px] font-light leading-[1.08] tracking-[-0.03em] text-[var(--xd-text)] sm:text-[52px] lg:text-[58px]">
              {t("contactPage.locationTitle")}
            </h2>

            <p className="mt-5 text-[14px] leading-[24px] text-[var(--xd-muted-2)]">
              {t("contactPage.locationBody")}
            </p>

            <a
              href="https://www.google.com/maps/search/?api=1&query=Cairo%2C%20Egypt"
              target="_blank"
              rel="noreferrer"
              className="mt-7 inline-flex h-11 items-center justify-center rounded-full border border-[var(--xd-gold-border-soft)] bg-white/80 px-5 text-[13px] font-bold text-[var(--xd-text)] shadow-[0_10px_24px_rgba(5,5,5,0.04)] transition hover:-translate-y-[1px] hover:border-[var(--xd-gold-border-hover)] hover:shadow-[0_14px_30px_rgba(5,5,5,0.07)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-border)]"
            >
              Open in Google Maps
            </a>
          </div>
        </SectionReveal>
      </ContactContainer>
    </section>
  );
}

function FaqSection() {
  const { t } = useLanguage();

  return (
    <section className="pb-16 pt-20 lg:pb-20 lg:pt-24">
      <ContactContainer>
        <SectionReveal className="mx-auto max-w-[760px] text-center">
          <Eyebrow className="justify-center">{t("contactPage.faqEyebrow")}</Eyebrow>
          <h2 className="mt-4 font-display text-[38px] font-light leading-[1.08] tracking-[-0.03em] text-[#050505] sm:text-[52px] lg:text-[58px]">
            {t("contactPage.faqTitle")}
          </h2>
          <p className="mx-auto mt-6 max-w-[650px] text-[14px] leading-[24px] text-[#717182]">
            {t("contactPage.faqBody")}
          </p>
        </SectionReveal>

        <SectionReveal delay={0.08} className="mx-auto mt-10 flex max-w-[1080px] flex-col gap-4">
          {FAQS.map((faqKey) => (
            <article
              key={faqKey}
              className="rounded-[12px] border border-[var(--xd-gold-border-soft)] bg-white/80 px-6 py-6 shadow-[0_10px_24px_rgba(5,5,5,0.035)] sm:px-8"
            >
              <h3 className="text-[15px] font-bold leading-[22px] text-[#050505]">
                {t(`contactPage.faqs.${faqKey}.question`)}
              </h3>
              <p className="mt-2 max-w-[700px] text-[13px] leading-[22px] text-[#717182]">
                {t(`contactPage.faqs.${faqKey}.answer`)}
              </p>
            </article>
          ))}
        </SectionReveal>

        <SectionReveal delay={0.08} className="mt-8 flex justify-center">
          <Button asChild variant="primary" className="gap-2 px-6 text-[14px]">
            <Link href="/faqs">
              {t("contactPage.viewMoreFaqs")}
              <DirectionalIcon size={16} aria-hidden="true" />
            </Link>
          </Button>
        </SectionReveal>
      </ContactContainer>
    </section>
  );
}

function ContactContainer({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-[1344px] px-5 sm:px-8 lg:px-12">
      {children}
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  required = false,
  icon,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  icon?: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[13px] font-bold text-[#050505]">
        {label}
      </span>
      <span className="relative block">
        {icon && (
          <span className="pointer-events-none absolute left-3 top-1/2 flex -translate-y-1/2 text-[#A7A7A7]">
            {icon}
          </span>
        )}
        <input
          name={name}
          type={type}
          required={required}
          className={`${FIELD_CLASS} ${icon ? "pl-9" : ""}`}
        />
      </span>
    </label>
  );
}

function Eyebrow({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={`flex text-[11px] font-bold uppercase leading-none tracking-[0.18em] text-[#717182] ${className}`}
    >
      {children}
    </p>
  );
}
