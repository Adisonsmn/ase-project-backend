import { Router } from "express";
import * as authController from "../controllers/auth.controller";
import { validateMiddleware } from "../middlewares/validate.middleware";
import {
  registerSchema,
  loginSchema,
  refreshSchema,
} from "../schemas/auth.schema";

const router = Router();

router.post(
  "/register",
  validateMiddleware(registerSchema),
  authController.register,
);

router.post(
  "/login",
  validateMiddleware(loginSchema),
  authController.login,
);

router.post(
  "/refresh",
  validateMiddleware(refreshSchema),
  authController.refresh,
);

router.post(
  "/logout",
  validateMiddleware(refreshSchema),
  authController.logout,
);

export default router;
