import mongoose from "mongoose";

export function requireAuthServiceReady(_request, response, next) {
  if (!process.env.MONGO_URI || !process.env.JWT_SECRET) {
    return response.status(503).json({
      message:
        "Authentication server is not configured. Set MONGO_URI and JWT_SECRET, then restart the backend.",
    });
  }

  if (process.env.JWT_SECRET.length < 32) {
    return response.status(503).json({
      message: "Authentication server configuration is invalid. JWT_SECRET must contain at least 32 characters.",
    });
  }

  if (mongoose.connection.readyState !== 1) {
    return response.status(503).json({
      message: "Authentication database is unavailable. Check the MongoDB connection and try again.",
    });
  }

  return next();
}
