import express, { Router } from "express";
import {
  changePassword,
  login,
  logout,
  me,
  register,
  updateMe,
  uploadProfileImage,
} from "../controllers/auth.controller.js";
import {
  getMySessions,
  logoutOtherSessions,
  revokeMySession,
} from "../controllers/session.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import {
  loginRateLimit,
  passwordActionRateLimit,
  registerRateLimit,
} from "../middleware/rateLimit.middleware.js";
import { requireAuthServiceReady } from "../middleware/serviceReady.middleware.js";

const router = Router();
const profileImageBody = express.raw({
  type: () => true,
  limit: "5mb",
});

router.post(
  "/register",
  registerRateLimit,
  requireAuthServiceReady,
  register
);
router.post(
  "/login",
  loginRateLimit,
  requireAuthServiceReady,
  login
);
router.post("/logout", logout);
router.get("/me", requireAuthServiceReady, requireAuth, me);
router.patch("/me", requireAuthServiceReady, requireAuth, updateMe);
router.put(
  "/me/profile-image",
  requireAuthServiceReady,
  requireAuth,
  profileImageBody,
  uploadProfileImage
);
router.post("/change-password", passwordActionRateLimit, requireAuthServiceReady, requireAuth, changePassword);
router.get("/sessions", requireAuthServiceReady, requireAuth, getMySessions);
router.delete("/sessions/:sessionId", requireAuthServiceReady, requireAuth, revokeMySession);
router.post("/sessions/logout-others", requireAuthServiceReady, requireAuth, logoutOtherSessions);

export default router;
