import { Router } from "express";
import { getPublicLoyaltySettings } from "../controllers/loyalty.controller.js";

const router = Router();

router.get("/settings", getPublicLoyaltySettings);

export default router;
