import { prisma } from "../config/db.js";
import {
  AUTH_COOKIE_NAME,
  clearAuthCookie,
  verifyToken,
} from "../utils/createToken.js";
import { resolveTrackedSession } from "../services/authSession.service.js";

export function clearAuthCookieOnFailure(_request, response, next) {
  const sendJson = response.json.bind(response);
  response.json = (body) => {
    if (response.statusCode >= 400) {
      clearAuthCookie(response);
    }
    return sendJson(body);
  };
  return next();
}

export async function requireAuth(request, response, next) {
  const token = request.cookies?.[AUTH_COOKIE_NAME];

  if (!token) {
    return response.status(401).json({ message: "Authentication required." });
  }

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    return response.status(401).json({ message: "Invalid or expired session." });
  }

  if (typeof payload !== "object" || typeof payload.sub !== "string") {
    return response.status(401).json({ message: "Invalid or expired session." });
  }

  const resolvedSession = await resolveTrackedSession({ payload });
  if (!resolvedSession) {
    return response.status(401).json({ message: "Invalid or expired session." });
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      professionalRole: true,
      clinicSpecialty: true,
      clinicName: true,
      profileImageUrl: true,
      clinicLocations: {
        include: {
          deliveryZone: true,
        },
      },
      role: true,
      customerTier: true,
      isActive: true,
      lifecycleState: true,
      permissions: {
        select: {
          permission: { select: { key: true } },
        },
      },
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!user) {
    return response.status(401).json({ message: "Invalid or expired session." });
  }
  if (
    !user.isActive
    || !["ACTIVE", "DELETION_REQUESTED"].includes(user.lifecycleState)
  ) {
    return response.status(401).json({ message: "Invalid or expired session." });
  }

  request.user = {
    ...user,
    role: user.role.toLowerCase(),
    customerTier: user.customerTier.toLowerCase(),
    permissions: user.permissions.map(({ permission }) => permission.key),
  };
  request.authSession = resolvedSession.session;
  request.legacySession = resolvedSession.legacy;
  return next();
}

/**
 * Attaches request.user when a valid session cookie is present, but never
 * rejects the request. Used by public endpoints (e.g. contact form) that
 * optionally associate submissions with a signed-in customer.
 */
export async function attachUserIfAuthenticated(request, _response, next) {
  const token = request.cookies?.[AUTH_COOKIE_NAME];
  if (!token) return next();

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    return next();
  }

  if (typeof payload !== "object" || typeof payload.sub !== "string") {
    return next();
  }

  const resolvedSession = await resolveTrackedSession({ payload });
  if (!resolvedSession) return next();

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      customerTier: true,
      isActive: true,
      lifecycleState: true,
    },
  });
  if (
    user?.isActive
    && ["ACTIVE", "DELETION_REQUESTED"].includes(user.lifecycleState)
  ) {
    request.user = {
      ...user,
      role: user.role.toLowerCase(),
      customerTier: user.customerTier.toLowerCase(),
    };
    request.authSession = resolvedSession.session;
    request.legacySession = resolvedSession.legacy;
  }

  return next();
}
