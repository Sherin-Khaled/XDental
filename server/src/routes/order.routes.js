import { Router } from "express";
import { createOrder, getMyOrder, getMyOrders } from "../controllers/order.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireAuthServiceReady } from "../middleware/serviceReady.middleware.js";

const router = Router();

router.use(requireAuthServiceReady, requireAuth);
router.use((request, response, next) => {
  if (request.user.role !== "customer") {
    return response.status(403).json({ message: "Customer access is required." });
  }
  return next();
});
router.post("/", createOrder);
router.get("/my", getMyOrders);
router.get("/my/:id", getMyOrder);

export default router;
