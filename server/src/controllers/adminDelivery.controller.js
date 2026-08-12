import { prisma } from "../config/db.js";
import {
  isDeliveryOfferValidNow,
  serializeDeliveryZone,
} from "../services/deliveryOffer.service.js";
import { cleanText, isValidId } from "../utils/records.js";

const OFFER_TYPES = new Set([
  "SAME_DAY_DELIVERY",
  "FREE_DELIVERY",
  "DISCOUNTED_DELIVERY",
  "CUSTOM",
]);
const RECURRENCE_TYPES = new Set(["WEEKLY", "SPECIFIC_DATE", "DATE_RANGE"]);
const DISCOUNT_TYPES = new Set(["PERCENTAGE", "FIXED"]);
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const CUTOFF_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value ?? {}, key);
}

function serializeOffer(offer) {
  return {
    id: offer.id,
    titleEn: offer.titleEn,
    titleAr: offer.titleAr,
    descriptionEn: offer.descriptionEn,
    descriptionAr: offer.descriptionAr,
    offerType: offer.offerType,
    recurrenceType: offer.recurrenceType,
    weekdays: offer.weekdays,
    specificDate: offer.specificDate?.toISOString().slice(0, 10) ?? null,
    startDate: offer.startDate?.toISOString().slice(0, 10) ?? null,
    endDate: offer.endDate?.toISOString().slice(0, 10) ?? null,
    cutoffTime: offer.cutoffTime ?? null,
    timezone: offer.timezone,
    discountType: offer.discountType ?? null,
    discountValue: offer.discountValue === null ? null : Number(offer.discountValue),
    minimumOrderAmount:
      offer.minimumOrderAmount === null ? null : Number(offer.minimumOrderAmount),
    appliesToStandard: offer.appliesToStandard,
    appliesToFast: offer.appliesToFast,
    isActive: offer.isActive,
    isCurrentlyValid: isDeliveryOfferValidNow(offer),
    deliveryZones: (offer.zones ?? []).map(({ deliveryZone }) =>
      serializeDeliveryZone(deliveryZone)
    ),
    createdAt: offer.createdAt,
    updatedAt: offer.updatedAt,
  };
}

const offerInclude = {
  zones: {
    include: { deliveryZone: true },
  },
};

function parseDateOnly(value, label, required) {
  if (value === null || value === undefined || value === "") {
    return required ? { error: `${label} is required.` } : { value: null };
  }
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) {
    return { error: `${label} must use YYYY-MM-DD.` };
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    return { error: `${label} is invalid.` };
  }
  return { value: date };
}

async function parseOfferInput(body, existing = null) {
  const valueFor = (key) => (hasOwn(body, key) ? body[key] : existing?.[key]);
  const textFields = [
    ["titleEn", "English title", 160],
    ["titleAr", "Arabic title", 160],
    ["descriptionEn", "English description", 1000],
    ["descriptionAr", "Arabic description", 1000],
  ];
  const parsed = {};

  for (const [field, label, maxLength] of textFields) {
    const value = cleanText(valueFor(field), maxLength);
    if (!value) return { error: { message: `${label} is required.`, field } };
    parsed[field] = value;
  }

  const offerType = cleanText(valueFor("offerType"), 40).toUpperCase();
  if (!OFFER_TYPES.has(offerType)) {
    return { error: { message: "Select a valid offer type.", field: "offerType" } };
  }

  const recurrenceType = cleanText(valueFor("recurrenceType"), 40).toUpperCase();
  if (!RECURRENCE_TYPES.has(recurrenceType)) {
    return {
      error: {
        message: "Select weekly, specific date, or date range scheduling.",
        field: "recurrenceType",
      },
    };
  }

  const rawZoneIds = hasOwn(body, "deliveryZoneIds")
    ? body.deliveryZoneIds
    : existing?.zones?.map(({ deliveryZoneId }) => deliveryZoneId) ?? [];
  if (!Array.isArray(rawZoneIds) || rawZoneIds.length === 0 || rawZoneIds.length > 50) {
    return {
      error: {
        message: "Assign at least one delivery zone.",
        field: "deliveryZoneIds",
      },
    };
  }
  const deliveryZoneIds = [...new Set(rawZoneIds.map((id) =>
    typeof id === "string" ? id.trim() : ""
  ))];
  if (deliveryZoneIds.some((id) => !isValidId(id))) {
    return { error: { message: "Select valid delivery zones.", field: "deliveryZoneIds" } };
  }
  const zoneCount = await prisma.deliveryZone.count({
    where: { id: { in: deliveryZoneIds } },
  });
  if (zoneCount !== deliveryZoneIds.length) {
    return {
      error: {
        message: "One or more delivery zones do not exist.",
        field: "deliveryZoneIds",
      },
    };
  }

  let weekdays = [];
  let specificDate = null;
  let startDate = null;
  let endDate = null;

  if (recurrenceType === "WEEKLY") {
    const rawWeekdays = valueFor("weekdays");
    if (!Array.isArray(rawWeekdays)) {
      return { error: { message: "Select at least one weekday.", field: "weekdays" } };
    }
    weekdays = [...new Set(rawWeekdays.map(Number))].sort((a, b) => a - b);
    if (
      weekdays.length === 0 ||
      weekdays.some((weekday) => !Number.isInteger(weekday) || weekday < 0 || weekday > 6)
    ) {
      return { error: { message: "Select valid weekdays.", field: "weekdays" } };
    }
  } else if (recurrenceType === "SPECIFIC_DATE") {
    const date = parseDateOnly(valueFor("specificDate"), "Specific date", true);
    if (date.error) return { error: { message: date.error, field: "specificDate" } };
    specificDate = date.value;
  } else {
    const start = parseDateOnly(valueFor("startDate"), "Start date", true);
    if (start.error) return { error: { message: start.error, field: "startDate" } };
    const end = parseDateOnly(valueFor("endDate"), "End date", true);
    if (end.error) return { error: { message: end.error, field: "endDate" } };
    if (end.value < start.value) {
      return { error: { message: "End date cannot be before start date.", field: "endDate" } };
    }
    startDate = start.value;
    endDate = end.value;
  }

  const rawCutoff = valueFor("cutoffTime");
  const cutoffTime = rawCutoff === null || rawCutoff === undefined || rawCutoff === ""
    ? null
    : cleanText(rawCutoff, 5);
  if (cutoffTime && !CUTOFF_PATTERN.test(cutoffTime)) {
    return {
      error: {
        message: "Cutoff time must use 24-hour HH:mm format.",
        field: "cutoffTime",
      },
    };
  }

  const isActive = valueFor("isActive") ?? true;
  if (typeof isActive !== "boolean") {
    return { error: { message: "Active must be true or false.", field: "isActive" } };
  }

  const monetary = offerType === "FREE_DELIVERY" || offerType === "DISCOUNTED_DELIVERY";
  const rawMinimum = valueFor("minimumOrderAmount");
  const minimumOrderAmount = !monetary || rawMinimum === null || rawMinimum === undefined || rawMinimum === ""
    ? null
    : Number(rawMinimum);
  if (minimumOrderAmount !== null && (!Number.isFinite(minimumOrderAmount) || minimumOrderAmount < 0)) {
    return {
      error: {
        message: "Minimum order must be zero or greater.",
        field: "minimumOrderAmount",
      },
    };
  }

  let discountType = null;
  let discountValue = null;
  if (offerType === "DISCOUNTED_DELIVERY") {
    discountType = cleanText(valueFor("discountType"), 30).toUpperCase();
    if (!DISCOUNT_TYPES.has(discountType)) {
      return { error: { message: "Select percentage or fixed discount.", field: "discountType" } };
    }
    discountValue = Number(valueFor("discountValue"));
    if (!Number.isFinite(discountValue) || discountValue <= 0) {
      return { error: { message: "Discount value must be greater than zero.", field: "discountValue" } };
    }
    if (discountType === "PERCENTAGE" && discountValue > 100) {
      return { error: { message: "Percentage discount cannot exceed 100%.", field: "discountValue" } };
    }
  }

  const appliesToStandard = monetary ? (valueFor("appliesToStandard") ?? true) : false;
  const appliesToFast = monetary ? (valueFor("appliesToFast") ?? true) : false;
  if (typeof appliesToStandard !== "boolean" || typeof appliesToFast !== "boolean") {
    return { error: { message: "Delivery method options must be true or false.", field: "appliesToStandard" } };
  }
  if (monetary && !appliesToStandard && !appliesToFast) {
    return { error: { message: "Select Standard, Fast, or both.", field: "appliesToStandard" } };
  }

  return {
    value: {
      titleEn: parsed.titleEn,
      titleAr: parsed.titleAr,
      descriptionEn: parsed.descriptionEn,
      descriptionAr: parsed.descriptionAr,
      offerType,
      recurrenceType,
      weekdays,
      specificDate,
      startDate,
      endDate,
      cutoffTime,
      timezone: "Africa/Cairo",
      discountType,
      discountValue,
      minimumOrderAmount,
      appliesToStandard,
      appliesToFast,
      isActive,
      deliveryZoneIds,
    },
  };
}

function parseZoneInput(body, existing = null) {
  const slug = hasOwn(body, "slug")
    ? cleanText(body.slug, 80).toLowerCase()
    : existing?.slug ?? "";
  const nameEn = hasOwn(body, "nameEn")
    ? cleanText(body.nameEn, 120)
    : existing?.nameEn ?? "";
  const nameAr = hasOwn(body, "nameAr")
    ? cleanText(body.nameAr, 120)
    : existing?.nameAr ?? "";
  const isActive = hasOwn(body, "isActive") ? body.isActive : existing?.isActive ?? true;
  const displayOrder = hasOwn(body, "displayOrder")
    ? Number(body.displayOrder)
    : existing?.displayOrder ?? 0;

  if (!SLUG_PATTERN.test(slug)) {
    return { error: { message: "Slug must contain lowercase letters, numbers, and hyphens.", field: "slug" } };
  }
  if (!nameEn) return { error: { message: "English name is required.", field: "nameEn" } };
  if (!nameAr) return { error: { message: "Arabic name is required.", field: "nameAr" } };
  if (typeof isActive !== "boolean") {
    return { error: { message: "Active must be true or false.", field: "isActive" } };
  }
  if (!Number.isInteger(displayOrder) || displayOrder < 0 || displayOrder > 100000) {
    return { error: { message: "Display order must be a non-negative whole number.", field: "displayOrder" } };
  }

  return { value: { slug, nameEn, nameAr, isActive, displayOrder } };
}

export async function getAdminDeliveryZones(_request, response) {
  const zones = await prisma.deliveryZone.findMany({
    include: {
      _count: { select: { userLocations: true, offerZones: true } },
    },
    orderBy: [{ displayOrder: "asc" }, { nameEn: "asc" }],
  });
  return response.json({
    deliveryZones: zones.map((zone) => ({
      ...serializeDeliveryZone(zone),
      userCount: zone._count.userLocations,
      offerCount: zone._count.offerZones,
    })),
  });
}

export async function createAdminDeliveryZone(request, response) {
  const parsed = parseZoneInput(request.body ?? {});
  if (parsed.error) return response.status(400).json(parsed.error);
  try {
    const zone = await prisma.deliveryZone.create({ data: parsed.value });
    return response.status(201).json({ deliveryZone: serializeDeliveryZone(zone) });
  } catch (error) {
    if (error?.code === "P2002") {
      return response.status(409).json({ message: "A delivery zone with this slug already exists.", field: "slug" });
    }
    throw error;
  }
}

export async function updateAdminDeliveryZone(request, response) {
  if (!isValidId(request.params.id)) {
    return response.status(404).json({ message: "Delivery zone not found." });
  }
  const existing = await prisma.deliveryZone.findUnique({ where: { id: request.params.id } });
  if (!existing) return response.status(404).json({ message: "Delivery zone not found." });
  const parsed = parseZoneInput(request.body ?? {}, existing);
  if (parsed.error) return response.status(400).json(parsed.error);
  try {
    const zone = await prisma.deliveryZone.update({
      where: { id: existing.id },
      data: parsed.value,
    });
    return response.json({ deliveryZone: serializeDeliveryZone(zone) });
  } catch (error) {
    if (error?.code === "P2002") {
      return response.status(409).json({ message: "A delivery zone with this slug already exists.", field: "slug" });
    }
    throw error;
  }
}

export async function deleteAdminDeliveryZone(request, response) {
  if (!isValidId(request.params.id)) {
    return response.status(404).json({ message: "Delivery zone not found." });
  }
  const existing = await prisma.deliveryZone.findUnique({
    where: { id: request.params.id },
    include: {
      _count: { select: { userLocations: true, offerZones: true } },
    },
  });
  if (!existing) return response.status(404).json({ message: "Delivery zone not found." });
  if (existing._count.userLocations > 0 || existing._count.offerZones > 0) {
    return response.status(409).json({
      message: "Deactivate this zone instead because it is already used by users or offers.",
    });
  }
  await prisma.deliveryZone.delete({ where: { id: existing.id } });
  return response.json({ message: "Delivery zone deleted successfully." });
}

export async function getAdminDeliveryOffers(_request, response) {
  const offers = await prisma.deliveryOffer.findMany({
    include: offerInclude,
    orderBy: { createdAt: "desc" },
  });
  return response.json({ deliveryOffers: offers.map(serializeOffer) });
}

export async function createAdminDeliveryOffer(request, response) {
  const parsed = await parseOfferInput(request.body ?? {});
  if (parsed.error) return response.status(400).json(parsed.error);
  const { deliveryZoneIds, ...data } = parsed.value;
  const offer = await prisma.deliveryOffer.create({
    data: {
      ...data,
      zones: {
        create: deliveryZoneIds.map((deliveryZoneId) => ({ deliveryZoneId })),
      },
    },
    include: offerInclude,
  });
  return response.status(201).json({ deliveryOffer: serializeOffer(offer) });
}

export async function updateAdminDeliveryOffer(request, response) {
  if (!isValidId(request.params.id)) {
    return response.status(404).json({ message: "Delivery offer not found." });
  }
  const existing = await prisma.deliveryOffer.findUnique({
    where: { id: request.params.id },
    include: offerInclude,
  });
  if (!existing) return response.status(404).json({ message: "Delivery offer not found." });
  const parsed = await parseOfferInput(request.body ?? {}, existing);
  if (parsed.error) return response.status(400).json(parsed.error);
  const { deliveryZoneIds, ...data } = parsed.value;

  const offer = await prisma.$transaction(async (transaction) => {
    await transaction.deliveryOfferZone.deleteMany({ where: { offerId: existing.id } });
    await transaction.deliveryOffer.update({ where: { id: existing.id }, data });
    await transaction.deliveryOfferZone.createMany({
      data: deliveryZoneIds.map((deliveryZoneId) => ({
        offerId: existing.id,
        deliveryZoneId,
      })),
    });
    return transaction.deliveryOffer.findUnique({
      where: { id: existing.id },
      include: offerInclude,
    });
  });

  return response.json({ deliveryOffer: serializeOffer(offer) });
}

export async function deleteAdminDeliveryOffer(request, response) {
  if (!isValidId(request.params.id)) {
    return response.status(404).json({ message: "Delivery offer not found." });
  }
  const existing = await prisma.deliveryOffer.findUnique({ where: { id: request.params.id } });
  if (!existing) return response.status(404).json({ message: "Delivery offer not found." });
  await prisma.deliveryOffer.delete({ where: { id: existing.id } });
  return response.json({ message: "Delivery offer deleted successfully." });
}

export async function getEligibleUsersForDeliveryOffer(request, response) {
  if (!isValidId(request.params.id)) {
    return response.status(404).json({ message: "Delivery offer not found." });
  }
  const offer = await prisma.deliveryOffer.findUnique({
    where: { id: request.params.id },
    include: offerInclude,
  });
  if (!offer) return response.status(404).json({ message: "Delivery offer not found." });
  const zoneIds = offer.zones.map(({ deliveryZoneId }) => deliveryZoneId);
  const users = await prisma.user.findMany({
    where: {
      clinicLocations: {
        some: { deliveryZoneId: { in: zoneIds } },
      },
    },
    select: {
      id: true,
      name: true,
      email: true,
      clinicLocations: {
        where: { deliveryZoneId: { in: zoneIds } },
        include: { deliveryZone: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return response.json({
    isCurrentlyValid: isDeliveryOfferValidNow(offer),
    eligibleUsers: users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      matchedLocations: user.clinicLocations.map((location) => ({
        deliveryZoneId: location.deliveryZoneId,
        nameEn: location.customArea || location.deliveryZone.nameEn,
        nameAr: location.customArea || location.deliveryZone.nameAr,
      })),
    })),
  });
}
