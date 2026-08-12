import { Router } from "express";
import { createContactMessage } from "../controllers/contact.controller.js";
import { attachUserIfAuthenticated } from "../middleware/auth.middleware.js";
import { contactMessageRateLimit } from "../middleware/rateLimit.middleware.js";
import { requireAuthServiceReady } from "../middleware/serviceReady.middleware.js";

const router = Router();
router.post("/", contactMessageRateLimit, requireAuthServiceReady, attachUserIfAuthenticated, createContactMessage);
export default router;
