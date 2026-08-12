import { Router } from "express";
import { subscribeToNewsletter } from "../controllers/newsletter.controller.js";
import { newsletterSubscribeRateLimit } from "../middleware/rateLimit.middleware.js";
import { requireAuthServiceReady } from "../middleware/serviceReady.middleware.js";

const router = Router();
router.post("/subscribe", newsletterSubscribeRateLimit, requireAuthServiceReady, subscribeToNewsletter);
export default router;
