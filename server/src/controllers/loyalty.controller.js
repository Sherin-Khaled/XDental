import { prisma } from "../config/db.js";
import { isValidId } from "../utils/records.js";
import { normalizeOrderIdempotencyKey } from "../services/orderIdempotency.service.js";
import {
  createAdminPointsAdjustment,
  createAdminWalletAdjustment,
  getAdminLoyaltyCustomers,
  getCustomerLoyaltySummary,
  getLoyaltyProgramSettings,
  LoyaltyError,
  reverseDeliveredOrderPoints,
  serializeLoyaltySettings,
  serializePublicLoyaltySettings,
  updateLoyaltyProgramSettings,
} from "../services/loyalty.service.js";

export async function getPublicLoyaltySettings(_request, response) {
  const settings = await getLoyaltyProgramSettings();
  return response.json({ settings: serializePublicLoyaltySettings(settings) });
}

function loyaltyErrorResponse(error, response) {
  if (!(error instanceof LoyaltyError)) return false;
  response.status(error.statusCode).json({
    message: error.message,
    code: error.code,
    ...(error.field ? { field: error.field } : {}),
  });
  return true;
}

function requireCustomerId(request, response) {
  if (!isValidId(request.params.userId)) {
    response.status(404).json({ message: "Customer not found." });
    return null;
  }
  return request.params.userId;
}

function requireAdjustmentKey(request, response) {
  const key = normalizeOrderIdempotencyKey(request.get("Idempotency-Key"));
  if (!key) {
    response.status(400).json({
      message: "A valid adjustment request key is required.",
      code: "INVALID_IDEMPOTENCY_KEY",
    });
    return null;
  }
  return key;
}

export async function getMyLoyalty(request, response) {
  if (request.user.role !== "customer") {
    return response.status(403).json({ message: "Customer access is required." });
  }
  const result = await prisma.$transaction((database) =>
    getCustomerLoyaltySummary(request.user.id, database)
  );
  return response.json(result);
}

export async function getAdminLoyaltyCustomerList(request, response) {
  const customers = await getAdminLoyaltyCustomers({ search: request.query?.search });
  return response.json({ customers });
}

export async function getAdminLoyaltyCustomer(request, response) {
  const userId = requireCustomerId(request, response);
  if (!userId) return;
  const user = await prisma.user.findFirst({
    where: { id: userId, role: "CUSTOMER" },
    select: { id: true, name: true, email: true, customerTier: true, isActive: true },
  });
  if (!user) return response.status(404).json({ message: "Customer not found." });
  const loyalty = await prisma.$transaction((database) =>
    getCustomerLoyaltySummary(userId, database)
  );
  return response.json({
    customer: {
      ...user,
      customerTier: user.customerTier.toLowerCase(),
    },
    ...loyalty,
  });
}

export async function adjustAdminCustomerPoints(request, response) {
  const userId = requireCustomerId(request, response);
  if (!userId) return;
  const idempotencyKey = requireAdjustmentKey(request, response);
  if (!idempotencyKey) return;
  if (request.body?.confirmation !== "ADJUST_POINTS") {
    return response.status(400).json({
      message: "Explicit points-adjustment confirmation is required.",
      field: "confirmation",
    });
  }
  try {
    const result = await prisma.$transaction((database) =>
      createAdminPointsAdjustment(database, {
        userId,
        actorUserId: request.user.id,
        points: request.body?.points,
        reason: request.body?.reason,
        idempotencyKey,
      })
    );
    return response.status(result.created ? 201 : 200).json(result);
  } catch (error) {
    if (loyaltyErrorResponse(error, response)) return;
    throw error;
  }
}

export async function adjustAdminCustomerWallet(request, response) {
  const userId = requireCustomerId(request, response);
  if (!userId) return;
  const idempotencyKey = requireAdjustmentKey(request, response);
  if (!idempotencyKey) return;
  if (request.body?.confirmation !== "ADJUST_WALLET") {
    return response.status(400).json({
      message: "Explicit wallet-adjustment confirmation is required.",
      field: "confirmation",
    });
  }
  if (
    request.body?.adjustmentType === "REFUND_CREDIT"
    && (typeof request.body?.approvalReference !== "string"
      || request.body.approvalReference.trim().length < 3)
  ) {
    return response.status(400).json({
      message: "An approved refund reference is required for refund credit.",
      field: "approvalReference",
    });
  }
  const reason = request.body?.adjustmentType === "REFUND_CREDIT"
    ? `${request.body.reason ?? ""} [Approval: ${request.body.approvalReference.trim()}]`
    : request.body?.reason;
  try {
    const result = await prisma.$transaction((database) =>
      createAdminWalletAdjustment(database, {
        userId,
        actorUserId: request.user.id,
        amount: request.body?.amount,
        adjustmentType: request.body?.adjustmentType,
        reason,
        idempotencyKey,
      })
    );
    return response.status(result.created ? 201 : 200).json(result);
  } catch (error) {
    if (loyaltyErrorResponse(error, response)) return;
    throw error;
  }
}

export async function getAdminLoyaltySettings(_request, response) {
  const settings = await getLoyaltyProgramSettings();
  return response.json({ settings: serializeLoyaltySettings(settings) });
}

export async function patchAdminLoyaltySettings(request, response) {
  if (request.body?.confirmation !== "UPDATE_LOYALTY_SETTINGS") {
    return response.status(400).json({
      message: "Explicit settings confirmation is required.",
      field: "confirmation",
    });
  }
  const { confirmation: _confirmation, ...patch } = request.body ?? {};
  try {
    const settings = await prisma.$transaction((database) =>
      updateLoyaltyProgramSettings(database, patch)
    );
    return response.json({ settings });
  } catch (error) {
    if (loyaltyErrorResponse(error, response)) return;
    throw error;
  }
}

export async function reverseAdminOrderPoints(request, response) {
  if (!isValidId(request.params.orderId)) {
    return response.status(404).json({ message: "Order not found." });
  }
  if (request.body?.confirmation !== "REVERSE_ORDER_POINTS") {
    return response.status(400).json({
      message: "Explicit points-reversal confirmation is required.",
      field: "confirmation",
    });
  }
  try {
    const result = await prisma.$transaction(async (database) => {
      const order = await database.order.findUnique({ where: { id: request.params.orderId } });
      if (!order) return null;
      if (order.status !== "DELIVERED") {
        throw new LoyaltyError(409, "ORDER_NOT_DELIVERED", "Only a delivered order can have earned points reversed.");
      }
      return reverseDeliveredOrderPoints(
        database,
        order,
        request.user.id,
        request.body?.reason
      );
    });
    if (!result) return response.status(404).json({ message: "Order not found." });
    return response.status(result.created ? 201 : 200).json(result);
  } catch (error) {
    if (loyaltyErrorResponse(error, response)) return;
    throw error;
  }
}
