import { Router } from "express";
import * as goalController from "../controllers/goal.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { validateMiddleware } from "../middlewares/validate.middleware";
import { idParamSchema } from "../schemas/common.schema";
import {
  createGoalSchema,
  updateGoalSchema,
  listGoalQuerySchema,
} from "../schemas/goal.schema";

const router = Router();

router.use(authMiddleware);

router.post("/", validateMiddleware(createGoalSchema), goalController.create);

router.get("/", validateMiddleware(listGoalQuerySchema), goalController.list);

router.get(
  "/:id",
  validateMiddleware(idParamSchema),
  goalController.detail,
);

// Analisis gap beserta rekomendasi penambahan income (F-05, F-06).
router.get(
  "/:id/gap",
  validateMiddleware(idParamSchema),
  goalController.gap,
);

router.patch(
  "/:id",
  validateMiddleware(updateGoalSchema),
  goalController.update,
);

router.delete(
  "/:id",
  validateMiddleware(idParamSchema),
  goalController.remove,
);

export default router;
