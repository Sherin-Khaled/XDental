import { Router } from "express";
import {
  createMySupplyList,
  deleteMySupplyList,
  duplicateMySupplyList,
  getMySupplyList,
  getMySupplyLists,
  mergeMySupplyListItems,
  replaceMySupplyListItems,
} from "../controllers/supplyList.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { supplyListMutationRateLimit } from "../middleware/rateLimit.middleware.js";
import { requireAuthServiceReady } from "../middleware/serviceReady.middleware.js";

const router = Router();

router.use(requireAuthServiceReady, requireAuth);
router.get("/", getMySupplyLists);
router.post("/", supplyListMutationRateLimit, createMySupplyList);
router.get("/:id", getMySupplyList);
router.post(
  "/:id/duplicate",
  supplyListMutationRateLimit,
  duplicateMySupplyList
);
router.put(
  "/:id/items",
  supplyListMutationRateLimit,
  replaceMySupplyListItems
);
router.post(
  "/:id/items/merge",
  supplyListMutationRateLimit,
  mergeMySupplyListItems
);
router.delete("/:id", supplyListMutationRateLimit, deleteMySupplyList);

export default router;
