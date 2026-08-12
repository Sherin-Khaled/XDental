import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import {
  ArrowDownRight,
  ArrowUpRight,
  ClipboardList,
  Headphones,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Repeat,
  SearchCheck,
} from "lucide-react";
import { DirectionalIcon } from "@/components/DirectionalIcon";
import { Container } from "@/components/dental/Container";
import { Button } from "@/components/dental/Button";
import { SectionReveal } from "@/components/dental/SectionReveal";
import { PremiumAccentIcon } from "@/components/dental/PremiumAccentIcon";
import type { CarouselApi } from "@/components/ui/carousel";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import { SEO } from "@/components/SEO";
import { useLanguage } from "@/context/LanguageContext";
import { useDirectionalNavigation } from "@/hooks/use-directional-navigation";

const HERO_VISUAL = `${import.meta.env.BASE_URL}about/hero_image.png`;
const PRODUCT_VISUAL = `${import.meta.env.BASE_URL}about/hero_image.png`;
const CLINIC_SUPPORT_VISUAL = `${import.meta.env.BASE_URL}contact-clinic-support.jpg`;

const HERO_TAGS = [
  "trustedBrands",
  "clinicSupplyLists",
  "quoteSupport",
  "fastReordering",
  "verifiedSuppliers",
  "specialRequests",
  "easyProductDiscovery",
  "orderSupport",
];

const CLINIC_NEEDS = [
  "dailyEssentials",
  "treatmentSpecific",
  "repeatPurchasing",
  "specialRequests",
];

const WHY_CHOOSE = [
  { id: "trustedBrands", number: "01" },
  { id: "organizedShopping", number: "02" },
  { id: "clinicTools", number: "03" },
  { id: "fasterReordering", number: "04" },
  { id: "support", number: "05" },
];

const WHY_CHOOSE_CAROUSEL = [...WHY_CHOOSE, ...WHY_CHOOSE];

const BUYING_STEPS = [
  {
    id: "wishlist",
    Icon: ClipboardList,
    imageSrc: PRODUCT_VISUAL,
    imageClassName: "object-contain p-4",
  },
  {
    id: "supplyLists",
    Icon: SearchCheck,
    imageSrc: CLINIC_SUPPORT_VISUAL,
    imageClassName: "object-cover",
  },
  {
    id: "quotes",
    Icon: Repeat,
    imageSrc: PRODUCT_VISUAL,
    imageClassName: "object-contain p-4",
  },
  {
    id: "productSupport",
    Icon: Headphones,
    imageSrc: CLINIC_SUPPORT_VISUAL,
    imageClassName: "object-cover",
  },
];

const CONTACT_ACTIONS = [
  { Icon: Phone, id: "call" },
  { Icon: Mail, id: "email" },
  { Icon: MessageCircle, id: "whatsapp" },
  { Icon: MapPin, id: "visit" },
];

export default function About() {
  const productImage = HERO_VISUAL;

  return (
    <div className="min-h-screen bg-[var(--xd-bg)] text-[#050505]">
      <SEO page="about" />
      <HeroSection productImage={productImage} />
      <IntroSection />
      <ClinicNeedsSection />
      <WhyChooseSection />
      <PromiseSection />
      <BuyingWorkflowSection />
      <ContactActionsSection />
    </div>
  );
}

function HeroSection({ productImage }: { productImage: string }) {
  const { isRtl, t } = useLanguage();

  return (
    <section className="relative overflow-visible pb-14 pt-8 sm:pt-16 lg:pb-20 lg:pt-8">
      <Container>
        <div className="relative hidden min-h-[840px] overflow-visible xl:block">
          <p className="absolute left-1/2 top-8 z-30 -translate-x-1/2 text-[12px] font-semibold uppercase tracking-[0.24em] text-[#717182]">
            {t("aboutPage.hero.eyebrow")}
          </p>

          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 22 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.75 }}
            className="pointer-events-none absolute left-1/2 top-[50%] z-10 flex h-[500px] w-[520px] -translate-x-1/2 -translate-y-1/2 items-center justify-center xl:h-[600px] xl:w-[680px] 2xl:h-[660px] 2xl:w-[760px]"
          >
            <div
              className="absolute left-1/2 top-1/2 h-[440px] w-[540px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl xl:h-[520px] xl:w-[660px] 2xl:h-[540px] 2xl:w-[700px]"
              style={{
                background:
                  "radial-gradient(circle, rgba(184,138,68,0.1) 0%, rgba(249,220,92,0.10) 38%, transparent 70%)",
              }}
            />
            <img
              src={productImage}
              alt=""
              className="relative z-10 h-full w-full object-contain opacity-100"
              style={{
                filter: "drop-shadow(0 34px 54px rgba(5,5,5,0.1))",
              }}
            />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            aria-label={t("aboutPage.hero.fullTitle")}
            className="absolute inset-x-0 top-[64px] z-20 font-display text-[#050505]"
          >
            <span
              className={`mx-auto block w-fit font-semibold leading-none ${
                isRtl
                  ? "text-[clamp(42px,3.5vw,56px)]"
                  : "text-[clamp(52px,4vw,64px)]"
              }`}
            >
              {t("aboutPage.hero.titleLine1")}
            </span>
            <span
              className={`absolute left-0 top-[220px] block max-w-[230px] font-light leading-[1.04] xl:max-w-[270px] 2xl:left-[4%] 2xl:max-w-[310px] ${
                isRtl
                  ? "text-[clamp(40px,3.7vw,56px)]"
                  : "text-[clamp(48px,4.2vw,64px)] xl:text-[clamp(56px,4.6vw,64px)]"
              }`}
            >
              {t("aboutPage.hero.titleLine2")}
            </span>
            <span
              className={`absolute right-0 top-[330px] block max-w-[270px] font-semibold leading-[1.04] xl:max-w-[330px] 2xl:right-[4%] 2xl:max-w-[390px] ${
                isRtl
                  ? "text-[clamp(40px,3.7vw,56px)]"
                  : "text-[clamp(48px,4.2vw,64px)] xl:text-[clamp(56px,4.6vw,64px)]"
              }`}
            >
              {t("aboutPage.hero.titleLine3")}
            </span>
          </motion.h1>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12, duration: 0.55 }}
            className="absolute bottom-[72px] left-[8%] z-30 xl:left-[10%]"
          >
            <Button
              asChild
              variant="primary"
              size="lg"
              className="h-14 px-8 text-[15px]"
            >
              <Link href="/products">{t("aboutPage.actions.browseProducts")}</Link>
            </Button>
          </motion.div>

          <p className="absolute bottom-0 right-[8%] z-30 max-w-[470px] text-start text-[16px] leading-[28px] text-[var(--xd-muted-2)] xl:right-[10%]">
            {t("aboutPage.hero.description")}
          </p>
        </div>

        <div className="relative flex flex-col items-center text-center xl:hidden">
          <p className="mb-8 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#717182]">
            {t("aboutPage.hero.eyebrow")}
          </p>

          <h1
            className={`font-display font-semibold leading-[1.14] text-[#050505] ${
              isRtl ? "text-[32px] sm:text-[42px]" : "text-[34px] sm:text-[46px]"
            }`}
          >
            {t("aboutPage.hero.titleLine1")}
            <span className="block font-light">{t("aboutPage.hero.titleLine2")}</span>
            <span className="block">{t("aboutPage.hero.titleLine3")}</span>
          </h1>

          <div className="relative my-10 h-[280px] w-full max-w-[380px] sm:h-[330px] sm:max-w-[460px]">
            <div
              className="absolute left-1/2 top-1/2 h-[260px] w-[360px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl sm:h-[320px] sm:w-[460px]"
              style={{
                background:
                  "radial-gradient(circle, rgba(184,138,68,0.18) 0%, rgba(249,220,92,0.10) 38%, transparent 70%)",
              }}
            />
            <img
              src={productImage}
              alt={t("aboutPage.hero.imageAlt")}
              className="relative z-10 h-full w-full object-contain opacity-100"
              style={{
                filter: "drop-shadow(0 24px 38px rgba(5,5,5,0.14))",
              }}
            />
          </div>

          <Button asChild variant="primary" className="px-7 text-[14px]">
            <Link href="/products">{t("aboutPage.actions.browseProducts")}</Link>
          </Button>

          <p className="mt-14 max-w-[480px] text-start text-[14px] leading-[25px] text-[#717182] sm:text-center">
            {t("aboutPage.hero.description")}
          </p>
        </div>

        <InfiniteValueLine />
      </Container>
    </section>
  );
}

function InfiniteValueLine() {
  const { isRtl, t } = useLanguage();

  return (
    <div
      className="about-value-marquee-viewport relative left-1/2 z-10 mt-16 w-screen -translate-x-1/2 overflow-hidden border-y border-[#050505]/[0.05] py-5"
      aria-label={t("aboutPage.hero.benefitsLabel")}
    >
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-20 bg-gradient-to-r from-[var(--xd-bg)] to-transparent sm:w-28" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-20 bg-gradient-to-l from-[var(--xd-bg)] to-transparent sm:w-28" />

      <div
        className={`about-value-marquee flex w-max items-center will-change-transform ${
          isRtl ? "about-value-marquee--rtl" : ""
        }`}
        dir="ltr"
      >
        {[false, true].map((isDuplicate) => (
          <div
            key={isDuplicate ? "duplicate" : "primary"}
            className="about-value-marquee-group flex shrink-0 items-center"
            dir={isRtl ? "rtl" : "ltr"}
            aria-hidden={isDuplicate ? true : undefined}
          >
            {HERO_TAGS.map((tag) => (
              <div key={tag} className="flex shrink-0 items-center">
                <span className="flex w-[clamp(190px,18vw,290px)] justify-center px-4 text-center text-[14px] font-bold leading-none text-[#050505] sm:text-[15px]">
                  {t(`aboutPage.hero.tags.${tag}`)}
                </span>

                <span
                  className="flex w-[clamp(54px,5vw,88px)] items-center justify-center"
                  aria-hidden="true"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-[#717182]" />
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function IntroSection() {
  const { isRtl, t } = useLanguage();

  return (
    <section className="pb-16 pt-14 lg:pb-20 lg:pt-24">
      <Container>
        <SectionReveal className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-end lg:gap-24">
          <div className="max-w-[880px]">
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#717182]">
              {t("aboutPage.intro.eyebrow")}
            </p>

            <h2
              className={`font-display font-semibold leading-[1.15] text-[#050505] ${
                isRtl
                  ? "text-[32px] sm:text-[42px] lg:text-[52px]"
                  : "text-[34px] sm:text-[46px] lg:text-[60px]"
              }`}
            >
              {t("aboutPage.intro.title")}
              <span className="block font-light">
                {t("aboutPage.intro.titleSecond")}
              </span>
            </h2>

            <p className="mt-10 max-w-[620px] text-[15px] font-semibold leading-[26px] text-[#717182]">
              {t("aboutPage.intro.description")}
            </p>
          </div>

          <Button
            asChild
            variant="primary"
            className="w-fit px-7 text-[14px] lg:mb-1"
          >
            <Link href="/contact">{t("aboutPage.actions.requestQuote")}</Link>
          </Button>
        </SectionReveal>
      </Container>
    </section>
  );
}

function ClinicNeedsSection() {
  const [openNeed, setOpenNeed] = useState(CLINIC_NEEDS[2]);
  const { isRtl, t } = useLanguage();

  return (
    <section className="py-14 lg:py-24">
      <Container>
        <SectionReveal className="grid gap-10 lg:min-h-[480px] lg:grid-cols-[0.95fr_1.05fr] lg:items-stretch lg:gap-24">
          <div className="flex flex-col">
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#717182]">
              {t("aboutPage.clinicNeeds.eyebrow")}
            </p>

            <h2 className="font-display text-[32px] font-light leading-[1.18] text-[#050505] sm:text-[42px] lg:text-[50px]">
              {t("aboutPage.clinicNeeds.title")}
              <span className="block">
                {t("aboutPage.clinicNeeds.titleSecond")}{" "}
                <strong className="font-bold">{t("aboutPage.clinicNeeds.titleStrong")}</strong>
              </span>
            </h2>

            <div className="mt-8 h-[180px] w-full max-w-[340px] overflow-hidden rounded-[16px] bg-white shadow-[0_16px_38px_rgba(5,5,5,0.08)] sm:h-[210px] lg:h-[170px] lg:w-[320px]">
              <img
                src="https://images.unsplash.com/photo-1606811841689-23dfddce3e95?auto=format&fit=crop&q=80&w=900"
                alt={t("aboutPage.clinicNeeds.imageAlt")}
                className="h-full w-full object-cover"
              />
            </div>
          </div>

          <div className="flex flex-col border-t border-[#050505]/10 lg:h-full">
            {CLINIC_NEEDS.map((need) => (
              <div
                key={need}
                className="flex border-b border-[#050505]/10 lg:flex-1"
              >
                <button
                  type="button"
                  aria-expanded={openNeed === need}
                  onClick={() =>
                    setOpenNeed((currentNeed) =>
                      currentNeed === need ? "" : need
                    )
                  }
                  className="group flex min-h-[86px] w-full items-start justify-between gap-5 py-4 pr-1 text-start lg:h-full lg:py-5"
                >
                  <div>
                    <h3
                      className={`font-display text-[21px] text-[#050505] transition-[font-weight] duration-200 group-hover:font-semibold sm:text-[28px] ${
                        openNeed === need
                          ? "font-semibold"
                          : "font-light"
                      }`}
                    >
                      {t(`aboutPage.clinicNeeds.items.${need}.title`)}
                    </h3>

                    {openNeed === need && (
                      <p className="mt-1 text-[13px] leading-[20px] text-[#717182]">
                        {t(`aboutPage.clinicNeeds.items.${need}.description`)}
                      </p>
                    )}
                  </div>

                  {openNeed === need ? (
                    <ArrowUpRight
                      size={18}
                      className="mt-1 shrink-0 text-[var(--xd-gold-icon)] dark:text-current"
                      style={{
                        transform: isRtl ? "scaleX(-1)" : undefined,
                      }}
                    />
                  ) : (
                    <ArrowDownRight
                      size={18}
                      className="mt-1 shrink-0 text-[var(--xd-gold-icon)] transition-colors group-hover:text-[var(--xd-gold-active)] dark:text-current dark:group-hover:text-current"
                      style={{
                        transform: isRtl ? "scaleX(-1)" : undefined,
                      }}
                    />
                  )}
                </button>
              </div>
            ))}
          </div>
        </SectionReveal>
      </Container>
    </section>
  );
}

function WhyChooseSection() {
  const { isRtl, t } = useLanguage();
  const { controlOrder } = useDirectionalNavigation();
  const prefersReducedMotion = useReducedMotion();
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const [activeCard, setActiveCard] = useState(0);

  useEffect(() => {
    if (!carouselApi) return;

    const updateActiveCard = () => {
      setActiveCard(carouselApi.selectedScrollSnap() % WHY_CHOOSE.length);
    };

    updateActiveCard();
    carouselApi.on("select", updateActiveCard);
    carouselApi.on("reInit", updateActiveCard);

    return () => {
      carouselApi.off("select", updateActiveCard);
      carouselApi.off("reInit", updateActiveCard);
    };
  }, [carouselApi]);

  useEffect(() => {
    if (!carouselApi || prefersReducedMotion) return;

    const interval = window.setInterval(() => {
      carouselApi.scrollNext();
    }, 4200);

    return () => window.clearInterval(interval);
  }, [carouselApi, prefersReducedMotion]);

  return (
    <section className="py-14 lg:py-20">
      <Container>
        <SectionReveal className="grid gap-10 lg:grid-cols-[1fr_420px] lg:items-start">
          <div>
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#717182]">
              {t("aboutPage.whyChoose.eyebrow")}
            </p>

            <h2
              className={`font-display font-light leading-[1.05] text-[#050505] ${
                isRtl
                  ? "text-[38px] sm:text-[54px] lg:text-[66px]"
                  : "text-[42px] sm:text-[64px] lg:text-[78px]"
              }`}
            >
              {t("aboutPage.whyChoose.title")}
              <span className="block">{t("aboutPage.whyChoose.titleSecond")}</span>
            </h2>
          </div>

          <p className="text-[15px] leading-[26px] text-[#717182] lg:pt-52">
            {t("aboutPage.whyChoose.description")}
          </p>
        </SectionReveal>

        <SectionReveal delay={0.08}>
        <Carousel
          setApi={setCarouselApi}
          opts={{
            align: "start",
            direction: isRtl ? "rtl" : "ltr",
            loop: true,
          }}
          data-rtl-carousel="about-why-choose"
          aria-label={t("aboutPage.whyChoose.carouselLabel")}
          className="about-numbered-carousel mt-12 lg:mt-16"
        >
          <CarouselContent
            className={isRtl ? "ml-0 -mr-5 py-10" : "-ml-5 py-10"}
          >
            {WHY_CHOOSE_CAROUSEL.map((item, index) => {
              const cardIndex = index % WHY_CHOOSE.length;
              const isActive = activeCard === cardIndex;
              const itemTitle = t(`aboutPage.whyChoose.items.${item.id}.title`);

              return (
                <CarouselItem
                  key={`${item.number}-${index}`}
                  aria-hidden={index >= WHY_CHOOSE.length}
                  className={`basis-[78%] sm:basis-[49%] lg:basis-[29%] xl:basis-[24%] ${
                    isRtl ? "pl-0 pr-5" : "pl-5"
                  }`}
                >
                  <article
                    className={`home-feature-card relative flex h-[270px] overflow-hidden rounded-[18px] border p-6 transition-[border-color,box-shadow,transform] duration-500 sm:h-[300px] ${
                      isActive
                        ? "home-feature-card--active shadow-[0_10px_24px_rgba(212,167,44,0.16)]"
                        : "shadow-[0_8px_20px_rgba(5,5,5,0.05)]"
                    }`}
                  >
                    <div className="relative z-10">
                      <h3 className="mb-3 max-w-[220px] text-[20px] font-semibold leading-[1.12] text-[var(--xd-text)]">
                        {itemTitle}
                      </h3>

                      <p className="max-w-[250px] text-[14px] leading-[23px] text-[var(--xd-text-muted)]">
                        {t(`aboutPage.whyChoose.items.${item.id}.description`)}
                      </p>
                    </div>

                    <div className="home-feature-divider absolute bottom-[76px] left-6 right-6 h-px transition-opacity duration-500" />

                    <span
                      className="home-feature-number pointer-events-none absolute -bottom-[32px] right-3 select-none font-display text-[104px] font-light leading-none transition-opacity duration-500 sm:-bottom-[35px] sm:text-[116px]"
                    >
                      {item.number}
                    </span>
                  </article>
                </CarouselItem>
              );
            })}
          </CarouselContent>
        </Carousel>

        <div className="mt-3 flex items-center gap-3" dir="ltr">
          {controlOrder.map((action) => (
            <button
              key={action}
              type="button"
              aria-label={
                action === "next"
                  ? t("common.nextCard")
                  : t("common.previousCard")
              }
              onClick={() =>
                action === "next"
                  ? carouselApi?.scrollNext()
                  : carouselApi?.scrollPrev()
              }
              disabled={!carouselApi}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-[#050505]/10 text-[#050505] transition-colors hover:border-[var(--xd-gold-active)]/60 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <DirectionalIcon direction={action} size={16} />
            </button>
          ))}

          <div
            className="flex items-center gap-1.5"
            style={{ marginInlineStart: 8 }}
          >
            {WHY_CHOOSE.map((item, index) => (
              <button
                key={item.number}
                type="button"
                aria-label={t("aboutPage.whyChoose.showCard", {
                  values: {
                    title: t(`aboutPage.whyChoose.items.${item.id}.title`),
                  },
                })}
                aria-current={activeCard === index ? "true" : undefined}
                onClick={() => carouselApi?.scrollTo(index)}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  activeCard === index
                    ? "xd-gradient-gold w-5"
                    : "w-1.5 bg-[var(--xd-border-strong)] hover:opacity-80"
                }`}
              >
                <span className="sr-only">
                  {t(`aboutPage.whyChoose.items.${item.id}.title`)}
                </span>
              </button>
            ))}
          </div>
        </div>
        </SectionReveal>
      </Container>
    </section>
  );
}

function PromiseSection() {
  const { isRtl, t } = useLanguage();
  const promiseCards = ["curatedProducts", "supplierNetwork", "orderingSupport", "reordering"];

  return (
    <section className="py-14 lg:py-20">
      <Container>
        <SectionReveal className="overflow-hidden rounded-[32px] border border-[var(--xd-gold-border-soft)] bg-white/72 px-6 py-10 shadow-[0_18px_54px_rgba(5,5,5,0.045)] backdrop-blur sm:px-8 lg:px-14 lg:py-14">
          <div className="grid gap-10 lg:grid-cols-[0.88fr_1.12fr] lg:items-center xl:gap-14">
            <div className="max-w-[600px]">
              <PillLabel label={t("aboutPage.promise.eyebrow")} />

              <h2
                className={`mt-7 font-display font-bold leading-[1.12] tracking-[-0.035em] text-[#050505] ${
                  isRtl
                    ? "text-[32px] sm:text-[40px] lg:text-[46px]"
                    : "text-[34px] sm:text-[44px] lg:text-[50px]"
                }`}
              >
                {t("aboutPage.promise.title")}
                <br />
                <span className="text-[#717182]">{t("aboutPage.promise.titleSecond")}</span>
                <br />
                {t("aboutPage.promise.titleThird")}
              </h2>

              <p className="mt-6 max-w-[540px] text-[15px] leading-[27px] text-[#0E0E0E]/70 sm:text-[16px] sm:leading-[29px]">
                {t("aboutPage.promise.description")}
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Button
                  asChild
                  variant="primary"
                  size="sm"
                  className="h-11 gap-2 px-6 text-[13px]"
                >
                  <Link href="/products">
                    {t("aboutPage.actions.browseProducts")}
                    <DirectionalIcon direction="forward" size={14} />
                  </Link>
                </Button>

                <Button
                  asChild
                  variant="secondary"
                  size="sm"
                  className="h-11 px-6 text-[13px]"
                >
                  <Link href="/contact">{t("aboutPage.actions.requestQuote")}</Link>
                </Button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {promiseCards.map((card) => (
                <article
                  key={card}
                  className="group rounded-[24px] border border-[#050505]/[0.06] bg-white/78 p-6 transition duration-300 hover:-translate-y-1 hover:border-[var(--xd-gold-border)] hover:shadow-[var(--xd-shadow-hover)]"
                >
                  <h3 className="text-[17px] font-bold leading-[23px] text-[#050505]">
                    {t(`aboutPage.promise.items.${card}.title`)}
                  </h3>

                  <p className="mt-3 text-[13.5px] leading-[23px] text-[#0E0E0E]/68">
                    {t(`aboutPage.promise.items.${card}.description`)}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </SectionReveal>
      </Container>
    </section>
  );
}

function BuyingWorkflowSection() {
  const { isRtl, t } = useLanguage();
  const prefersReducedMotion = useReducedMotion();
  const timelineRef = useRef<HTMLDivElement>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [showBottomProgress, setShowBottomProgress] = useState(true);

  const activeStep = BUYING_STEPS[currentStepIndex];
  const lastStepIndex = BUYING_STEPS.length - 1;

  const { scrollYProgress } = useScroll({
    target: timelineRef,
    offset: ["start start", "end end"],
  });

  const railScaleY = useTransform(scrollYProgress, [0, 1], [0, 1]);
  const bottomScaleX = useTransform(scrollYProgress, [0, 1], [0, 1]);

  const textEnterX = isRtl ? -56 : 56;
  const textExitX = isRtl ? -18 : 18;
  const imageEnterX = isRtl ? -88 : 88;
  const imageExitX = isRtl ? -28 : 28;

  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    const nextStepIndex = Math.min(
      Math.floor(latest * BUYING_STEPS.length),
      lastStepIndex
    );

    setCurrentStepIndex((previousStepIndex) =>
      previousStepIndex === nextStepIndex ? previousStepIndex : nextStepIndex
    );
  });

  useEffect(() => {
    if (currentStepIndex !== lastStepIndex) {
      setShowBottomProgress(true);
      return;
    }

    const hideTimer = window.setTimeout(() => {
      setShowBottomProgress(false);
    }, 450);

    return () => window.clearTimeout(hideTimer);
  }, [currentStepIndex, lastStepIndex]);

  useEffect(() => {
    if (window.location.hash !== "#clinic-purchasing") return;

    const scrollFrame = window.requestAnimationFrame(() => {
      document.getElementById("clinic-purchasing")?.scrollIntoView();
    });

    return () => window.cancelAnimationFrame(scrollFrame);
  }, []);

  const scrollToStep = (stepIndex: number) => {
    const timeline = timelineRef.current;
    if (!timeline) return;

    const timelineTop = timeline.getBoundingClientRect().top + window.scrollY;
    const scrollableDistance = timeline.offsetHeight - window.innerHeight;
    const targetProgress =
      BUYING_STEPS.length <= 1 ? 0 : stepIndex / lastStepIndex;

    window.scrollTo({
      top: timelineTop + scrollableDistance * targetProgress,
      behavior: prefersReducedMotion ? "auto" : "smooth",
    });
  };

  return (
    <section
      id="clinic-purchasing"
      className="relative scroll-mt-[76px] bg-[var(--xd-bg)]"
    >
      <div className="px-5 py-14 lg:hidden">
        <div className="mx-auto max-w-[620px]">
          <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#717182]">
            {t("aboutPage.workflow.eyebrow")}
          </p>

          <h2 className="font-display text-[34px] font-light leading-[1.12] text-[#050505] sm:text-[44px]">
            {t("aboutPage.workflow.title")}
            <span className="block text-[#717182]">{t("aboutPage.workflow.titleSecond")}</span>
          </h2>

          <div className="mt-9 flex flex-col gap-5">
            {BUYING_STEPS.map(
              ({
                id,
                Icon,
                imageSrc,
                imageClassName,
              }) => (
                <article
                  key={id}
                  className="overflow-hidden rounded-[20px] border border-[#050505]/[0.06] bg-white/70 p-5 shadow-[0_12px_32px_rgba(5,5,5,0.05)]"
                >
                  <div className="flex items-center gap-3">
                    <span className="xd-accent-icon-surface flex h-10 w-10 items-center justify-center rounded-full">
                      <PremiumAccentIcon icon={Icon} size={16} className="xd-timeline-step-icon" />
                    </span>

                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--xd-gold-text)]">
                      {t(`aboutPage.workflow.steps.${id}.label`)}
                    </p>
                  </div>

                  <h3 className="mt-4 font-display text-[22px] font-bold leading-[29px] text-[var(--xd-text)]">
                    {t(`aboutPage.workflow.steps.${id}.title`)}
                  </h3>

                  <p className="mt-3 text-[14px] leading-[24px] text-[var(--xd-text-muted)]">
                    {t(`aboutPage.workflow.steps.${id}.description`)}
                  </p>

                  <div className="mt-5 aspect-[3/2] overflow-hidden rounded-[16px] bg-white">
                    <img
                      src={imageSrc}
                      alt={t(`aboutPage.workflow.steps.${id}.imageAlt`)}
                      className={`h-full w-full ${imageClassName}`}
                      loading="lazy"
                    />
                  </div>
                </article>
              )
            )}
          </div>
        </div>
      </div>

      <div ref={timelineRef} className="relative hidden h-[400vh] lg:block">
        <div className="sticky top-[76px] h-[calc(100vh-76px)]">
          <Container className="relative flex h-full flex-col justify-center px-5 lg:px-24">
            <div className="grid items-center gap-10 lg:grid-cols-[0.95fr_1.05fr] xl:gap-14">
              <div className="grid grid-cols-[64px_1fr] items-start gap-5">
                <div
                  className="relative flex flex-col items-center"
                  aria-label={t("aboutPage.workflow.navigationLabel")}
                >
                  <div className="xd-timeline-rail absolute bottom-6 top-6 w-px" />

                  <motion.div
                    className="xd-timeline-rail-progress absolute bottom-6 top-6 w-px origin-top"
                    style={{ scaleY: railScaleY }}
                  />

                  <div className="relative flex flex-col items-center gap-10">
                    {BUYING_STEPS.map(({ Icon, id }, index) => {
                      const isActive = index === currentStepIndex;
                      const isVisited = index < currentStepIndex;
                      const stepLabel = t(`aboutPage.workflow.steps.${id}.label`);
                      const stepState = isActive
                        ? "active"
                        : isVisited
                          ? "completed"
                          : "upcoming";

                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => scrollToStep(index)}
                          aria-label={t("aboutPage.workflow.goToStep", {
                            values: { step: stepLabel },
                          })}
                          aria-current={isActive ? "step" : undefined}
                          data-state={stepState}
                          className={`xd-timeline-step xd-timeline-step--${stepState} relative flex h-12 w-12 items-center justify-center rounded-full`}
                        >
                          <span className="xd-timeline-step-ring absolute inset-0 rounded-full" />

                          <PremiumAccentIcon
                            icon={Icon}
                            size={17}
                            className="xd-timeline-step-icon relative z-10"
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex min-h-[200px] items-start pt-1">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeStep.id}
                      initial={{ opacity: 0, x: textEnterX }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: textExitX }}
                      transition={{ duration: 0.58, ease: "easeOut" }}
                    >
                      <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--xd-gold-text)]">
                        {t(`aboutPage.workflow.steps.${activeStep.id}.label`)}
                      </p>

                      <h2 className="mt-3 font-display text-[34px] font-bold leading-[1.08] text-[var(--xd-text)] xl:text-[40px]">
                        {t(`aboutPage.workflow.steps.${activeStep.id}.title`)}
                      </h2>

                      <p className="mt-4 max-w-[500px] text-[15px] leading-[26px] text-[var(--xd-text-muted)]">
                        {t(`aboutPage.workflow.steps.${activeStep.id}.description`)}
                      </p>
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>

              <div className="flex justify-end">
                <div className="w-full max-w-[360px] xl:max-w-[390px]">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeStep.id}
                      initial={{ opacity: 0, x: imageEnterX }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: imageExitX }}
                      transition={{ duration: 0.58, ease: "easeOut" }}
                      className="h-[240px] w-full overflow-hidden rounded-[22px] bg-white shadow-[0_18px_44px_rgba(5,5,5,0.08)]"
                    >
                      <img
                        src={activeStep.imageSrc}
                        alt={t(`aboutPage.workflow.steps.${activeStep.id}.imageAlt`)}
                        className={`h-full w-full ${activeStep.imageClassName}`}
                        loading={currentStepIndex === 0 ? "eager" : "lazy"}
                      />
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
            </div>

            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px]">
              <motion.div
                className={`h-[2px] w-full origin-left rounded-full bg-[var(--xd-gold)] transition-opacity duration-700 ${
                  showBottomProgress ? "opacity-100" : "opacity-0"
                }`}
                style={{ scaleX: bottomScaleX }}
              />
            </div>
          </Container>
        </div>
      </div>
    </section>
  );
}

function ContactActionsSection() {
  const { isRtl, t } = useLanguage();

  return (
    <section className="pb-16 pt-14 lg:pb-20 lg:pt-24">
      <Container>
        <SectionReveal className="rounded-[24px] bg-white px-6 py-14 text-center shadow-[0_16px_42px_rgba(5,5,5,0.05)] lg:rounded-[32px] lg:px-16 lg:py-20">
          <div className="mx-auto max-w-[640px]">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#717182]">
              {t("aboutPage.contact.eyebrow")}
            </p>

            <h2
              className={`font-display font-light leading-[1.08] text-[#050505] ${
                isRtl ? "text-[34px] sm:text-[50px]" : "text-[36px] sm:text-[58px]"
              }`}
            >
              {t("aboutPage.contact.title")}
              <span className="block">{t("aboutPage.contact.titleSecond")}</span>
            </h2>

            <p className="mt-6 text-[14px] leading-[24px] text-[#717182]">
              {t("aboutPage.contact.description")}
            </p>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {CONTACT_ACTIONS.map(({ Icon, id }) => (
              <Link
                key={id}
                href="/contact"
                className="flex min-h-[112px] flex-col items-center justify-center gap-3 rounded-[12px] border border-[var(--xd-gold-border-soft)] bg-white/70 px-4 py-5 shadow-[0_8px_22px_rgba(5,5,5,0.04)] transition hover:-translate-y-0.5 hover:border-[var(--xd-gold-border-hover)]"
              >
                <span className="xd-accent-icon-surface xd-icon-card-surface flex h-10 w-10 items-center justify-center rounded-[10px]">
                  <PremiumAccentIcon icon={Icon} size={18} />
                </span>

                <span className="text-[13px] font-semibold text-[#050505]">
                  {t(`aboutPage.contact.actions.${id}`)}
                </span>
              </Link>
            ))}
          </div>
        </SectionReveal>
      </Container>
    </section>
  );
}

function PillLabel({ label }: { label: string }) {
  return (
    <span className="inline-flex w-fit items-center gap-2 rounded-full bg-[var(--xd-info-bg)] px-4 py-2 text-[12px] font-bold uppercase tracking-[0.04em] text-[var(--xd-info-text)]">
      <span className="h-1.5 w-1.5 rounded-full bg-[var(--xd-gold)]" />
      {label}
    </span>
  );
}
