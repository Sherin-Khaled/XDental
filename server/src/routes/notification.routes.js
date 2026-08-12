import { Router } from "express";
import {
  getMyNotifications,
  getPushConfiguration,
  markAllNotificationsRead,
  markNotificationRead,
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
} from "../controllers/notification.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { pushSubscriptionMutationRateLimit } from "../middleware/rateLimit.middleware.js";
import { requireAuthServiceReady } from "../middleware/serviceReady.middleware.js";

const router = Router();
router.use(requireAuthServiceReady, requireAuth);
router.get("/my", getMyNotifications);
router.get("/push/config", getPushConfiguration);
router.put("/push/subscription", pushSubscriptionMutationRateLimit, subscribeToPushNotifications);
router.delete("/push/subscription", pushSubscriptionMutationRateLimit, unsubscribeFromPushNotifications);
router.patch("/read-all", markAllNotificationsRead);
router.patch("/:id/read", markNotificationRead);
export default router;
