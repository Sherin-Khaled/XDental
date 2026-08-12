import assert from "node:assert/strict";
import test from "node:test";
import {
  applyLoyaltyPricing,
  awardDeliveredOrderLoyalty,
  calculateEarnedPoints,
  createAdminPointsAdjustment,
  createAdminWalletAdjustment,
  debitOrderLoyalty,
  expirePointsForUser,
  initializeNewCustomerLoyalty,
  LoyaltyError,
  parseRequestedWalletCents,
  restoreOrderLoyalty,
} from "./loyalty.service.js";

const settings = {
  id: "default",
  enabled: true,
  standardPointsPerEgp10: 1,
  vipPointsPerEgp10: 2,
  pointsPerRedemptionUnit: 100,
  redemptionValueEgp: 10,
  welcomePoints: 200,
  welcomeMinimumSubtotalEgp: 500,
  welcomeExpiryDays: 30,
  minimumRedemptionPoints: 100,
  maximumRedemptionPercent: 20,
  expiryMonths: 12,
};

function basePricing({ subtotalCents = 100_000, monetaryDiscountCents = 10_000, shippingCents = 5_000 } = {}) {
  return {
    subtotalCents,
    monetaryDiscountCents,
    shippingCents,
    totalCents: subtotalCents - monetaryDiscountCents + shippingCents,
    pricingBreakdown: { pricingVersion: "phase5-v1" },
  };
}

function pricingDatabase({
  tier = "STANDARD",
  availablePoints = 1_000,
  pendingPoints = 0,
  walletBalance = 100,
  transactions = [],
} = {}) {
  const account = {
    userId: "customer-1",
    availablePoints,
    pendingPoints,
    lifetimeEarnedPoints: 0,
    lifetimeRedeemedPoints: 0,
    walletBalance,
  };
  return {
    account,
    loyaltyProgramSettings: {
      upsert: async () => settings,
    },
    user: {
      findUnique: async ({ where }) => where.id === "customer-1" ? { customerTier: tier } : null,
    },
    loyaltyAccount: {
      upsert: async ({ where }) => {
        assert.equal(where.userId, "customer-1");
        return account;
      },
      findUnique: async () => account,
    },
    loyaltyPointTransaction: {
      findMany: async ({ where }) => {
        assert.equal(where.userId, "customer-1");
        return transactions;
      },
    },
  };
}

test("checkout exposes real balances and enforces 100-point increments plus the 20% product cap", async () => {
  const database = pricingDatabase();
  const preview = await applyLoyaltyPricing(database, {
    userId: "customer-1",
    pricing: basePricing(),
    requestedPoints: 100,
    requestedWalletAmount: "20.00",
  });
  assert.equal(preview.loyalty.availablePoints, 1_000);
  assert.equal(preview.loyalty.maximumRedeemablePoints, 1_000);
  assert.equal(preview.pointsRedemptionValueCents, 1_000);
  assert.equal(preview.walletCreditUsedCents, 2_000);
  assert.equal(preview.totalCents, 94_000);
  assert.equal(preview.remainingCodCents, 92_000);

  await assert.rejects(
    applyLoyaltyPricing(database, {
      userId: "customer-1",
      pricing: basePricing(),
      requestedPoints: 150,
    }),
    (error) => error instanceof LoyaltyError && error.code === "INVALID_POINTS_INCREMENT"
  );

  const cappedDatabase = pricingDatabase({ availablePoints: 100_000 });
  await assert.rejects(
    applyLoyaltyPricing(cappedDatabase, {
      userId: "customer-1",
      pricing: basePricing({ subtotalCents: 10_000, monetaryDiscountCents: 0, shippingCents: 5_000 }),
      requestedPoints: 300,
    }),
    (error) => error instanceof LoyaltyError && error.code === "POINTS_REDEMPTION_LIMIT"
  );
});

test("points never pay shipping and wallet-funded product value does not earn points", async () => {
  const database = pricingDatabase();
  const preview = await applyLoyaltyPricing(database, {
    userId: "customer-1",
    pricing: basePricing(),
    requestedPoints: 100,
    requestedWalletAmount: "60.00",
  });
  assert.equal(preview.loyalty.eligibleProductSubtotalCents, 90_000);
  assert.equal(preview.loyalty.eligibleEarningCents, 88_000);
  assert.equal(preview.remainingCodCents, 88_000);
});

test("standard earns 1% and VIP earns 2% using complete EGP 10 blocks rounded down", () => {
  const order = {
    pricingBreakdown: {
      loyalty: {
        eligibleEarningAmount: 99.99,
        earningRatePointsPerEgp10: 1,
      },
    },
  };
  assert.equal(calculateEarnedPoints(order), 9);
  assert.equal(calculateEarnedPoints({
    ...order,
    pricingBreakdown: {
      loyalty: { ...order.pricingBreakdown.loyalty, earningRatePointsPerEgp10: 2 },
    },
  }), 18);
  assert.equal(calculateEarnedPoints({ pricingBreakdown: null }), 0);
});

test("wallet amount parsing is exact to cents and rejects malformed values", () => {
  assert.equal(parseRequestedWalletCents("10"), 1_000);
  assert.equal(parseRequestedWalletCents("10.05"), 1_005);
  assert.throws(() => parseRequestedWalletCents("10.005"), LoyaltyError);
  assert.throws(() => parseRequestedWalletCents("-1"), LoyaltyError);
});

test("new public customer receives exactly one immediately available welcome grant", async () => {
  const calls = { point: 0, notification: 0 };
  const pointRows = new Map();
  const account = {
    userId: "new-customer",
    availablePoints: 0,
    pendingPoints: 0,
    lifetimeEarnedPoints: 0,
  };
  const database = {
    loyaltyProgramSettings: { upsert: async () => settings },
    loyaltyAccount: {
      upsert: async () => account,
      update: async ({ data }) => {
        account.availablePoints += data.availablePoints.increment;
        account.lifetimeEarnedPoints += data.lifetimeEarnedPoints.increment;
        return { ...account };
      },
    },
    loyaltyPointTransaction: {
      findUnique: async ({ where }) => pointRows.get(where.idempotencyKey) ?? null,
      create: async ({ data }) => {
        calls.point += 1;
        assert.equal(data.idempotencyKey, "welcome:new-customer:granted");
        assert.equal(data.status, "ACTIVE");
        assert.equal(data.type, "WELCOME_GRANTED");
        pointRows.set(data.idempotencyKey, data);
        return { id: "welcome-row", ...data };
      },
    },
    notification: {
      findUnique: async () => null,
      create: async ({ data }) => {
        calls.notification += 1;
        return data;
      },
    },
  };
  const grantedAt = new Date("2026-08-02T10:00:00Z");
  await initializeNewCustomerLoyalty(database, "new-customer", grantedAt);
  await initializeNewCustomerLoyalty(database, "new-customer", grantedAt);
  assert.equal(account.availablePoints, 200);
  assert.equal(account.pendingPoints, 0);
  assert.equal(pointRows.get("welcome:new-customer:granted").expiresAt.toISOString(), "2026-09-01T10:00:00.000Z");
  assert.deepEqual(calls, { point: 1, notification: 1 });
});

test("delivery leaves legacy pending welcome untouched and awards normal order points once", async () => {
  const pointRows = new Map();
  const account = {
    availablePoints: 0,
    pendingPoints: 200,
    lifetimeEarnedPoints: 0,
    walletBalance: 0,
  };
  let updates = 0;
  const database = {
    loyaltyProgramSettings: { upsert: async () => settings },
    loyaltyAccount: {
      upsert: async () => account,
      update: async ({ data }) => {
        updates += 1;
        account.availablePoints += data.availablePoints.increment;
        account.pendingPoints -= data.pendingPoints?.decrement ?? 0;
        account.lifetimeEarnedPoints += data.lifetimeEarnedPoints.increment;
        return { ...account };
      },
    },
    loyaltyPointTransaction: {
      findUnique: async ({ where }) => pointRows.get(where.idempotencyKey) ?? null,
      create: async ({ data }) => {
        pointRows.set(data.idempotencyKey, data);
        return data;
      },
    },
    notification: {
      findUnique: async () => null,
      create: async ({ data }) => data,
    },
  };
  const order = {
    id: "order-1",
    userId: "customer-1",
    orderNumber: "ORD-1",
    status: "DELIVERED",
    pricingBreakdown: {
      loyalty: {
        eligibleEarningAmount: 250,
        earningRatePointsPerEgp10: 1,
        expiryMonths: 12,
      },
    },
  };
  await awardDeliveredOrderLoyalty(database, order, new Date("2026-08-02T10:00:00Z"));
  assert.equal(account.availablePoints, 25);
  assert.equal(account.pendingPoints, 200);
  assert.equal(updates, 1);
  await awardDeliveredOrderLoyalty(database, order, new Date("2026-08-02T10:00:01Z"));
  assert.equal(account.availablePoints, 25);
  assert.equal(updates, 1);
});

test("welcome points enforce EGP 500 and are usable on the first eligible checkout", async () => {
  const welcome = {
    id: "welcome-1",
    type: "WELCOME_GRANTED",
    points: 200,
    status: "ACTIVE",
    expiresAt: new Date("2026-09-01T10:00:00Z"),
    idempotencyKey: "welcome:customer-1:granted",
    createdAt: new Date("2026-08-02T10:00:00Z"),
  };
  const database = pricingDatabase({ availablePoints: 200, transactions: [welcome] });

  await assert.rejects(
    applyLoyaltyPricing(database, {
      userId: "customer-1",
      pricing: basePricing({ subtotalCents: 49_900, monetaryDiscountCents: 0 }),
      requestedPoints: 100,
      now: new Date("2026-08-02T11:00:00Z"),
    }),
    (error) => error instanceof LoyaltyError && error.code === "WELCOME_MINIMUM_SUBTOTAL"
  );

  const eligible = await applyLoyaltyPricing(database, {
    userId: "customer-1",
    pricing: basePricing({ subtotalCents: 50_000, monetaryDiscountCents: 0 }),
    requestedPoints: 200,
    now: new Date("2026-08-02T11:00:00Z"),
  });
  assert.equal(eligible.pointsRedemptionValueCents, 2_000);
  assert.equal(eligible.shippingCents, 5_000);
  assert.equal(eligible.totalCents, 53_000);
  assert.equal(eligible.pricingBreakdown.loyalty.welcomePointsRedeemed, 200);
});

test("earned points remain redeemable below the welcome minimum without consuming welcome points", async () => {
  const transactions = [
    {
      id: "welcome-1",
      type: "WELCOME_GRANTED",
      points: 200,
      status: "ACTIVE",
      expiresAt: new Date("2026-09-01T10:00:00Z"),
      createdAt: new Date("2026-08-01T10:00:00Z"),
    },
    {
      id: "earned-1",
      type: "ORDER_EARN",
      points: 100,
      status: "ACTIVE",
      expiresAt: new Date("2027-08-01T10:00:00Z"),
      createdAt: new Date("2026-08-02T10:00:00Z"),
    },
  ];
  const database = pricingDatabase({ availablePoints: 300, transactions });
  const pricing = await applyLoyaltyPricing(database, {
    userId: "customer-1",
    pricing: basePricing({ subtotalCents: 49_900, monetaryDiscountCents: 0 }),
    requestedPoints: 100,
    now: new Date("2026-08-02T11:00:00Z"),
  });
  assert.equal(pricing.pricingBreakdown.loyalty.welcomePointsRedeemed, 0);
  assert.equal(pricing.pricingBreakdown.loyalty.earnedOrAdjustedPointsRedeemed, 100);
});

test("welcome and order points cannot activate before delivery", async () => {
  let settingsReads = 0;
  const database = {
    loyaltyProgramSettings: { upsert: async () => { settingsReads += 1; return settings; } },
  };
  const notifications = await awardDeliveredOrderLoyalty(database, {
    id: "order-pending",
    userId: "customer-1",
    orderNumber: "ORD-PENDING",
    status: "OUT_FOR_DELIVERY",
  });
  assert.deepEqual(notifications, []);
  assert.equal(settingsReads, 0);
});

test("transactional redemption rejects concurrent balance loss before creating any ledger debit", async () => {
  let pointCreates = 0;
  const database = {
    loyaltyAccount: {
      updateMany: async () => ({ count: 0 }),
    },
    loyaltyPointTransaction: { create: async () => { pointCreates += 1; } },
    walletTransaction: { create: async () => undefined },
  };
  await assert.rejects(
    debitOrderLoyalty(
      database,
      { id: "order-1", userId: "customer-1", orderNumber: "ORD-1" },
      { pointsRedeemed: 100, walletCreditUsedCents: 0 }
    ),
    (error) => error instanceof LoyaltyError && error.code === "LOYALTY_BALANCE_CHANGED"
  );
  assert.equal(pointCreates, 0);
});

test("cancellation restoration returns points and wallet only once", async () => {
  const pointRows = new Map();
  const walletRows = new Map();
  const account = {
    availablePoints: 0,
    lifetimeRedeemedPoints: 100,
    walletBalance: 0,
  };
  const database = {
    loyaltyProgramSettings: { upsert: async () => settings },
    loyaltyAccount: {
      upsert: async () => account,
      update: async ({ data }) => {
        if (data.availablePoints) account.availablePoints += data.availablePoints.increment;
        if (data.lifetimeRedeemedPoints) account.lifetimeRedeemedPoints -= data.lifetimeRedeemedPoints.decrement;
        if (data.walletBalance) account.walletBalance += data.walletBalance.increment;
        return { ...account };
      },
    },
    loyaltyPointTransaction: {
      findUnique: async ({ where }) => pointRows.get(where.idempotencyKey) ?? null,
      create: async ({ data }) => { pointRows.set(data.idempotencyKey, data); return data; },
    },
    walletTransaction: {
      findUnique: async ({ where }) => walletRows.get(where.idempotencyKey) ?? null,
      create: async ({ data }) => { walletRows.set(data.idempotencyKey, data); return data; },
    },
    notification: {
      findUnique: async () => null,
      create: async ({ data }) => data,
    },
  };
  const order = {
    id: "order-1",
    userId: "customer-1",
    orderNumber: "ORD-1",
    pointsRedeemed: 100,
    walletCreditUsed: 25,
  };
  await restoreOrderLoyalty(database, order);
  await restoreOrderLoyalty(database, order);
  assert.equal(account.availablePoints, 100);
  assert.equal(account.lifetimeRedeemedPoints, 0);
  assert.equal(account.walletBalance, 25);
});

test("expired unused points create one compensating immutable ledger row", async () => {
  const account = {
    availablePoints: 100,
    pendingPoints: 0,
    lifetimeEarnedPoints: 100,
    lifetimeRedeemedPoints: 0,
    walletBalance: 0,
  };
  const transactions = [{
    id: "credit-1",
    type: "ORDER_EARN",
    points: 100,
    status: "ACTIVE",
    expiresAt: new Date("2026-07-01T00:00:00Z"),
    createdAt: new Date("2025-07-01T00:00:00Z"),
  }];
  const created = [];
  const database = {
    loyaltyAccount: {
      upsert: async () => account,
      updateMany: async ({ where, data }) => {
        if (account.availablePoints < where.availablePoints.gte) return { count: 0 };
        account.availablePoints -= data.availablePoints.decrement;
        return { count: 1 };
      },
    },
    loyaltyPointTransaction: {
      findMany: async () => transactions,
      createMany: async ({ data }) => {
        const row = data[0];
        if (created.some((item) => item.idempotencyKey === row.idempotencyKey)) {
          return { count: 0 };
        }
        created.push(row);
        transactions.push({ id: `expiration-${created.length}`, createdAt: new Date(), ...row });
        return { count: 1 };
      },
    },
  };
  await expirePointsForUser(database, "customer-1", new Date("2026-08-02T00:00:00Z"));
  await expirePointsForUser(database, "customer-1", new Date("2026-08-02T00:00:01Z"));
  assert.equal(account.availablePoints, 0);
  assert.equal(created.length, 1);
  assert.equal(created[0].type, "EXPIRATION");
  assert.equal(created[0].points, -100);
});

test("admin +100 and -100 adjustments record exact signed values without allowing overdraft", async () => {
  const account = { availablePoints: 25 };
  const ledgers = new Map();
  const database = {
    loyaltyProgramSettings: { upsert: async () => settings },
    loyaltyAccount: {
      upsert: async () => account,
      updateMany: async ({ where, data }) => {
        if (where.availablePoints?.gte > account.availablePoints) return { count: 0 };
        account.availablePoints += data.availablePoints.increment
          ?? -(data.availablePoints.decrement ?? 0);
        return { count: 1 };
      },
      findUnique: async () => account,
    },
    loyaltyPointTransaction: {
      findUnique: async ({ where }) => ledgers.get(where.idempotencyKey) ?? null,
      create: async ({ data }) => {
        const ledger = { ...data, id: `tx-${ledgers.size + 1}`, actor: { id: data.actorUserId, name: "Admin", role: "ADMIN" }, createdAt: new Date() };
        ledgers.set(data.idempotencyKey, ledger);
        return ledger;
      },
    },
    notification: {
      findUnique: async () => null,
      create: async ({ data }) => data,
    },
  };
  const credit = await createAdminPointsAdjustment(database, {
    userId: "customer-1",
    actorUserId: "admin-1",
    points: 100,
    reason: "Approved support correction",
    idempotencyKey: "12345678-1234-1234-1234-123456789012",
  });
  assert.equal(account.availablePoints, 125);
  assert.equal(credit.transaction.points, 100);
  assert.equal(credit.transaction.actor.id, "admin-1");

  const debit = await createAdminPointsAdjustment(database, {
    userId: "customer-1",
    actorUserId: "admin-1",
    points: -100,
    reason: "Approved points deduction",
    idempotencyKey: "87654321-4321-4321-4321-210987654321",
  });
  assert.equal(account.availablePoints, 25);
  assert.equal(debit.transaction.points, -100);
  assert.equal(debit.transaction.description, "Approved points deduction");

  await assert.rejects(
    createAdminPointsAdjustment(database, {
      userId: "customer-1",
      actorUserId: "admin-1",
      points: -100,
      reason: "Disallowed overdraft",
      idempotencyKey: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    }),
    (error) => error instanceof LoyaltyError && error.code === "INSUFFICIENT_POINTS"
  );
  assert.equal(account.availablePoints, 25);
});

test("admin wallet credit and debit are ledger-only, actor-audited and idempotent", async () => {
  const account = { walletBalance: 50 };
  const ledgers = new Map();
  const database = {
    loyaltyAccount: {
      upsert: async () => account,
      updateMany: async ({ data }) => {
        account.walletBalance += data.walletBalance.increment
          ?? -(data.walletBalance.decrement ?? 0);
        return { count: 1 };
      },
      findUnique: async () => account,
    },
    walletTransaction: {
      findUnique: async ({ where }) => ledgers.get(where.idempotencyKey) ?? null,
      create: async ({ data }) => {
        const row = {
          ...data,
          id: `wallet-${ledgers.size + 1}`,
          actor: { id: data.actorUserId, name: "Admin", role: "ADMIN" },
          createdAt: new Date(),
        };
        ledgers.set(data.idempotencyKey, row);
        return row;
      },
    },
    notification: {
      findUnique: async () => null,
      create: async ({ data }) => data,
    },
  };

  const creditInput = {
    userId: "customer-1",
    actorUserId: "admin-1",
    amount: "25.00",
    adjustmentType: "PROMOTIONAL_CREDIT",
    reason: "Approved summer credit",
    idempotencyKey: "12345678-1234-1234-1234-123456789012",
  };
  const credit = await createAdminWalletAdjustment(database, creditInput);
  const replay = await createAdminWalletAdjustment(database, creditInput);
  assert.equal(credit.created, true);
  assert.equal(replay.created, false);
  assert.equal(account.walletBalance, 75);
  assert.equal(ledgers.size, 1);
  assert.equal(credit.transaction.actor.id, "admin-1");

  await createAdminWalletAdjustment(database, {
    ...creditInput,
    amount: "20.00",
    adjustmentType: "ADMIN_DEBIT",
    reason: "Approved correction",
    idempotencyKey: "87654321-4321-4321-4321-210987654321",
  });
  assert.equal(account.walletBalance, 55);
  assert.equal(ledgers.size, 2);
});

test("loyalty pricing is isolated to the authenticated customer id and VIP tier", async () => {
  const vipDatabase = pricingDatabase({ tier: "VIP" });
  const vip = await applyLoyaltyPricing(vipDatabase, {
    userId: "customer-1",
    pricing: basePricing(),
  });
  assert.equal(vip.loyalty.earningRatePointsPerEgp10, 2);
  await assert.rejects(
    applyLoyaltyPricing(vipDatabase, {
      userId: "another-customer",
      pricing: basePricing(),
    }),
    (error) => error instanceof LoyaltyError && error.code === "LOYALTY_ACCOUNT_NOT_FOUND"
  );
});
