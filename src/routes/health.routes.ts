import { Router } from "express";
import * as healthController from "../controllers/health.controller";

const router = Router();

// Liveness: proses berjalan.
router.get("/", healthController.live);

// Readiness: proses berjalan DAN database dapat dihubungi.
router.get("/ready", healthController.ready);

export default router;
