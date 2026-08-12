import { Router } from "express";
import { getPublicScheduledPromotions } from "../controllers/scheduledPromotion.controller.js";

const router = Router();

router.get("/promotions", getPublicScheduledPromotions);

export default router;
