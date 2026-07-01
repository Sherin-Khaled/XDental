import { isDatabaseReady } from "../config/db.js";

export function requireAuthServiceReady(_request, response, next) {
  if (!process.env.DATABASE_URL || !process.env.JWT_SECRET) {
    return response.status(503).json({
      message:
        "Authentication server is not configured. Set DATABASE_URL and JWT_SECRET, then restart the backend.",
    });
  }

  if (process.env.JWT_SECRET.length < 32) {
    return response.status(503).json({
      message: "Authentication server configuration is invalid. JWT_SECRET must contain at least 32 characters.",
    });
  }

  if (!isDatabaseReady()) {
    return response.status(503).json({
      message: "Authentication database is unavailable. Check the PostgreSQL connection and try again.",
    });
  }

  return next();
}
