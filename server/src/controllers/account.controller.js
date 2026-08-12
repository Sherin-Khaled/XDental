import { prisma } from "../config/db.js";
import {
  getAccountPreferences as readAccountPreferences,
  PreferenceValidationError,
  updateAccountPreferences as saveAccountPreferences,
} from "../services/accountPreference.service.js";
import { getBenefitLifecycle } from "../services/customerBenefit.service.js";

function requireCustomer(request, response) {
  if (request.user.role !== "customer") {
    response.status(403).json({ message: "Customer account required." });
    return false;
  }
  return true;
}

export async function getAccountPreferences(request, response) {
  if (!requireCustomer(request, response)) return;
  const result = await readAccountPreferences(request.user.id);
  return response.json(result);
}

export async function updateAccountPreferences(request, response) {
  if (!requireCustomer(request, response)) return;
  try {
    const preferences = await prisma.$transaction((database) =>
      saveAccountPreferences(
        {
          userId: request.user.id,
          email: request.user.email,
          patch: request.body,
        },
        database
      )
    );
    return response.json({ preferences, persisted: true });
  } catch (error) {
    if (error instanceof PreferenceValidationError) {
      return response.status(400).json({
        message: error.message,
        ...(error.field ? { field: error.field } : {}),
      });
    }
    throw error;
  }
}

export async function getMyVipBenefits(request, response) {
  if (!requireCustomer(request, response)) return;
  if (request.user.customerTier !== "vip") {
    return response.json({ customerTier: "standard", benefits: [] });
  }

  const benefits = await prisma.customerBenefit.findMany({
    where: {
      userId: request.user.id,
      revokedAt: null,
    },
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
  });
  return response.json({
    customerTier: "vip",
    benefits: benefits.map((benefit) => ({
      type: benefit.type,
      titleEn: benefit.titleEn,
      titleAr: benefit.titleAr,
      descriptionEn: benefit.descriptionEn ?? null,
      descriptionAr: benefit.descriptionAr ?? null,
      discountPercent:
        benefit.discountPercent === null ? null : Number(benefit.discountPercent),
      discountAmount:
        benefit.discountAmount === null ? null : Number(benefit.discountAmount),
      promoCode: benefit.type === "PROMO_CODE" ? benefit.promoCode ?? null : null,
      minimumOrderAmount:
        benefit.minimumOrderAmount === null
          ? null
          : Number(benefit.minimumOrderAmount),
      startsAt: benefit.startsAt,
      endsAt: benefit.endsAt,
      status: getBenefitLifecycle(benefit),
    })),
  });
}
