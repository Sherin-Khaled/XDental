// Schema for the home hero slider. Content records are designed to be
// managed from the admin dashboard later (CRUD on the hero_slides table);
// the frontend only ever renders what this shape describes.

/** Every user-visible string carries both site languages inline, mirroring
 *  how DB-backed content (e.g. testimonials) is localized in this project. */
export type LocalizedText = {
  en: string;
  ar: string;
};

export type HeroSlideCta = {
  label: LocalizedText;
  href: string;
};

export type HeroSlideStat = {
  value: LocalizedText;
  label: LocalizedText;
};

export type HeroSlideGlassCard = {
  title: LocalizedText;
  items: LocalizedText[];
};

export type HeroSlide = {
  id: string;
  /** Ascending display order. */
  order: number;
  /** Inactive slides are never rendered. */
  isActive: boolean;
  badgeText: LocalizedText;
  headline: LocalizedText;
  /** Substring of `headline` (per language) rendered in the accent color. */
  headlineHighlight?: LocalizedText;
  subtext: LocalizedText;
  primaryCta: HeroSlideCta;
  secondaryCta?: HeroSlideCta;
  /** `src` may be an absolute URL or a path under the site base (e.g. "/toothtools.webp"). */
  image: { src: string; alt: LocalizedText };
  /** Optional mobile crop. The desktop image remains the automatic fallback. */
  mobileImage?: { src: string } | null;
  /** Small pills floating around the image. Max 2 are rendered. */
  floatingLabels?: LocalizedText[];
  /** Up to 3 entries; the stats row is hidden when empty/omitted. */
  stats?: HeroSlideStat[];
  /** Optional glass card rendered over the visual column. */
  glassCard?: HeroSlideGlassCard | null;
  /** Optional per-slide accent; defaults to the brand gold. */
  accentColor?: string;
  /** ISO date. When set, a countdown renders; after it passes, the slide is
   *  treated as inactive. */
  countdownTo?: string | null;
};
