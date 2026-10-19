import { Router } from "express";
import * as activityController from "../controllers/activity.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { validateMiddleware } from "../middlewares/validate.middleware";
import { listActivityQuerySchema } from "../schemas/activity.schema";

const router = Router();

router.use(authMiddleware);

// Timeline beranda: transaksi dan transfer dalam satu daftar.
router.get(
  "/",
  validateMiddleware(listActivityQuerySchema),
  activityController.list,
);

export default router;
