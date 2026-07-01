import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import { getDatabaseHealth } from "./config/db.js";
import authRoutes from "./routes/auth.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import notificationRoutes from "./routes/notification.routes.js";
import productRequestRoutes from "./routes/productRequest.routes.js";
import supportRoutes from "./routes/support.routes.js";

function getAllowedOrigins() {
  return (process.env.CLIENT_URL ?? "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean);
}

export function createApp() {
  const app = express();
  const allowedOrigins = getAllowedOrigins();

  if (process.env.NODE_ENV === "production") {
    app.set("trust proxy", 1);
  }

  app.disable("x-powered-by");
  app.use(
    cors({
      credentials: true,
      origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin.replace(/\/$/, ""))) {
          return callback(null, true);
        }
        return callback(new Error("Origin is not allowed by CORS."));
      },
    })
  );
  app.use(express.json({ limit: "20kb" }));
  app.use(cookieParser());

  app.get("/api/health", async (_request, response) => {
    const database = await getDatabaseHealth();
    const statusCode = database.status === "connected" ? 200 : 503;
    return response.status(statusCode).json({
      server: { status: "ok" },
      database,
    });
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/product-requests", productRequestRoutes);
  app.use("/api/support", supportRoutes);
  app.use("/api/notifications", notificationRoutes);
  app.use("/api/admin", adminRoutes);

  app.use((_request, response) => {
    response.status(404).json({ message: "Endpoint not found." });
  });

  app.use((error, _request, response, _next) => {
    if (error?.type === "entity.parse.failed") {
      return response.status(400).json({ message: "Request body must contain valid JSON." });
    }

    if (error?.message === "Origin is not allowed by CORS.") {
      return response.status(403).json({ message: "Origin is not allowed." });
    }

    if (typeof error?.name === "string" && error.name.startsWith("Prisma")) {
      return response.status(503).json({
        message: "Authentication database is unavailable. Check the PostgreSQL connection and try again.",
      });
    }

    return response.status(500).json({ message: "An unexpected server error occurred." });
  });

  return app;
}
