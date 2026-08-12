import { Router } from "express";
import {
  getActiveDeliveryZones,
  getMyClinicLocations,
  getMyMatchingDeliveryOffers,
  updateMyClinicLocations,
} from "../controllers/delivery.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireAuthServiceReady } from "../middleware/serviceReady.middleware.js";

const router = Router();

router.get("/delivery-zones", requireAuthServiceReady, getActiveDeliveryZones);
router.get("/delivery-zones/my", requireAuthServiceReady, requireAuth, getMyClinicLocations);
router.put("/delivery-zones/my", requireAuthServiceReady, requireAuth, updateMyClinicLocations);
router.get("/delivery-offers/my", requireAuthServiceReady, requireAuth, getMyMatchingDeliveryOffers);

export default router;
