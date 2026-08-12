import { Router } from "express";
import { createQuote, getMyQuote, getMyQuotes } from "../controllers/quote.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { quoteCreationRateLimit } from "../middleware/rateLimit.middleware.js";
import { requireAuthServiceReady } from "../middleware/serviceReady.middleware.js";

const router = Router();
router.use(requireAuthServiceReady, requireAuth);
router.use((request, response, next) => {
  if (request.user.role !== "customer") {
    return response.status(403).json({ message: "Customer access is required." });
  }
  return next();
});
router.post("/", quoteCreationRateLimit, createQuote);
router.get("/my", getMyQuotes);
router.get("/my/:id", getMyQuote);
export default router;
