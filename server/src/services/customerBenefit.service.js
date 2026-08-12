function toCents(value) {
  return Math.max(0, Math.round(Number(value ?? 0) * 100));
}

export function getBenefitLifecycle(benefit, now = new Date()) {
  if (benefit.revokedAt) return "REVOKED";
  if (benefit.endsAt && new Date(benefit.endsAt) < now) return "EXPIRED";
  if (!benefit.isActive || benefit.pausedAt) return "PAUSED";
  if (benefit.startsAt && new Date(benefit.startsAt) > now) return "PAUSED";
  return "ACTIVE";
}

export function serializeBenefit(benefit) {
  return {
    ...benefit,
    discountPercent: benefit.discountPercent === null ? null : Number(benefit.discountPercent),
    discountAmount: benefit.discountAmount === null ? null : Number(benefit.discountAmount),
    minimumOrderAmount:
      benefit.minimumOrderAmount === null ? null : Number(benefit.minimumOrderAmount),
    lifecycle: getBenefitLifecycle(benefit),
  };
}

export async function evaluateCustomerBenefits(
  database,
  { userId, subtotalCents, shippingCents, promoCode = "", now = new Date() }
) {
  if (!userId) {
    return {
      discountCents: 0,
      shippingCents,
      appliedBenefits: [],
      monetaryCandidates: [],
      freeShippingSources: [],
      combinationRule: "highest_automatic_discount_plus_free_shipping",
    };
  }

  const user = await database.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      customerTier: true,
      isActive: true,
      customerBenefits: {
        where: {
          isActive: true,
          revokedAt: null,
          OR: [{ startsAt: null }, { startsAt: { lte: now } }],
          AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!user || !user.isActive || user.role !== "CUSTOMER" || user.customerTier !== "VIP") {
    return {
      discountCents: 0,
      shippingCents,
      appliedBenefits: [],
      monetaryCandidates: [],
      freeShippingSources: [],
      combinationRule: "highest_automatic_discount_plus_free_shipping",
    };
  }

  const normalizedPromoCode = String(promoCode).trim().toUpperCase();
  const eligible = user.customerBenefits.filter(
    (benefit) =>
      getBenefitLifecycle(benefit, now) === "ACTIVE" &&
      subtotalCents >= toCents(benefit.minimumOrderAmount)
  );

  const freeShippingBenefits = eligible.filter((benefit) => benefit.type === "FREE_SHIPPING");
  const monetaryCandidates = eligible.flatMap((benefit) => {
    if (benefit.type === "PERCENTAGE_DISCOUNT") {
      const percent = Math.min(100, Math.max(0, Number(benefit.discountPercent ?? 0)));
      return [{ benefit, discountCents: Math.round(subtotalCents * (percent / 100)) }];
    }
    if (benefit.type === "FIXED_DISCOUNT") {
      return [{ benefit, discountCents: Math.min(subtotalCents, toCents(benefit.discountAmount)) }];
    }
    if (
      benefit.type === "PROMO_CODE" &&
      normalizedPromoCode &&
      normalizedPromoCode === String(benefit.promoCode ?? "").trim().toUpperCase()
    ) {
      const percent = Number(benefit.discountPercent ?? 0);
      const discountCents = percent > 0
        ? Math.round(subtotalCents * (Math.min(100, percent) / 100))
        : Math.min(subtotalCents, toCents(benefit.discountAmount));
      return [{ benefit, discountCents }];
    }
    return [];
  });

  monetaryCandidates.sort((a, b) =>
    b.discountCents - a.discountCents
    || new Date(a.benefit.createdAt).getTime() - new Date(b.benefit.createdAt).getTime()
    || a.benefit.id.localeCompare(b.benefit.id)
  );
  const bestDiscount = monetaryCandidates[0] ?? null;
  const freeShipping = freeShippingBenefits[0] ?? null;
  const appliedBenefits = [
    ...(freeShipping ? [serializeBenefit(freeShipping)] : []),
    ...(bestDiscount && bestDiscount.discountCents > 0
      ? [serializeBenefit(bestDiscount.benefit)]
      : []),
  ];

  return {
    discountCents: Math.min(subtotalCents, bestDiscount?.discountCents ?? 0),
    shippingCents: freeShipping ? 0 : shippingCents,
    appliedBenefits,
    monetaryCandidates: monetaryCandidates.map(({ benefit, discountCents }) => ({
      sourceType: "VIP_BENEFIT",
      sourceId: benefit.id,
      titleEn: benefit.titleEn,
      titleAr: benefit.titleAr,
      createdAt: benefit.createdAt,
      discountCents: Math.min(subtotalCents, discountCents),
      benefit: serializeBenefit(benefit),
    })),
    freeShippingSources: freeShippingBenefits.map((benefit) => ({
      sourceType: "VIP_BENEFIT",
      sourceId: benefit.id,
      titleEn: benefit.titleEn,
      titleAr: benefit.titleAr,
      createdAt: benefit.createdAt,
      benefit: serializeBenefit(benefit),
    })),
    combinationRule: "highest_automatic_discount_plus_free_shipping",
  };
}
