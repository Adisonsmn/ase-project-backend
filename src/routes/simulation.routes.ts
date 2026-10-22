import { Router } from "express";
import * as simulationController from "../controllers/simulation.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { validateMiddleware } from "../middlewares/validate.middleware";
import { idParamSchema } from "../schemas/common.schema";
import {
  instrumentCodeParamSchema,
  instrumentHistorySchema,
  listInstrumentQuerySchema,
  listSessionQuerySchema,
  purchaseSchema,
} from "../schemas/simulation.schema";

const router = Router();

// Daftar dan grafik instrumen tidak butuh akun, sama seperti artikel: calon
// user bisa melihat isi game dulu. Bermain (sesi) butuh login.
router.get(
  "/instruments",
  validateMiddleware(listInstrumentQuerySchema),
  simulationController.listInstruments,
);

router.get(
  "/instruments/:code",
  validateMiddleware(instrumentCodeParamSchema),
  simulationController.instrumentDetail,
);

router.get(
  "/instruments/:code/history",
  validateMiddleware(instrumentHistorySchema),
  simulationController.instrumentHistory,
);

router.use("/sessions", authMiddleware);

// Estimasi pembelian tanpa menyimpan; didaftarkan sebelum "/sessions/:id".
router.post(
  "/sessions/preview",
  validateMiddleware(purchaseSchema),
  simulationController.preview,
);

router.post(
  "/sessions",
  validateMiddleware(purchaseSchema),
  simulationController.createSession,
);

router.get(
  "/sessions",
  validateMiddleware(listSessionQuerySchema),
  simulationController.listSessions,
);

router.get(
  "/sessions/:id",
  validateMiddleware(idParamSchema),
  simulationController.sessionDetail,
);

router.post(
  "/sessions/:id/advance",
  validateMiddleware(idParamSchema),
  simulationController.advance,
);

export default router;
