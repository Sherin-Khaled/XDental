import { Router } from "express";
import {
  getAdminProductRequest,
  getAdminProductRequests,
  updateAdminProductRequestStatus,
} from "../controllers/productRequest.controller.js";
import { getAdminThreads, getThreadMessages, postThreadMessage, updateAdminThreadStatus } from "../controllers/support.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireRoles } from "../middleware/role.middleware.js";
import { requireAuthServiceReady } from "../middleware/serviceReady.middleware.js";

const router = Router();
router.use(requireAuthServiceReady, requireAuth, requireRoles("admin", "support"));
router.get("/product-requests", getAdminProductRequests);
router.get("/product-requests/:id", getAdminProductRequest);
router.patch("/product-requests/:id/status", updateAdminProductRequestStatus);
router.get("/support/threads", getAdminThreads);
router.get("/support/threads/:threadId/messages", getThreadMessages);
router.post("/support/threads/:threadId/messages", postThreadMessage);
router.patch("/support/threads/:threadId/status", updateAdminThreadStatus);
export default router;
