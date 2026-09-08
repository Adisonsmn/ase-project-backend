import { Router } from "express";
import * as userController from "../controllers/user.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { validateMiddleware } from "../middlewares/validate.middleware";
import { updateMeSchema } from "../schemas/user.schema";

const router = Router();

router.use(authMiddleware);

router.get("/me", userController.getMe);
router.patch(
  "/me",
  validateMiddleware(updateMeSchema),
  userController.updateMe,
);

export default router;
