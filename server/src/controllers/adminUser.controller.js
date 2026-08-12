import bcrypt from "bcrypt";
import { prisma } from "../config/db.js";
import {
  PERMISSION_GROUPS,
  PERMISSION_KEYS,
  PERMISSION_PRESETS,
  invalidPermissionKeys,
  normalizePermissionKeys,
  replaceUserPermissions,
} from "../services/permission.service.js";
import { ensureLoyaltyAccount } from "../services/loyalty.service.js";
import { getBenefitLifecycle, serializeBenefit } from "../services/customerBenefit.service.js";
import { createAnonymizedIdentityHash } from "../services/accountActionRequest.service.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BCRYPT_ROUNDS = 12;
const USER_ROLES = new Set(["CUSTOMER", "SUPPORT", "ADMIN"]);
const CUSTOMER_TIERS = new Set(["STANDARD", "VIP"]);
const BENEFIT_TYPES = new Set([
  "FREE_SHIPPING",
  "PERCENTAGE_DISCOUNT",
  "FIXED_DISCOUNT",
  "PROMO_CODE",
  "CUSTOM",
]);

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEmail(value) {
  return normalizeText(value).toLowerCase();
}

function normalizeUpper(value) {
  return normalizeText(value).toUpperCase();
}

function serializeUser(user) {
  const permissionRows = user.permissions ?? [];
  const benefits = user.customerBenefits ?? [];
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone ?? null,
    role: user.role.toLowerCase(),
    customerTier: user.customerTier.toLowerCase(),
    isActive: user.isActive,
    lifecycleState: user.lifecycleState,
    lifecycleRequests: (user.accountActionRequests ?? []).map((accountRequest) => ({
      id: accountRequest.id,
      publicRequestNumber: accountRequest.publicRequestNumber,
      type: accountRequest.type,
      status: accountRequest.status,
      submittedAt: accountRequest.submittedAt,
      completedAt: accountRequest.completedAt,
    })),
    permissions: permissionRows.map(({ permission }) => permission.key),
    permissionsUpdatedAt: user.permissionsUpdatedAt,
    permissionsUpdatedBy: user.permissionsUpdatedBy ?? null,
    activeBenefitCount: benefits.filter((benefit) => getBenefitLifecycle(benefit) === "ACTIVE").length,
    benefits: benefits.map(serializeBenefit),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    orderCount: user._count?.orders ?? 0,
    productRequestCount: user._count?.productRequests ?? 0,
  };
}

const safeUserSelection = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  customerTier: true,
  isActive: true,
  lifecycleState: true,
  permissionsUpdatedAt: true,
  permissionsUpdatedBy: { select: { id: true, name: true, email: true } },
  createdAt: true,
  updatedAt: true,
  permissions: {
    select: {
      updatedAt: true,
      permission: { select: { key: true } },
      grantedBy: { select: { id: true, name: true, email: true } },
    },
  },
  customerBenefits: {
    orderBy: { createdAt: "desc" },
  },
  accountActionRequests: {
    orderBy: { submittedAt: "desc" },
    take: 20,
    select: {
      id: true,
      publicRequestNumber: true,
      type: true,
      status: true,
      submittedAt: true,
      completedAt: true,
    },
  },
  _count: {
    select: {
      orders: true,
      productRequests: true,
    },
  },
};

async function findManagedUser(id) {
  return prisma.user.findUnique({ where: { id }, select: safeUserSelection });
}

function parseOptionalMoney(value, field) {
  if (value === null || value === undefined || value === "") return { value: null };
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return { error: `${field} must be a non-negative number.`, field };
  }
  return { value: parsed };
}

function parseOptionalDate(value, field) {
  if (!value) return { value: null };
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return { error: `${field} must be a valid date.`, field };
  return { value: parsed };
}

function parseBenefitInput(body, { partial = false } = {}) {
  const type = normalizeUpper(body?.type);
  const titleEn = normalizeText(body?.titleEn);
  const titleAr = normalizeText(body?.titleAr);
  if (!partial || body?.type !== undefined) {
    if (!BENEFIT_TYPES.has(type)) return { error: "Unsupported benefit type.", field: "type" };
  }
  if (!partial || body?.titleEn !== undefined) {
    if (titleEn.length < 2 || titleEn.length > 120) return { error: "English title must be 2–120 characters.", field: "titleEn" };
  }
  if (!partial || body?.titleAr !== undefined) {
    if (titleAr.length < 2 || titleAr.length > 120) return { error: "Arabic title must be 2–120 characters.", field: "titleAr" };
  }

  const discountPercent = parseOptionalMoney(body?.discountPercent, "discountPercent");
  const discountAmount = parseOptionalMoney(body?.discountAmount, "discountAmount");
  const minimumOrderAmount = parseOptionalMoney(body?.minimumOrderAmount, "minimumOrderAmount");
  const startsAt = parseOptionalDate(body?.startsAt, "startsAt");
  const endsAt = parseOptionalDate(body?.endsAt, "endsAt");
  const invalid = [discountPercent, discountAmount, minimumOrderAmount, startsAt, endsAt].find((value) => value.error);
  if (invalid) return invalid;
  if (discountPercent.value !== null && discountPercent.value > 100) {
    return { error: "discountPercent cannot exceed 100.", field: "discountPercent" };
  }
  if (startsAt.value && endsAt.value && endsAt.value <= startsAt.value) {
    return { error: "End date must be after start date.", field: "endsAt" };
  }

  const data = {};
  const assign = (key, value) => {
    if (!partial || body?.[key] !== undefined) data[key] = value;
  };
  assign("type", type);
  assign("titleEn", titleEn);
  assign("titleAr", titleAr);
  assign("descriptionEn", normalizeText(body?.descriptionEn) || null);
  assign("descriptionAr", normalizeText(body?.descriptionAr) || null);
  assign("discountPercent", discountPercent.value);
  assign("discountAmount", discountAmount.value);
  assign("promoCode", normalizeUpper(body?.promoCode) || null);
  assign("minimumOrderAmount", minimumOrderAmount.value);
  assign("startsAt", startsAt.value);
  assign("endsAt", endsAt.value);
  return { data };
}

export async function getAdminUsers(request, response) {
  const search = normalizeText(request.query?.search).slice(0, 100);
  const role = normalizeUpper(request.query?.role);
  const tier = normalizeUpper(request.query?.tier);
  if (role && !USER_ROLES.has(role)) return response.status(400).json({ message: "Invalid role." });
  if (tier && !CUSTOMER_TIERS.has(tier)) return response.status(400).json({ message: "Invalid customer tier." });

  const users = await prisma.user.findMany({
    where: {
      ...(role ? { role } : {}),
      ...(tier ? { role: "CUSTOMER", customerTier: tier } : {}),
      ...(search
        ? { OR: [{ name: { contains: search, mode: "insensitive" } }, { email: { contains: search, mode: "insensitive" } }] }
        : {}),
    },
    select: safeUserSelection,
    orderBy: { createdAt: "desc" },
  });
  return response.json({ users: users.map(serializeUser) });
}

export async function getAdminUser(request, response) {
  const user = await findManagedUser(request.params.id);
  return user
    ? response.json({ user: serializeUser(user) })
    : response.status(404).json({ message: "User not found." });
}

export async function getPermissionCatalog(_request, response) {
  return response.json({
    permissions: PERMISSION_KEYS,
    groups: PERMISSION_GROUPS,
    presets: PERMISSION_PRESETS,
  });
}

export async function createAdminUser(request, response) {
  const name = normalizeText(request.body?.name);
  const email = normalizeEmail(request.body?.email);
  const phone = normalizeText(request.body?.phone);
  const password = request.body?.password;
  const role = normalizeUpper(request.body?.role);
  const requestedTier = normalizeUpper(request.body?.customerTier) || "STANDARD";
  const permissions = normalizePermissionKeys(request.body?.permissions);

  if (name.length < 2 || name.length > 100) return response.status(400).json({ message: "Name must be between 2 and 100 characters.", field: "name" });
  if (!email || !EMAIL_PATTERN.test(email)) return response.status(400).json({ message: "Enter a valid email address.", field: "email" });
  if (typeof password !== "string" || password.length < 8 || password.length > 128) return response.status(400).json({ message: "Password must be between 8 and 128 characters.", field: "password" });
  if (phone.length > 30) return response.status(400).json({ message: "Phone number must be 30 characters or fewer.", field: "phone" });
  if (!USER_ROLES.has(role)) return response.status(400).json({ message: "Invalid role.", field: "role" });
  if (role === "CUSTOMER" && !CUSTOMER_TIERS.has(requestedTier)) return response.status(400).json({ message: "Invalid customer tier.", field: "customerTier" });
  if (role !== "CUSTOMER" && requestedTier !== "STANDARD") return response.status(400).json({ message: "Only customer accounts may be VIP.", field: "customerTier" });
  if (role !== "SUPPORT" && permissions.length) return response.status(400).json({ message: "Only support accounts may receive support permissions.", field: "permissions" });
  const invalidPermissions = invalidPermissionKeys(permissions);
  if (invalidPermissions.length) return response.status(400).json({ message: `Unsupported permission key: ${invalidPermissions[0]}`, field: "permissions" });
  const existingIdentity = await prisma.user.findFirst({
    where: {
      OR: [
        { email },
        { anonymizedIdentityHash: createAnonymizedIdentityHash(email) },
      ],
    },
    select: { id: true },
  });
  if (existingIdentity) {
    return response.status(409).json({
      message: "An account with this email already exists.",
      field: "email",
    });
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  try {
    const userId = await prisma.$transaction(async (database) => {
      const user = await database.user.create({
        data: {
          name,
          email,
          phone: phone || null,
          passwordHash,
          role,
          customerTier: role === "CUSTOMER" ? requestedTier : "STANDARD",
        },
        select: { id: true },
      });
      if (role === "CUSTOMER") {
        // Administrative account creation is not a public-signup reward event.
        await ensureLoyaltyAccount(database, user.id);
      }
      if (role === "SUPPORT") await replaceUserPermissions(database, user.id, permissions, request.user.id);
      return user.id;
    });
    const user = await findManagedUser(userId);
    return response.status(201).json({ user: serializeUser(user) });
  } catch (error) {
    if (error?.code === "P2002") return response.status(409).json({ message: "An account with this email already exists.", field: "email" });
    if (error?.statusCode) return response.status(error.statusCode).json({ message: error.message, field: error.field });
    throw error;
  }
}

export async function updateCustomerTier(request, response) {
  const customerTier = normalizeUpper(request.body?.customerTier);
  if (!CUSTOMER_TIERS.has(customerTier)) return response.status(400).json({ message: "Invalid customer tier.", field: "customerTier" });
  const target = await prisma.user.findUnique({ where: { id: request.params.id }, select: { id: true, role: true, lifecycleState: true } });
  if (!target) return response.status(404).json({ message: "User not found." });
  if (target.role !== "CUSTOMER") return response.status(400).json({ message: "Only customer accounts may have a customer tier." });
  if (target.lifecycleState === "DELETED") return response.status(409).json({ message: "Deleted accounts cannot be changed." });
  await prisma.user.update({ where: { id: target.id }, data: { customerTier } });
  return response.json({ user: serializeUser(await findManagedUser(target.id)) });
}

export async function replaceSupportPermissions(request, response) {
  const target = await prisma.user.findUnique({ where: { id: request.params.id }, select: { id: true, role: true } });
  if (!target) return response.status(404).json({ message: "User not found." });
  if (target.role !== "SUPPORT") return response.status(400).json({ message: "Only support accounts may receive support permissions." });
  try {
    await prisma.$transaction((database) =>
      replaceUserPermissions(database, target.id, request.body?.permissions, request.user.id)
    );
    return response.json({ user: serializeUser(await findManagedUser(target.id)) });
  } catch (error) {
    if (error?.statusCode) return response.status(error.statusCode).json({ message: error.message, field: error.field });
    throw error;
  }
}

export async function updateUserStatus(request, response) {
  if (typeof request.body?.isActive !== "boolean") return response.status(400).json({ message: "isActive must be a boolean.", field: "isActive" });
  const target = await prisma.user.findUnique({
    where: { id: request.params.id },
    select: { id: true, role: true, lifecycleState: true },
  });
  if (!target) return response.status(404).json({ message: "User not found." });
  if (target.role === "ADMIN") return response.status(403).json({ message: "Admin account status cannot be changed here." });
  if (target.role === "CUSTOMER" && request.body.isActive === false) {
    return response.status(409).json({
      message: "Use the audited account lifecycle request workflow to deactivate customers.",
    });
  }
  if (
    request.body.isActive
    && target.role === "CUSTOMER"
    && target.lifecycleState === "DEACTIVATED"
  ) {
    return response.status(409).json({
      message: "Reactivate this customer from the completed account request so the action is audited.",
    });
  }
  if (request.body.isActive && target.lifecycleState === "DELETED") {
    return response.status(409).json({ message: "Deleted accounts cannot be reactivated." });
  }
  const now = new Date();
  await prisma.$transaction(async (database) => {
    await database.user.update({
      where: { id: target.id },
      data: {
        isActive: request.body.isActive,
        ...(target.role === "CUSTOMER" && !request.body.isActive
          ? { lifecycleState: "DEACTIVATED", lifecycleUpdatedAt: now }
          : {}),
      },
    });
    if (!request.body.isActive) {
      await database.authSession.updateMany({
        where: { userId: target.id, revokedAt: null },
        data: { revokedAt: now, revocationReason: "ADMIN_DEACTIVATED" },
      });
    }
  });
  return response.json({ user: serializeUser(await findManagedUser(target.id)) });
}

export async function createCustomerBenefit(request, response) {
  const target = await prisma.user.findUnique({ where: { id: request.params.id }, select: { id: true, role: true, customerTier: true, lifecycleState: true } });
  if (!target) return response.status(404).json({ message: "User not found." });
  if (target.role !== "CUSTOMER" || target.customerTier !== "VIP") return response.status(400).json({ message: "Benefits can only be assigned to VIP customers." });
  if (target.lifecycleState === "DELETED") return response.status(409).json({ message: "Deleted accounts cannot manage benefits." });
  const parsed = parseBenefitInput(request.body);
  if (parsed.error) return response.status(400).json({ message: parsed.error, field: parsed.field });
  const benefit = await prisma.customerBenefit.create({
    data: { ...parsed.data, userId: target.id, createdById: request.user.id },
  });
  return response.status(201).json({ benefit: serializeBenefit(benefit) });
}

export async function updateCustomerBenefit(request, response) {
  const existing = await prisma.customerBenefit.findUnique({ where: { id: request.params.benefitId }, select: { id: true, userId: true, revokedAt: true, user: { select: { lifecycleState: true } } } });
  if (!existing || existing.userId !== request.params.id) return response.status(404).json({ message: "Benefit not found." });
  if (existing.user.lifecycleState === "DELETED") return response.status(409).json({ message: "Deleted accounts cannot manage benefits." });
  if (existing.revokedAt) return response.status(409).json({ message: "Revoked benefits cannot be edited." });
  const parsed = parseBenefitInput(request.body, { partial: true });
  if (parsed.error) return response.status(400).json({ message: parsed.error, field: parsed.field });
  const benefit = await prisma.customerBenefit.update({ where: { id: existing.id }, data: parsed.data });
  return response.json({ benefit: serializeBenefit(benefit) });
}

export async function updateCustomerBenefitLifecycle(request, response) {
  const action = normalizeUpper(request.body?.action);
  const existing = await prisma.customerBenefit.findUnique({ where: { id: request.params.benefitId }, select: { id: true, userId: true, revokedAt: true, user: { select: { lifecycleState: true } } } });
  if (!existing || existing.userId !== request.params.id) return response.status(404).json({ message: "Benefit not found." });
  if (existing.user.lifecycleState === "DELETED") return response.status(409).json({ message: "Deleted accounts cannot manage benefits." });
  if (existing.revokedAt) return response.status(409).json({ message: "Revoked benefits cannot be changed." });
  let data;
  if (action === "PAUSE") data = { isActive: false, pausedAt: new Date() };
  else if (action === "REACTIVATE") data = { isActive: true, pausedAt: null };
  else if (action === "REVOKE") data = { isActive: false, revokedAt: new Date(), revokedById: request.user.id };
  else return response.status(400).json({ message: "Action must be pause, reactivate, or revoke.", field: "action" });
  const benefit = await prisma.customerBenefit.update({ where: { id: existing.id }, data });
  return response.json({ benefit: serializeBenefit(benefit) });
}
