import { Router } from "express";
import {
  createSupportThread,
  getMyThreads,
  getThreadMessages,
  postThreadMessage,
} from "../controllers/support.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireAuthServiceReady } from "../middleware/serviceReady.middleware.js";

const router = Router();
router.use(requireAuthServiceReady, requireAuth);
router.post("/threads", createSupportThread);
router.get("/threads/my", getMyThreads);
router.get("/threads/:threadId/messages", getThreadMessages);
router.post("/threads/:threadId/messages", postThreadMessage);
export default router;
