import { Router } from "express";
import * as categoryController from "../controllers/category.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { validateMiddleware } from "../middlewares/validate.middleware";
import { idParamSchema } from "../schemas/common.schema";
import {
  listCategoryQuerySchema,
  createCategorySchema,
  updateCategorySchema,
} from "../schemas/category.schema";

const router = Router();

router.use(authMiddleware);

router.get(
  "/",
  validateMiddleware(listCategoryQuerySchema),
  categoryController.list,
);

router.post(
  "/",
  validateMiddleware(createCategorySchema),
  categoryController.create,
);

router.patch(
  "/:id",
  validateMiddleware(updateCategorySchema),
  categoryController.update,
);

router.delete(
  "/:id",
  validateMiddleware(idParamSchema),
  categoryController.remove,
);

export default router;
