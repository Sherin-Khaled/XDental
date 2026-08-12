import { Router } from "express";
import {
  createSupportThread,
  getMyThreads,
  getThreadMessages,
  postThreadMessage,
} from "../controllers/support.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { supportMessageRateLimit } from "../middleware/rateLimit.middleware.js";
import { requireAuthServiceReady } from "../middleware/serviceReady.middleware.js";

const router = Router();
router.use(requireAuthServiceReady, requireAuth);
router.post("/threads", supportMessageRateLimit, createSupportThread);
router.get("/threads/my", getMyThreads);
router.get("/threads/:threadId/messages", getThreadMessages);
router.post("/threads/:threadId/messages", supportMessageRateLimit, postThreadMessage);
export default router;
