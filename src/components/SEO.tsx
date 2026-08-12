import { useEffect } from "react";
import { BRAND_NAME, ISOLATED_BRAND_NAME } from "@/components/dental/BrandLogo";
import { useLanguage } from "@/context/LanguageContext";
import { SITE_URL, seoPages, type RobotsDirective, type SeoPageKey } from "@/data/seo";

type SEOProps = {
  page: SeoPageKey;
  path?: string;
  title?: string;
  titleFormat?: "brandFirst" | "exact";
  description?: string;
  image?: string;
  robots?: RobotsDirective;
  values?: Record<string, string | number>;
};

function upsertMeta(selector: string, create: () => HTMLMetaElement, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(selector);

  if (!element) {
    element = create();
    document.head.appendChild(element);
  }

  element.content = content;
}

function upsertLink(rel: string, selector: string, href: string, hreflang?: string) {
  let element = document.head.querySelector<HTMLLinkElement>(selector);

  if (!element) {
    element = document.createElement("link");
    element.rel = rel;
    if (hreflang) element.hreflang = hreflang;
    document.head.appendChild(element);
  }

  element.href = href;
}

function getBrandFirstTitle(title: string) {
  const trimmedTitle = title.trim();

  if (!trimmedTitle) return ISOLATED_BRAND_NAME;

  if (trimmedTitle.startsWith(BRAND_NAME)) {
    return `${ISOLATED_BRAND_NAME}${trimmedTitle.slice(BRAND_NAME.length)}`;
  }

  const pageTitle = trimmedTitle
    .replace(new RegExp(`\\s*[|\\-–—]\\s*${BRAND_NAME}\\s*$`, "i"), "")
    .replace(new RegExp(`\\s+${BRAND_NAME}\\s*$`, "i"), "")
    .trim();

  return `${ISOLATED_BRAND_NAME} | ${pageTitle || trimmedTitle}`;
}

export function SEO({
  page,
  path,
  title,
  titleFormat = "brandFirst",
  description,
  image = `${SITE_URL}/opengraph.jpg`,
  robots,
  values,
}: SEOProps) {
  const { language, t } = useLanguage();

  useEffect(() => {
    const pageConfig = seoPages[page];
    const pagePath = path ?? pageConfig.path;
    const canonicalUrl = `${SITE_URL}${pagePath}`;
    const rawTitle = title ?? t(`seo.pages.${page}.title`, { values });
    const resolvedTitle =
      titleFormat === "exact"
        ? rawTitle.trim() || ISOLATED_BRAND_NAME
        : getBrandFirstTitle(rawTitle);
    const resolvedDescription = description ?? t(`seo.pages.${page}.description`, { values });
    const resolvedRobots = robots ?? pageConfig.robots;
    const locale = language === "ar" ? "ar_EG" : "en_US";

    document.title = resolvedTitle;

    upsertMeta("meta[name='description']", () => {
      const meta = document.createElement("meta");
      meta.name = "description";
      return meta;
    }, resolvedDescription);

    upsertMeta("meta[name='robots']", () => {
      const meta = document.createElement("meta");
      meta.name = "robots";
      return meta;
    }, resolvedRobots);

    upsertMeta("meta[property='og:type']", () => {
      const meta = document.createElement("meta");
      meta.setAttribute("property", "og:type");
      return meta;
    }, "website");

    upsertMeta("meta[property='og:url']", () => {
      const meta = document.createElement("meta");
      meta.setAttribute("property", "og:url");
      return meta;
    }, canonicalUrl);

    upsertMeta("meta[property='og:title']", () => {
      const meta = document.createElement("meta");
      meta.setAttribute("property", "og:title");
      return meta;
    }, resolvedTitle);

    upsertMeta("meta[property='og:description']", () => {
      const meta = document.createElement("meta");
      meta.setAttribute("property", "og:description");
      return meta;
    }, resolvedDescription);

    upsertMeta("meta[property='og:image']", () => {
      const meta = document.createElement("meta");
      meta.setAttribute("property", "og:image");
      return meta;
    }, image);

    upsertMeta("meta[property='og:locale']", () => {
      const meta = document.createElement("meta");
      meta.setAttribute("property", "og:locale");
      return meta;
    }, locale);

    upsertMeta("meta[name='twitter:card']", () => {
      const meta = document.createElement("meta");
      meta.name = "twitter:card";
      return meta;
    }, "summary_large_image");

    upsertMeta("meta[name='twitter:title']", () => {
      const meta = document.createElement("meta");
      meta.name = "twitter:title";
      return meta;
    }, resolvedTitle);

    upsertMeta("meta[name='twitter:description']", () => {
      const meta = document.createElement("meta");
      meta.name = "twitter:description";
      return meta;
    }, resolvedDescription);

    upsertMeta("meta[name='twitter:image']", () => {
      const meta = document.createElement("meta");
      meta.name = "twitter:image";
      return meta;
    }, image);

    upsertLink("canonical", "link[rel='canonical']", canonicalUrl);
    upsertLink("alternate", "link[rel='alternate'][hreflang='en']", `${SITE_URL}${pagePath}`, "en");
    upsertLink("alternate", "link[rel='alternate'][hreflang='ar']", `${SITE_URL}${pagePath}`, "ar");
    upsertLink("alternate", "link[rel='alternate'][hreflang='x-default']", `${SITE_URL}${pagePath}`, "x-default");
  }, [description, image, language, page, path, robots, t, title, titleFormat, values]);

  return null;
}
