import { Router } from "express";
import { login, logout, me, register } from "../controllers/auth.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireAuthServiceReady } from "../middleware/serviceReady.middleware.js";

const router = Router();

router.post("/register", requireAuthServiceReady, register);
router.post("/login", requireAuthServiceReady, login);
router.post("/logout", logout);
router.get("/me", requireAuthServiceReady, requireAuth, me);

export default router;
