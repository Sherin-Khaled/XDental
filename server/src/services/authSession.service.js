import { createHash, randomBytes } from "node:crypto";
import { prisma } from "../config/db.js";
import { SESSION_DURATION_MS } from "../utils/createToken.js";

const LAST_SEEN_WRITE_INTERVAL_MS = 15 * 60 * 1000;

function clean(value, maxLength) {
  return typeof value === "string"
    ? value.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, maxLength)
    : "";
}

export function summarizeUserAgent(userAgent) {
  const value = clean(userAgent, 500);
  if (!value) return "Unknown browser";

  const browser = /Edg\//.test(value)
    ? "Microsoft Edge"
    : /Firefox\//.test(value)
      ? "Firefox"
      : /Chrome\//.test(value)
        ? "Chrome"
        : /Safari\//.test(value)
          ? "Safari"
          : "Web browser";
  const device = /Android/i.test(value)
    ? "Android"
    : /iPhone|iPad/i.test(value)
      ? "iPhone or iPad"
      : /Windows/i.test(value)
        ? "Windows"
        : /Mac OS X|Macintosh/i.test(value)
          ? "macOS"
          : /Linux/i.test(value)
            ? "Linux"
            : "unknown device";
  return `${browser} on ${device}`;
}

function hashIpAddress(value, secret) {
  const ipAddress = clean(value, 100);
  if (!ipAddress || !secret) return null;
  return createHash("sha256").update(`${secret}:${ipAddress}`).digest("hex");
}

export function sessionMetadataFromRequest(request, environment = process.env) {
  return {
    deviceSummary: summarizeUserAgent(request.get?.("user-agent") ?? request.headers?.["user-agent"]),
    ipAddressHash: hashIpAddress(
      request.ip ?? request.socket?.remoteAddress,
      environment.JWT_SECRET
    ),
  };
}

export async function createAuthSession(
  { userId, request, now = new Date(), environment = process.env },
  database = prisma
) {
  return database.authSession.create({
    data: {
      id: randomBytes(32).toString("base64url"),
      userId,
      ...sessionMetadataFromRequest(request, environment),
      createdAt: now,
      lastSeenAt: now,
      expiresAt: new Date(now.getTime() + SESSION_DURATION_MS),
    },
  });
}

export function serializeAuthSession(session, currentSessionId) {
  return {
    id: session.id,
    isCurrent: session.id === currentSessionId,
    deviceSummary: session.deviceSummary,
    createdAt: session.createdAt,
    lastSeenAt: session.lastSeenAt,
    expiresAt: session.expiresAt,
  };
}

export async function listActiveAuthSessions(
  { userId, currentSessionId, now = new Date() },
  database = prisma
) {
  const sessions = await database.authSession.findMany({
    where: {
      userId,
      revokedAt: null,
      expiresAt: { gt: now },
    },
    orderBy: { lastSeenAt: "desc" },
  });
  return sessions.map((session) => serializeAuthSession(session, currentSessionId));
}

export async function revokeAuthSession(
  { userId, sessionId, reason = "USER_REVOKED", now = new Date() },
  database = prisma
) {
  return database.authSession.updateMany({
    where: {
      id: sessionId,
      userId,
      revokedAt: null,
    },
    data: {
      revokedAt: now,
      revocationReason: reason,
    },
  });
}

export async function revokeOtherAuthSessions(
  { userId, currentSessionId, reason = "LOGOUT_OTHERS", now = new Date() },
  database = prisma
) {
  if (!currentSessionId) {
    throw new Error("A tracked current session is required.");
  }
  return database.authSession.updateMany({
    where: {
      userId,
      id: { not: currentSessionId },
      revokedAt: null,
      expiresAt: { gt: now },
    },
    data: {
      revokedAt: now,
      revocationReason: reason,
    },
  });
}

export function legacySessionIsAllowed(environment = process.env) {
  return environment.NODE_ENV !== "production";
}

export async function resolveTrackedSession(
  { payload, now = new Date(), environment = process.env },
  database = prisma
) {
  if (typeof payload?.sid !== "string" || !payload.sid) {
    return legacySessionIsAllowed(environment)
      ? { session: null, legacy: true }
      : null;
  }

  const session = await database.authSession.findFirst({
    where: {
      id: payload.sid,
      userId: payload.sub,
      revokedAt: null,
      expiresAt: { gt: now },
    },
  });
  if (!session) return null;

  if (now.getTime() - session.lastSeenAt.getTime() >= LAST_SEEN_WRITE_INTERVAL_MS) {
    await database.authSession.updateMany({
      where: {
        id: session.id,
        userId: payload.sub,
        revokedAt: null,
        lastSeenAt: {
          lt: new Date(now.getTime() - LAST_SEEN_WRITE_INTERVAL_MS),
        },
      },
      data: { lastSeenAt: now },
    });
    session.lastSeenAt = now;
  }
  return { session, legacy: false };
}
