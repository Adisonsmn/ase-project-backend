import { Router } from "express";
import * as transactionController from "../controllers/transaction.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { validateMiddleware } from "../middlewares/validate.middleware";
import { idParamSchema } from "../schemas/common.schema";
import {
  createTransactionSchema,
  updateTransactionSchema,
  listTransactionQuerySchema,
  summaryQuerySchema,
} from "../schemas/transaction.schema";

const router = Router();

router.use(authMiddleware);

// Didaftarkan sebelum "/:id" supaya "summary" tidak tertangkap sebagai id.
router.get(
  "/summary",
  validateMiddleware(summaryQuerySchema),
  transactionController.summary,
);

router.post(
  "/",
  validateMiddleware(createTransactionSchema),
  transactionController.create,
);

router.get(
  "/",
  validateMiddleware(listTransactionQuerySchema),
  transactionController.list,
);

router.get(
  "/:id",
  validateMiddleware(idParamSchema),
  transactionController.detail,
);

router.patch(
  "/:id",
  validateMiddleware(updateTransactionSchema),
  transactionController.update,
);

router.delete(
  "/:id",
  validateMiddleware(idParamSchema),
  transactionController.remove,
);

export default router;
