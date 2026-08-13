import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import { getDatabaseHealth } from "./config/db.js";
import authRoutes from "./routes/auth.routes.js";
import accountRoutes from "./routes/account.routes.js";
import loyaltyRoutes from "./routes/loyalty.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import notificationRoutes from "./routes/notification.routes.js";
import orderRoutes from "./routes/order.routes.js";
import productRequestRoutes from "./routes/productRequest.routes.js";
import quoteRoutes from "./routes/quote.routes.js";
import supportRoutes from "./routes/support.routes.js";
import catalogRoutes from "./routes/catalog.routes.js";
import contactRoutes from "./routes/contact.routes.js";
import newsletterRoutes from "./routes/newsletter.routes.js";
import deliveryRoutes from "./routes/delivery.routes.js";
import promotionRoutes from "./routes/promotion.routes.js";
import cartRoutes from "./routes/cart.routes.js";
import wishlistRoutes from "./routes/wishlist.routes.js";
import supplyListRoutes from "./routes/supplyList.routes.js";
import {
  PROFILE_IMAGE_DIRECTORY,
  PROFILE_IMAGE_PUBLIC_PREFIX,
  PRODUCT_IMAGE_DIRECTORY,
  PRODUCT_IMAGE_PUBLIC_PREFIX,
  HERO_IMAGE_DIRECTORY,
  HERO_IMAGE_PUBLIC_PREFIX,
} from "./config/uploads.js";
import {
  addRequestId,
  addSecurityHeaders,
  logServerError,
  preventPrivateCaching,
} from "./middleware/security.middleware.js";
import { clearAuthCookieOnFailure } from "./middleware/auth.middleware.js";
import { getClientOrigins } from "./config/server.js";

const JSON_BODY_LIMIT = "20kb";
const PRIVATE_API_PATHS = [
  "/api/auth",
  "/api/account",
  "/api/admin",
  "/api/cart",
  "/api/wishlist",
  "/api/supply-lists",
  "/api/notifications",
  "/api/orders",
  "/api/product-requests",
  "/api/quotes",
  "/api/support",
  "/api/delivery-offers",
  "/api/delivery-zones/my",
];

function normalizeOrigin(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function createApp({
  allowedOrigins = getClientOrigins(process.env),
  production = process.env.NODE_ENV === "production",
} = {}) {
  const app = express();

  if (production) {
    app.set("trust proxy", 1);
  }

  app.disable("x-powered-by");
  app.use(addRequestId);
  app.use(addSecurityHeaders);
  app.use(
    cors((request, callback) => {
      const requestOrigin = request.get("Origin");
      if (!requestOrigin) {
        return callback(null, { origin: false, credentials: false });
      }

      if (allowedOrigins.includes(normalizeOrigin(requestOrigin))) {
        return callback(null, { origin: requestOrigin, credentials: true });
      }

      const error = new Error("Origin is not allowed by CORS.");
      error.code = "CORS_ORIGIN_DENIED";
      return callback(error);
    })
  );
  app.use(
    PROFILE_IMAGE_PUBLIC_PREFIX,
    express.static(PROFILE_IMAGE_DIRECTORY, {
      dotfiles: "deny",
      fallthrough: true,
      immutable: true,
      index: false,
      maxAge: "1d",
    })
  );
  app.use(
    PRODUCT_IMAGE_PUBLIC_PREFIX,
    express.static(PRODUCT_IMAGE_DIRECTORY, {
      dotfiles: "deny",
      fallthrough: true,
      immutable: true,
      index: false,
      maxAge: "1d",
    })
  );
  app.use(
    HERO_IMAGE_PUBLIC_PREFIX,
    express.static(HERO_IMAGE_DIRECTORY, {
      dotfiles: "deny",
      fallthrough: true,
      immutable: true,
      index: false,
      maxAge: "1d",
    })
  );
  app.use(
    ["/api/auth/login", "/api/auth/register"],
    clearAuthCookieOnFailure
  );
  app.use(express.json({ limit: JSON_BODY_LIMIT }));
  app.use(cookieParser());
  app.use(PRIVATE_API_PATHS, preventPrivateCaching);

  app.get("/api/health", async (_request, response) => {
    const database = await getDatabaseHealth();
    const statusCode = database.status === "connected" ? 200 : 503;
    return response.status(statusCode).json({
      server: { status: "ok" },
      database,
    });
  });

  app.use("/api", catalogRoutes);
  app.use("/api", deliveryRoutes);
  app.use("/api", promotionRoutes);
  app.use("/api/auth", authRoutes);
  app.use("/api/account", accountRoutes);
  app.use("/api/loyalty", loyaltyRoutes);
  app.use("/api/cart", cartRoutes);
  app.use("/api/wishlist", wishlistRoutes);
  app.use("/api/supply-lists", supplyListRoutes);
  app.use("/api/product-requests", productRequestRoutes);
  app.use("/api/support", supportRoutes);
  app.use("/api/notifications", notificationRoutes);
  app.use("/api/orders", orderRoutes);
  app.use("/api/quotes", quoteRoutes);
  app.use("/api/contact", contactRoutes);
  app.use("/api/newsletter", newsletterRoutes);
  app.use("/api/admin", adminRoutes);

  app.use((_request, response) => {
    response.status(404).json({ message: "Endpoint not found." });
  });

  app.use((error, request, response, next) => {
    if (response.headersSent) return next(error);

    if (error?.type === "entity.too.large") {
      return response.status(413).json({ message: "Request body is too large." });
    }

    if (error?.type === "entity.parse.failed") {
      return response.status(400).json({ message: "Request body must contain valid JSON." });
    }

    if (error?.code === "CORS_ORIGIN_DENIED") {
      return response.status(403).json({ message: "Origin is not allowed." });
    }

    if (typeof error?.name === "string" && error.name.startsWith("Prisma")) {
      logServerError(error, request, 503);
      return response.status(503).json({
        message: "Database service is temporarily unavailable.",
        requestId: request.id,
      });
    }

    logServerError(error, request, 500);
    return response.status(500).json({
      message: "An unexpected server error occurred.",
      requestId: request.id,
    });
  });

  return app;
}
