import { createHmac, randomBytes, randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import { prisma } from "../config/db.js";
import { notifyStaff } from "./notification.service.js";

export const ACCOUNT_ACTION_TYPES = Object.freeze(["DEACTIVATION", "DELETION"]);
export const ACCOUNT_ACTION_STATUSES = Object.freeze([
  "PENDING",
  "UNDER_REVIEW",
  "APPROVED",
  "REJECTED",
  "CANCELED",
  "COMPLETED",
]);
export const ACTIVE_ACCOUNT_ACTION_STATUSES = Object.freeze([
  "PENDING",
  "UNDER_REVIEW",
  "APPROVED",
]);
export const ACCOUNT_ACTION_ADMIN_ACTIONS = Object.freeze([
  "UNDER_REVIEW",
  "APPROVE",
  "REJECT",
  "COMPLETE",
  "REACTIVATE",
]);

const CUSTOMER_CREATE_FIELDS = new Set([
  "type",
  "customerReason",
  "customerDetails",
  "confirmation",
]);
const CUSTOMER_CANCEL_FIELDS = new Set(["cancellationReason"]);
const ADMIN_ACTION_FIELDS = new Set([
  "action",
  "customerResponse",
  "adminNote",
  "confirmation",
]);
const ADMIN_INITIATION_FIELDS = new Set([
  "type",
  "customerResponse",
  "adminNote",
  "confirmation",
]);

const STATUS_FROM_ACTION = Object.freeze({
  UNDER_REVIEW: "UNDER_REVIEW",
  APPROVE: "APPROVED",
  REJECT: "REJECTED",
  COMPLETE: "COMPLETED",
});

const ALLOWED_TRANSITIONS = Object.freeze({
  PENDING: new Set(["UNDER_REVIEW", "APPROVED", "REJECTED"]),
  UNDER_REVIEW: new Set(["APPROVED", "REJECTED"]),
  APPROVED: new Set(["COMPLETED"]),
  REJECTED: new Set(),
  CANCELED: new Set(),
  COMPLETED: new Set(),
});

const NOTIFICATION_COPY = {
  en: {
    SUBMITTED: ["Account request submitted", "Your {type} request {number} was submitted for review."],
    UNDER_REVIEW: ["Account request under review", "Your request {number} is now under review."],
    APPROVED: ["Account request approved", "Your request {number} was approved. It has not been completed yet."],
    REJECTED: ["Account request rejected", "Your request {number} was not approved. Open Settings to review the response."],
    CANCELED: ["Account request canceled", "Your request {number} was canceled."],
    COMPLETED: ["Account request completed", "Your request {number} has been completed."],
    REACTIVATED: ["Account reactivated", "Your account has been reactivated. Sign in again to create a new secure session."],
    type: { DEACTIVATION: "account deactivation", DELETION: "account deletion" },
  },
  ar: {
    SUBMITTED: ["تم إرسال طلب الحساب", "تم إرسال طلب {type} رقم {number} للمراجعة."],
    UNDER_REVIEW: ["طلب الحساب قيد المراجعة", "طلبك رقم {number} قيد المراجعة الآن."],
    APPROVED: ["تمت الموافقة على طلب الحساب", "تمت الموافقة على طلبك رقم {number} ولم يكتمل تنفيذه بعد."],
    REJECTED: ["تم رفض طلب الحساب", "لم تتم الموافقة على طلبك رقم {number}. افتح الإعدادات لعرض الرد."],
    CANCELED: ["تم إلغاء طلب الحساب", "تم إلغاء طلبك رقم {number}."],
    COMPLETED: ["اكتمل طلب الحساب", "اكتمل تنفيذ طلبك رقم {number}."],
    REACTIVATED: ["تمت إعادة تفعيل الحساب", "تمت إعادة تفعيل حسابك. سجّل الدخول مرة أخرى لإنشاء جلسة آمنة جديدة."],
    type: { DEACTIVATION: "تعطيل الحساب", DELETION: "حذف الحساب" },
  },
};

export class AccountActionValidationError extends Error {
  constructor(message, { statusCode = 400, field, code } = {}) {
    super(message);
    this.name = "AccountActionValidationError";
    this.statusCode = statusCode;
    this.field = field;
    this.code = code;
  }
}

function cleanOptionalText(value, maximumLength, field) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") {
    throw new AccountActionValidationError(`${field} must be text.`, { field });
  }
  const cleaned = value.replace(/\u0000/g, "").trim();
  if (cleaned.length > maximumLength) {
    throw new AccountActionValidationError(
      `${field} must be ${maximumLength} characters or fewer.`,
      { field }
    );
  }
  return cleaned || null;
}

function assertObjectWithFields(payload, allowedFields) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new AccountActionValidationError("A JSON object is required.");
  }
  const unexpected = Object.keys(payload).find((field) => !allowedFields.has(field));
  if (unexpected) {
    throw new AccountActionValidationError(`Unexpected field: ${unexpected}.`, {
      field: unexpected,
    });
  }
}

export function validateCustomerActionRequestPayload(payload) {
  assertObjectWithFields(payload, CUSTOMER_CREATE_FIELDS);
  const type = String(payload.type ?? "").trim().toUpperCase();
  if (!ACCOUNT_ACTION_TYPES.includes(type)) {
    throw new AccountActionValidationError("Type must be DEACTIVATION or DELETION.", {
      field: "type",
    });
  }
  const expectedConfirmation = type === "DELETION" ? "DELETE" : "DEACTIVATE";
  if (payload.confirmation !== expectedConfirmation) {
    throw new AccountActionValidationError("Explicit confirmation is required.", {
      field: "confirmation",
      code: "CONFIRMATION_REQUIRED",
    });
  }
  return {
    type,
    customerReason: cleanOptionalText(payload.customerReason, 500, "customerReason"),
    customerDetails: cleanOptionalText(payload.customerDetails, 2000, "customerDetails"),
  };
}

export function validateCustomerCancellationPayload(payload = {}) {
  assertObjectWithFields(payload, CUSTOMER_CANCEL_FIELDS);
  return {
    cancellationReason: cleanOptionalText(
      payload.cancellationReason,
      500,
      "cancellationReason"
    ),
  };
}

export function validateAdminActionPayload(payload) {
  assertObjectWithFields(payload, ADMIN_ACTION_FIELDS);
  const action = String(payload.action ?? "").trim().toUpperCase();
  if (!ACCOUNT_ACTION_ADMIN_ACTIONS.includes(action)) {
    throw new AccountActionValidationError("Unsupported account-request action.", {
      field: "action",
    });
  }
  const expectedConfirmation = {
    APPROVE: "APPROVE",
    COMPLETE: "COMPLETE",
    REACTIVATE: "REACTIVATE",
  }[action];
  if (expectedConfirmation && payload.confirmation !== expectedConfirmation) {
    throw new AccountActionValidationError("Explicit confirmation is required.", {
      field: "confirmation",
      code: "CONFIRMATION_REQUIRED",
    });
  }
  const customerResponse = cleanOptionalText(
    payload.customerResponse,
    1000,
    "customerResponse"
  );
  if (action === "REJECT" && !customerResponse) {
    throw new AccountActionValidationError(
      "A customer-visible response is required when rejecting a request.",
      { field: "customerResponse" }
    );
  }
  const adminNote = cleanOptionalText(payload.adminNote, 2000, "adminNote");
  if (["APPROVE", "REJECT", "COMPLETE", "REACTIVATE"].includes(action) && !adminNote) {
    throw new AccountActionValidationError(
      "A private administrative reason is required.",
      { field: "adminNote", code: "ADMIN_REASON_REQUIRED" }
    );
  }
  if (["APPROVE", "COMPLETE", "REACTIVATE"].includes(action) && !customerResponse) {
    throw new AccountActionValidationError(
      "A customer-visible response is required.",
      { field: "customerResponse", code: "CUSTOMER_RESPONSE_REQUIRED" }
    );
  }
  return {
    action,
    customerResponse,
    adminNote,
  };
}

export function validateAdminInitiationPayload(payload) {
  assertObjectWithFields(payload, ADMIN_INITIATION_FIELDS);
  const type = String(payload.type ?? "").trim().toUpperCase();
  if (!ACCOUNT_ACTION_TYPES.includes(type)) {
    throw new AccountActionValidationError("Type must be DEACTIVATION or DELETION.", {
      field: "type",
    });
  }
  const expectedConfirmation = type === "DELETION"
    ? "INITIATE_DELETION"
    : "INITIATE_DEACTIVATION";
  if (payload.confirmation !== expectedConfirmation) {
    throw new AccountActionValidationError("Explicit confirmation is required.", {
      field: "confirmation",
      code: "CONFIRMATION_REQUIRED",
    });
  }
  const customerResponse = cleanOptionalText(
    payload.customerResponse,
    1000,
    "customerResponse"
  );
  const adminNote = cleanOptionalText(payload.adminNote, 2000, "adminNote");
  if (!customerResponse) {
    throw new AccountActionValidationError("A customer-visible response is required.", {
      field: "customerResponse",
      code: "CUSTOMER_RESPONSE_REQUIRED",
    });
  }
  if (!adminNote) {
    throw new AccountActionValidationError("A private administrative reason is required.", {
      field: "adminNote",
      code: "ADMIN_REASON_REQUIRED",
    });
  }
  return { type, customerResponse, adminNote };
}

function publicRequestNumber(now = new Date()) {
  const date = now.toISOString().slice(0, 10).replaceAll("-", "");
  return `AR-${date}-${randomBytes(4).toString("hex").toUpperCase()}`;
}

function languageOf(user) {
  return user?.accountPreference?.language === "AR" ? "ar" : "en";
}

function notificationCopy(event, request, user) {
  const language = languageOf(user);
  const copy = NOTIFICATION_COPY[language];
  const [title, template] = copy[event];
  const body = template
    .replace("{type}", copy.type[request.type])
    .replace("{number}", request.publicRequestNumber);
  return { language, title, body };
}

async function createMandatoryNotification(database, event, request, user) {
  const copy = notificationCopy(event, request, user);
  const notification = await database.notification.create({
    data: {
      userId: request.userId,
      type: "ACCOUNT",
      title: copy.title,
      body: copy.body,
      link: "/account/settings",
      metadata: {
        mandatory: true,
        accountActionEvent: event,
        requestId: request.id,
        requestNumber: request.publicRequestNumber,
      },
    },
  });
  return {
    notification,
    email: {
      recipient: user.email,
      title: copy.title,
      body: copy.body,
      language: copy.language,
    },
  };
}

function cleanStaffIdentity(value) {
  return String(value ?? "Customer")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .trim()
    .slice(0, 120) || "Customer";
}

async function notifyEligibleStaffForAccountRequest(
  database,
  event,
  request,
  user
) {
  const typeLabel =
    request.type === "DELETION" ? "deletion" : "deactivation";
  const submittedAt = new Date(request.submittedAt).toISOString();
  const isCanceled = event === "CANCELED";
  return notifyStaff(
    {
      permissionKey: "ACCOUNT_LIFECYCLE_VIEW",
      dedupeKey: `account-action:${request.id}:${event}`,
      type: "ACCOUNT",
      title: isCanceled
        ? "Account request canceled"
        : "New account request",
      body: isCanceled
        ? `${typeLabel[0].toUpperCase()}${typeLabel.slice(1)} request ${request.publicRequestNumber} was canceled by ${cleanStaffIdentity(user.name)}.`
        : `${typeLabel[0].toUpperCase()}${typeLabel.slice(1)} request ${request.publicRequestNumber} was submitted by ${cleanStaffIdentity(user.name)} on ${submittedAt}.`,
      link: `/admin/account-requests?request=${encodeURIComponent(request.id)}`,
      metadata: {
        mandatory: true,
        accountActionStaffEvent: event,
        requestId: request.id,
        requestNumber: request.publicRequestNumber,
        requestType: request.type,
        submittedAt,
      },
    },
    database
  );
}

function customerRequest(request) {
  return {
    id: request.id,
    publicRequestNumber: request.publicRequestNumber,
    type: request.type,
    status: request.status,
    customerReason: request.customerReason,
    customerDetails: request.customerDetails,
    submittedAt: request.submittedAt,
    updatedAt: request.updatedAt,
    reviewedAt: request.reviewedAt,
    customerResponse: request.customerResponse,
    completedAt: request.completedAt,
    canceledAt: request.canceledAt,
    cancellationReason: request.cancellationReason,
    canCancel: request.status === "PENDING",
  };
}

function adminRequest(request) {
  return {
    ...customerRequest(request),
    reviewerNote: request.reviewerNote,
    completionReference: request.completionReference,
    customer: request.user
      ? {
          id: request.user.id,
          name: request.user.name,
          email: request.user.email,
          isActive: request.user.isActive,
          lifecycleState: request.user.lifecycleState,
        }
      : null,
    reviewedBy: request.reviewedBy
      ? { name: request.reviewedBy.name, email: request.reviewedBy.email }
      : null,
    history: (request.history ?? []).map((entry) => ({
      id: entry.id,
      eventType: entry.eventType,
      previousStatus: entry.previousStatus,
      newStatus: entry.newStatus,
      previousLifecycle: entry.previousLifecycle,
      newLifecycle: entry.newLifecycle,
      actorRole: entry.actorRole,
      actor: entry.actor ? { name: entry.actor.name, email: entry.actor.email } : null,
      customerNote: entry.customerNote,
      adminNote: entry.adminNote,
      createdAt: entry.createdAt,
    })),
  };
}

const userForCommunication = {
  id: true,
  name: true,
  email: true,
  profileImageUrl: true,
  role: true,
  isActive: true,
  lifecycleState: true,
  accountPreference: { select: { language: true } },
};

const adminRequestInclude = {
  user: { select: userForCommunication },
  reviewedBy: { select: { name: true, email: true } },
  history: {
    orderBy: { createdAt: "asc" },
    include: { actor: { select: { name: true, email: true } } },
  },
};

export async function listCustomerAccountActionRequests(userId, database = prisma) {
  const requests = await database.accountActionRequest.findMany({
    where: { userId },
    orderBy: { submittedAt: "desc" },
  });
  return requests.map(customerRequest);
}

export async function getCustomerAccountActionRequest(
  { userId, requestId },
  database = prisma
) {
  const request = await database.accountActionRequest.findFirst({
    where: { id: requestId, userId },
  });
  if (!request) {
    throw new AccountActionValidationError("Account request not found.", {
      statusCode: 404,
      code: "NOT_FOUND",
    });
  }
  return customerRequest(request);
}

export async function createCustomerAccountActionRequest(
  { userId, payload, now = new Date(), requestNumber },
  database = prisma
) {
  const validated = validateCustomerActionRequestPayload(payload);
  try {
    return await database.$transaction(async (transaction) => {
      const user = await transaction.user.findUnique({
        where: { id: userId },
        select: userForCommunication,
      });
      if (!user || user.role !== "CUSTOMER") {
        throw new AccountActionValidationError("Customer account required.", {
          statusCode: 403,
        });
      }
      if (!user.isActive || ["DEACTIVATED", "DELETED"].includes(user.lifecycleState)) {
        throw new AccountActionValidationError("This account cannot submit requests.", {
          statusCode: 409,
          code: "ACCOUNT_INACTIVE",
        });
      }

      const existing = await transaction.accountActionRequest.findFirst({
        where: {
          userId,
          type: validated.type,
          status: { in: ACTIVE_ACCOUNT_ACTION_STATUSES },
        },
        orderBy: { submittedAt: "desc" },
      });
      if (existing) {
        return { request: customerRequest(existing), created: false, communication: null };
      }

      const created = await transaction.accountActionRequest.create({
        data: {
          publicRequestNumber: requestNumber ?? publicRequestNumber(now),
          userId,
          type: validated.type,
          customerReason: validated.customerReason,
          customerDetails: validated.customerDetails,
          submittedAt: now,
          history: {
            create: {
              eventType: "STATUS_CHANGE",
              previousStatus: null,
              newStatus: "PENDING",
              previousLifecycle: user.lifecycleState,
              newLifecycle:
                validated.type === "DELETION"
                  ? "DELETION_REQUESTED"
                  : user.lifecycleState,
              actorUserId: userId,
              actorRole: "CUSTOMER",
              customerNote: validated.customerReason,
            },
          },
        },
      });
      if (validated.type === "DELETION" && user.lifecycleState === "ACTIVE") {
        await transaction.user.update({
          where: { id: userId },
          data: {
            lifecycleState: "DELETION_REQUESTED",
            lifecycleUpdatedAt: now,
          },
        });
      }
      const communication = await createMandatoryNotification(
        transaction,
        "SUBMITTED",
        created,
        user
      );
      await notifyEligibleStaffForAccountRequest(
        transaction,
        "SUBMITTED",
        created,
        user
      );
      return { request: customerRequest(created), created: true, communication };
    });
  } catch (error) {
    if (error?.code === "P2002") {
      const existing = await database.accountActionRequest.findFirst({
        where: {
          userId,
          type: validated.type,
          status: { in: ACTIVE_ACCOUNT_ACTION_STATUSES },
        },
        orderBy: { submittedAt: "desc" },
      });
      if (existing) {
        return { request: customerRequest(existing), created: false, communication: null };
      }
    }
    throw error;
  }
}

export async function cancelCustomerAccountActionRequest(
  { userId, requestId, payload, now = new Date() },
  database = prisma
) {
  const validated = validateCustomerCancellationPayload(payload);
  return database.$transaction(async (transaction) => {
    const request = await transaction.accountActionRequest.findFirst({
      where: { id: requestId, userId },
    });
    if (!request) {
      throw new AccountActionValidationError("Account request not found.", {
        statusCode: 404,
      });
    }
    if (request.status !== "PENDING") {
      throw new AccountActionValidationError(
        "Only pending account requests can be canceled.",
        { statusCode: 409, code: "CANCELLATION_NOT_ALLOWED" }
      );
    }
    const user = await transaction.user.findUnique({
      where: { id: userId },
      select: userForCommunication,
    });
    const nextLifecycle =
      request.type === "DELETION" && user.lifecycleState === "DELETION_REQUESTED"
        ? user.isActive
          ? "ACTIVE"
          : "DEACTIVATED"
        : user.lifecycleState;
    const updated = await transaction.accountActionRequest.update({
      where: { id: request.id },
      data: {
        status: "CANCELED",
        canceledAt: now,
        cancellationReason: validated.cancellationReason,
        history: {
          create: {
            eventType: "STATUS_CHANGE",
            previousStatus: request.status,
            newStatus: "CANCELED",
            previousLifecycle: user.lifecycleState,
            newLifecycle: nextLifecycle,
            actorUserId: userId,
            actorRole: "CUSTOMER",
            customerNote: validated.cancellationReason,
          },
        },
      },
    });
    if (nextLifecycle !== user.lifecycleState) {
      await transaction.user.update({
        where: { id: userId },
        data: { lifecycleState: nextLifecycle, lifecycleUpdatedAt: now },
      });
    }
    const communication = await createMandatoryNotification(
      transaction,
      "CANCELED",
      updated,
      user
    );
    await notifyEligibleStaffForAccountRequest(
      transaction,
      "CANCELED",
      updated,
      user
    );
    return { request: customerRequest(updated), communication };
  });
}

export async function assertAccountRemovalTargetAllowed(
  database,
  { actor, target }
) {
  if (actor.id === target.id) {
    throw new AccountActionValidationError(
      "Administrators cannot remove their own account.",
      { statusCode: 403, code: "SELF_REMOVAL_BLOCKED" }
    );
  }
  if (target.role === "ADMIN") {
    const activeAdmins = await database.user.count({
      where: { role: "ADMIN", isActive: true, lifecycleState: { not: "DELETED" } },
    });
    if (target.isActive && activeAdmins <= 1) {
      throw new AccountActionValidationError(
        "The last active administrator cannot be removed.",
        { statusCode: 409, code: "LAST_ADMIN_PROTECTED" }
      );
    }
  }
  if (target.role !== "CUSTOMER") {
    throw new AccountActionValidationError(
      "This account lifecycle workflow is limited to customer accounts.",
      { statusCode: 403, code: "CUSTOMER_ACCOUNT_REQUIRED" }
    );
  }
}

export async function createAdminManagedAccountActionRequest(
  { userId, actor, payload, now = new Date(), requestNumber },
  database = prisma
) {
  const validated = validateAdminInitiationPayload(payload);
  return database.$transaction(async (transaction) => {
    const user = await transaction.user.findUnique({
      where: { id: userId },
      select: userForCommunication,
    });
    if (!user) {
      throw new AccountActionValidationError("Customer account not found.", {
        statusCode: 404,
      });
    }
    await assertAccountRemovalTargetAllowed(transaction, { actor, target: user });
    if (user.lifecycleState === "DELETED") {
      throw new AccountActionValidationError(
        "Completed deletion is irreversible.",
        { statusCode: 409, code: "DELETION_IRREVERSIBLE" }
      );
    }
    if (
      validated.type === "DEACTIVATION"
      && (!user.isActive || user.lifecycleState !== "ACTIVE")
    ) {
      throw new AccountActionValidationError(
        "Only an active customer account can start deactivation.",
        { statusCode: 409, code: "INVALID_DEACTIVATION_STATE" }
      );
    }
    if (
      validated.type === "DELETION"
      && !["ACTIVE", "DEACTIVATED", "DELETION_REQUESTED"].includes(user.lifecycleState)
    ) {
      throw new AccountActionValidationError(
        "This customer account cannot start deletion.",
        { statusCode: 409, code: "INVALID_DELETION_STATE" }
      );
    }

    const existing = await transaction.accountActionRequest.findFirst({
      where: {
        userId,
        type: validated.type,
        status: { in: ACTIVE_ACCOUNT_ACTION_STATUSES },
      },
      orderBy: { submittedAt: "desc" },
    });
    if (existing) {
      return {
        request: await getAdminAccountActionRequest(existing.id, transaction),
        created: false,
        communication: null,
      };
    }

    const nextLifecycle = validated.type === "DELETION"
      ? "DELETION_REQUESTED"
      : user.lifecycleState;
    const created = await transaction.accountActionRequest.create({
      data: {
        publicRequestNumber: requestNumber ?? publicRequestNumber(now),
        userId,
        type: validated.type,
        submittedAt: now,
        customerResponse: validated.customerResponse,
        reviewerNote: validated.adminNote,
        history: {
          create: {
            eventType: "STATUS_CHANGE",
            previousStatus: null,
            newStatus: "PENDING",
            previousLifecycle: user.lifecycleState,
            newLifecycle: nextLifecycle,
            actorUserId: actor.id,
            actorRole: actor.role.toUpperCase(),
            customerNote: validated.customerResponse,
            adminNote: validated.adminNote,
          },
        },
      },
    });
    if (nextLifecycle !== user.lifecycleState) {
      await transaction.user.update({
        where: { id: userId },
        data: { lifecycleState: nextLifecycle, lifecycleUpdatedAt: now },
      });
    }
    const communication = await createMandatoryNotification(
      transaction,
      "SUBMITTED",
      created,
      user
    );
    return {
      request: await getAdminAccountActionRequest(created.id, transaction),
      created: true,
      communication,
    };
  });
}

export async function listAdminAccountActionRequests(
  { search, type, status } = {},
  database = prisma
) {
  const requests = await database.accountActionRequest.findMany({
    where: {
      ...(ACCOUNT_ACTION_TYPES.includes(type) ? { type } : {}),
      ...(ACCOUNT_ACTION_STATUSES.includes(status) ? { status } : {}),
      ...(search
        ? {
            OR: [
              { publicRequestNumber: { contains: search, mode: "insensitive" } },
              { user: { name: { contains: search, mode: "insensitive" } } },
              { user: { email: { contains: search, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    include: adminRequestInclude,
    orderBy: { submittedAt: "desc" },
    take: 300,
  });
  return requests.map(adminRequest);
}

export async function countAdminAccountActionRequestsNeedingAttention(
  database = prisma
) {
  return database.accountActionRequest.count({
    where: {
      status: { in: ACTIVE_ACCOUNT_ACTION_STATUSES },
    },
  });
}

export async function getAdminAccountActionRequest(requestId, database = prisma) {
  const request = await database.accountActionRequest.findUnique({
    where: { id: requestId },
    include: adminRequestInclude,
  });
  if (!request) {
    throw new AccountActionValidationError("Account request not found.", {
      statusCode: 404,
    });
  }
  return adminRequest(request);
}

export function createAnonymizedIdentityHash(email, secret = process.env.JWT_SECRET) {
  if (!secret) throw new Error("JWT_SECRET is required for account anonymization.");
  return createHmac("sha256", secret)
    .update(`x-dental-deleted-email:v1:${String(email).trim().toLowerCase()}`)
    .digest("hex");
}

export async function processAdminAccountAction(
  { requestId, actor, payload, now = new Date(), environment = process.env },
  database = prisma
) {
  const validated = validateAdminActionPayload(payload);
  return database.$transaction(async (transaction) => {
    const request = await transaction.accountActionRequest.findUnique({
      where: { id: requestId },
      include: { user: { select: userForCommunication } },
    });
    if (!request) {
      throw new AccountActionValidationError("Account request not found.", {
        statusCode: 404,
      });
    }
    const user = request.user;
    await assertAccountRemovalTargetAllowed(transaction, { actor, target: user });
    if (user.lifecycleState === "DELETED") {
      throw new AccountActionValidationError(
        "Completed deletion is irreversible.",
        { statusCode: 409, code: "DELETION_IRREVERSIBLE" }
      );
    }

    if (validated.action === "REACTIVATE") {
      if (
        request.type !== "DEACTIVATION"
        || request.status !== "COMPLETED"
        || user.lifecycleState !== "DEACTIVATED"
      ) {
        throw new AccountActionValidationError(
          "Only a completed deactivation can be reactivated.",
          { statusCode: 409, code: "INVALID_REACTIVATION" }
        );
      }
      await transaction.user.update({
        where: { id: user.id },
        data: {
          isActive: true,
          lifecycleState: "ACTIVE",
          lifecycleUpdatedAt: now,
        },
      });
      await transaction.accountActionRequestHistory.create({
        data: {
          requestId: request.id,
          eventType: "REACTIVATED",
          previousStatus: request.status,
          newStatus: request.status,
          previousLifecycle: "DEACTIVATED",
          newLifecycle: "ACTIVE",
          actorUserId: actor.id,
          actorRole: actor.role.toUpperCase(),
          customerNote: validated.customerResponse,
          adminNote: validated.adminNote,
          createdAt: now,
        },
      });
      const communication = await createMandatoryNotification(
        transaction,
        "REACTIVATED",
        request,
        user
      );
      return {
        request: await getAdminAccountActionRequest(request.id, transaction),
        communication,
      };
    }

    const nextStatus = STATUS_FROM_ACTION[validated.action];
    if (!ALLOWED_TRANSITIONS[request.status].has(nextStatus)) {
      throw new AccountActionValidationError(
        `Cannot change ${request.status} to ${nextStatus}.`,
        { statusCode: 409, code: "INVALID_TRANSITION" }
      );
    }

    let nextLifecycle = user.lifecycleState;
    let completionReference = request.completionReference;
    let profileImageUrlToDelete = null;
    const requestData = {
      status: nextStatus,
      reviewedAt: now,
      reviewedByUserId: actor.id,
      ...(validated.customerResponse !== null
        ? { customerResponse: validated.customerResponse }
        : {}),
      ...(validated.adminNote !== null ? { reviewerNote: validated.adminNote } : {}),
    };

    if (nextStatus === "REJECTED" && request.type === "DELETION") {
      nextLifecycle = user.isActive ? "ACTIVE" : "DEACTIVATED";
      await transaction.user.update({
        where: { id: user.id },
        data: { lifecycleState: nextLifecycle, lifecycleUpdatedAt: now },
      });
    }

    if (nextStatus === "COMPLETED") {
      completionReference = randomUUID();
      requestData.completedAt = now;
      requestData.completionReference = completionReference;
      if (request.type === "DEACTIVATION") {
        nextLifecycle = "DEACTIVATED";
        await transaction.user.update({
          where: { id: user.id },
          data: {
            isActive: false,
            lifecycleState: "DEACTIVATED",
            lifecycleUpdatedAt: now,
          },
        });
        await transaction.authSession.updateMany({
          where: { userId: user.id, revokedAt: null },
          data: { revokedAt: now, revocationReason: "ACCOUNT_DEACTIVATED" },
        });
      } else {
        nextLifecycle = "DELETED";
        profileImageUrlToDelete = user.profileImageUrl;
        const anonymizedIdentityHash = createAnonymizedIdentityHash(
          user.email,
          environment.JWT_SECRET
        );
        const unusablePasswordHash = await bcrypt.hash(
          randomBytes(32).toString("hex"),
          12
        );
        await transaction.authSession.updateMany({
          where: { userId: user.id, revokedAt: null },
          data: { revokedAt: now, revocationReason: "ACCOUNT_DELETED" },
        });
        await transaction.pushSubscription.deleteMany({ where: { userId: user.id } });
        await transaction.userClinicLocation.deleteMany({ where: { userId: user.id } });
        await transaction.newsletterSubscriber.deleteMany({
          where: { email: user.email.toLowerCase() },
        });
        await transaction.user.update({
          where: { id: user.id },
          data: {
            name: "Deleted customer",
            email: `deleted-${completionReference}@anonymized.invalid`,
            passwordHash: unusablePasswordHash,
            phone: null,
            professionalRole: null,
            clinicSpecialty: null,
            clinicName: null,
            profileImageUrl: null,
            isActive: false,
            lifecycleState: "DELETED",
            lifecycleUpdatedAt: now,
            anonymizedIdentityHash,
          },
        });
      }
    }

    const updated = await transaction.accountActionRequest.update({
      where: { id: request.id },
      data: requestData,
    });
    await transaction.accountActionRequestHistory.create({
      data: {
        requestId: request.id,
        eventType: "STATUS_CHANGE",
        previousStatus: request.status,
        newStatus: nextStatus,
        previousLifecycle: user.lifecycleState,
        newLifecycle: nextLifecycle,
        actorUserId: actor.id,
        actorRole: actor.role.toUpperCase(),
        customerNote: validated.customerResponse,
        adminNote: validated.adminNote,
        createdAt: now,
      },
    });
    const communication = await createMandatoryNotification(
      transaction,
      nextStatus,
      updated,
      user
    );
    return {
      request: await getAdminAccountActionRequest(updated.id, transaction),
      communication,
      profileImageUrlToDelete,
    };
  });
}
