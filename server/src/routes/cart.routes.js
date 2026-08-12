import { Router } from "express";
import {
  addMyCartItem,
  clearMyCart,
  getMyCart,
  mergeMyCart,
  removeMyCartItem,
  updateMyCartItem,
} from "../controllers/cart.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireAuthServiceReady } from "../middleware/serviceReady.middleware.js";
import { cartMutationRateLimit } from "../middleware/rateLimit.middleware.js";

const router = Router();

router.use(requireAuthServiceReady, requireAuth);
router.get("/", getMyCart);
router.post("/items", cartMutationRateLimit, addMyCartItem);
router.patch("/items/:productId", cartMutationRateLimit, updateMyCartItem);
router.delete("/items/:productId", cartMutationRateLimit, removeMyCartItem);
router.post("/merge", cartMutationRateLimit, mergeMyCart);
router.delete("/", cartMutationRateLimit, clearMyCart);

export default router;
