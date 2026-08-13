import { Router } from "express";
import {
  addMyWishlistItem,
  clearMyWishlist,
  getMyWishlist,
  mergeMyWishlist,
  removeMyWishlistItem,
} from "../controllers/wishlist.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { wishlistMutationRateLimit } from "../middleware/rateLimit.middleware.js";
import { requireAuthServiceReady } from "../middleware/serviceReady.middleware.js";

const router = Router();

router.use(requireAuthServiceReady, requireAuth);
router.use((request, response, next) => request.user.role === "customer"
  ? next()
  : response.status(403).json({ message: "Customer access is required." }));
router.get("/", getMyWishlist);
router.post("/items", wishlistMutationRateLimit, addMyWishlistItem);
router.delete("/items/:productId", wishlistMutationRateLimit, removeMyWishlistItem);
router.post("/merge", wishlistMutationRateLimit, mergeMyWishlist);
router.delete("/", wishlistMutationRateLimit, clearMyWishlist);

export default router;
