import { Router } from "express";
import {
  getMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../controllers/notification.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireAuthServiceReady } from "../middleware/serviceReady.middleware.js";

const router = Router();
router.use(requireAuthServiceReady, requireAuth);
router.get("/my", getMyNotifications);
router.patch("/read-all", markAllNotificationsRead);
router.patch("/:id/read", markNotificationRead);
export default router;
