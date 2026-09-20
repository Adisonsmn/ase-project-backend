import { Router } from "express";
import * as goalController from "../controllers/goal.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { validateMiddleware } from "../middlewares/validate.middleware";
import { listIncomeIdeaQuerySchema } from "../schemas/goal.schema";

const router = Router();

router.use(authMiddleware);

// Butuh auth karena kelompok usia diambil dari profil user kalau tidak
// disebutkan lewat query.
router.get(
  "/",
  validateMiddleware(listIncomeIdeaQuerySchema),
  goalController.incomeIdeas,
);

export default router;
