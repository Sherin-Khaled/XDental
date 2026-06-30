import jwt from "jsonwebtoken";

export const AUTH_COOKIE_NAME = "x_dental_auth";
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

export function createToken(userId) {
  return jwt.sign({ sub: userId }, process.env.JWT_SECRET, { expiresIn: "7d" });
}

export function getAuthCookieOptions() {
  const isProduction = process.env.NODE_ENV === "production";
  const productionSameSite =
    process.env.COOKIE_SAME_SITE?.toLowerCase() === "lax" ? "lax" : "none";

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? productionSameSite : "lax",
    path: "/",
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
