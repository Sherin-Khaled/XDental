import {
  listActiveAuthSessions,
  revokeAuthSession,
  revokeOtherAuthSessions,
} from "../services/authSession.service.js";
import { clearAuthCookie } from "../utils/createToken.js";

export async function getMySessions(request, response) {
  const currentSessionId = request.authSession?.id ?? null;
  const sessions = await listActiveAuthSessions({
    userId: request.user.id,
    currentSessionId,
  });
  return response.json({
    sessions,
    currentSessionId,
    legacyCurrentSession: Boolean(request.legacySession),
  });
}

export async function revokeMySession(request, response) {
  const sessionId = request.params.sessionId;
  if (typeof sessionId !== "string" || sessionId.length < 20 || sessionId.length > 100) {
    return response.status(400).json({ message: "Invalid session identifier." });
  }

  const result = await revokeAuthSession({
    userId: request.user.id,
    sessionId,
  });
  if (result.count === 0) {
    return response.status(404).json({ message: "Active session not found." });
  }

  const currentSessionRevoked = request.authSession?.id === sessionId;
  if (currentSessionRevoked) clearAuthCookie(response);
  return response.json({ revoked: true, currentSessionRevoked });
}

export async function logoutOtherSessions(request, response) {
  if (!request.authSession?.id) {
    return response.status(409).json({
      message: "Sign in again once to manage other devices securely.",
    });
  }
  const result = await revokeOtherAuthSessions({
    userId: request.user.id,
    currentSessionId: request.authSession.id,
  });
  return response.json({ revokedCount: result.count });
}
