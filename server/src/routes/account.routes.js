import { Router } from "express";
import {
  getAccountPreferences,
  getMyVipBenefits,
  updateAccountPreferences,
} from "../controllers/account.controller.js";
import {
  cancelMyAccountActionRequest,
  createMyAccountActionRequest,
  getMyAccountActionRequest,
  getMyAccountActionRequests,
} from "../controllers/accountActionRequest.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireAuthServiceReady } from "../middleware/serviceReady.middleware.js";
import { getMyLoyalty } from "../controllers/loyalty.controller.js";

const router = Router();
router.use(requireAuthServiceReady, requireAuth);
router.get("/preferences", getAccountPreferences);
router.get("/vip-benefits", getMyVipBenefits);
router.get("/loyalty", getMyLoyalty);
router.patch("/preferences", updateAccountPreferences);
router.get("/action-requests", getMyAccountActionRequests);
router.post("/action-requests", createMyAccountActionRequest);
router.get("/action-requests/:id", getMyAccountActionRequest);
router.post("/action-requests/:id/cancel", cancelMyAccountActionRequest);

export default router;
