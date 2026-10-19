import { Router } from "express";
import * as transferController from "../controllers/transfer.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { validateMiddleware } from "../middlewares/validate.middleware";
import { idParamSchema } from "../schemas/common.schema";
import {
  createTransferSchema,
  updateTransferSchema,
} from "../schemas/transfer.schema";

const router = Router();

router.use(authMiddleware);

// Tidak ada GET: transfer dibaca lewat GET /activities bersama transaksi.
router.post(
  "/",
  validateMiddleware(createTransferSchema),
  transferController.create,
);

router.patch(
  "/:id",
  validateMiddleware(updateTransferSchema),
  transferController.update,
);

router.delete(
  "/:id",
  validateMiddleware(idParamSchema),
  transferController.remove,
);

export default router;
