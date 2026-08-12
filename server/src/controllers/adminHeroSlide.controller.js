import { prisma } from "../config/db.js";
import {
  storeHeroImage,
  validateHeroImage,
} from "../services/heroImageStorage.service.js";

const MAX_TITLE = 120;
const MAX_DESCRIPTION = 420;
const MAX_LABEL = 80;
const ALLOWED_KEYS = new Set([
  "badgeText", "headline", "headlineHighlight", "subtext", "primaryCta",
  "secondaryCta", "image", "mobileImage", "glassCard", "floatingLabels",
  "stats", "accentColor",
]);

function text(value, max) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function localized(value, max) {
  return { en: text(value?.en, max), ar: text(value?.ar, max) };
}

function safeUrl(value) {
  const url = text(value, 500);
  if (!url) return "";
  if (url.startsWith("/") && !url.startsWith("//")) return url;
  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.toString() : "";
  } catch {
    return "";
  }
}

function normalizeCta(value, optional = false) {
  if (optional && !value) return null;
  const cta = {
    label: localized(value?.label, MAX_LABEL),
    href: safeUrl(value?.href),
  };
  return optional && !cta.label.en && !cta.label.ar && !cta.href ? null : cta;
}

function normalizeContent(input, existing = {}) {
  const content = { ...existing };
  for (const key of ALLOWED_KEYS) {
    if (Object.prototype.hasOwnProperty.call(input ?? {}, key)) content[key] = input[key];
  }
  content.badgeText = localized(content.badgeText, MAX_LABEL);
  content.headline = localized(content.headline, MAX_TITLE);
  content.headlineHighlight = localized(content.headlineHighlight, MAX_TITLE);
  content.subtext = localized(content.subtext, MAX_DESCRIPTION);
  content.primaryCta = normalizeCta(content.primaryCta);
  content.secondaryCta = normalizeCta(content.secondaryCta, true);
  content.image = {
    src: text(content.image?.src, 500),
    alt: localized(content.image?.alt, 180),
  };
  content.mobileImage = content.mobileImage?.src
    ? { src: text(content.mobileImage.src, 500) }
    : null;
  return content;
}

function normalizeDraft(body, record) {
  const prior = record.draftData ?? {
    order: record.order,
    isActive: record.isActive,
    countdownTo: record.countdownTo?.toISOString() ?? null,
    content: record.content,
  };
  const order = Number(body?.order ?? prior.order);
  return {
    order: Number.isInteger(order) && order >= 1 && order <= 3 ? order : prior.order,
    isActive: typeof body?.isActive === "boolean" ? body.isActive : prior.isActive,
    countdownTo: body?.countdownTo ?? prior.countdownTo ?? null,
    content: normalizeContent(body?.content ?? body, prior.content),
  };
}

function validateDraft(draft, publishing) {
  const errors = {};
  if (![1, 2, 3].includes(draft.order)) errors.order = "Choose a slide position from 1 to 3.";
  const { content } = draft;
  if (publishing) {
    if (!content.headline.en) errors.headlineEn = "English title is required.";
    if (!content.headline.ar) errors.headlineAr = "Arabic title is required.";
    if (!content.image.src) errors.desktopImageUrl = "A desktop Hero image is required.";
  }
  for (const [key, cta] of [["primary", content.primaryCta], ["secondary", content.secondaryCta]]) {
    if (!cta) continue;
    const hasLabel = cta.label.en || cta.label.ar;
    if (hasLabel && !cta.href) errors[`${key}ButtonUrl`] = "Enter a valid internal, HTTP, or HTTPS destination.";
    if (publishing && key === "primary" && cta.href && (!cta.label.en || !cta.label.ar)) {
      errors.primaryButtonText = "Primary button text is required in both languages.";
    }
  }
  return errors;
}

function adminSlide(record) {
  const published = {
    id: record.id,
    slotNumber: record.slotNumber,
    order: record.order,
    isActive: record.isActive,
    countdownTo: record.countdownTo?.toISOString() ?? null,
    ...record.content,
  };
  const draft = record.draftData
    ? {
        id: record.id,
        slotNumber: record.slotNumber,
        order: record.draftData.order,
        isActive: record.draftData.isActive,
        countdownTo: record.draftData.countdownTo ?? null,
        ...record.draftData.content,
      }
    : null;
  return {
    id: record.id,
    slotNumber: record.slotNumber,
    status: record.status,
    publishedAt: record.publishedAt?.toISOString() ?? null,
    updatedAt: record.updatedAt.toISOString(),
    published,
    draft,
  };
}

async function findSlide(id) {
  return prisma.heroSlide.findUnique({ where: { id } });
}

export async function getAdminHeroSlides(_request, response) {
  const records = await prisma.heroSlide.findMany({ orderBy: { slotNumber: "asc" } });
  return response.json({ slides: records.map(adminSlide) });
}

export async function saveAdminHeroSlideDraft(request, response) {
  const record = await findSlide(request.params.id);
  if (!record) return response.status(404).json({ message: "Hero slide was not found." });
  const draft = normalizeDraft(request.body, record);
  const errors = validateDraft(draft, false);
  if (Object.keys(errors).length) {
    return response.status(400).json({ message: "Review the highlighted fields.", errors });
  }
  const updated = await prisma.heroSlide.update({
    where: { id: record.id },
    data: { draftData: draft, status: "DRAFT", updatedById: request.user.id },
  });
  return response.json({ slide: adminSlide(updated) });
}

export async function publishAdminHeroSlide(request, response) {
  const record = await findSlide(request.params.id);
  if (!record) return response.status(404).json({ message: "Hero slide was not found." });
  const draft = normalizeDraft(request.body, record);
  const errors = validateDraft(draft, true);
  if (Object.keys(errors).length) {
    return response.status(400).json({ message: "Complete the required fields before publishing.", errors });
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (draft.order !== record.order) {
      const displaced = await tx.heroSlide.findUnique({ where: { order: draft.order } });
      await tx.heroSlide.update({ where: { id: record.id }, data: { order: 100 + record.slotNumber } });
      if (displaced) {
        await tx.heroSlide.update({
          where: { id: displaced.id },
          data: { order: record.order, updatedById: request.user.id },
        });
      }
    }
    return tx.heroSlide.update({
      where: { id: record.id },
      data: {
        order: draft.order,
        isActive: draft.isActive,
        countdownTo: draft.countdownTo ? new Date(draft.countdownTo) : null,
        content: draft.content,
        draftData: null,
        status: "PUBLISHED",
        publishedAt: new Date(),
        updatedById: request.user.id,
      },
    });
  });
  return response.json({ slide: adminSlide(updated) });
}

export async function uploadAdminHeroImage(request, response) {
  const contentType = request.get("Content-Type")?.split(";", 1)[0].trim().toLowerCase() ?? "";
  const validation = validateHeroImage(request.body, contentType);
  if (validation.error) {
    return response.status(validation.error.status).json({
      message: validation.error.message,
      field: request.get("X-Hero-Image-Kind") === "mobile" ? "mobileImageUrl" : "desktopImageUrl",
    });
  }
  const stored = await storeHeroImage(request.body, validation.extension);
  return response.status(201).json({ imageUrl: stored.publicUrl });
}
