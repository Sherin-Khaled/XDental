import bcrypt from "bcrypt";
import { prisma } from "../config/db.js";
import {
  AUTH_COOKIE_NAME,
  clearAuthCookie,
  createToken,
  setAuthCookie,
  verifyToken,
} from "../utils/createToken.js";
import {
  createAuthSession,
  revokeAuthSession,
  revokeOtherAuthSessions,
} from "../services/authSession.service.js";
import {
  createNotification,
  deliverNotificationPush,
} from "../services/notification.service.js";
import {
  clinicLocationsInclude,
  replaceUserClinicLocations,
  serializeClinicLocation,
  validateClinicLocationInput,
} from "../services/deliveryOffer.service.js";
import {
  deleteManagedProfileImage,
  storeProfileImage,
  validateProfileImage,
} from "../services/profileImageStorage.service.js";
import { createAnonymizedIdentityHash } from "../services/accountActionRequest.service.js";
import { initializeNewCustomerLoyalty } from "../services/loyalty.service.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BCRYPT_ROUNDS = 12;
const MAX_CLINIC_NAME_LENGTH = 120;
const DEFAULT_CLINIC_SPECIALTY = "General Dentistry";
const CLINIC_SPECIALTIES = new Set([
  DEFAULT_CLINIC_SPECIALTY,
  "Orthodontics",
  "Endodontics",
  "Implantology",
  "Prosthodontics",
  "Oral Surgery",
  "Periodontics",
  "Pediatric Dentistry",
  "Dental Laboratory",
  "Other",
]);

const authUserInclude = {
  clinicLocations: clinicLocationsInclude,
  permissions: {
    select: {
      permission: { select: { key: true } },
    },
  },
};

function normalizeEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function toSafeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role.toLowerCase(),
    customerTier: user.customerTier.toLowerCase(),
    isActive: user.isActive,
    lifecycleState: user.lifecycleState,
    permissions: (user.permissions ?? []).map((row) =>
      typeof row === "string" ? row : row.permission.key
    ),
    phone: user.phone ?? null,
    professionalRole: user.professionalRole ?? null,
    clinicSpecialty: user.clinicSpecialty ?? null,
    clinicName: user.clinicName ?? null,
    profileImageUrl: user.profileImageUrl ?? null,
    clinicLocations: (user.clinicLocations ?? []).map(serializeClinicLocation),
  };
}

function validateCredentials(email, password) {
  if (!email || !EMAIL_PATTERN.test(email)) {
    return "Enter a valid email address.";
  }

  if (typeof password !== "string" || password.length === 0) {
    return "Password is required.";
  }

  return null;
}

export function isLoginEligibleUser(user) {
  return Boolean(
    user?.isActive
    && ["ACTIVE", "DELETION_REQUESTED"].includes(user.lifecycleState)
  );
}

export async function register(request, response) {
  const name = normalizeText(request.body?.name);
  const email = normalizeEmail(request.body?.email);
  const password = request.body?.password;
  const phone = normalizeText(request.body?.phone);
  const professionalRole = normalizeText(request.body?.professionalRole);
  const clinicSpecialty = normalizeText(request.body?.clinicSpecialty);
  const parsedClinicLocations = await validateClinicLocationInput(
    request.body?.clinicLocations
  );

  if (name.length < 2 || name.length > 100) {
    return response.status(400).json({ message: "Name must be between 2 and 100 characters." });
  }

  const credentialsError = validateCredentials(email, password);
  if (credentialsError) {
    return response.status(400).json({ message: credentialsError });
  }

  if (password.length < 8 || password.length > 128) {
    return response.status(400).json({ message: "Password must be between 8 and 128 characters." });
  }

  if (phone.length > 30) {
    return response.status(400).json({ message: "Phone number must be 30 characters or fewer." });
  }

  if (professionalRole.length > 100) {
    return response.status(400).json({ message: "Professional role must be 100 characters or fewer." });
  }

  if (!CLINIC_SPECIALTIES.has(clinicSpecialty)) {
    return response.status(400).json({ message: "Select a valid clinic specialty." });
  }

  if (parsedClinicLocations.error) {
    return response.status(400).json(parsedClinicLocations.error);
  }

  const anonymizedIdentityHash = createAnonymizedIdentityHash(email);
  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [{ email }, { anonymizedIdentityHash }],
    },
    select: { id: true },
  });
  if (existingUser) {
    return response.status(409).json({ message: "An account with this email already exists." });
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  try {
    const result = await prisma.$transaction(async (database) => {
      const user = await database.user.create({
        data: {
          name,
          email,
          passwordHash,
          phone: phone || null,
          professionalRole: professionalRole || null,
          clinicSpecialty,
          clinicLocations: {
            create: parsedClinicLocations.value.map((location, index) => ({
              ...location,
              isDefault: location.isDefault ?? index === 0,
            })),
          },
        },
        include: authUserInclude,
      });
      const session = await createAuthSession(
        { userId: user.id, request },
        database
      );
      const loyalty = await initializeNewCustomerLoyalty(database, user.id);
      return { user, session, loyaltyNotification: loyalty.notification };
    });

    setAuthCookie(response, createToken(result.user.id, result.session.id));
    await deliverNotificationPush(result.loyaltyNotification);
    return response.status(201).json({ user: toSafeUser(result.user) });
  } catch (error) {
    if (error?.code === "P2002") {
      return response.status(409).json({ message: "An account with this email already exists." });
    }
    throw error;
  }
}

export async function login(request, response) {
  const email = normalizeEmail(request.body?.email);
  const password = request.body?.password;
  const credentialsError = validateCredentials(email, password);

  if (credentialsError) {
    return response.status(400).json({ message: credentialsError });
  }

  const user = await prisma.user.findUnique({
    where: { email },
    include: authUserInclude,
  });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return response.status(401).json({ message: "Invalid email or password." });
  }
  if (!isLoginEligibleUser(user)) {
    return response.status(401).json({ message: "Invalid email or password." });
  }

  const session = await createAuthSession({ userId: user.id, request });
  setAuthCookie(response, createToken(user.id, session.id));
  return response.json({ user: toSafeUser(user) });
}

export async function logout(request, response) {
  clearAuthCookie(response);
  const token = request.cookies?.[AUTH_COOKIE_NAME];
  if (token) {
    try {
      const payload = verifyToken(token);
      if (
        typeof payload === "object"
        && typeof payload.sub === "string"
        && typeof payload.sid === "string"
      ) {
        await revokeAuthSession({
          userId: payload.sub,
          sessionId: payload.sid,
          reason: "USER_LOGOUT",
        });
      }
    } catch {
      // Clearing the cookie is still a successful logout for invalid/expired JWTs.
    }
  }
  return response.json({ message: "Signed out successfully." });
}

export function me(request, response) {
  return response.json({ user: toSafeUser(request.user) });
}

export async function updateMe(request, response) {
  const body = request.body ?? {};
  const updates = {};
  let clinicLocations = null;

  if ("name" in body) {
    const name = normalizeText(body.name);
    if (name.length < 2 || name.length > 100) {
      return response.status(400).json({ message: "Name must be between 2 and 100 characters." });
    }
    updates.name = name;
  }

  if ("phone" in body) {
    const phone = normalizeText(body.phone);
    if (phone.length > 30) {
      return response.status(400).json({ message: "Phone number must be 30 characters or fewer." });
    }
    updates.phone = phone || null;
  }

  if ("professionalRole" in body) {
    const professionalRole = normalizeText(body.professionalRole);
    if (professionalRole.length > 100) {
      return response.status(400).json({ message: "Professional role must be 100 characters or fewer." });
    }
    updates.professionalRole = professionalRole || null;
  }

  if ("clinicSpecialty" in body) {
    const clinicSpecialty = normalizeText(body.clinicSpecialty);
    if (!CLINIC_SPECIALTIES.has(clinicSpecialty)) {
      return response.status(400).json({ message: "Select a valid clinic specialty." });
    }
    updates.clinicSpecialty = clinicSpecialty;
  }

  if ("clinicName" in body) {
    if (typeof body.clinicName !== "string") {
      return response.status(400).json({ message: "Clinic name must be text." });
    }
    const clinicName = body.clinicName.trim();
    if (body.clinicName.length > 0 && clinicName.length === 0) {
      return response.status(400).json({ message: "Clinic name cannot contain only spaces." });
    }
    if (clinicName.length > MAX_CLINIC_NAME_LENGTH) {
      return response.status(400).json({
        message: `Clinic name must be ${MAX_CLINIC_NAME_LENGTH} characters or fewer.`,
      });
    }
    updates.clinicName = clinicName || null;
  }

  if ("clinicLocations" in body) {
    const parsedClinicLocations = await validateClinicLocationInput(body.clinicLocations);
    if (parsedClinicLocations.error) {
      return response.status(400).json(parsedClinicLocations.error);
    }
    clinicLocations = parsedClinicLocations.value;
  }

  // Email and role changes are intentionally not supported from this endpoint.
  if (Object.keys(updates).length === 0 && clinicLocations === null) {
    return response.status(400).json({ message: "Provide at least one profile field to update." });
  }

  const user = await prisma.$transaction(async (transaction) => {
    if (Object.keys(updates).length > 0) {
      await transaction.user.update({
        where: { id: request.user.id },
        data: updates,
      });
    }
    if (clinicLocations !== null) {
      await replaceUserClinicLocations(
        transaction,
        request.user.id,
        clinicLocations
      );
    }
    return transaction.user.findUnique({
      where: { id: request.user.id },
      include: authUserInclude,
    });
  });

  return response.json({ user: toSafeUser(user) });
}

export async function uploadProfileImage(request, response) {
  const contentType = request.get("Content-Type")?.split(";", 1)[0].trim().toLowerCase() ?? "";
  const validation = validateProfileImage(request.body, contentType);
  if (validation.error) {
    return response
      .status(validation.error.status)
      .json({ message: validation.error.message });
  }

  const storedImage = await storeProfileImage(request.body, validation.extension);
  let user;
  try {
    user = await prisma.user.update({
      where: { id: request.user.id },
      data: { profileImageUrl: storedImage.publicUrl },
      include: authUserInclude,
    });
  } catch (error) {
    await deleteManagedProfileImage(storedImage.publicUrl).catch(() => {});
    throw error;
  }

  if (
    request.user.profileImageUrl &&
    request.user.profileImageUrl !== storedImage.publicUrl
  ) {
    await deleteManagedProfileImage(request.user.profileImageUrl).catch(() => {});
  }

  return response.json({ user: toSafeUser(user) });
}

export async function changePassword(request, response) {
  const currentPassword = request.body?.currentPassword;
  const newPassword = request.body?.newPassword;

  if (typeof currentPassword !== "string" || currentPassword.length === 0) {
    return response.status(400).json({ message: "Current password is required." });
  }

  if (typeof newPassword !== "string" || newPassword.length < 8 || newPassword.length > 128) {
    return response.status(400).json({ message: "New password must be between 8 and 128 characters." });
  }

  const user = await prisma.user.findUnique({
    where: { id: request.user.id },
    select: { id: true, passwordHash: true },
  });

  if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
    return response.status(401).json({ message: "The current password is incorrect." });
  }

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  const result = await prisma.$transaction(async (database) => {
    await database.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    let currentSession = request.authSession;
    if (!currentSession) {
      currentSession = await createAuthSession(
        { userId: user.id, request },
        database
      );
    }

    const revoked = await revokeOtherAuthSessions(
      {
        userId: user.id,
        currentSessionId: currentSession.id,
        reason: "PASSWORD_CHANGED",
      },
      database
    );
    const notification = await createNotification(
      {
        userId: user.id,
        type: "ACCOUNT",
        title: "Your password was changed",
        body: "Your account password was changed successfully. If this wasn't you, contact support immediately.",
        link: "/account/settings",
        metadata: { securityEvent: "PASSWORD_CHANGED" },
        mandatory: true,
      },
      database
    );
    return { currentSession, notification, revokedCount: revoked.count };
  });

  if (!request.authSession) {
    setAuthCookie(
      response,
      createToken(user.id, result.currentSession.id)
    );
  }
  await deliverNotificationPush(result.notification);
  return response.json({
    message: "Password changed successfully. Other devices were signed out.",
    signedOutOtherSessions: result.revokedCount,
  });
}
