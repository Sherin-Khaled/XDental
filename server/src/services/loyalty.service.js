import { createHash, randomUUID } from "node:crypto";
import { prisma } from "../config/db.js";

const SETTINGS_ID = "default";
const EGP10_CENTS = 1_000;
const MAX_REASON_LENGTH = 500;
const POINT_CREDIT_TYPES = new Set([
  "WELCOME_GRANTED",
  "WELCOME_RESTORE",
  "WELCOME_ACTIVATED",
  "ORDER_EARN",
  "RESTORE",
  "ADMIN_ADJUSTMENT",
]);
const WELCOME_POINT_CREDIT_TYPES = new Set([
  "WELCOME_GRANTED",
  "WELCOME_RESTORE",
  "WELCOME_ACTIVATED",
]);

export class LoyaltyError extends Error {
  constructor(statusCode, code, message, field) {
    super(message);
    this.name = "LoyaltyError";
    this.statusCode = statusCode;
    this.code = code;
    this.field = field;
  }
}

function asNumber(value) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function toCents(value) {
  return Math.round(asNumber(value) * 100);
}

function addMonths(date, months) {
  const result = new Date(date);
  result.setUTCMonth(result.getUTCMonth() + months);
  return result;
}

function addDays(date, days) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function welcomeExpiryDays(settings) {
  const days = Number(settings.welcomeExpiryDays ?? 30);
  return Number.isInteger(days) && days > 0 ? days : 30;
}

function welcomeMinimumSubtotalCents(settings) {
  return toCents(settings.welcomeMinimumSubtotalEgp ?? 500);
}

function safeReason(value) {
  return typeof value === "string" ? value.trim().slice(0, MAX_REASON_LENGTH) : "";
}

function deterministicNotificationId(eventKey) {
  return `loyalty_${createHash("sha256")
    .update(`x-dental-loyalty-notification:v1:${eventKey}`)
    .digest("hex")
    .slice(0, 48)}`;
}

async function createMandatoryLoyaltyNotification(
  database,
  { eventKey, userId, title, body, metadata = {} }
) {
  const id = deterministicNotificationId(eventKey);
  const existing = await database.notification.findUnique({ where: { id } });
  if (existing) return null;
  return database.notification.create({
    data: {
      id,
      userId,
      type: "ACCOUNT",
      title,
      body,
      link: "/account/wallet",
      metadata: { ...metadata, loyaltyEventKey: eventKey },
    },
  });
}

export async function getLoyaltyProgramSettings(database = prisma) {
  return database.loyaltyProgramSettings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID },
    update: {},
  });
}

export function serializeLoyaltySettings(settings) {
  return {
    enabled: settings.enabled,
    standardPointsPerEgp10: settings.standardPointsPerEgp10,
    vipPointsPerEgp10: settings.vipPointsPerEgp10,
    pointsPerRedemptionUnit: settings.pointsPerRedemptionUnit,
    redemptionValueEgp: asNumber(settings.redemptionValueEgp),
    welcomePoints: settings.welcomePoints,
    welcomeMinimumSubtotalEgp: asNumber(settings.welcomeMinimumSubtotalEgp ?? 500),
    welcomeExpiryDays: welcomeExpiryDays(settings),
    minimumRedemptionPoints: settings.minimumRedemptionPoints,
    maximumRedemptionPercent: asNumber(settings.maximumRedemptionPercent),
    expiryMonths: settings.expiryMonths,
  };
}

export function serializePublicLoyaltySettings(settings) {
  const welcomePoints = Number(settings.welcomePoints ?? 0);
  const redemptionUnits = Math.floor(
    welcomePoints / Math.max(1, Number(settings.pointsPerRedemptionUnit ?? 100))
  );
  return {
    welcomePoints,
    welcomeValueEgp: redemptionUnits * asNumber(settings.redemptionValueEgp),
    welcomeMinimumSubtotalEgp: asNumber(settings.welcomeMinimumSubtotalEgp ?? 500),
    welcomeExpiryDays: welcomeExpiryDays(settings),
    appliesTo: "PRODUCTS_ONLY",
  };
}

export async function ensureLoyaltyAccount(database, userId) {
  return database.loyaltyAccount.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });
}

export async function initializeNewCustomerLoyalty(database, userId, now = new Date()) {
  if (typeof database.$transaction === "function") {
    return database.$transaction((transaction) =>
      initializeNewCustomerLoyalty(transaction, userId, now)
    );
  }
  const settings = await getLoyaltyProgramSettings(database);
  const welcomePoints = settings.welcomePoints;
  const account = await ensureLoyaltyAccount(database, userId);

  let notification = null;
  if (welcomePoints > 0) {
    const idempotencyKey = `welcome:${userId}:granted`;
    const existing = await database.loyaltyPointTransaction.findUnique({
      where: { idempotencyKey },
    });
    if (existing) return { account, notification, granted: false };

    const grantedAt = now;
    const updatedAccount = await database.loyaltyAccount.update({
      where: { userId },
      data: {
        availablePoints: { increment: welcomePoints },
        lifetimeEarnedPoints: { increment: welcomePoints },
      },
    });
    await database.loyaltyPointTransaction.create({
      data: {
        userId,
        type: "WELCOME_GRANTED",
        points: welcomePoints,
        balanceAfter: updatedAccount.availablePoints,
        status: "ACTIVE",
        expiresAt: addDays(grantedAt, welcomeExpiryDays(settings)),
        description: "Welcome points granted after public customer registration.",
        idempotencyKey,
        createdAt: grantedAt,
      },
    });
    notification = await createMandatoryLoyaltyNotification(database, {
      eventKey: idempotencyKey,
      userId,
      title: "Welcome points added",
      body: `${welcomePoints} welcome points are available now and expire in ${welcomeExpiryDays(settings)} days.`,
      metadata: { type: "WELCOME_GRANTED", points: welcomePoints },
    });
    return { account: updatedAccount, notification, granted: true };
  }
  return { account, notification, granted: false };
}

function calculateRemainingPointLots(transactions) {
  const lots = [];
  const consume = (points, predicate = () => true) => {
    let debit = points;
    for (const lot of lots) {
      if (debit <= 0) break;
      if (!predicate(lot)) continue;
      const consumed = Math.min(lot.remainingPoints, debit);
      lot.remainingPoints -= consumed;
      debit -= consumed;
    }
    return debit;
  };
  for (const transaction of transactions) {
    if (
      transaction.points > 0
      && transaction.status === "ACTIVE"
      && POINT_CREDIT_TYPES.has(transaction.type)
    ) {
      lots.push({ ...transaction, remainingPoints: transaction.points });
      continue;
    }
    if (transaction.points >= 0 || transaction.status === "PENDING") continue;
    const debit = Math.abs(transaction.points);
    if (
      transaction.type === "EXPIRATION"
      && transaction.idempotencyKey?.startsWith("expiry:")
    ) {
      const sourceId = transaction.idempotencyKey.slice("expiry:".length);
      consume(debit, (lot) => lot.id === sourceId);
      continue;
    }
    if (transaction.type === "REDEMPTION") {
      const loyaltySnapshot = transaction.order?.pricingBreakdown?.loyalty;
      const welcomeDebit = Number(loyaltySnapshot?.welcomePointsRedeemed);
      const otherDebit = Number(loyaltySnapshot?.earnedOrAdjustedPointsRedeemed);
      if (
        Number.isInteger(welcomeDebit)
        && welcomeDebit >= 0
        && Number.isInteger(otherDebit)
        && otherDebit >= 0
        && welcomeDebit + otherDebit === debit
      ) {
        consume(otherDebit, (lot) => !WELCOME_POINT_CREDIT_TYPES.has(lot.type));
        consume(welcomeDebit, (lot) => WELCOME_POINT_CREDIT_TYPES.has(lot.type));
        continue;
      }
    }
    consume(debit);
  }
  return lots;
}

function allocatePointLots(lots, requestedPoints) {
  const allocations = [];
  let remaining = requestedPoints;
  for (const lot of lots) {
    if (remaining <= 0) break;
    const points = Math.min(lot.remainingPoints, remaining);
    if (points > 0) allocations.push({ lot, points });
    remaining -= points;
  }
  return allocations;
}

function welcomeRedemptionDetails(lots, requestedPoints, welcomeEligible = true) {
  const allocations = welcomeEligible
    ? allocatePointLots(lots, requestedPoints)
    : allocatePointLots(
        lots.filter((lot) => !WELCOME_POINT_CREDIT_TYPES.has(lot.type)),
        requestedPoints
      );
  const welcomeAllocations = allocations.filter(({ lot }) =>
    WELCOME_POINT_CREDIT_TYPES.has(lot.type)
  );
  return {
    allocations,
    welcomePointsRedeemed: welcomeAllocations.reduce(
      (sum, allocation) => sum + allocation.points,
      0
    ),
    welcomeExpiresAt: welcomeAllocations
      .map(({ lot }) => lot.expiresAt)
      .filter(Boolean)
      .sort((left, right) => new Date(left) - new Date(right))[0] ?? null,
  };
}

export async function expirePointsForUser(database, userId, now = new Date()) {
  if (typeof database.$transaction === "function") {
    return database.$transaction((transaction) =>
      expirePointsForUser(transaction, userId, now)
    );
  }
  const [account, transactions] = await Promise.all([
    ensureLoyaltyAccount(database, userId),
    database.loyaltyPointTransaction.findMany({
      where: { userId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      include: { order: { select: { pricingBreakdown: true } } },
    }),
  ]);
  const lots = calculateRemainingPointLots(transactions);
  const expiringLots = lots.filter(
    (lot) => lot.remainingPoints > 0 && lot.expiresAt && lot.expiresAt <= now
  );
  let availablePoints = account.availablePoints;

  for (const lot of expiringLots) {
    const idempotencyKey = `expiry:${lot.id}`;
    const balanceAfter = Math.max(0, availablePoints - lot.remainingPoints);
    const inserted = await database.loyaltyPointTransaction.createMany({
      data: [{
        userId,
        type: "EXPIRATION",
        points: -lot.remainingPoints,
        balanceAfter,
        status: "EXPIRED",
        description: WELCOME_POINT_CREDIT_TYPES.has(lot.type)
          ? "Unused welcome points expired."
          : "Unused points expired.",
        idempotencyKey,
      }],
      skipDuplicates: true,
    });
    if (inserted.count === 0) continue;
    const debited = await database.loyaltyAccount.updateMany({
      where: { userId, availablePoints: { gte: lot.remainingPoints } },
      data: { availablePoints: { decrement: lot.remainingPoints } },
    });
    if (debited.count !== 1) {
      throw new LoyaltyError(
        409,
        "LOYALTY_BALANCE_CHANGED",
        "Your rewards balance changed. Refresh and try again."
      );
    }
    availablePoints = balanceAfter;
  }
  return ensureLoyaltyAccount(database, userId);
}

function parseRequestedPoints(value) {
  if (value === undefined || value === null || value === "") return 0;
  const points = Number(value);
  if (!Number.isInteger(points) || points < 0 || points > 100_000_000) {
    throw new LoyaltyError(
      400,
      "INVALID_POINTS_REDEMPTION",
      "Requested points must be a non-negative whole number.",
      "requestedPoints"
    );
  }
  return points;
}

export function parseRequestedWalletCents(value) {
  if (value === undefined || value === null || value === "") return 0;
  const normalized = typeof value === "number" ? String(value) : String(value).trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) {
    throw new LoyaltyError(
      400,
      "INVALID_WALLET_AMOUNT",
      "Wallet amount must be a non-negative EGP amount with at most two decimal places.",
      "requestedWalletAmount"
    );
  }
  const [major, fractional = ""] = normalized.split(".");
  const cents = Number(major) * 100 + Number(fractional.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents) || cents > 100_000_000_00) {
    throw new LoyaltyError(400, "INVALID_WALLET_AMOUNT", "Wallet amount is invalid.", "requestedWalletAmount");
  }
  return cents;
}

function redemptionValueCentsForPoints(points, settings) {
  return Math.floor(points / settings.pointsPerRedemptionUnit)
    * toCents(settings.redemptionValueEgp);
}

function maximumRedeemablePoints(eligibleProductSubtotalCents, availablePoints, settings) {
  if (!settings.enabled || availablePoints < settings.minimumRedemptionPoints) return 0;
  const unitPoints = settings.pointsPerRedemptionUnit;
  const unitValueCents = toCents(settings.redemptionValueEgp);
  const maximumValueCents = Math.floor(
    eligibleProductSubtotalCents * asNumber(settings.maximumRedemptionPercent) / 100
  );
  const unitsByCap = Math.floor(maximumValueCents / unitValueCents);
  const availableUnits = Math.floor(Math.max(0, availablePoints) / unitPoints);
  return Math.min(unitsByCap, availableUnits) * unitPoints;
}

export async function applyLoyaltyPricing(
  database,
  {
    userId,
    pricing,
    requestedPoints: rawRequestedPoints = 0,
    requestedWalletAmount = 0,
    now = new Date(),
  }
) {
  const requestedPoints = parseRequestedPoints(rawRequestedPoints);
  const requestedWalletCents = parseRequestedWalletCents(requestedWalletAmount);
  const [settings, user] = await Promise.all([
    getLoyaltyProgramSettings(database),
    database.user.findUnique({
      where: { id: userId },
      select: { customerTier: true },
    }),
  ]);
  if (!user) {
    throw new LoyaltyError(404, "LOYALTY_ACCOUNT_NOT_FOUND", "Customer account was not found.");
  }
  const account = await expirePointsForUser(database, userId, now);
  const pointTransactions = await database.loyaltyPointTransaction.findMany({
    where: { userId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    include: { order: { select: { pricingBreakdown: true } } },
  });
  const remainingPointLots = calculateRemainingPointLots(pointTransactions);
  const welcomePointsAvailable = remainingPointLots
    .filter((lot) => WELCOME_POINT_CREDIT_TYPES.has(lot.type))
    .reduce((sum, lot) => sum + lot.remainingPoints, 0);
  const nonWelcomePointsAvailable = remainingPointLots
    .filter((lot) => !WELCOME_POINT_CREDIT_TYPES.has(lot.type))
    .reduce((sum, lot) => sum + lot.remainingPoints, 0);
  const eligibleProductSubtotalCents = Math.max(
    0,
    pricing.subtotalCents - pricing.monetaryDiscountCents
  );
  const welcomeMinimumCents = welcomeMinimumSubtotalCents(settings);
  let maximumPoints = maximumRedeemablePoints(
    eligibleProductSubtotalCents,
    account.availablePoints,
    settings
  );
  if (eligibleProductSubtotalCents < welcomeMinimumCents && welcomePointsAvailable > 0) {
    maximumPoints = Math.min(
      maximumPoints,
      Math.floor(nonWelcomePointsAvailable / settings.pointsPerRedemptionUnit)
        * settings.pointsPerRedemptionUnit
    );
  }
  const redemptionDetails = welcomeRedemptionDetails(
    remainingPointLots,
    requestedPoints,
    eligibleProductSubtotalCents >= welcomeMinimumCents
  );

  if ((requestedPoints > 0 || requestedWalletCents > 0) && !settings.enabled) {
    throw new LoyaltyError(409, "LOYALTY_DISABLED", "Rewards redemption is currently unavailable.");
  }
  if (requestedPoints > 0) {
    if (
      requestedPoints < settings.minimumRedemptionPoints
      || requestedPoints % settings.pointsPerRedemptionUnit !== 0
    ) {
      throw new LoyaltyError(
        400,
        "INVALID_POINTS_INCREMENT",
        `Redeem at least ${settings.minimumRedemptionPoints} points in ${settings.pointsPerRedemptionUnit}-point increments.`,
        "requestedPoints"
      );
    }
    if (requestedPoints > account.availablePoints) {
      throw new LoyaltyError(409, "INSUFFICIENT_POINTS", "Your available points balance changed.");
    }
    if (
      eligibleProductSubtotalCents < welcomeMinimumCents
      && welcomePointsAvailable > 0
      && requestedPoints > nonWelcomePointsAvailable
    ) {
      throw new LoyaltyError(
        409,
        "WELCOME_MINIMUM_SUBTOTAL",
        `Welcome points require at least EGP ${(welcomeMinimumCents / 100).toFixed(2)} of eligible products.`
      );
    }
    if (requestedPoints > maximumPoints) {
      throw new LoyaltyError(
        409,
        "POINTS_REDEMPTION_LIMIT",
        "Points can cover at most 20% of the eligible product subtotal."
      );
    }
  }

  const pointsRedemptionValueCents = redemptionValueCentsForPoints(
    requestedPoints,
    settings
  );
  const afterPointsCents = Math.max(0, pricing.totalCents - pointsRedemptionValueCents);
  const walletBalanceCents = toCents(account.walletBalance);
  if (requestedWalletCents > walletBalanceCents) {
    throw new LoyaltyError(409, "INSUFFICIENT_WALLET_CREDIT", "Your wallet balance changed.");
  }
  if (requestedWalletCents > afterPointsCents) {
    throw new LoyaltyError(
      409,
      "WALLET_AMOUNT_EXCEEDS_TOTAL",
      "Wallet credit cannot exceed the current order total.",
      "requestedWalletAmount"
    );
  }

  const walletAppliedToShippingCents = Math.min(
    requestedWalletCents,
    pricing.shippingCents
  );
  const walletAppliedToProductsCents = Math.max(
    0,
    requestedWalletCents - walletAppliedToShippingCents
  );
  const eligibleEarningCents = Math.max(
    0,
    eligibleProductSubtotalCents
      - pointsRedemptionValueCents
      - walletAppliedToProductsCents
  );
  const earningRatePointsPerEgp10 =
    user.customerTier === "VIP"
      ? settings.vipPointsPerEgp10
      : settings.standardPointsPerEgp10;
  const remainingCodCents = afterPointsCents - requestedWalletCents;
  const pointValueCents = redemptionValueCentsForPoints(
    Math.max(0, account.availablePoints),
    settings
  );

  return {
    ...pricing,
    // Wallet credit is a payment tender, not a discount. Order.total remains
    // the authoritative order value after points; remainingCodCents records
    // the unpaid Cash on Delivery amount separately.
    totalCents: afterPointsCents,
    pointsRedeemed: requestedPoints,
    pointsRedemptionValueCents,
    walletCreditUsedCents: requestedWalletCents,
    remainingCodCents,
    loyalty: {
      enabled: settings.enabled,
      availablePoints: account.availablePoints,
      pendingPoints: account.pendingPoints,
      welcomePointsAvailable,
      welcomeMinimumSubtotalCents: welcomeMinimumCents,
      welcomePointsEligible: eligibleProductSubtotalCents >= welcomeMinimumCents,
      pointValueCents,
      walletBalanceCents,
      maximumRedeemablePoints: maximumPoints,
      maximumRedemptionValueCents: redemptionValueCentsForPoints(maximumPoints, settings),
      pointsRedeemed: requestedPoints,
      pointsRedemptionValueCents,
      walletCreditUsedCents: requestedWalletCents,
      remainingCodCents,
      eligibleProductSubtotalCents,
      eligibleEarningCents,
      earningRatePointsPerEgp10,
      pointsPerRedemptionUnit: settings.pointsPerRedemptionUnit,
      redemptionValueCents: toCents(settings.redemptionValueEgp),
      minimumRedemptionPoints: settings.minimumRedemptionPoints,
      maximumRedemptionPercent: asNumber(settings.maximumRedemptionPercent),
      expiryMonths: settings.expiryMonths,
      welcomeExpiryDays: welcomeExpiryDays(settings),
    },
    pricingBreakdown: {
      ...pricing.pricingBreakdown,
      loyalty: {
        pointsRedeemed: requestedPoints,
        pointsRedemptionValue: pointsRedemptionValueCents / 100,
        walletCreditUsed: requestedWalletCents / 100,
        orderTotalAfterPoints: afterPointsCents / 100,
        remainingCodAmount: remainingCodCents / 100,
        eligibleProductSubtotal: eligibleProductSubtotalCents / 100,
        eligibleEarningAmount: eligibleEarningCents / 100,
        earningRatePointsPerEgp10,
        pointsPerRedemptionUnit: settings.pointsPerRedemptionUnit,
        redemptionValueEgp: asNumber(settings.redemptionValueEgp),
        maximumRedemptionPercent: asNumber(settings.maximumRedemptionPercent),
        expiryMonths: settings.expiryMonths,
        welcomePointsRedeemed: redemptionDetails.welcomePointsRedeemed,
        earnedOrAdjustedPointsRedeemed:
          requestedPoints - redemptionDetails.welcomePointsRedeemed,
        welcomePointsExpiry: redemptionDetails.welcomeExpiresAt,
        welcomeMinimumSubtotal: welcomeMinimumCents / 100,
      },
    },
  };
}

export function serializeLoyaltyPricing(pricing) {
  const loyalty = pricing.loyalty;
  return {
    availablePoints: loyalty.availablePoints,
    pendingPoints: loyalty.pendingPoints,
    welcomePointsAvailable: loyalty.welcomePointsAvailable,
    welcomeMinimumSubtotal: loyalty.welcomeMinimumSubtotalCents / 100,
    welcomePointsEligible: loyalty.welcomePointsEligible,
    pointValue: loyalty.pointValueCents / 100,
    walletBalance: loyalty.walletBalanceCents / 100,
    maximumRedeemablePoints: loyalty.maximumRedeemablePoints,
    maximumRedemptionValue: loyalty.maximumRedemptionValueCents / 100,
    pointsRedeemed: loyalty.pointsRedeemed,
    pointsRedemptionValue: loyalty.pointsRedemptionValueCents / 100,
    walletCreditUsed: loyalty.walletCreditUsedCents / 100,
    remainingCodAmount: loyalty.remainingCodCents / 100,
    earningRatePointsPerEgp10: loyalty.earningRatePointsPerEgp10,
    eligibleEarningAmount: loyalty.eligibleEarningCents / 100,
    pointsPerRedemptionUnit: loyalty.pointsPerRedemptionUnit,
    redemptionValueEgp: loyalty.redemptionValueCents / 100,
    minimumRedemptionPoints: loyalty.minimumRedemptionPoints,
    maximumRedemptionPercent: loyalty.maximumRedemptionPercent,
    welcomeExpiryDays: loyalty.welcomeExpiryDays,
  };
}

export async function debitOrderLoyalty(database, order, pricing) {
  const points = pricing.pointsRedeemed;
  const walletCents = pricing.walletCreditUsedCents;
  if (points === 0 && walletCents === 0) return [];

  const updated = await database.loyaltyAccount.updateMany({
    where: {
      userId: order.userId,
      ...(points > 0 ? { availablePoints: { gte: points } } : {}),
      ...(walletCents > 0 ? { walletBalance: { gte: walletCents / 100 } } : {}),
    },
    data: {
      ...(points > 0
        ? {
            availablePoints: { decrement: points },
            lifetimeRedeemedPoints: { increment: points },
          }
        : {}),
      ...(walletCents > 0
        ? { walletBalance: { decrement: walletCents / 100 } }
        : {}),
    },
  });
  if (updated.count !== 1) {
    throw new LoyaltyError(
      409,
      "LOYALTY_BALANCE_CHANGED",
      "Your rewards balance changed. Review the latest total and try again."
    );
  }

  const account = await database.loyaltyAccount.findUnique({
    where: { userId: order.userId },
  });
  const notifications = [];
  if (points > 0) {
    const welcomePoints = Number(
      pricing.pricingBreakdown?.loyalty?.welcomePointsRedeemed ?? 0
    );
    await database.loyaltyPointTransaction.create({
      data: {
        userId: order.userId,
        orderId: order.id,
        type: "REDEMPTION",
        points: -points,
        balanceAfter: account.availablePoints,
        status: "ACTIVE",
        description: welcomePoints > 0
          ? `Points redeemed on order ${order.orderNumber}, including ${welcomePoints} welcome points.`
          : `Points redeemed on order ${order.orderNumber}.`,
        idempotencyKey: `order:${order.id}:points:redemption`,
      },
    });
    notifications.push(await createMandatoryLoyaltyNotification(database, {
      eventKey: `order:${order.id}:points:redemption`,
      userId: order.userId,
      title: "Points redeemed",
      body: `${points} points were applied to order ${order.orderNumber}.`,
      metadata: { type: "POINTS_REDEEMED", orderId: order.id, points },
    }));
  }
  if (walletCents > 0) {
    await database.walletTransaction.create({
      data: {
        userId: order.userId,
        orderId: order.id,
        type: "ORDER_PAYMENT",
        amount: -(walletCents / 100),
        balanceAfter: account.walletBalance,
        description: `Wallet credit used on order ${order.orderNumber}.`,
        idempotencyKey: `order:${order.id}:wallet:payment`,
      },
    });
    notifications.push(await createMandatoryLoyaltyNotification(database, {
      eventKey: `order:${order.id}:wallet:payment`,
      userId: order.userId,
      title: "Wallet credit used",
      body: `EGP ${(walletCents / 100).toFixed(2)} was applied to order ${order.orderNumber}.`,
      metadata: { type: "WALLET_USED", orderId: order.id, amount: walletCents / 100 },
    }));
  }
  return notifications.filter(Boolean);
}

export async function restoreOrderLoyalty(database, order, now = new Date()) {
  const points = Number(order.pointsRedeemed ?? 0);
  const walletCents = toCents(order.walletCreditUsed);
  const notifications = [];
  const settings = await getLoyaltyProgramSettings(database);
  await ensureLoyaltyAccount(database, order.userId);

  if (points > 0) {
    const loyaltySnapshot = orderLoyaltySnapshot(order);
    const welcomePoints = Math.min(
      points,
      Math.max(0, Number(loyaltySnapshot?.welcomePointsRedeemed ?? 0))
    );
    const standardPoints = points - welcomePoints;
    const welcomeKey = `order:${order.id}:points:restore:welcome`;
    const standardKey = `order:${order.id}:points:restore`;
    const expectedKeys = [
      ...(welcomePoints > 0 ? [welcomeKey] : []),
      ...(standardPoints > 0 ? [standardKey] : []),
    ];
    const existingRows = await Promise.all(expectedKeys.map((idempotencyKey) =>
      database.loyaltyPointTransaction.findUnique({ where: { idempotencyKey } })
    ));
    if (existingRows.every(Boolean)) {
      // The original cancellation/rejection already restored this debit.
    } else if (existingRows.some(Boolean)) {
      throw new LoyaltyError(
        409,
        "INCOMPLETE_POINTS_RESTORE",
        "The stored points restoration is incomplete and requires review."
      );
    } else {
      const account = await database.loyaltyAccount.update({
        where: { userId: order.userId },
        data: {
          availablePoints: { increment: points },
          lifetimeRedeemedPoints: { decrement: points },
        },
      });
      let runningBalance = account.availablePoints - points;
      if (welcomePoints > 0) {
        runningBalance += welcomePoints;
        await database.loyaltyPointTransaction.create({
          data: {
            userId: order.userId,
            orderId: order.id,
            type: "WELCOME_RESTORE",
            points: welcomePoints,
            balanceAfter: runningBalance,
            status: "ACTIVE",
            expiresAt: loyaltySnapshot?.welcomePointsExpiry
              ? new Date(loyaltySnapshot.welcomePointsExpiry)
              : addDays(now, welcomeExpiryDays(settings)),
            description: `Welcome points restored from order ${order.orderNumber}.`,
            idempotencyKey: welcomeKey,
          },
        });
      }
      if (standardPoints > 0) {
        runningBalance += standardPoints;
        await database.loyaltyPointTransaction.create({
          data: {
          userId: order.userId,
          orderId: order.id,
          type: "RESTORE",
          points: standardPoints,
          balanceAfter: runningBalance,
          status: "ACTIVE",
          expiresAt: addMonths(now, settings.expiryMonths),
          description: `Redeemed points restored from order ${order.orderNumber}.`,
          idempotencyKey: standardKey,
          },
        });
      }
      notifications.push(await createMandatoryLoyaltyNotification(database, {
        eventKey: `order:${order.id}:points:restore`,
        userId: order.userId,
        title: "Points restored",
        body: `${points} points were restored after order ${order.orderNumber} was closed.`,
        metadata: { type: "POINTS_RESTORED", orderId: order.id, points },
      }));
    }
  }

  if (walletCents > 0) {
    const idempotencyKey = `order:${order.id}:wallet:restore`;
    const existing = await database.walletTransaction.findUnique({ where: { idempotencyKey } });
    if (!existing) {
      const account = await database.loyaltyAccount.update({
        where: { userId: order.userId },
        data: { walletBalance: { increment: walletCents / 100 } },
      });
      await database.walletTransaction.create({
        data: {
          userId: order.userId,
          orderId: order.id,
          type: "RESTORE",
          amount: walletCents / 100,
          balanceAfter: account.walletBalance,
          description: `Wallet credit restored from order ${order.orderNumber}.`,
          idempotencyKey,
        },
      });
      notifications.push(await createMandatoryLoyaltyNotification(database, {
        eventKey: idempotencyKey,
        userId: order.userId,
        title: "Wallet credit restored",
        body: `EGP ${(walletCents / 100).toFixed(2)} was restored after order ${order.orderNumber} was closed.`,
        metadata: { type: "WALLET_RESTORED", orderId: order.id, amount: walletCents / 100 },
      }));
    }
  }
  return notifications.filter(Boolean);
}

function orderLoyaltySnapshot(order) {
  const breakdown = order.pricingBreakdown;
  const loyalty = breakdown && typeof breakdown === "object" && !Array.isArray(breakdown)
    ? breakdown.loyalty
    : null;
  if (!loyalty || typeof loyalty !== "object" || Array.isArray(loyalty)) return null;
  return loyalty;
}

export function calculateEarnedPoints(order) {
  const snapshot = orderLoyaltySnapshot(order);
  if (!snapshot) return 0;
  const eligibleCents = toCents(snapshot.eligibleEarningAmount);
  const rate = Number(snapshot.earningRatePointsPerEgp10);
  if (!Number.isInteger(rate) || rate <= 0) return 0;
  // Only complete EGP 10 blocks earn points; fractional blocks are rounded down.
  return Math.floor(eligibleCents / EGP10_CENTS) * rate;
}

export async function awardDeliveredOrderLoyalty(database, order, now = new Date()) {
  // Keep the award rule enforced at the service boundary as well as in the
  // order-status controller so an internal caller cannot award early.
  if (order.status !== "DELIVERED") return [];
  const settings = await getLoyaltyProgramSettings(database);
  await ensureLoyaltyAccount(database, order.userId);
  if (!settings.enabled) return [];

  const orderEarnKey = `order:${order.id}:points:earn`;
  const existingOrderEarn = await database.loyaltyPointTransaction.findUnique({
    where: { idempotencyKey: orderEarnKey },
  });
  const earnedPoints = existingOrderEarn ? 0 : calculateEarnedPoints(order);
  if (earnedPoints <= 0) return [];

  const updatedAccount = await database.loyaltyAccount.update({
    where: { userId: order.userId },
    data: {
      availablePoints: { increment: earnedPoints },
      lifetimeEarnedPoints: { increment: earnedPoints },
    },
  });
  const expiresAt = addMonths(now, Number(orderLoyaltySnapshot(order)?.expiryMonths) || settings.expiryMonths);
  const notifications = [];
  await database.loyaltyPointTransaction.create({
      data: {
        userId: order.userId,
        orderId: order.id,
        type: "ORDER_EARN",
        points: earnedPoints,
        balanceAfter: updatedAccount.availablePoints,
        status: "ACTIVE",
        expiresAt,
        description: `Points earned from delivered order ${order.orderNumber}.`,
        idempotencyKey: orderEarnKey,
      },
  });
  notifications.push(await createMandatoryLoyaltyNotification(database, {
      eventKey: orderEarnKey,
      userId: order.userId,
      title: "Order points earned",
      body: `${earnedPoints} points were earned from order ${order.orderNumber}.`,
      metadata: { type: "ORDER_POINTS_EARNED", orderId: order.id, points: earnedPoints },
  }));
  return notifications.filter(Boolean);
}

export async function reverseDeliveredOrderPoints(database, order, actorUserId, reason) {
  const safeDescription = safeReason(reason);
  if (!safeDescription) {
    throw new LoyaltyError(400, "REASON_REQUIRED", "A reason is required.", "reason");
  }
  const idempotencyKey = `order:${order.id}:points:reversal`;
  const existing = await database.loyaltyPointTransaction.findUnique({ where: { idempotencyKey } });
  if (existing) return { transaction: existing, created: false };
  const awarded = await database.loyaltyPointTransaction.aggregate({
    where: {
      orderId: order.id,
      type: { in: ["WELCOME_ACTIVATED", "ORDER_EARN"] },
      points: { gt: 0 },
    },
    _sum: { points: true },
  });
  const points = awarded._sum.points ?? 0;
  if (points <= 0) {
    throw new LoyaltyError(409, "NO_POINTS_TO_REVERSE", "This order has no awarded points to reverse.");
  }
  const account = await ensureLoyaltyAccount(database, order.userId);
  const updated = await database.loyaltyAccount.update({
    where: { userId: order.userId },
    data: { availablePoints: { decrement: points } },
  });
  const transaction = await database.loyaltyPointTransaction.create({
    data: {
      userId: order.userId,
      orderId: order.id,
      actorUserId,
      type: "REVERSAL",
      points: -points,
      balanceAfter: updated.availablePoints,
      status: "REVERSED",
      description: safeDescription,
      idempotencyKey,
    },
  });
  await createMandatoryLoyaltyNotification(database, {
    eventKey: idempotencyKey,
    userId: order.userId,
    title: "Order points adjusted",
    body: `${points} points were reversed for order ${order.orderNumber}.`,
    metadata: { type: "ORDER_POINTS_REVERSED", orderId: order.id, points },
  });
  return { transaction, created: true, previousBalance: account.availablePoints };
}

function serializePointTransaction(transaction) {
  return {
    id: transaction.id,
    orderId: transaction.orderId,
    type: transaction.type,
    points: transaction.points,
    balanceAfter: transaction.balanceAfter,
    status: transaction.status,
    expiresAt: transaction.expiresAt,
    description: transaction.description,
    actor: transaction.actor
      ? { id: transaction.actor.id, name: transaction.actor.name, role: transaction.actor.role.toLowerCase() }
      : null,
    createdAt: transaction.createdAt,
  };
}

function serializeWalletTransaction(transaction) {
  return {
    id: transaction.id,
    orderId: transaction.orderId,
    type: transaction.type,
    amount: asNumber(transaction.amount),
    balanceAfter: asNumber(transaction.balanceAfter),
    description: transaction.description,
    actor: transaction.actor
      ? { id: transaction.actor.id, name: transaction.actor.name, role: transaction.actor.role.toLowerCase() }
      : null,
    createdAt: transaction.createdAt,
  };
}

export async function getCustomerLoyaltySummary(userId, database = prisma, now = new Date()) {
  await expirePointsForUser(database, userId, now);
  const [account, settings, pointTransactions, walletTransactions, user] = await Promise.all([
    database.loyaltyAccount.findUnique({ where: { userId } }),
    getLoyaltyProgramSettings(database),
    database.loyaltyPointTransaction.findMany({
      where: { userId },
      include: { actor: { select: { id: true, name: true, role: true } } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 50,
    }),
    database.walletTransaction.findMany({
      where: { userId },
      include: { actor: { select: { id: true, name: true, role: true } } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 50,
    }),
    database.user.findUnique({ where: { id: userId }, select: { customerTier: true } }),
  ]);
  const allPointTransactions = await database.loyaltyPointTransaction.findMany({
    where: { userId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  const remainingLots = calculateRemainingPointLots(allPointTransactions);
  const soon = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const expiringSoonLots = remainingLots.filter(
    (lot) => lot.remainingPoints > 0 && lot.expiresAt && lot.expiresAt > now && lot.expiresAt <= soon
  );
  const pointsExpiringSoon = expiringSoonLots.reduce(
    (sum, lot) => sum + lot.remainingPoints,
    0
  );
  for (const lot of expiringSoonLots) {
    await createMandatoryLoyaltyNotification(database, {
      eventKey: `expiring:${lot.id}`,
      userId,
      title: "Points expiring soon",
      body: `${lot.remainingPoints} points will expire within 30 days.`,
      metadata: { type: "POINTS_EXPIRING", points: lot.remainingPoints, expiresAt: lot.expiresAt },
    });
  }
  const redeemablePointValue = redemptionValueCentsForPoints(
    Math.max(0, account.availablePoints),
    settings
  ) / 100;
  return {
    account: {
      availablePoints: account.availablePoints,
      pendingPoints: account.pendingPoints,
      lifetimeEarnedPoints: account.lifetimeEarnedPoints,
      lifetimeRedeemedPoints: account.lifetimeRedeemedPoints,
      redeemablePointValue,
      walletBalance: asNumber(account.walletBalance),
      pointsExpiringSoon,
    },
    customerTier: (user?.customerTier ?? "STANDARD").toLowerCase(),
    settings: serializeLoyaltySettings(settings),
    pointTransactions: pointTransactions.map(serializePointTransaction),
    walletTransactions: walletTransactions.map(serializeWalletTransaction),
  };
}

export async function getAdminLoyaltyCustomers({ search = "" } = {}, database = prisma) {
  const normalized = safeReason(search).slice(0, 160);
  const users = await database.user.findMany({
    where: {
      role: "CUSTOMER",
      ...(normalized
        ? {
            OR: [
              { name: { contains: normalized, mode: "insensitive" } },
              { email: { contains: normalized, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      name: true,
      email: true,
      customerTier: true,
      isActive: true,
      loyaltyAccount: true,
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    customerTier: user.customerTier.toLowerCase(),
    isActive: user.isActive,
    availablePoints: user.loyaltyAccount?.availablePoints ?? 0,
    pendingPoints: user.loyaltyAccount?.pendingPoints ?? 0,
    walletBalance: asNumber(user.loyaltyAccount?.walletBalance),
  }));
}

export async function createAdminPointsAdjustment(
  database,
  { userId, actorUserId, points, reason, idempotencyKey = randomUUID() }
) {
  const normalizedPoints = Number(points);
  const description = safeReason(reason);
  if (!Number.isInteger(normalizedPoints) || normalizedPoints === 0 || Math.abs(normalizedPoints) > 10_000_000) {
    throw new LoyaltyError(400, "INVALID_POINTS_ADJUSTMENT", "Points adjustment must be a non-zero whole number.", "points");
  }
  if (!description) throw new LoyaltyError(400, "REASON_REQUIRED", "A reason is required.", "reason");
  const key = `admin:${actorUserId}:points:${idempotencyKey}`;
  const existing = await database.loyaltyPointTransaction.findUnique({ where: { idempotencyKey: key } });
  if (existing) return { transaction: serializePointTransaction(existing), created: false };
  const settings = await getLoyaltyProgramSettings(database);
  await ensureLoyaltyAccount(database, userId);
  const update = await database.loyaltyAccount.updateMany({
    where: {
      userId,
      ...(normalizedPoints < 0
        ? { availablePoints: { gte: Math.abs(normalizedPoints) } }
        : {}),
    },
    data: {
      availablePoints: normalizedPoints > 0
        ? { increment: normalizedPoints }
        : { decrement: Math.abs(normalizedPoints) },
      ...(normalizedPoints > 0
        ? { lifetimeEarnedPoints: { increment: normalizedPoints } }
        : {}),
    },
  });
  if (update.count !== 1) {
    throw new LoyaltyError(
      409,
      "INSUFFICIENT_POINTS",
      "Points deduction exceeds the customer's available balance."
    );
  }
  const account = await database.loyaltyAccount.findUnique({ where: { userId } });
  const transaction = await database.loyaltyPointTransaction.create({
    data: {
      userId,
      actorUserId,
      type: "ADMIN_ADJUSTMENT",
      points: normalizedPoints,
      balanceAfter: account.availablePoints,
      status: "ACTIVE",
      expiresAt: normalizedPoints > 0 ? addMonths(new Date(), settings.expiryMonths) : null,
      description,
      idempotencyKey: key,
    },
    include: { actor: { select: { id: true, name: true, role: true } } },
  });
  await createMandatoryLoyaltyNotification(database, {
    eventKey: key,
    userId,
    title: "Points balance adjusted",
    body: `${Math.abs(normalizedPoints)} points were ${normalizedPoints > 0 ? "added to" : "deducted from"} your rewards balance.`,
    metadata: { type: "ADMIN_POINTS_ADJUSTMENT", points: normalizedPoints },
  });
  return { transaction: serializePointTransaction(transaction), created: true };
}

export async function createAdminWalletAdjustment(
  database,
  { userId, actorUserId, amount, adjustmentType, reason, idempotencyKey = randomUUID() }
) {
  const cents = parseRequestedWalletCents(amount);
  const description = safeReason(reason);
  const allowed = new Set(["PROMOTIONAL_CREDIT", "ADMIN_CREDIT", "ADMIN_DEBIT", "REFUND_CREDIT"]);
  if (cents <= 0) throw new LoyaltyError(400, "INVALID_WALLET_ADJUSTMENT", "Wallet amount must be greater than zero.", "amount");
  if (!allowed.has(adjustmentType)) throw new LoyaltyError(400, "INVALID_WALLET_TYPE", "Wallet adjustment type is invalid.", "adjustmentType");
  if (!description) throw new LoyaltyError(400, "REASON_REQUIRED", "A reason is required.", "reason");
  const key = `admin:${actorUserId}:wallet:${idempotencyKey}`;
  const existing = await database.walletTransaction.findUnique({ where: { idempotencyKey: key } });
  if (existing) return { transaction: serializeWalletTransaction(existing), created: false };
  await ensureLoyaltyAccount(database, userId);
  const debit = adjustmentType === "ADMIN_DEBIT";
  const update = debit
    ? await database.loyaltyAccount.updateMany({
        where: { userId, walletBalance: { gte: cents / 100 } },
        data: { walletBalance: { decrement: cents / 100 } },
      })
    : await database.loyaltyAccount.updateMany({
        where: { userId },
        data: { walletBalance: { increment: cents / 100 } },
      });
  if (update.count !== 1) {
    throw new LoyaltyError(409, "INSUFFICIENT_WALLET_CREDIT", "Wallet debit exceeds the available balance.");
  }
  const account = await database.loyaltyAccount.findUnique({ where: { userId } });
  const signedAmount = debit ? -(cents / 100) : cents / 100;
  const transaction = await database.walletTransaction.create({
    data: {
      userId,
      actorUserId,
      type: adjustmentType,
      amount: signedAmount,
      balanceAfter: account.walletBalance,
      description,
      idempotencyKey: key,
    },
    include: { actor: { select: { id: true, name: true, role: true } } },
  });
  await createMandatoryLoyaltyNotification(database, {
    eventKey: key,
    userId,
    title: debit ? "Wallet balance adjusted" : "Wallet credit added",
    body: `EGP ${(cents / 100).toFixed(2)} was ${debit ? "deducted from" : "added to"} your store-credit wallet.`,
    metadata: { type: debit ? "WALLET_DEBITED" : "WALLET_CREDITED", amount: signedAmount },
  });
  return { transaction: serializeWalletTransaction(transaction), created: true };
}

export async function updateLoyaltyProgramSettings(database, patch) {
  const allowed = new Set([
    "enabled",
    "standardPointsPerEgp10",
    "vipPointsPerEgp10",
    "pointsPerRedemptionUnit",
    "redemptionValueEgp",
    "welcomePoints",
    "welcomeMinimumSubtotalEgp",
    "welcomeExpiryDays",
    "minimumRedemptionPoints",
    "maximumRedemptionPercent",
    "expiryMonths",
  ]);
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
    throw new LoyaltyError(400, "INVALID_SETTINGS", "Settings must be a JSON object.");
  }
  const unknown = Object.keys(patch).find((key) => !allowed.has(key));
  if (unknown) throw new LoyaltyError(400, "INVALID_SETTINGS", `Unknown loyalty setting: ${unknown}.`, unknown);
  const data = {};
  for (const [key, value] of Object.entries(patch)) {
    if (key === "enabled") {
      if (typeof value !== "boolean") throw new LoyaltyError(400, "INVALID_SETTINGS", "enabled must be true or false.", key);
      data[key] = value;
      continue;
    }
    const number = Number(value);
    const allowsZero = [
      "welcomePoints",
      "welcomeMinimumSubtotalEgp",
      "maximumRedemptionPercent",
    ].includes(key);
    const integer = ![
      "redemptionValueEgp",
      "welcomeMinimumSubtotalEgp",
      "maximumRedemptionPercent",
    ].includes(key);
    if (!Number.isFinite(number) || (integer && !Number.isInteger(number)) || number < (allowsZero ? 0 : 1)) {
      throw new LoyaltyError(400, "INVALID_SETTINGS", `${key} has an invalid value.`, key);
    }
    if (key === "maximumRedemptionPercent" && number > 100) {
      throw new LoyaltyError(400, "INVALID_SETTINGS", "maximumRedemptionPercent cannot exceed 100.", key);
    }
    data[key] = number;
  }
  const settings = await database.loyaltyProgramSettings.update({
    where: { id: SETTINGS_ID },
    data,
  });
  return serializeLoyaltySettings(settings);
}

export const loyaltySerializers = {
  pointTransaction: serializePointTransaction,
  walletTransaction: serializeWalletTransaction,
};
