import { Router } from "express";
import * as accountController from "../controllers/account.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { validateMiddleware } from "../middlewares/validate.middleware";
import { idParamSchema } from "../schemas/common.schema";
import {
  createAccountSchema,
  listAccountQuerySchema,
  updateAccountSchema,
} from "../schemas/account.schema";

const router = Router();

router.use(authMiddleware);

router.get(
  "/",
  validateMiddleware(listAccountQuerySchema),
  accountController.list,
);

router.post(
  "/",
  validateMiddleware(createAccountSchema),
  accountController.create,
);

router.patch(
  "/:id",
  validateMiddleware(updateAccountSchema),
  accountController.update,
);

router.delete(
  "/:id",
  validateMiddleware(idParamSchema),
  accountController.remove,
);

export default router;
