import jwt from "jsonwebtoken";

export const AUTH_COOKIE_NAME = "x_dental_auth";
export const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

export function createToken(userId, sessionId) {
  return jwt.sign(
    { sub: userId, ...(sessionId ? { sid: sessionId } : {}) },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

export function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

export function getAuthCookieOptions() {
  const isProduction = process.env.NODE_ENV === "production";
  const configuredSameSite = process.env.COOKIE_SAME_SITE?.trim().toLowerCase();
  const productionSameSite = ["lax", "strict", "none"].includes(configuredSameSite)
    ? configuredSameSite
    : "lax";

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? productionSameSite : "lax",
    path: "/",
    priority: "high",
  };
}

export function setAuthCookie(response, token) {
  response.cookie(AUTH_COOKIE_NAME, token, {
    ...getAuthCookieOptions(),
    maxAge: SESSION_DURATION_MS,
  });
}

export function clearAuthCookie(response) {
  response.clearCookie(AUTH_COOKIE_NAME, getAuthCookieOptions());
}
