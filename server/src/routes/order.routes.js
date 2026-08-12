import { Router } from "express";
import { createOrder, getMyOrder, getMyOrders, previewOrderTotals, previewPublicCoupon, trackPublicOrder } from "../controllers/order.controller.js";
import { attachUserIfAuthenticated, requireAuth } from "../middleware/auth.middleware.js";
import { couponValidationRateLimit, orderCreationRateLimit, publicOrderTrackingRateLimit } from "../middleware/rateLimit.middleware.js";
import { requireAuthServiceReady } from "../middleware/serviceReady.middleware.js";

const router = Router();

router.post("/track", publicOrderTrackingRateLimit, trackPublicOrder);
router.post(
  "/coupon-preview",
  couponValidationRateLimit,
  attachUserIfAuthenticated,
  previewPublicCoupon
);

router.use(requireAuthServiceReady, requireAuth);
router.use((request, response, next) => {
  if (request.user.role !== "customer") {
    return response.status(403).json({ message: "Customer access is required." });
  }
  return next();
});
router.post("/", orderCreationRateLimit, createOrder);
router.post("/preview", previewOrderTotals);
router.get("/my", getMyOrders);
router.get("/my/:id", getMyOrder);

export default router;
