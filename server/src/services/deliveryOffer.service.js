import { prisma } from "../config/db.js";
import { cleanText, isValidId } from "../utils/records.js";

export const DELIVERY_TIMEZONE = "Africa/Cairo";
const MAX_CLINIC_LOCATIONS = 20;
const MAX_CUSTOM_AREA_LENGTH = 100;
const MAX_LOCATION_LABEL_LENGTH = 80;
const MAX_ADDRESS_LINE_LENGTH = 300;
const MAX_ADDRESS_PART_LENGTH = 100;

export const clinicLocationsInclude = {
  include: {
    deliveryZone: true,
  },
  orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
};

export function serializeDeliveryZone(zone) {
  return {
    id: zone.id,
    slug: zone.slug,
    nameEn: zone.nameEn,
    nameAr: zone.nameAr,
    isActive: zone.isActive,
    displayOrder: zone.displayOrder,
    createdAt: zone.createdAt,
    updatedAt: zone.updatedAt,
  };
}

export function serializeClinicLocation(location) {
  return {
    id: location.id,
    deliveryZoneId: location.deliveryZoneId,
    customArea: location.customArea ?? null,
    label: location.label ?? null,
    addressLine: location.addressLine ?? null,
    governorate: location.governorate ?? null,
    cityArea: location.cityArea ?? null,
    buildingNumber: location.buildingNumber ?? null,
    apartmentFloor: location.apartmentFloor ?? null,
    postalCode: location.postalCode ?? null,
    isDefault: location.isDefault,
    deliveryZone: serializeDeliveryZone(location.deliveryZone),
  };
}

export async function validateClinicLocationInput(
  input,
  { database = prisma, requireAtLeastOne = true } = {}
) {
  if (!Array.isArray(input)) {
    return {
      error: {
        message: "Clinic locations must be provided as a list.",
        field: "clinicLocations",
      },
    };
  }

  if (requireAtLeastOne && input.length === 0) {
    return {
      error: {
        message: "Select at least one clinic location.",
        field: "clinicLocations",
      },
    };
  }

  if (input.length > MAX_CLINIC_LOCATIONS) {
    return {
      error: {
        message: `Select no more than ${MAX_CLINIC_LOCATIONS} clinic locations.`,
        field: "clinicLocations",
      },
    };
  }

  const normalized = [];
  const seenZoneIds = new Set();
  for (const item of input) {
    const deliveryZoneId = typeof item?.deliveryZoneId === "string"
      ? item.deliveryZoneId.trim()
      : "";
    const customArea = cleanText(item?.customArea, MAX_CUSTOM_AREA_LENGTH);
    const label = cleanText(item?.label, MAX_LOCATION_LABEL_LENGTH);
    const addressLine = cleanText(item?.addressLine, MAX_ADDRESS_LINE_LENGTH);
    const governorate = cleanText(item?.governorate, MAX_ADDRESS_PART_LENGTH);
    const cityArea = cleanText(item?.cityArea, MAX_ADDRESS_PART_LENGTH);
    const buildingNumber = cleanText(item?.buildingNumber, MAX_ADDRESS_PART_LENGTH);
    const apartmentFloor = cleanText(item?.apartmentFloor, MAX_ADDRESS_PART_LENGTH);
    const postalCode = cleanText(item?.postalCode, MAX_ADDRESS_PART_LENGTH);
    const isDefault = typeof item?.isDefault === "boolean" ? item.isDefault : undefined;

    if (!isValidId(deliveryZoneId)) {
      return {
        error: {
          message: "Select valid clinic locations.",
          field: "clinicLocations",
        },
      };
    }

    if (seenZoneIds.has(deliveryZoneId)) {
      return {
        error: {
          message: "Each clinic location can only be selected once.",
          field: "clinicLocations",
        },
      };
    }

    seenZoneIds.add(deliveryZoneId);
    normalized.push({ deliveryZoneId, customArea });
    Object.assign(normalized.at(-1), {
      ...(label ? { label } : {}),
      ...(addressLine ? { addressLine } : {}),
      ...(governorate ? { governorate } : {}),
      ...(cityArea ? { cityArea } : {}),
      ...(buildingNumber ? { buildingNumber } : {}),
      ...(apartmentFloor ? { apartmentFloor } : {}),
      ...(postalCode ? { postalCode } : {}),
      ...(isDefault !== undefined ? { isDefault } : {}),
    });
  }

  const zones = await database.deliveryZone.findMany({
    where: {
      id: { in: normalized.map((item) => item.deliveryZoneId) },
      isActive: true,
    },
  });

  if (zones.length !== normalized.length) {
    return {
      error: {
        message: "One or more clinic locations are unavailable.",
        field: "clinicLocations",
      },
    };
  }

  const zonesById = new Map(zones.map((zone) => [zone.id, zone]));
  const value = [];
  for (const item of normalized) {
    const zone = zonesById.get(item.deliveryZoneId);
    const isOther = zone?.slug === "other";

    if (isOther && item.customArea.length < 2) {
      return {
        error: {
          message: "Enter your clinic area when selecting Other.",
          field: "customArea",
        },
      };
    }

    if (!isOther && item.customArea) {
      return {
        error: {
          message: "A custom area can only be used with the Other location.",
          field: "customArea",
        },
      };
    }

    value.push({
      deliveryZoneId: item.deliveryZoneId,
      customArea: isOther ? item.customArea : null,
      ...(item.label ? { label: item.label } : {}),
      ...(item.addressLine ? { addressLine: item.addressLine } : {}),
      ...(item.governorate ? { governorate: item.governorate } : {}),
      ...(item.cityArea ? { cityArea: item.cityArea } : {}),
      ...(item.buildingNumber ? { buildingNumber: item.buildingNumber } : {}),
      ...(item.apartmentFloor ? { apartmentFloor: item.apartmentFloor } : {}),
      ...(item.postalCode ? { postalCode: item.postalCode } : {}),
      ...(item.isDefault !== undefined ? { isDefault: item.isDefault } : {}),
    });
  }

  return { value };
}

export async function validateSavedClinicLocationInput(input, options = {}) {
  const parsed = await validateClinicLocationInput([input], options);
  if (parsed.error) return parsed;
  const value = parsed.value[0];
  if (!value.label || value.label.length < 2) {
    return { error: { message: "Location label must be at least 2 characters.", field: "label" } };
  }
  if (!value.addressLine || value.addressLine.length < 5) {
    return { error: { message: "Enter the full clinic or delivery address.", field: "addressLine" } };
  }
  if (!value.governorate || !value.cityArea || !value.buildingNumber || !value.apartmentFloor) {
    return { error: { message: "Governorate, city/area, building, and floor are required.", field: "addressLine" } };
  }
  return { value };
}

export async function replaceUserClinicLocations(database, userId, locations) {
  const existing = await database.userClinicLocation.findMany({
    where: { userId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });
  const desiredZoneIds = locations.map(({ deliveryZoneId }) => deliveryZoneId);
  await database.userClinicLocation.deleteMany({
    where: { userId, deliveryZoneId: { notIn: desiredZoneIds } },
  });

  const requestedDefault = locations.find((location) => location.isDefault === true);
  if (requestedDefault) {
    await database.userClinicLocation.updateMany({ where: { userId }, data: { isDefault: false } });
  }

  for (const [index, location] of locations.entries()) {
    const current = existing.find((item) => item.deliveryZoneId === location.deliveryZoneId);
    const metadata = {
      ...(location.label !== undefined ? { label: location.label || null } : {}),
      ...(location.addressLine !== undefined ? { addressLine: location.addressLine || null } : {}),
      ...(location.governorate !== undefined ? { governorate: location.governorate || null } : {}),
      ...(location.cityArea !== undefined ? { cityArea: location.cityArea || null } : {}),
      ...(location.buildingNumber !== undefined ? { buildingNumber: location.buildingNumber || null } : {}),
      ...(location.apartmentFloor !== undefined ? { apartmentFloor: location.apartmentFloor || null } : {}),
      ...(location.postalCode !== undefined ? { postalCode: location.postalCode || null } : {}),
      ...(location.isDefault !== undefined
        ? { isDefault: requestedDefault ? location.deliveryZoneId === requestedDefault.deliveryZoneId : location.isDefault }
        : {}),
    };
    if (current) {
      await database.userClinicLocation.update({
        where: { id: current.id },
        data: { customArea: location.customArea, ...metadata },
      });
    } else {
      await database.userClinicLocation.create({
        data: {
          userId,
          deliveryZoneId: location.deliveryZoneId,
          customArea: location.customArea,
          label: location.label || null,
          addressLine: location.addressLine || null,
          governorate: location.governorate || null,
          cityArea: location.cityArea || null,
          buildingNumber: location.buildingNumber || null,
          apartmentFloor: location.apartmentFloor || null,
          postalCode: location.postalCode || null,
          isDefault: location.isDefault ?? (existing.length === 0 && index === 0),
        },
      });
    }
  }

  if (locations.length > 0) {
    const defaultCount = await database.userClinicLocation.count({ where: { userId, isDefault: true } });
    if (defaultCount === 0) {
      const first = await database.userClinicLocation.findFirst({
        where: { userId },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });
      if (first) await database.userClinicLocation.update({ where: { id: first.id }, data: { isDefault: true } });
    }
  }
}

function cairoClock(now = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: DELIVERY_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(now).map((part) => [part.type, part.value])
  );
  const weekdayMap = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    weekday: weekdayMap[parts.weekday],
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

function dateOnly(value) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : null;
}

function cutoffMinutes(value) {
  if (typeof value !== "string" || !/^\d{2}:\d{2}$/.test(value)) return null;
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function isDeliveryOfferValidNow(offer, now = new Date()) {
  if (!offer?.isActive) return false;

  const clock = cairoClock(now);
  const cutoff = cutoffMinutes(offer.cutoffTime);
  if (cutoff !== null && clock.minutes >= cutoff) return false;

  if (offer.recurrenceType === "WEEKLY") {
    return Array.isArray(offer.weekdays) && offer.weekdays.includes(clock.weekday);
  }

  if (offer.recurrenceType === "SPECIFIC_DATE") {
    return dateOnly(offer.specificDate) === clock.date;
  }

  if (offer.recurrenceType === "DATE_RANGE") {
    const start = dateOnly(offer.startDate);
    const end = dateOnly(offer.endDate);
    return Boolean(start && end && clock.date >= start && clock.date <= end);
  }

  return false;
}

function serializeMatchedLocation(userLocation) {
  return {
    deliveryZoneId: userLocation.deliveryZoneId,
    slug: userLocation.deliveryZone.slug,
    nameEn: userLocation.customArea || userLocation.deliveryZone.nameEn,
    nameAr: userLocation.customArea || userLocation.deliveryZone.nameAr,
    customArea: userLocation.customArea ?? null,
  };
}

function serializeMatchingOffer(offer, userLocationsByZoneId) {
  const matchedLocations = offer.zones
    .map(({ deliveryZoneId }) => userLocationsByZoneId.get(deliveryZoneId))
    .filter(Boolean)
    .map(serializeMatchedLocation);

  return {
    id: offer.id,
    titleEn: offer.titleEn,
    titleAr: offer.titleAr,
    descriptionEn: offer.descriptionEn,
    descriptionAr: offer.descriptionAr,
    offerType: offer.offerType,
    recurrenceType: offer.recurrenceType,
    cutoffTime: offer.cutoffTime ?? null,
    timezone: offer.timezone,
    discountType: offer.discountType ?? null,
    discountValue: offer.discountValue === null ? null : Number(offer.discountValue),
    minimumOrderAmount:
      offer.minimumOrderAmount === null ? null : Number(offer.minimumOrderAmount),
    appliesToStandard: offer.appliesToStandard,
    appliesToFast: offer.appliesToFast,
    matchedLocations,
  };
}

export class DeliveryOfferEligibilityError extends Error {
  constructor(message = "The selected clinic location is unavailable.") {
    super(message);
    this.name = "DeliveryOfferEligibilityError";
    this.statusCode = 400;
    this.code = "INVALID_CLINIC_LOCATION";
  }
}

function toCents(value) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? Math.max(0, Math.round(number * 100)) : 0;
}

function safeOfferSource(offer) {
  return {
    sourceType: "DELIVERY_OFFER",
    sourceId: offer.id,
    titleEn: offer.titleEn,
    titleAr: offer.titleAr,
    offerType: offer.offerType,
    createdAt: offer.createdAt,
  };
}

/**
 * Resolves monetary Delivery Offers only after ownership-validating the saved
 * clinic location. Manual/free-text addresses intentionally receive none.
 */
export async function evaluateDeliveryOfferPricing(
  database,
  {
    userId,
    clinicLocationId,
    deliveryMethod,
    subtotalCents,
    shippingCents,
    now = new Date(),
  }
) {
  const empty = {
    shippingDiscountCents: 0,
    shippingCents,
    appliedOffer: null,
    freeShippingSources: [],
  };
  if (!clinicLocationId) return empty;

  const location = await database.userClinicLocation.findFirst({
    where: {
      id: clinicLocationId,
      userId,
      deliveryZone: { isActive: true },
    },
    include: { deliveryZone: true },
  });
  if (!location) throw new DeliveryOfferEligibilityError();
  if (deliveryMethod === "pickup" || shippingCents <= 0) return empty;

  const offers = await database.deliveryOffer.findMany({
    where: {
      isActive: true,
      offerType: { in: ["FREE_DELIVERY", "DISCOUNTED_DELIVERY"] },
      zones: {
        some: {
          deliveryZoneId: location.deliveryZoneId,
          deliveryZone: { isActive: true },
        },
      },
    },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
  });

  const candidates = offers.flatMap((offer) => {
    if (!isDeliveryOfferValidNow(offer, now)) return [];
    if (subtotalCents < toCents(offer.minimumOrderAmount)) return [];
    if (deliveryMethod === "standard" && !offer.appliesToStandard) return [];
    if (deliveryMethod === "fast" && !offer.appliesToFast) return [];

    let discountCents = 0;
    if (offer.offerType === "FREE_DELIVERY") {
      discountCents = shippingCents;
    } else if (offer.discountType === "PERCENTAGE") {
      const percent = Math.min(100, Math.max(0, Number(offer.discountValue ?? 0)));
      discountCents = Math.round(shippingCents * percent / 100);
    } else if (offer.discountType === "FIXED") {
      discountCents = toCents(offer.discountValue);
    }
    discountCents = Math.min(shippingCents, Math.max(0, discountCents));
    if (!(discountCents > 0)) return [];
    return [{
      offer,
      discountCents,
      finalShippingCents: shippingCents - discountCents,
    }];
  });

  candidates.sort((left, right) =>
    left.finalShippingCents - right.finalShippingCents
    || Number(right.offer.offerType === "FREE_DELIVERY")
      - Number(left.offer.offerType === "FREE_DELIVERY")
    || right.offer.createdAt.getTime() - left.offer.createdAt.getTime()
    || left.offer.id.localeCompare(right.offer.id)
  );
  const winner = candidates[0];
  if (!winner) return empty;

  const source = safeOfferSource(winner.offer);
  return {
    shippingDiscountCents: winner.discountCents,
    shippingCents: winner.finalShippingCents,
    appliedOffer: source,
    freeShippingSources:
      winner.offer.offerType === "FREE_DELIVERY" ? [source] : [],
  };
}

export async function getMatchingDeliveryOffers(userId, now = new Date(), database = prisma) {
  const userLocations = await database.userClinicLocation.findMany({
    where: {
      userId,
      deliveryZone: { isActive: true },
    },
    ...clinicLocationsInclude,
  });

  if (userLocations.length === 0) {
    return {
      offers: [],
      needsClinicLocations: true,
      timezone: DELIVERY_TIMEZONE,
      serverTime: now,
    };
  }

  const userLocationsByZoneId = new Map(
    userLocations.map((location) => [location.deliveryZoneId, location])
  );
  const offers = await database.deliveryOffer.findMany({
    where: {
      isActive: true,
      zones: {
        some: {
          deliveryZoneId: { in: [...userLocationsByZoneId.keys()] },
          deliveryZone: { isActive: true },
        },
      },
    },
    include: {
      zones: {
        include: { deliveryZone: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return {
    offers: offers
      .filter((offer) => isDeliveryOfferValidNow(offer, now))
      .map((offer) => serializeMatchingOffer(offer, userLocationsByZoneId)),
    needsClinicLocations: false,
    timezone: DELIVERY_TIMEZONE,
    serverTime: now,
  };
}
