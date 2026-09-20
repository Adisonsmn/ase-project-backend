import { Router } from "express";
import * as savingsController from "../controllers/savings.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { validateMiddleware } from "../middlewares/validate.middleware";
import {
  calculateRatioSchema,
  saveRatioSchema,
} from "../schemas/savings.schema";

const router = Router();

// Preset bersifat statis dan tidak menyangkut data siapa pun, jadi dibiarkan
// publik supaya frontend bisa menampilkan pilihan rasio sebelum user login.
router.get("/ratio/presets", savingsController.presets);

router.use(authMiddleware);

router.post(
  "/ratio/calculate",
  validateMiddleware(calculateRatioSchema),
  savingsController.calculate,
);

router.get("/ratio", savingsController.getRatio);

router.put(
  "/ratio",
  validateMiddleware(saveRatioSchema),
  savingsController.saveRatio,
);

export default router;
