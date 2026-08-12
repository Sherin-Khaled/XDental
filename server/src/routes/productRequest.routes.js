import { Router } from "express";
import {
  cancelMyProductRequest,
  createProductRequest,
  getMyProductRequest,
  getMyProductRequests,
  updateMyProductRequestDetails,
} from "../controllers/productRequest.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { productRequestCreationRateLimit } from "../middleware/rateLimit.middleware.js";
import { requireAuthServiceReady } from "../middleware/serviceReady.middleware.js";

const router = Router();
router.use(requireAuthServiceReady, requireAuth);
router.post("/", productRequestCreationRateLimit, createProductRequest);
router.get("/my", getMyProductRequests);
router.get("/my/:id", getMyProductRequest);
router.patch("/my/:id/cancel", cancelMyProductRequest);
router.patch("/my/:id/details", updateMyProductRequestDetails);
export default router;
