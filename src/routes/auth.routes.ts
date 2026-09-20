import { Router } from "express";
import * as authController from "../controllers/auth.controller";
import { validateMiddleware } from "../middlewares/validate.middleware";
import {
  authLimiter,
  registerLimiter,
} from "../middlewares/rate-limit.middleware";
import {
  registerSchema,
  loginSchema,
  refreshSchema,
} from "../schemas/auth.schema";

const router = Router();

router.post(
  "/register",
  registerLimiter,
  validateMiddleware(registerSchema),
  authController.register,
);

router.post(
  "/login",
  authLimiter,
  validateMiddleware(loginSchema),
  authController.login,
);

router.post(
  "/refresh",
  authLimiter,
  validateMiddleware(refreshSchema),
  authController.refresh,
);

// Logout tidak dibatasi authLimiter: gagal logout tidak membocorkan kredensial,
// dan pembatasan justru bisa menahan user keluar dari sesinya.
router.post(
  "/logout",
  validateMiddleware(refreshSchema),
  authController.logout,
);

export default router;
